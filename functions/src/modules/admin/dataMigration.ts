/**
 * 데이터 마이그레이션 모듈
 *
 * 일회성 데이터 마이그레이션 작업을 위한 Cloud Functions
 * 사용 후 비활성화하거나 삭제 권장
 */

import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";

/**
 * 학생 데이터에 enrollmentDate 필드 추가 마이그레이션
 *
 * 기존 학생 데이터에 enrollmentDate가 없는 경우:
 * - enrollmentDate를 createdAt으로 설정
 * - status를 'active'로 설정 (없는 경우)
 *
 * @returns 마이그레이션 결과 (처리된 사용자 수, 업데이트된 학생 수 등)
 */
export const migrateStudentEnrollmentDates = onCall(
  {
    region: "asia-northeast3",
    timeoutSeconds: 540, // 9분 (최대 실행 시간)
  },
  async (request) => {
    // 인증 확인
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    const userId = request.auth.uid;
    const dryRun = request.data?.dryRun || false; // Dry-run 모드 (실제 업데이트하지 않음)

    logger.info("enrollmentDate 마이그레이션 시작", {
      userId,
      dryRun,
    });

    try {
      const db = admin.firestore();

      // 통계
      let totalUsers = 0;
      let totalStudents = 0;
      let updatedStudents = 0;
      let skippedStudents = 0;
      const errorCount = 0;

      // 특정 사용자만 마이그레이션 (자신의 데이터만)
      const userRef = db.collection("users").doc(userId);
      const studentsSnapshot = await userRef.collection("students").get();

      totalUsers = 1;
      totalStudents = studentsSnapshot.size;

      logger.info(`사용자 ${userId}의 학생 ${totalStudents}명 확인`);

      // Batch 처리 (Firestore는 batch당 최대 500개 작업)
      const batchSize = 500;
      let batch = db.batch();
      let batchCount = 0;

      for (const doc of studentsSnapshot.docs) {
        const studentData = doc.data();

        // enrollmentDate가 이미 있으면 스킵
        if (studentData.enrollmentDate) {
          skippedStudents++;
          continue;
        }

        // 업데이트할 데이터 준비
        const updateData: any = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // enrollmentDate 설정 (createdAt 또는 현재 시간)
        if (studentData.createdAt) {
          updateData.enrollmentDate = studentData.createdAt;
        } else {
          updateData.enrollmentDate = admin.firestore.FieldValue.serverTimestamp();
        }

        // status 설정 (없는 경우만)
        if (!studentData.status) {
          updateData.status = "active";
        }

        // Dry-run이 아닌 경우에만 실제 업데이트
        if (!dryRun) {
          batch.update(doc.ref, updateData);
          batchCount++;

          // Batch가 가득 차면 커밋
          if (batchCount >= batchSize) {
            await batch.commit();
            logger.info(`Batch 커밋: ${batchCount}개 학생 업데이트`);
            batch = db.batch();
            batchCount = 0;
          }
        }

        updatedStudents++;

        logger.info(`학생 ${doc.id} 마이그레이션 준비`, {
          name: studentData.name,
          enrollmentDate: updateData.enrollmentDate,
          status: updateData.status || studentData.status,
        });
      }

      // 남은 batch 커밋
      if (!dryRun && batchCount > 0) {
        await batch.commit();
        logger.info(`마지막 Batch 커밋: ${batchCount}개 학생 업데이트`);
      }

      const result = {
        success: true,
        dryRun,
        totalUsers,
        totalStudents,
        updatedStudents,
        skippedStudents,
        errorCount,
        message: dryRun ?
          `Dry-run 완료: ${updatedStudents}명의 학생이 업데이트 대상입니다.` :
          `마이그레이션 완료: ${updatedStudents}명의 학생 데이터를 업데이트했습니다.`,
      };

      logger.info("enrollmentDate 마이그레이션 완료", result);

      return result;
    } catch (error) {
      logger.error("enrollmentDate 마이그레이션 실패", error);
      throw new HttpsError(
        "internal",
        "마이그레이션 중 오류가 발생했습니다.",
        error
      );
    }
  }
);

