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
import { groupSlotsByExternalBreak } from "../utils/attendanceUtils";

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

          // 4-1. 시간 순서대로 정렬 (detailedSchedule.timeSlots는 정렬 안 되어 있을 수 있음)
          const sortedSlots = [...detailedSchedule.timeSlots].sort((a, b) =>
            a.startTime.localeCompare(b.startTime)
          );

          // 4-2. 연속 블럭 그룹화
          const continuousBlocks = groupSlotsByExternalBreak(sortedSlots);

          if (continuousBlocks.length === 0) {
            logger.info(`[SKIP] userId=${userId}, studentId=${studentId}: 출석 의무 슬롯 없음`);
            totalSkipped++;
            continue;
          }

          // 5. 블럭마다 레코드 생성
          const batch = db.batch();

          for (let i = 0; i < continuousBlocks.length; i++) {
            const block = continuousBlocks[i];
            const timestamp = admin.firestore.Timestamp.now();

            // ⭐ recordId: {studentId}_{YYYYMMDD}_block{N}_{timestamp}
            // 변경: slot → block
            const recordId = `${studentId}_${today.replace(/-/g, "")}_block${i + 1}_${timestamp.toMillis()}`;

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

              // ⭐ 블럭 정보 (신규)
              blockNumber: i + 1,
              blockSlotCount: block.slots.length,
              blockSubjects: block.slots.map((s: any) => s.subject).join(", "),
              blockSlots: block.slots.map((s: any, idx: number) => ({
                slotId: s.id || `slot_${idx}`,
                subject: s.subject || "",
                type: s.type,
                startTime: s.startTime,
                endTime: s.endTime
              })),

              // 시간표 정보 (첫 번째 슬롯 기준)
              timetableId,
              timeSlotId: block.slots[0].id || "slot_0",
              timeSlotSubject: block.slots.map((s: any) => s.subject).join(", "),
              timeSlotType: block.slots[0].type,

              expectedArrivalTime: block.startTime, // 블럭 시작
              expectedDepartureTime: block.endTime, // 블럭 종료

              status: "scheduled",
              isLate: false,
              isEarlyLeave: false,

              sessionNumber: i + 1, // 블럭 번호와 동일
              isLatestSession: (i === continuousBlocks.length - 1),

              createdAt: timestamp,
              updatedAt: timestamp,
              recordTimestamp: timestamp
            };

            batch.set(recordRef, recordData);
          }

          await batch.commit();
          totalCreated += continuousBlocks.length; // 블럭 개수
          const totalSlots = sortedSlots.filter((s: any) => s.type === "class" || s.type === "self_study").length;
          logger.info(`[성공] userId=${userId}, studentId=${studentId}: ${continuousBlocks.length}개 블럭 생성 (${totalSlots}개 슬롯)`);
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
