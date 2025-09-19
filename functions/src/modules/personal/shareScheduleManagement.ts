import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";

interface SharedSchedule {
  shareToken: string;
  timetableId: string;
  permissions: {
    canEdit: boolean;
    canView: boolean;
    canComment: boolean;
  };
  accessSettings: {
    requireName: boolean;
    requireEmail: boolean;
    maxContributions?: number;
  };
  linkSettings: {
    isActive: boolean;
    expiresAt?: admin.firestore.Timestamp;
    createdAt: admin.firestore.Timestamp;
    lastUsedAt?: admin.firestore.Timestamp;
    usageCount: number;
  };
  title?: string;
  description?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

interface ScheduleContribution {
  shareToken: string;
  timetableId: string;
  contributor: {
    name?: string;
    email?: string;
    ipAddress: string;
  };
  contributions: {
    dayOfWeek: string;
    timeSlots: {
      startTime: string;
      endTime: string;
      subject: string;
      type: "class" | "self_study";
      color?: string;
      note?: string;
    }[];
  }[];
  status: "pending" | "approved" | "rejected" | "applied";
  appliedAt?: admin.firestore.Timestamp;
  submittedAt: admin.firestore.Timestamp;
  processedAt?: admin.firestore.Timestamp;
  processedBy?: string;
}

/**
 * 시간표 공유 링크 생성
 */
export const createShareLink = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const {
    timetableId,
    permissions = { canEdit: true, canView: true, canComment: false },
    accessSettings = { requireName: false, requireEmail: false },
    expiresInDays,
    title,
    description
  } = data;

  if (!timetableId) {
    throw new functions.https.HttpsError("invalid-argument", "timetableId가 필요합니다.");
  }

  try {
    const db = admin.firestore();

    // 시간표 존재 확인
    const timetableRef = db.collection("users").doc(userId).collection("timetables").doc(timetableId);
    const timetableDoc = await timetableRef.get();

    if (!timetableDoc.exists) {
      throw new functions.https.HttpsError("not-found", "시간표를 찾을 수 없습니다.");
    }

    // 공유 토큰 생성
    const shareToken = uuidv4();
    const sharedScheduleRef = db
      .collection("users")
      .doc(userId)
      .collection("shared_schedules")
      .doc();

    const linkSettings: any = {
      isActive: true,
      createdAt: admin.firestore.Timestamp.now(),
      usageCount: 0
    };

    if (expiresInDays) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      linkSettings.expiresAt = admin.firestore.Timestamp.fromDate(expiresAt);
    }

