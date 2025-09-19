import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

interface Seat {
  seatNumber: string;
  location: {
    x: number;
    y: number;
  };
  status: "available" | "occupied" | "maintenance";
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

interface SeatAssignment {
  seatId: string;
  assignedAt: admin.firestore.Timestamp;
  expiresAt?: admin.firestore.Timestamp;
  status: "active" | "expired" | "cancelled";
  updatedAt: admin.firestore.Timestamp;
}

interface SeatLayout {
  name: string;
  layout: {
    seats: {
      id: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
    }[];
    dimensions: {
      width: number;
      height: number;
    };
  };
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * 좌석 생성
 */
export const createSeat = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { seatNumber, location } = data;

  if (!seatNumber || !location) {
    throw new functions.https.HttpsError("invalid-argument", "필수 필드가 누락되었습니다.");
  }

  try {
    const db = admin.firestore();
    const seatRef = db
      .collection("users")
      .doc(userId)
      .collection("seats")
      .doc();

    const seatData: Seat = {
      seatNumber,
      location,
      status: "available",
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    await seatRef.set(seatData);

    return {
      success: true,
      message: "좌석이 생성되었습니다.",
      data: { seatId: seatRef.id }
    };
  } catch (error) {
    console.error("좌석 생성 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 좌석 목록 조회
 */
export const getSeats = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { status } = data;

  try {
    const db = admin.firestore();
    let query = db
      .collection("users")
      .doc(userId)
      .collection("seats")
      .orderBy("seatNumber", "asc");

    if (status) {
      query = query.where("status", "==", status);
    }

    const snapshot = await query.get();
    const seats = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      success: true,
      data: seats
    };
  } catch (error) {
    console.error("좌석 목록 조회 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 좌석 배정
 */
export const assignSeat = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { seatId, expiresInHours } = data;

  if (!seatId) {
    throw new functions.https.HttpsError("invalid-argument", "seatId가 필요합니다.");
  }

  try {
    const db = admin.firestore();

    // 좌석 존재 및 상태 확인
    const seatRef = db.collection("users").doc(userId).collection("seats").doc(seatId);
    const seatDoc = await seatRef.get();

    if (!seatDoc.exists) {
      throw new functions.https.HttpsError("not-found", "좌석을 찾을 수 없습니다.");
    }

    const seatData = seatDoc.data() as Seat;
    if (seatData.status !== "available") {
      throw new functions.https.HttpsError("failed-precondition", "사용 가능한 좌석이 아닙니다.");
    }

    // 기존 활성 배정 확인
    const activeAssignmentQuery = await db
      .collection("users")
      .doc(userId)
      .collection("seat_assignments")
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (!activeAssignmentQuery.empty) {
      throw new functions.https.HttpsError("failed-precondition", "이미 배정된 좌석이 있습니다.");
    }

    // 좌석 배정 생성
    const assignmentRef = db
      .collection("users")
      .doc(userId)
      .collection("seat_assignments")
      .doc();

    const assignmentData: SeatAssignment = {
      seatId,
      assignedAt: admin.firestore.Timestamp.now(),
      status: "active",
      updatedAt: admin.firestore.Timestamp.now()
    };

    if (expiresInHours) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);
      assignmentData.expiresAt = admin.firestore.Timestamp.fromDate(expiresAt);
    }

    // 트랜잭션으로 좌석 상태와 배정 동시 업데이트
    await db.runTransaction(async (transaction) => {
      transaction.set(assignmentRef, assignmentData);
      transaction.update(seatRef, {
        status: "occupied",
        updatedAt: admin.firestore.Timestamp.now()
      });
    });

    return {
      success: true,
      message: "좌석이 배정되었습니다.",
      data: { assignmentId: assignmentRef.id }
    };
  } catch (error) {
    console.error("좌석 배정 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 좌석 배정 해제
 */
export const unassignSeat = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { assignmentId } = data;

  try {
    const db = admin.firestore();

    let assignmentRef;
    let assignmentData;

    if (assignmentId) {
      // 특정 배정 해제
      assignmentRef = db
        .collection("users")
        .doc(userId)
        .collection("seat_assignments")
        .doc(assignmentId);

      const assignmentDoc = await assignmentRef.get();
      if (!assignmentDoc.exists) {
        throw new functions.https.HttpsError("not-found", "좌석 배정을 찾을 수 없습니다.");
      }
      assignmentData = assignmentDoc.data() as SeatAssignment;
    } else {
      // 현재 활성 배정 해제
      const activeAssignmentQuery = await db
        .collection("users")
        .doc(userId)
        .collection("seat_assignments")
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (activeAssignmentQuery.empty) {
        throw new functions.https.HttpsError("not-found", "활성 좌석 배정이 없습니다.");
      }

      const assignmentDoc = activeAssignmentQuery.docs[0];
      assignmentRef = assignmentDoc.ref;
      assignmentData = assignmentDoc.data() as SeatAssignment;
    }

    // 좌석 상태 복구
    const seatRef = db.collection("users").doc(userId).collection("seats").doc(assignmentData.seatId);

    await db.runTransaction(async (transaction) => {
      transaction.update(assignmentRef, {
        status: "cancelled",
        updatedAt: admin.firestore.Timestamp.now()
      });
      transaction.update(seatRef, {
        status: "available",
        updatedAt: admin.firestore.Timestamp.now()
      });
    });

    return {
      success: true,
      message: "좌석 배정이 해제되었습니다."
    };
  } catch (error) {
    console.error("좌석 배정 해제 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 좌석 배치도 생성
 */
export const createSeatLayout = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { name, layout } = data;

  if (!name || !layout) {
    throw new functions.https.HttpsError("invalid-argument", "필수 필드가 누락되었습니다.");
  }

  try {
    const db = admin.firestore();
    const layoutRef = db
      .collection("users")
      .doc(userId)
      .collection("seat_layouts")
      .doc();

    const layoutData: SeatLayout = {
      name,
      layout,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    await layoutRef.set(layoutData);

    return {
      success: true,
      message: "좌석 배치도가 생성되었습니다.",
      data: { layoutId: layoutRef.id }
    };
  } catch (error) {
    console.error("좌석 배치도 생성 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 좌석 배치도 목록 조회
 */
export const getSeatLayouts = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;

  try {
    const db = admin.firestore();
    const snapshot = await db
      .collection("users")
      .doc(userId)
      .collection("seat_layouts")
      .orderBy("createdAt", "desc")
      .get();

    const layouts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      success: true,
      data: layouts
    };
  } catch (error) {
    console.error("좌석 배치도 목록 조회 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 현재 좌석 배정 상태 조회
 */
export const getCurrentSeatAssignment = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;

  try {
    const db = admin.firestore();
    const assignmentQuery = await db
      .collection("users")
      .doc(userId)
      .collection("seat_assignments")
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (assignmentQuery.empty) {
      return {
        success: true,
        data: null,
        message: "현재 배정된 좌석이 없습니다."
      };
    }

    const assignmentDoc = assignmentQuery.docs[0];
    const assignmentData = assignmentDoc.data() as SeatAssignment;

    // 좌석 정보도 함께 조회
    const seatDoc = await db
      .collection("users")
      .doc(userId)
      .collection("seats")
      .doc(assignmentData.seatId)
      .get();

    const result = {
      id: assignmentDoc.id,
      ...assignmentData,
      seatInfo: seatDoc.exists ? { id: seatDoc.id, ...seatDoc.data() } : null
    };

    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error("현재 좌석 배정 조회 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});
