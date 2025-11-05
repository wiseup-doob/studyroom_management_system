/**
 * 매일 새벽 2시 실행: 오늘 출석 레코드 사전 생성
 *
 * 참고:
 * - ATTENDANCE_REFACTORING_PLAN.md Phase 2
 * - ATTENDANCE_IMPLEMENTATION_STATUS.md Day 2
 *
 * 동작:
 * 1. 모든 사용자의 활성 좌석 배정 조회
 * 2. 각 학생의 시간표에서 오늘 출석 의무 슬롯 추출 (class, self_study만)
 * 3. 슬롯별로 출석 레코드 생성 (status: "scheduled")
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import {
  getTodayInKorea,
  getCurrentKoreaDayOfWeek
} from "../utils/timeUtils";

export const createDailyAttendanceRecords = onSchedule({
  schedule: "0 2 * * *", // 매일 02:00 (Asia/Seoul 기준)
  timeZone: "Asia/Seoul",
  region: "asia-northeast3",
  timeoutSeconds: 540, // 9분 (Cloud Functions v2 최대값)
  memory: "1GiB"
}, async () => {
  const db = admin.firestore();
  const today = getTodayInKorea();
  const dayOfWeek = getCurrentKoreaDayOfWeek();

  logger.info(`[배치 시작] ${today} (${dayOfWeek}) 출석 레코드 생성`);

  try {
    // 1. 모든 사용자 조회
    const usersSnapshot = await db.collection("users").get();
    let totalCreated = 0;
    let totalSkipped = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      try {
        // 2. 해당 사용자의 활성 좌석 배정 조회
        const assignmentsSnapshot = await db
          .collection("users")
          .doc(userId)
          .collection("seat_assignments")
          .where("status", "==", "active")
          .get();

        if (assignmentsSnapshot.empty) {
          logger.info(`[SKIP] userId=${userId}: 활성 좌석 배정 없음`);
          continue;
        }

        for (const assignmentDoc of assignmentsSnapshot.docs) {
          const assignment = assignmentDoc.data();
          const { studentId, seatLayoutId, seatId, seatNumber } = assignment;

          // 3. 학생 시간표 조회
          const timetableId = assignment.timetableId;
          if (!timetableId) {
            logger.warn(`[SKIP] userId=${userId}, studentId=${studentId}: timetableId 없음`);
            totalSkipped++;
            continue;
          }

          const timetableDoc = await db
            .collection("users")
            .doc(userId)
            .collection("student_timetables")
            .doc(timetableId)
            .get();

          if (!timetableDoc.exists) {
            logger.warn(`[SKIP] userId=${userId}, timetableId=${timetableId}: 시간표 문서 없음`);
            totalSkipped++;
            continue;
          }

          const timetableData = timetableDoc.data();
          const dailySchedule = timetableData?.basicSchedule?.dailySchedules?.[dayOfWeek];

          // 오늘 비활성 날짜면 스킵
          if (!dailySchedule || !dailySchedule.isActive) {
            logger.info(`[SKIP] userId=${userId}, studentId=${studentId}: 오늘(${dayOfWeek}) 비활성`);
            totalSkipped++;
            continue;
          }

          // 4. detailedSchedule에서 출석 의무 슬롯 필터링
          const detailedSchedule = timetableData?.detailedSchedule?.[dayOfWeek];
          if (!detailedSchedule || !detailedSchedule.timeSlots) {
            logger.warn(`[SKIP] userId=${userId}, studentId=${studentId}: detailedSchedule 없음`);
            totalSkipped++;
            continue;
          }

          // type이 "class" 또는 "self_study"인 슬롯만 선택
          // "external"은 출석 체크 대상 아님
          const obligatorySlots = detailedSchedule.timeSlots.filter(
            (slot: any) => slot.type === "class" || slot.type === "self_study"
          );

          if (obligatorySlots.length === 0) {
            logger.info(`[SKIP] userId=${userId}, studentId=${studentId}: 출석 의무 슬롯 없음`);
            totalSkipped++;
            continue;
          }

          // 5. 각 슬롯별로 출석 레코드 생성
          const batch = db.batch();

          for (let i = 0; i < obligatorySlots.length; i++) {
            const slot = obligatorySlots[i];
            const timestamp = admin.firestore.Timestamp.now();

            // recordId: {studentId}_{YYYYMMDD}_slot{N}_{timestamp}
            // 예: "student123_20250131_slot1_1706745600000"
            const recordId = `${studentId}_${today.replace(/-/g, "")}_slot${i + 1}_${timestamp.toMillis()}`;

            const recordRef = db
              .collection("users")
              .doc(userId)
              .collection("student_attendance_records")
              .doc(recordId);

            const recordData: any = {
              id: recordId,
              userId,
              studentId,
              studentName: assignment.studentName || "",
              seatLayoutId,
              seatId,
              seatNumber: seatNumber || "",
              date: today,
              dayOfWeek,

              // ✅ 신규 필드: 시간표 슬롯 정보
              timetableId,
              timeSlotId: slot.id || `slot_${i}`,
              timeSlotSubject: slot.subject || "",
              timeSlotType: slot.type,

              expectedArrivalTime: slot.startTime,
              expectedDepartureTime: slot.endTime,

              status: "scheduled", // ← 초기 상태
              isLate: false,
              isEarlyLeave: false,

              sessionNumber: i + 1, // 슬롯 순서 (1부터 시작)
              isLatestSession: (i === obligatorySlots.length - 1),

              createdAt: timestamp,
              updatedAt: timestamp,
              recordTimestamp: timestamp
            };

            batch.set(recordRef, recordData);
          }

          await batch.commit();
          totalCreated += obligatorySlots.length;
          logger.info(`[성공] userId=${userId}, studentId=${studentId}: ${obligatorySlots.length}개 슬롯 생성`);
        }
      } catch (userError) {
        logger.error(`[사용자 처리 오류] userId=${userId}`, userError);
        // 다른 사용자는 계속 처리
        continue;
      }
    }

    logger.info(`[배치 완료] ${today} - 생성: ${totalCreated}개, 스킵: ${totalSkipped}개`);
  } catch (error) {
    logger.error(`[배치 오류] ${today}`, error);
    throw error;
  }
});
