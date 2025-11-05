/**
 * 10분 간격 실행: not_arrived 상태를 유예 기간 후 absent_unexcused로 확정
 *
 * 참고:
 * - ATTENDANCE_SLOT_IMPLEMENTATION_PLAN.md Day 6
 * - 사용자 제안: "5분 유예 기간 시스템"
 *
 * 동작:
 * 1. not_arrived 상태 레코드 조회
 * 2. 수업 종료 시간 + 30분 + 5분(유예) 지난 레코드 필터링
 * 3. absent_unexcused로 상태 변경
 * 4. 정밀한 시간 로깅 (확정 시간 + 처리 시간)
 *
 * Grace Period:
 * - 학생이 not_arrived 상태에서도 PIN 입력 가능 (늦은 체크인)
 * - 유예 기간 내 PIN 입력 시 checked_in으로 자동 복구 (지각 처리)
 * - 유예 기간 초과 시에만 absent_unexcused 확정
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import {
  getTodayInKorea,
  getCurrentKoreaMinutes,
  parseTimeToMinutes,
  minutesToTime
} from "../utils/timeUtils";

// 유예 기간 설정 (분 단위)
const GRACE_PERIOD_MINUTES = 5;

export const markAbsentUnexcused = onSchedule({
  schedule: "*/10 * * * *", // 10분마다
  timeZone: "Asia/Seoul",
  region: "asia-northeast3",
  timeoutSeconds: 120,
  memory: "512MiB"
}, async () => {
  const db = admin.firestore();
  const today = getTodayInKorea();
  const currentMinutes = getCurrentKoreaMinutes();
  const timestamp = admin.firestore.Timestamp.now();

  logger.info(`[결석 확정 시작] ${today} ${minutesToTime(currentMinutes)}`);

  try {
    const usersSnapshot = await db.collection("users").get();
    let totalConfirmed = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      try {
        // not_arrived 상태 레코드 조회
        const notArrivedRecords = await db
          .collection("users")
          .doc(userId)
          .collection("student_attendance_records")
          .where("date", "==", today)
          .where("status", "==", "not_arrived")
          .get();

        if (notArrivedRecords.empty) continue;

        const batch = db.batch();
        let batchCount = 0;

        for (const doc of notArrivedRecords.docs) {
          const record = doc.data();
          const slotEndMinutes = parseTimeToMinutes(record.expectedDepartureTime);

          // 유예 기간 종료 시간 계산
          // 예: 수업 종료 12:00 → 12:00 + 30분(기본) + 5분(유예) = 12:35
          const graceEndMinutes = slotEndMinutes + 30 + GRACE_PERIOD_MINUTES;

          // 유예 기간이 지났으면 absent_unexcused 확정
          if (currentMinutes > graceEndMinutes) {
            // 유예 종료 시점의 정확한 Timestamp 계산
            const graceEndTime = new Date(record.notArrivedAt.toDate());
            graceEndTime.setMinutes(
              graceEndTime.getMinutes() +
              (slotEndMinutes - parseTimeToMinutes(record.expectedArrivalTime)) +
              30 +
              GRACE_PERIOD_MINUTES
            );

            batch.update(doc.ref, {
              status: "absent_unexcused",
              absentConfirmedAt: admin.firestore.Timestamp.fromDate(graceEndTime), // 유예 종료 시간
              absentMarkedAt: timestamp, // 실제 배치 처리 시간
              updatedAt: timestamp
            });
            batchCount++;

            logger.info(
              `[결석 확정] userId=${userId}, studentId=${record.studentId}, ` +
              `slot=${record.expectedArrivalTime}-${record.expectedDepartureTime}, ` +
              `confirmedAt=${graceEndTime.toISOString()}`
            );
          }
        }

        if (batchCount > 0) {
          await batch.commit();
          totalConfirmed += batchCount;
        }
      } catch (userError) {
        logger.error(`[사용자 오류] userId=${userId}`, userError);
        continue;
      }
    }

    logger.info(
      `[결석 확정 완료] ${today} ${minutesToTime(currentMinutes)} - ` +
      `총 ${totalConfirmed}건 확정`
    );
  } catch (error) {
    logger.error(`[결석 확정 오류] ${today}`, error);
    throw error;
  }
});
