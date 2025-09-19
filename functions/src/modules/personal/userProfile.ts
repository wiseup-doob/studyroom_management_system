import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * 사용자 프로필 생성/업데이트
 * Google 로그인 시 사용자 정보를 Firestore에 저장
 */
export const createOrUpdateUserProfile = functions.https.onCall(async (data: any, context: any) => {
  // 인증 확인
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { name, email, profilePicture, googleId } = data;

  try {
    const db = admin.firestore();
    const userRef = db.collection("users").doc(userId);

    // 사용자 문서 생성/업데이트
    const userData: any = {
      authUid: userId,
      name: name || context.auth.token?.name || "",
      email: email || context.auth.token?.email || "",
      profilePicture: profilePicture || context.auth.token?.picture || "",
      googleId: googleId || context.auth.token?.firebase?.identities?.["google.com"]?.[0] || "",
      isActive: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 문서가 존재하지 않으면 createdAt 필드도 추가
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      userData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await userRef.set(userData, { merge: true });

    return {
      success: true,
      message: "사용자 프로필이 생성/업데이트되었습니다.",
      userId
    };
  } catch (error) {
    console.error("사용자 프로필 생성/업데이트 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 사용자 프로필 조회
 */
export const getUserProfile = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;

  try {
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "사용자 프로필을 찾을 수 없습니다.");
    }

    return {
      success: true,
      data: userDoc.data()
    };
  } catch (error) {
    console.error("사용자 프로필 조회 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 사용자 프로필 소프트 삭제 (계정 비활성화)
 */
export const deactivateUserProfile = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;

  try {
    const db = admin.firestore();
    const userRef = db.collection("users").doc(userId);

    await userRef.update({
      isActive: false,
      deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      message: "사용자 계정이 비활성화되었습니다. 데이터는 보존됩니다."
    };
  } catch (error) {
    console.error("사용자 프로필 비활성화 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 사용자 프로필 완전 삭제 (계정 탈퇴)
 * 모든 관련 데이터를 완전히 삭제합니다.
 * Firestore 배치 제한(500개 문서)을 고려하여 안전하게 처리합니다.
 */
export const deleteUserProfile = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { confirmDeletion } = data;

  // 삭제 확인 플래그가 없으면 오류
  if (!confirmDeletion) {
    throw new functions.https.HttpsError("failed-precondition", "계정 삭제를 확인해주세요.");
  }

  try {
    const db = admin.firestore();
    const userRef = db.collection("users").doc(userId);

    // 사용자 문서 존재 확인
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "사용자 계정을 찾을 수 없습니다.");
    }

    // 모든 하위 컬렉션 데이터 삭제
    const collections = [
      "attendance_records",
      "timetables", 
      "shared_schedules",
      "schedule_contributions",
      "seats",
      "seat_assignments",
      "seat_layouts",
      "class_sections",
      "attendance_summaries",
      "settings"
    ];

    let totalDeletedDocs = 0;

    // 각 컬렉션의 모든 문서 삭제 (배치 제한 고려)
    for (const collectionName of collections) {
      const collectionRef = userRef.collection(collectionName);
      
      // 배치 크기 제한 (500개 문서)
      const BATCH_SIZE = 500;
      let hasMore = true;
      
      while (hasMore) {
        const snapshot = await collectionRef.limit(BATCH_SIZE).get();
        
        if (snapshot.empty) {
          hasMore = false;
          break;
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        totalDeletedDocs += snapshot.docs.length;
        
        // 마지막 문서가 배치 크기보다 작으면 더 이상 문서가 없음
        if (snapshot.docs.length < BATCH_SIZE) {
          hasMore = false;
        }
      }
    }

    // 사용자 문서 삭제
    await userRef.delete();

    return {
      success: true,
      message: `사용자 계정과 모든 관련 데이터가 완전히 삭제되었습니다. (총 ${totalDeletedDocs}개 문서 삭제)`
    };
  } catch (error) {
    console.error("사용자 프로필 완전 삭제 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 사용자 프로필 복구 (비활성화된 계정 복구)
 */
export const restoreUserProfile = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;

  try {
    const db = admin.firestore();
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "사용자 계정을 찾을 수 없습니다.");
    }

    const userData = userDoc.data();
    if (userData?.isActive) {
      throw new functions.https.HttpsError("failed-precondition", "이미 활성화된 계정입니다.");
    }

    await userRef.update({
      isActive: true,
      restoredAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      message: "사용자 계정이 복구되었습니다."
    };
  } catch (error) {
    console.error("사용자 프로필 복구 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 사용자 데이터 통계 조회 (삭제 전 확인용)
 */
export const getUserDataStats = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;

  try {
    const db = admin.firestore();
    const userRef = db.collection("users").doc(userId);

    // 사용자 문서 존재 확인
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "사용자 계정을 찾을 수 없습니다.");
    }

    const collections = [
      "attendance_records",
      "timetables", 
      "shared_schedules",
      "schedule_contributions",
      "seats",
      "seat_assignments",
      "seat_layouts",
      "class_sections",
      "attendance_summaries",
      "settings"
    ];

    const stats: { [key: string]: number } = {};
    let totalDocuments = 0;

    // 각 컬렉션의 문서 수 조회
    for (const collectionName of collections) {
      const collectionRef = userRef.collection(collectionName);
      const snapshot = await collectionRef.get();
      const count = snapshot.docs.length;
      stats[collectionName] = count;
      totalDocuments += count;
    }

    return {
      success: true,
      data: {
        userId,
        totalDocuments,
        collectionStats: stats,
        userInfo: {
          name: userDoc.data()?.name,
          email: userDoc.data()?.email,
          isActive: userDoc.data()?.isActive,
          createdAt: userDoc.data()?.createdAt
        }
      }
    };
  } catch (error) {
    console.error("사용자 데이터 통계 조회 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 사용자 데이터 백업 생성 (삭제 전 백업)
 */
export const createUserDataBackup = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;

  try {
    const db = admin.firestore();
    const userRef = db.collection("users").doc(userId);

    // 사용자 문서 존재 확인
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "사용자 계정을 찾을 수 없습니다.");
    }

    const backupData: any = {
      userId,
      userProfile: userDoc.data(),
      collections: {}
    };

    const collections = [
      "attendance_records",
      "timetables", 
      "shared_schedules",
      "schedule_contributions",
      "seats",
      "seat_assignments",
      "seat_layouts",
      "class_sections",
      "attendance_summaries",
      "settings"
    ];

    // 각 컬렉션의 모든 문서 백업
    for (const collectionName of collections) {
      const collectionRef = userRef.collection(collectionName);
      const snapshot = await collectionRef.get();
      
      backupData.collections[collectionName] = snapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
      }));
    }

    // 백업 데이터를 별도 컬렉션에 저장
    const backupRef = db.collection("user_backups").doc(`${userId}_${Date.now()}`);
    await backupRef.set({
      ...backupData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      backupType: "full_backup"
    });

    return {
      success: true,
      message: "사용자 데이터 백업이 생성되었습니다.",
      data: {
        backupId: backupRef.id,
        totalDocuments: Object.values(backupData.collections).reduce((sum: number, docs: any) => sum + docs.length, 0)
      }
    };
  } catch (error) {
    console.error("사용자 데이터 백업 생성 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});
