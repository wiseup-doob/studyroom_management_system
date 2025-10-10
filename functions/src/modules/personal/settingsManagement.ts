import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

interface UserSettings {
  notifications: {
    attendance: boolean;
    schedule: boolean;
    announcements: boolean;
  };
  preferences: {
    theme: "light" | "dark";
    language: string;
  };
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * 사용자 설정 조회
 */
export const getSettings = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;

  try {
    const db = admin.firestore();
    const settingsDoc = await db
      .collection("users")
      .doc(userId)
      .collection("settings")
      .doc("preferences")
      .get();

    if (!settingsDoc.exists) {
      // 기본 설정 생성
      const defaultSettings: UserSettings = {
        notifications: {
          attendance: true,
          schedule: true,
          announcements: true
        },
        preferences: {
          theme: "light",
          language: "ko"
        },
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      await settingsDoc.ref.set(defaultSettings);

      return {
        success: true,
        data: defaultSettings
      };
    }

    return {
      success: true,
      data: settingsDoc.data()
    };
  } catch (error) {
    console.error("설정 조회 오류:", error);
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 사용자 설정 업데이트
 */
export const updateSettings = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const { notifications, preferences } = request.data;

  if (!notifications && !preferences) {
    throw new HttpsError("invalid-argument", "업데이트할 설정이 없습니다.");
  }

  try {
    const db = admin.firestore();
    const settingsRef = db
      .collection("users")
      .doc(userId)
      .collection("settings")
      .doc("preferences");

    const updateData: any = {
      updatedAt: admin.firestore.Timestamp.now()
    };

    if (notifications) {
      updateData.notifications = notifications;
    }

    if (preferences) {
      updateData.preferences = preferences;
    }

    await settingsRef.set(updateData, { merge: true });

    return {
      success: true,
      message: "설정이 업데이트되었습니다."
    };
  } catch (error) {
    console.error("설정 업데이트 오류:", error);
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 알림 설정 업데이트
 */
export const updateNotificationSettings = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const { attendance, schedule, announcements } = request.data;

  try {
    const db = admin.firestore();
    const settingsRef = db
      .collection("users")
      .doc(userId)
      .collection("settings")
      .doc("preferences");

    const updateData = {
      "notifications.attendance": attendance !== undefined ? attendance : true,
      "notifications.schedule": schedule !== undefined ? schedule : true,
      "notifications.announcements": announcements !== undefined ? announcements : true,
      "updatedAt": admin.firestore.Timestamp.now()
    };

    await settingsRef.set(updateData, { merge: true });

    return {
      success: true,
      message: "알림 설정이 업데이트되었습니다."
    };
  } catch (error) {
    console.error("알림 설정 업데이트 오류:", error);
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 테마 설정 업데이트
 */
export const updateTheme = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const { theme } = request.data;

  if (!theme || !["light", "dark"].includes(theme)) {
    throw new HttpsError("invalid-argument", "올바른 테마를 선택해주세요.");
  }

  try {
    const db = admin.firestore();
    const settingsRef = db
      .collection("users")
      .doc(userId)
      .collection("settings")
      .doc("preferences");

    await settingsRef.set({
      "preferences.theme": theme,
      "updatedAt": admin.firestore.Timestamp.now()
    }, { merge: true });

    return {
      success: true,
      message: "테마가 변경되었습니다.",
      data: { theme }
    };
  } catch (error) {
    console.error("테마 업데이트 오류:", error);
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 언어 설정 업데이트
 */
export const updateLanguage = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const { language } = request.data;

  if (!language) {
    throw new HttpsError("invalid-argument", "언어를 선택해주세요.");
  }

  try {
    const db = admin.firestore();
    const settingsRef = db
      .collection("users")
      .doc(userId)
      .collection("settings")
      .doc("preferences");

    await settingsRef.set({
      "preferences.language": language,
      "updatedAt": admin.firestore.Timestamp.now()
    }, { merge: true });

    return {
      success: true,
      message: "언어가 변경되었습니다.",
      data: { language }
    };
  } catch (error) {
    console.error("언어 업데이트 오류:", error);
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 설정 초기화
 */
export const resetSettings = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;

  try {
    const db = admin.firestore();
    const settingsRef = db
      .collection("users")
      .doc(userId)
      .collection("settings")
      .doc("preferences");

    const defaultSettings: UserSettings = {
      notifications: {
        attendance: true,
        schedule: true,
        announcements: true
      },
      preferences: {
        theme: "light",
        language: "ko"
      },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    await settingsRef.set(defaultSettings);

    return {
      success: true,
      message: "설정이 초기화되었습니다.",
      data: defaultSettings
    };
  } catch (error) {
    console.error("설정 초기화 오류:", error);
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});
