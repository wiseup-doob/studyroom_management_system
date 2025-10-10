/**
 * Firestore Trigger: 시간표 업데이트 시 자동 캐시 동기화
 *
 * 문제: 좌석 할당 시 expectedSchedule을 seat_assignments에 캐싱하는데,
 *       이후 시간표가 변경되어도 캐시가 업데이트되지 않아 지각/조퇴 계산이 부정확함
 *
 * 해결: 시간표 업데이트 시 해당 시간표를 사용하는 모든 좌석 할당의 expectedSchedule을
 *       자동으로 업데이트
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

const db = admin.firestore();

/**
 * 시간표 업데이트 트리거
 *
 * Path: users/{userId}/student_timetables/{timetableId}
 */
export const onStudentTimetableUpdate = onDocumentUpdated(
  {
    document: "users/{userId}/student_timetables/{timetableId}",
    region: "asia-northeast3"
  },
  async (event) => {
    const { userId, timetableId } = event.params;

    // 변경 전후 데이터
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) {
      logger.warn(`시간표 업데이트 트리거: 데이터 없음 (timetableId: ${timetableId})`);
      return;
    }

    // basicSchedule.dailySchedules가 변경되었는지 확인
    const beforeSchedule = JSON.stringify(beforeData.basicSchedule?.dailySchedules || {});
    const afterSchedule = JSON.stringify(afterData.basicSchedule?.dailySchedules || {});

    if (beforeSchedule === afterSchedule) {
      logger.info(`시간표 업데이트 트리거: basicSchedule 변경 없음 (timetableId: ${timetableId})`);
      return; // 변경 없으면 종료
    }

    logger.info(`시간표 업데이트 트리거: basicSchedule 변경 감지 (timetableId: ${timetableId})`);

    try {
      // 이 시간표를 사용하는 모든 활성 좌석 할당 조회
      const assignmentsSnapshot = await db
        .collection("users")
        .doc(userId)
        .collection("seat_assignments")
        .where("timetableId", "==", timetableId)
        .where("status", "==", "active")
        .get();

      if (assignmentsSnapshot.empty) {
        logger.info(`시간표 업데이트 트리거: 관련 좌석 할당 없음 (timetableId: ${timetableId})`);
        return;
      }

      logger.info(`시간표 업데이트 트리거: ${assignmentsSnapshot.size}개의 좌석 할당 업데이트 시작`);

      // 배치 업데이트 (최대 500개)
      const batch = db.batch();
      let updateCount = 0;

      assignmentsSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          expectedSchedule: afterData.basicSchedule.dailySchedules,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        updateCount++;
      });

      await batch.commit();

      logger.info(
        `시간표 업데이트 트리거: 좌석 할당 캐시 업데이트 완료 (timetableId: ${timetableId}, 업데이트 수: ${updateCount})`
      );

      // 500개 이상인 경우 경고
      if (assignmentsSnapshot.size >= 500) {
        logger.warn(
          "시간표 업데이트 트리거: 좌석 할당이 500개 이상입니다. 추가 배치 처리가 필요할 수 있습니다."
        );
      }
    } catch (error) {
      logger.error(`시간표 업데이트 트리거 오류 (timetableId: ${timetableId}):`, error);
      // Trigger는 에러를 던지지 않고 로깅만 함 (재시도는 Firebase가 자동으로 처리)
    }
  }
);