/**
 * 관리자용: 모든 사용자 데이터 마이그레이션
 *
 * 주의: 이 함수는 모든 사용자의 데이터를 처리하므로 매우 신중하게 사용해야 합니다.
 * 실제 프로덕션 환경에서는 관리자 권한 검증이 필요합니다.
 *
 * @returns 마이그레이션 결과
 */
export const migrateAllUsersEnrollmentDates = onCall(
  {
    region: "asia-northeast3",
    timeoutSeconds: 540,
  },
  async (request) => {
    // 인증 확인
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    // TODO: 실제로는 관리자 권한 확인이 필요
    // 예: Custom Claims 확인 또는 특정 이메일 확인
    // if (!request.auth.token.admin) {
    //   throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
    // }

    const dryRun = request.data?.dryRun || false;

    logger.warn("모든 사용자 enrollmentDate 마이그레이션 시작", {
      dryRun,
      calledBy: request.auth.uid,
    });

    try {
      const db = admin.firestore();

      let totalUsers = 0;
      let totalStudents = 0;
      let updatedStudents = 0;
      let skippedStudents = 0;
      let errorCount = 0;

      // 모든 사용자 조회
      const usersSnapshot = await db.collection("users").get();
      totalUsers = usersSnapshot.size;

      logger.info(`총 ${totalUsers}명의 사용자 확인`);

      // 각 사용자별로 처리
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;

        try {
          const studentsSnapshot = await userDoc.ref.collection("students").get();
          totalStudents += studentsSnapshot.size;

          const batchSize = 500;
          let batch = db.batch();
          let batchCount = 0;

          for (const studentDoc of studentsSnapshot.docs) {
            const studentData = studentDoc.data();

            if (studentData.enrollmentDate) {
              skippedStudents++;
              continue;
            }

            const updateData: any = {
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            if (studentData.createdAt) {
              updateData.enrollmentDate = studentData.createdAt;
            } else {
              updateData.enrollmentDate = admin.firestore.FieldValue.serverTimestamp();
            }

            if (!studentData.status) {
              updateData.status = "active";
            }

            if (!dryRun) {
              batch.update(studentDoc.ref, updateData);
              batchCount++;

              if (batchCount >= batchSize) {
                await batch.commit();
                logger.info(`사용자 ${userId} Batch 커밋: ${batchCount}개`);
                batch = db.batch();
                batchCount = 0;
              }
            }

            updatedStudents++;
          }

          // 남은 batch 커밋
          if (!dryRun && batchCount > 0) {
            await batch.commit();
            logger.info(`사용자 ${userId} 마지막 Batch: ${batchCount}개`);
          }

          logger.info(`사용자 ${userId} 처리 완료`, {
            totalStudents: studentsSnapshot.size,
            updated: updatedStudents,
          });
        } catch (error) {
          logger.error(`사용자 ${userId} 처리 실패`, error);
          errorCount++;
        }
      }

      const result = {
        success: true,
        dryRun,
        totalUsers,
        totalStudents,
        updatedStudents,
        skippedStudents,
        errorCount,
        message: dryRun ?
          `Dry-run 완료: ${totalUsers}명의 사용자, ${updatedStudents}명의 학생이 업데이트 대상입니다.` :
          `마이그레이션 완료: ${totalUsers}명의 사용자, ${updatedStudents}명의 학생 데이터를 업데이트했습니다.`,
      };

      logger.warn("모든 사용자 enrollmentDate 마이그레이션 완료", result);

      return result;
    } catch (error) {
      logger.error("모든 사용자 마이그레이션 실패", error);
      throw new HttpsError(
        "internal",
        "마이그레이션 중 오류가 발생했습니다.",
        error
      );
    }
  }
);
