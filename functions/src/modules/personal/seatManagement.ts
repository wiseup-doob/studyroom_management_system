import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// ==================== 타입 정의 ====================

type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

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

  // ⭐ 출석 시스템용 추가 필드 (optional - 하위 호환성)
  studentId?: string; // 학생 ID
  studentName?: string; // 학생 이름 (캐싱)
  seatNumber?: string; // 좌석 번호 (캐싱)
  timetableId?: string; // 시간표 ID
  seatLayoutId?: string; // 좌석 배치도 ID

  // 예정 등/하원 시간 캐싱
  expectedSchedule?: {
    [key in DayOfWeek]?: {
      arrivalTime: string;
      departureTime: string;
      isActive: boolean;
    };
  };
}

interface SeatLayout {
  name: string;
  layout: {
    // ⭐ 출석 시스템용 groups 필드 (optional - 하위 호환성)
    groups?: {
      id: string;
      name: string;
      rows: number;
      cols: number;
      position: { x: number; y: number };
    }[];
    seats: {
      id: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
      // ⭐ 출석 시스템용 추가 필드 (optional)
      groupId?: string;
      row?: number;
      col?: number;
      label?: string;
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
export const createSeat = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const { seatNumber, location } = request.data;

  if (!seatNumber || !location) {
    throw new HttpsError("invalid-argument", "필수 필드가 누락되었습니다.");
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
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 좌석 목록 조회
 */
export const getSeats = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
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
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 좌석 배정 (기존 + 학생 할당 기능 확장)
 */
export const assignSeat = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { seatId, studentId, timetableId, seatLayoutId } = data;

  if (!seatId || !studentId || !seatLayoutId) {
    throw new HttpsError("invalid-argument", "seatId, studentId, seatLayoutId가 필요합니다.");
  }

  try {
    const db = admin.firestore();

    // 출석용 SeatLayout 검증 (groups 존재 여부)
    const layoutDoc = await db
      .collection("users")
      .doc(userId)
      .collection("seat_layouts")
      .doc(seatLayoutId)
      .get();

    if (!layoutDoc.exists) {
      throw new HttpsError("not-found", "좌석 배치도를 찾을 수 없습니다.");
    }

    const layoutData = layoutDoc.data();
    if (!layoutData?.layout.groups || layoutData.layout.groups.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "출석 관리용 좌석 배치도는 groups 정보가 필요합니다. 출석용 배치도를 새로 생성해주세요."
      );
    }

    // seat_layouts 내부의 좌석 정보 확인
    const seat = layoutData.layout.seats.find((s: any) => s.id === seatId);
    if (!seat) {
      throw new HttpsError("not-found", "배치도에서 해당 좌석을 찾을 수 없습니다.");
    }

    const seatNumber = seat.label || seatId;

    // ⭐ 학생 할당 검증
    let studentName = "";
    let expectedSchedule: any = undefined;

    // 학생 정보 조회
    const studentDoc = await db
      .collection("users")
      .doc(userId)
      .collection("students")
      .doc(studentId)
      .get();

    if (!studentDoc.exists) {
      throw new HttpsError("not-found", "학생을 찾을 수 없습니다.");
    }

    studentName = studentDoc.data()?.name || "";

    // 활성 시간표 조회 (timetableId가 제공되면 해당 시간표, 아니면 활성 시간표)
    let timetableDoc;
    if (timetableId) {
      timetableDoc = await db
        .collection("users")
        .doc(userId)
        .collection("student_timetables")
        .doc(timetableId)
        .get();
    } else {
      const timetableQuery = await db
        .collection("users")
        .doc(userId)
        .collection("student_timetables")
        .where("studentId", "==", studentId)
        .where("isActive", "==", true)
        .limit(1)
        .get();

      if (!timetableQuery.empty) {
        timetableDoc = timetableQuery.docs[0];
      }
    }

    if (timetableDoc && timetableDoc.exists) {
      const timetableData = timetableDoc.data();
      expectedSchedule = timetableData?.basicSchedule?.dailySchedules || {};
    } else {
      throw new HttpsError(
        "not-found",
        "학생의 활성 시간표를 찾을 수 없습니다. 시간표를 먼저 생성해주세요."
      );
    }

    // 같은 학생이 같은 배치도에 이미 배정되어 있는지 확인
    const existingAssignment = await db
      .collection("users")
      .doc(userId)
      .collection("seat_assignments")
      .where("studentId", "==", studentId)
      .where("seatLayoutId", "==", seatLayoutId)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (!existingAssignment.empty) {
      throw new HttpsError("failed-precondition", "해당 학생은 이미 이 배치도에서 좌석이 배정되어 있습니다.");
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
      updatedAt: admin.firestore.Timestamp.now(),
      studentId: studentId,
      studentName: studentName,
      seatNumber: seatNumber,
      seatLayoutId: seatLayoutId,
      expectedSchedule: expectedSchedule
    };

    if (timetableId) {
      assignmentData.timetableId = timetableId;
    }

    await assignmentRef.set(assignmentData);

    return {
      success: true,
      message: `${studentName} 학생에게 좌석이 배정되었습니다.`,
      data: { assignmentId: assignmentRef.id }
    };
  } catch (error) {
    console.error("좌석 배정 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 좌석 배정 해제
 */
export const unassignSeat = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
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
        throw new HttpsError("not-found", "좌석 배정을 찾을 수 없습니다.");
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
        throw new HttpsError("not-found", "활성 좌석 배정이 없습니다.");
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
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 좌석 배치도 생성
 * 출석용 배치도인 경우 groups 필드 검증 포함
 */
export const createSeatLayout = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { name, layout } = data;

  if (!name || !layout) {
    throw new HttpsError("invalid-argument", "필수 필드가 누락되었습니다.");
  }

  // ⭐ groups 검증 (출석용 배치도인 경우만)
  if (layout.groups) {
    // groups 배열 검증
    if (!Array.isArray(layout.groups) || layout.groups.length === 0) {
      throw new HttpsError("invalid-argument", "groups는 배열이어야 하며 최소 1개 이상의 그룹이 필요합니다.");
    }

    // 각 group 필드 검증
    for (const group of layout.groups) {
      if (!group.id || !group.name || !group.rows || !group.cols || !group.position) {
        throw new HttpsError("invalid-argument", "그룹 정보가 불완전합니다.");
      }
    }
  }

  // seats 검증
  if (!layout.seats || !Array.isArray(layout.seats) || layout.seats.length === 0) {
    throw new HttpsError("invalid-argument", "최소 1개 이상의 좌석이 필요합니다.");
  }

  // 각 좌석의 기본 필드 검증
  for (const seat of layout.seats) {
    if (!seat.id || !seat.position || !seat.size) {
      throw new HttpsError("invalid-argument", "좌석 정보가 불완전합니다.");
    }

    // ⭐ groups가 있을 때만 groupId, row, col 검증 (하위 호환성)
    if (layout.groups && layout.groups.length > 0) {
      if (!seat.groupId || seat.row === undefined || seat.col === undefined) {
        throw new HttpsError(
          "invalid-argument",
          `좌석 ${seat.id}에 groupId, row, col이 필요합니다.`
        );
      }

      // groupId 유효성 검증
      const groupExists = layout.groups.some((g: any) => g.id === seat.groupId);
      if (!groupExists) {
        throw new HttpsError(
          "invalid-argument",
          `좌석 ${seat.id}의 유효하지 않은 groupId: ${seat.groupId}`
        );
      }

      // row, col 범위 검증
      const group = layout.groups.find((g: any) => g.id === seat.groupId);
      if (seat.row < 0 || seat.row >= group.rows) {
        throw new HttpsError(
          "invalid-argument",
          `좌석 ${seat.id}의 row(${seat.row})가 그룹 범위(0-${group.rows - 1})를 벗어났습니다.`
        );
      }
      if (seat.col < 0 || seat.col >= group.cols) {
        throw new HttpsError(
          "invalid-argument",
          `좌석 ${seat.id}의 col(${seat.col})가 그룹 범위(0-${group.cols - 1})를 벗어났습니다.`
        );
      }
    }
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
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 좌석 배치도 목록 조회
 */
export const getSeatLayouts = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;

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
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 현재 좌석 배정 상태 조회
 */
export const getCurrentSeatAssignment = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;

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
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 학생 시간표 검증 (좌석 할당 전)
 */
export const validateStudentTimetableForSeat = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { studentId } = data;

  if (!studentId) {
    throw new HttpsError("invalid-argument", "studentId가 필요합니다.");
  }

  try {
    const db = admin.firestore();

    // 1. 학생 존재 확인
    const studentDoc = await db
      .collection("users")
      .doc(userId)
      .collection("students")
      .doc(studentId)
      .get();

    if (!studentDoc.exists) {
      throw new HttpsError("not-found", "학생을 찾을 수 없습니다.");
    }

    // 2. 학생의 활성 시간표 조회
    const timetablesSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("student_timetables")
      .where("studentId", "==", studentId)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (timetablesSnapshot.empty) {
      return {
        success: false,
        message: "활성 시간표가 없습니다. 먼저 시간표를 생성하세요."
      };
    }

    const timetable = timetablesSnapshot.docs[0].data();
    const { basicSchedule } = timetable;

    // 3. dailySchedules 검증
    const activeDays = Object.entries(basicSchedule.dailySchedules)
      .filter(([, schedule]: [string, any]) => schedule.isActive);

    if (activeDays.length === 0) {
      return {
        success: false,
        message: "시간표에 활성화된 요일이 없습니다."
      };
    }

    // 4. 각 활성 요일의 등/하원 시간 확인
    for (const [day, schedule] of activeDays) {
      const scheduleData = schedule as any;
      if (!scheduleData.arrivalTime || !scheduleData.departureTime) {
        return {
          success: false,
          message: `${day} 요일의 등원 또는 하원 시간이 설정되지 않았습니다.`
        };
      }
    }

    // 5. 검증 통과
    return {
      success: true,
      data: {
        timetableId: timetablesSnapshot.docs[0].id,
        activeDays: activeDays.map(([day, schedule]: [string, any]) => ({
          day,
          arrivalTime: schedule.arrivalTime,
          departureTime: schedule.departureTime
        }))
      }
    };
  } catch (error) {
    console.error("시간표 검증 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 특정 배치도의 좌석 할당 목록 조회
 *
 * ⚠️ getCurrentSeatAssignment는 사용자의 단일 할당만 반환하므로
 * 출석 시스템에서는 특정 배치도의 모든 학생 할당이 필요하여 이 함수 추가
 */
export const getSeatAssignments = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { seatLayoutId } = data;

  if (!seatLayoutId) {
    throw new HttpsError("invalid-argument", "seatLayoutId가 필요합니다.");
  }

  try {
    const db = admin.firestore();
    const snapshot = await db
      .collection("users")
      .doc(userId)
      .collection("seat_assignments")
      .where("seatLayoutId", "==", seatLayoutId)
      .where("status", "==", "active")
      .orderBy("assignedAt", "desc")
      .get();

    const assignments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      success: true,
      data: assignments
    };
  } catch (error) {
    console.error("좌석 할당 목록 조회 오류:", error);
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 좌석 배치도 수정
 */
export const updateSeatLayout = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { seatLayoutId, name, layout } = data;

  if (!seatLayoutId) {
    throw new HttpsError("invalid-argument", "seatLayoutId가 필요합니다.");
  }

  if (!name && !layout) {
    throw new HttpsError("invalid-argument", "수정할 데이터가 필요합니다.");
  }

  try {
    const db = admin.firestore();

    // 배치도 존재 확인
    const layoutRef = db
      .collection("users")
      .doc(userId)
      .collection("seat_layouts")
      .doc(seatLayoutId);

    const layoutDoc = await layoutRef.get();
    if (!layoutDoc.exists) {
      throw new HttpsError("not-found", "좌석 배치도를 찾을 수 없습니다.");
    }

    // 업데이트 데이터 준비
    const updateData: any = {
      updatedAt: admin.firestore.Timestamp.now()
    };

    if (name) {
      updateData.name = name;
    }

    if (layout) {
      updateData.layout = layout;
    }

    // 배치도 업데이트
    await layoutRef.update(updateData);

    return {
      success: true,
      message: "좌석 배치도가 수정되었습니다."
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "좌석 배치도 수정 중 오류가 발생했습니다.");
  }
});

/**
 * 좌석 배치도 삭제
 * 배치도와 관련된 모든 데이터를 함께 삭제합니다:
 * - seat_assignments (모든 상태)
 * - student_attendance_records
 * - attendance_check_links
 */
export const deleteSeatLayout = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { seatLayoutId } = data;

  if (!seatLayoutId) {
    throw new HttpsError("invalid-argument", "seatLayoutId가 필요합니다.");
  }

  try {
    const db = admin.firestore();

    // 1. 배치도 존재 확인
    const layoutDoc = await db
      .collection("users")
      .doc(userId)
      .collection("seat_layouts")
      .doc(seatLayoutId)
      .get();

    if (!layoutDoc.exists) {
      throw new HttpsError("not-found", "좌석 배치도를 찾을 수 없습니다.");
    }

    // 2. 관련 데이터 일괄 삭제 (500개씩 청크로 처리)

    // Helper: 문서 배열을 500개씩 나눠서 삭제
    const deleteInChunks = async (docs: admin.firestore.QueryDocumentSnapshot[]) => {
      const chunkSize = 500;
      for (let i = 0; i < docs.length; i += chunkSize) {
        const chunk = docs.slice(i, i + chunkSize);
        const chunkBatch = db.batch();
        chunk.forEach(doc => chunkBatch.delete(doc.ref));
        await chunkBatch.commit();
      }
      return docs.length;
    };

    // 2-1. 해당 배치도의 모든 좌석 할당 삭제 (모든 상태)
    const assignmentsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("seat_assignments")
      .where("seatLayoutId", "==", seatLayoutId)
      .get();

    const deletedAssignments = await deleteInChunks(assignmentsSnapshot.docs);

    // 2-2. 해당 배치도의 출석 기록 삭제
    const attendanceRecordsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("student_attendance_records")
      .where("seatLayoutId", "==", seatLayoutId)
      .get();

    const deletedAttendanceRecords = await deleteInChunks(attendanceRecordsSnapshot.docs);

    // 2-3. 해당 배치도의 출석 체크 링크 삭제
    const checkLinksSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("attendance_check_links")
      .where("seatLayoutId", "==", seatLayoutId)
      .get();

    const deletedCheckLinks = await deleteInChunks(checkLinksSnapshot.docs);

    // 2-4. 배치도 자체 삭제 (별도 배치)
    const finalBatch = db.batch();
    finalBatch.delete(layoutDoc.ref);
    await finalBatch.commit();

    return {
      success: true,
      message: `좌석 배치도와 관련된 데이터가 삭제되었습니다. (삭제된 문서: ${deletedAssignments + deletedAttendanceRecords + deletedCheckLinks + 1}개)`,
      data: {
        deletedAssignments,
        deletedAttendanceRecords,
        deletedCheckLinks
      }
    };
  } catch (error) {
    console.error("좌석 배치도 삭제 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});
