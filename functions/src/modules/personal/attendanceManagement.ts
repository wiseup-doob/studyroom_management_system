import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

type AttendanceStatus = "present" | "absent" | "late" | "early_leave";

interface AttendanceRecord {
  date: string;
  status: AttendanceStatus;
  seatId?: string;
  checkInTime?: admin.firestore.Timestamp;
  checkOutTime?: admin.firestore.Timestamp;
  notes?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * 출석 체크인
 */
export const checkIn = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { seatId, notes } = data;
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  try {
    const db = admin.firestore();
    const attendanceRef = db
      .collection("users")
      .doc(userId)
      .collection("attendance_records")
      .doc(today);

    // 오늘 이미 체크인했는지 확인
    const existingRecord = await attendanceRef.get();
    if (existingRecord.exists && existingRecord.data()?.checkInTime) {
      throw new functions.https.HttpsError("already-exists", "오늘 이미 체크인하셨습니다.");
    }

    const attendanceData: AttendanceRecord = {
      date: today,
      status: "present",
      seatId,
      checkInTime: admin.firestore.Timestamp.now(),
      notes,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    await attendanceRef.set(attendanceData, { merge: true });

    return {
      success: true,
      message: "체크인이 완료되었습니다.",
      data: { recordId: today, checkInTime: attendanceData.checkInTime }
    };
  } catch (error) {
    console.error("체크인 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 출석 체크아웃
 */
export const checkOut = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const today = new Date().toISOString().split("T")[0];

  try {
    const db = admin.firestore();
    const attendanceRef = db
      .collection("users")
      .doc(userId)
      .collection("attendance_records")
      .doc(today);

    const existingRecord = await attendanceRef.get();
    if (!existingRecord.exists || !existingRecord.data()?.checkInTime) {
      throw new functions.https.HttpsError("not-found", "체크인 기록을 찾을 수 없습니다.");
    }

    if (existingRecord.data()?.checkOutTime) {
      throw new functions.https.HttpsError("already-exists", "이미 체크아웃하셨습니다.");
    }

    await attendanceRef.update({
      checkOutTime: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    return {
      success: true,
      message: "체크아웃이 완료되었습니다.",
      data: { recordId: today, checkOutTime: admin.firestore.Timestamp.now() }
    };
  } catch (error) {
    console.error("체크아웃 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 출석 기록 조회 (날짜 범위)
 */
export const getAttendanceRecords = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { startDate, endDate, limit = 30 } = data;

  try {
    const db = admin.firestore();
    let query = db
      .collection("users")
      .doc(userId)
      .collection("attendance_records")
      .orderBy("date", "desc");

    if (startDate) {
      query = query.where("date", ">=", startDate);
    }
    if (endDate) {
      query = query.where("date", "<=", endDate);
    }

    query = query.limit(limit);
    const snapshot = await query.get();

    const records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      success: true,
      data: records
    };
  } catch (error) {
    console.error("출석 기록 조회 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 출석 통계 생성/업데이트
 */
export const updateAttendanceSummary = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { period } = data; // YYYY-MM 형식

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    throw new functions.https.HttpsError("invalid-argument", "올바른 기간 형식을 입력해주세요. (YYYY-MM)");
  }

  try {
    const db = admin.firestore();

    // 해당 월의 출석 기록 조회
    const startDate = `${period}-01`;
    const endDate = `${period}-31`;

    const recordsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("attendance_records")
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .get();

    // 통계 계산
    let totalDays = 0;
    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;
    let earlyLeaveDays = 0;

    recordsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      totalDays++;

      switch (data.status) {
      case "present":
        presentDays++;
        break;
      case "absent":
        absentDays++;
        break;
      case "late":
        lateDays++;
        break;
      case "early_leave":
        earlyLeaveDays++;
        break;
      }
    });

    const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    // 요약 데이터 저장
    const summaryRef = db
      .collection("users")
      .doc(userId)
      .collection("attendance_summaries")
      .doc(period);

    const summaryData: any = {
      period,
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      earlyLeaveDays,
      attendanceRate,
      updatedAt: admin.firestore.Timestamp.now()
    };

    const existingSummary = await summaryRef.get();
    if (!existingSummary.exists) {
      summaryData.createdAt = admin.firestore.Timestamp.now();
    }

    await summaryRef.set(summaryData, { merge: true });

    return {
      success: true,
      message: "출석 통계가 업데이트되었습니다.",
      data: summaryData
    };
  } catch (error) {
    console.error("출석 통계 업데이트 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});