    const sharedScheduleData: SharedSchedule = {
      shareToken,
      timetableId,
      permissions,
      accessSettings,
      linkSettings,
      title,
      description,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    await sharedScheduleRef.set(sharedScheduleData);

    // 원본 시간표에 공유 상태 업데이트
    await timetableRef.update({
      isShared: true,
      shareToken,
      shareSettings: {
        allowEdit: permissions.canEdit,
        allowView: permissions.canView,
        expiresAt: linkSettings.expiresAt || null
      },
      updatedAt: admin.firestore.Timestamp.now()
    });

    return {
      success: true,
      message: "공유 링크가 생성되었습니다.",
      data: {
        shareId: sharedScheduleRef.id,
        shareToken,
        shareUrl: `${process.env.VITE_BASE_URL || "http://localhost:3000"}/shared-schedule/${shareToken}`
      }
    };
  } catch (error) {
    console.error("공유 링크 생성 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 공유 링크로 시간표 조회 (공개 접근 가능)
 */
export const getSharedSchedule = functions.https.onRequest(async (req, res) => {
  const { shareToken } = req.params;

  if (!shareToken) {
    res.status(400).json({ success: false, error: "공유 토큰이 필요합니다." });
    return;
  }

  try {
    const db = admin.firestore();

    // 공유 링크 정보 조회
    const sharedScheduleQuery = await db
      .collectionGroup("shared_schedules")
      .where("shareToken", "==", shareToken)
      .limit(1)
      .get();

    if (sharedScheduleQuery.empty) {
      res.status(404).json({ success: false, error: "공유 링크를 찾을 수 없습니다." });
      return;
    }

    const sharedScheduleDoc = sharedScheduleQuery.docs[0];
    const sharedScheduleData = sharedScheduleDoc.data() as SharedSchedule;

    // 링크 활성 상태 및 만료 확인
    if (!sharedScheduleData.linkSettings.isActive) {
      res.status(403).json({ success: false, error: "비활성화된 공유 링크입니다." });
      return;
    }

    if (sharedScheduleData.linkSettings.expiresAt &&
        sharedScheduleData.linkSettings.expiresAt.toDate() < new Date()) {
      res.status(410).json({ success: false, error: "만료된 공유 링크입니다." });
      return;
    }

    // 시간표 소유자 ID 추출
    const userId = sharedScheduleDoc.ref.parent.parent?.id;
    if (!userId) {
      res.status(500).json({ success: false, error: "시간표 소유자를 확인할 수 없습니다." });
      return;
    }

    // 원본 시간표 조회
    const timetableDoc = await db
      .collection("users")
      .doc(userId)
      .collection("timetables")
      .doc(sharedScheduleData.timetableId)
      .get();

    if (!timetableDoc.exists) {
      res.status(404).json({ success: false, error: "시간표를 찾을 수 없습니다." });
      return;
    }

    // 사용 카운트 업데이트
    await sharedScheduleDoc.ref.update({
      "linkSettings.usageCount": admin.firestore.FieldValue.increment(1),
      "linkSettings.lastUsedAt": admin.firestore.Timestamp.now()
    });

    res.json({
      success: true,
      data: {
        timetable: { id: timetableDoc.id, ...timetableDoc.data() },
        shareInfo: {
          title: sharedScheduleData.title,
          description: sharedScheduleData.description,
          permissions: sharedScheduleData.permissions,
          accessSettings: sharedScheduleData.accessSettings
        }
      }
    });
  } catch (error) {
    console.error("공유 시간표 조회 오류:", error);
    res.status(500).json({ success: false, error: "서버 오류가 발생했습니다." });
  }
});

/**
 * 외부 사용자가 시간표에 일정 기여
 */
export const contributeSchedule = functions.https.onRequest(async (req, res) => {
  const { shareToken } = req.params;
  const { contributor, contributions } = req.body;

  if (!shareToken || !contributions) {
    res.status(400).json({ success: false, error: "필수 필드가 누락되었습니다." });
    return;
  }

  try {
    const db = admin.firestore();

    // 공유 링크 확인
    const sharedScheduleQuery = await db
      .collectionGroup("shared_schedules")
      .where("shareToken", "==", shareToken)
      .limit(1)
      .get();

    if (sharedScheduleQuery.empty) {
      res.status(404).json({ success: false, error: "공유 링크를 찾을 수 없습니다." });
      return;
    }

    const sharedScheduleDoc = sharedScheduleQuery.docs[0];
    const sharedScheduleData = sharedScheduleDoc.data() as SharedSchedule;

    // 편집 권한 확인
    if (!sharedScheduleData.permissions.canEdit) {
      res.status(403).json({ success: false, error: "편집 권한이 없습니다." });
      return;
    }

    // 시간표 소유자 ID 추출
    const userId = sharedScheduleDoc.ref.parent.parent?.id;
    if (!userId) {
      res.status(500).json({ success: false, error: "시간표 소유자를 확인할 수 없습니다." });
      return;
    }

    // 기여 데이터 저장
    const contributionRef = db
      .collection("users")
      .doc(userId)
      .collection("schedule_contributions")
      .doc();

    const contributionData: ScheduleContribution = {
      shareToken,
      timetableId: sharedScheduleData.timetableId,
      contributor: {
        name: contributor?.name,
        email: contributor?.email,
        ipAddress: req.ip || "unknown"
      },
      contributions,
      status: "pending",
      submittedAt: admin.firestore.Timestamp.now()
    };

    await contributionRef.set(contributionData);

    res.status(201).json({
      success: true,
      message: "일정 기여가 제출되었습니다. 시간표 소유자의 승인을 기다리고 있습니다.",
      data: { contributionId: contributionRef.id }
    });
  } catch (error) {
    console.error("일정 기여 오류:", error);
    res.status(500).json({ success: false, error: "서버 오류가 발생했습니다." });
  }
});

/**
 * 기여 데이터 승인/거부
 */
export const processContribution = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { contributionId, action } = data; // action: 'approve' | 'reject'

  if (!contributionId || !["approve", "reject"].includes(action)) {
    throw new functions.https.HttpsError("invalid-argument", "올바른 처리 액션을 선택해주세요.");
  }

  try {
    const db = admin.firestore();
    const contributionRef = db
      .collection("users")
      .doc(userId)
      .collection("schedule_contributions")
      .doc(contributionId);

    const contributionDoc = await contributionRef.get();
    if (!contributionDoc.exists) {
      throw new functions.https.HttpsError("not-found", "기여 데이터를 찾을 수 없습니다.");
    }

    const contributionData = contributionDoc.data() as ScheduleContribution;

    if (contributionData.status !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "이미 처리된 기여입니다.");
    }

    const updateData: any = {
      status: action === "approve" ? "approved" : "rejected",
      processedAt: admin.firestore.Timestamp.now(),
      processedBy: userId
    };

    // 승인된 경우 시간표에 적용
    if (action === "approve") {
      const timetableRef = db
        .collection("users")
        .doc(userId)
        .collection("timetables")
        .doc(contributionData.timetableId);

      const timetableDoc = await timetableRef.get();
      if (timetableDoc.exists) {
        const timetableData = timetableDoc.data();
        const updatedSchedule = { ...timetableData?.detailedSchedule };

        // 기여된 일정을 시간표에 반영
        for (const contribution of contributionData.contributions) {
          const dayOfWeek = contribution.dayOfWeek;
          if (!updatedSchedule[dayOfWeek]) {
            updatedSchedule[dayOfWeek] = { timeSlots: [] };
          }

          // 기존 자동생성 자습시간 제거 후 새 일정 추가
          const existingSlots = updatedSchedule[dayOfWeek].timeSlots.filter(
            (slot: any) => !slot.isAutoGenerated
          );
          updatedSchedule[dayOfWeek].timeSlots = [
            ...existingSlots,
            ...contribution.timeSlots
          ];
        }

        await timetableRef.update({
          detailedSchedule: updatedSchedule,
          updatedAt: admin.firestore.Timestamp.now()
        });

        updateData.status = "applied";
        updateData.appliedAt = admin.firestore.Timestamp.now();
      }
    }

    await contributionRef.update(updateData);

    return {
      success: true,
      message: action === "approve" ? "기여가 승인되어 시간표에 적용되었습니다." : "기여가 거부되었습니다."
    };
  } catch (error) {
    console.error("기여 처리 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 공유 링크 관리 (비활성화/삭제)
 */
export const manageShareLink = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { shareId, action } = data; // action: 'disable' | 'delete'

  if (!shareId || !["disable", "delete"].includes(action)) {
    throw new functions.https.HttpsError("invalid-argument", "올바른 관리 액션을 선택해주세요.");
  }

  try {
    const db = admin.firestore();
    const shareRef = db
      .collection("users")
      .doc(userId)
      .collection("shared_schedules")
      .doc(shareId);

    const shareDoc = await shareRef.get();
    if (!shareDoc.exists) {
      throw new functions.https.HttpsError("not-found", "공유 링크를 찾을 수 없습니다.");
    }

    if (action === "delete") {
      await shareRef.delete();
    } else {
      await shareRef.update({
        "linkSettings.isActive": false,
        "updatedAt": admin.firestore.Timestamp.now()
      });
    }

    return {
      success: true,
      message: action === "delete" ? "공유 링크가 삭제되었습니다." : "공유 링크가 비활성화되었습니다."
    };
  } catch (error) {
    console.error("공유 링크 관리 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});
