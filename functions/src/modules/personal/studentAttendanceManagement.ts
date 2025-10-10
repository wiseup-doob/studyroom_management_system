/**
 * 학생 출석 관리 Cloud Functions
 * ATTENDANCE_DATABASE_DESIGN.md 기준 구현
 *
 * - 학생 출석 기록 관리
 * - PIN 기반 출석 체크
 * - 출석 체크 링크 관리
 * - 학생 PIN 관리
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

// ==================== 타입 정의 ====================

type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

type StudentAttendanceStatus =
  | "checked_in" // 등원 (실제 등원 완료)
  | "checked_out" // 하원 (실제 하원 완료)
  | "not_arrived" // 미등원 (예정 시간 지났지만 미출석)
  | "absent_excused" // 사유결석
  | "absent_unexcused"; // 무단결석

interface StudentAttendanceRecord {
  id: string;
  userId: string;
  studentId: string;
  studentName: string;
  seatLayoutId: string;
  seatId: string;
  seatNumber: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: DayOfWeek;
  expectedArrivalTime: string;
  expectedDepartureTime: string;
  actualArrivalTime?: admin.firestore.Timestamp;
  actualDepartureTime?: admin.firestore.Timestamp;
  status: StudentAttendanceStatus;
  excusedReason?: string;
  excusedNote?: string;
  excusedBy?: string;
  isLate: boolean;
  isEarlyLeave: boolean;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  checkInMethod?: "pin" | "manual" | "admin";
  checkOutMethod?: "pin" | "manual" | "admin";
  notes?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  recordTimestamp: admin.firestore.Timestamp;
}

interface AttendanceCheckLink {
  id: string;
  userId: string;
  linkToken: string;
  linkUrl: string;
  seatLayoutId: string;
  seatLayoutName: string;
  title: string;
  description?: string;
  isActive: boolean;
  expiresAt?: admin.firestore.Timestamp;
  usageCount: number;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

interface AttendanceStudentPin {
  id: string; // studentId와 동일
  userId: string;
  studentId: string;
  studentName: string;
  pinHash: string; // bcrypt 해시값
  actualPin: string; // 실제 PIN (관리자 확인용)
  isActive: boolean;
  isLocked: boolean;
  failedAttempts: number;
  lastFailedAt?: admin.firestore.Timestamp;
  lastChangedAt: admin.firestore.Timestamp;
  lastUsedAt?: admin.firestore.Timestamp;
  changeHistory?: {
    changedAt: admin.firestore.Timestamp;
    changedBy: string;
  }[];
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// ==================== 유틸리티 함수 ====================

/**
 * UTC+9 시간대 적용하여 한국 날짜 계산
 */
function getTodayInKorea(): string {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  return koreaTime.toISOString().split("T")[0];
}

/**
 * 요일 계산
 */
function getDayOfWeek(date: Date): DayOfWeek {
  const days: DayOfWeek[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[date.getDay()];
}

/**
 * 시간 비교 (HH:mm 형식)
 */
function parseTime(timeString: string): number {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

// ==================== PIN 관리 Functions ====================

/**
 * 학생 PIN 생성
 */
export const generateStudentPin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { studentId, pin } = data;

  if (!studentId || !pin) {
    throw new HttpsError("invalid-argument", "studentId와 pin이 필요합니다.");
  }

  // PIN 형식 검증 (4-6자리 숫자)
  if (!/^\d{4,6}$/.test(pin)) {
    throw new HttpsError("invalid-argument", "PIN은 4-6자리 숫자여야 합니다.");
  }

  try {
    const db = admin.firestore();

    // 학생 존재 확인
    const studentDoc = await db
      .collection("users")
      .doc(userId)
      .collection("students")
      .doc(studentId)
      .get();

    if (!studentDoc.exists) {
      throw new HttpsError("not-found", "학생을 찾을 수 없습니다.");
    }

    const studentName = studentDoc.data()?.name || "";

    // PIN 중복 확인 (같은 사용자 내)
    const pinsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("attendance_student_pins")
      .get();

    for (const doc of pinsSnapshot.docs) {
      const data = doc.data() as AttendanceStudentPin;
      if (data.isActive && doc.id !== studentId) {
        const isMatch = await bcrypt.compare(pin, data.pinHash);
        if (isMatch) {
          throw new HttpsError("already-exists", "이미 사용 중인 PIN입니다. 다른 PIN을 선택해주세요.");
        }
      }
    }

    // PIN 해싱
    const saltRounds = 10;
    const pinHash = await bcrypt.hash(pin, saltRounds);

    const pinRef = db
      .collection("users")
      .doc(userId)
      .collection("attendance_student_pins")
      .doc(studentId);

    const pinData: AttendanceStudentPin = {
      id: studentId,
      userId,
      studentId,
      studentName,
      pinHash,
      actualPin: pin, // 실제 PIN 저장 (관리자 확인용)
      isActive: true,
      isLocked: false,
      failedAttempts: 0,
      lastChangedAt: admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    await pinRef.set(pinData);

    return {
      success: true,
      message: `${studentName} 학생의 PIN이 생성되었습니다.`,
      data: { studentId }
    };
  } catch (error) {
    console.error("PIN 생성 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 학생 PIN 변경
 */
export const updateStudentPin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { studentId, newPin } = data;

  if (!studentId || !newPin) {
    throw new HttpsError("invalid-argument", "studentId와 newPin이 필요합니다.");
  }

  // PIN 형식 검증
  if (!/^\d{4,6}$/.test(newPin)) {
    throw new HttpsError("invalid-argument", "PIN은 4-6자리 숫자여야 합니다.");
  }

  try {
    const db = admin.firestore();
    const pinRef = db
      .collection("users")
      .doc(userId)
      .collection("attendance_student_pins")
      .doc(studentId);

    const pinDoc = await pinRef.get();
    if (!pinDoc.exists) {
      throw new HttpsError("not-found", "PIN을 찾을 수 없습니다.");
    }

    const existingPin = pinDoc.data() as AttendanceStudentPin;

    // PIN 중복 확인
    const pinsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("attendance_student_pins")
      .get();

    for (const doc of pinsSnapshot.docs) {
      const data = doc.data() as AttendanceStudentPin;
      if (data.isActive && doc.id !== studentId) {
        const isMatch = await bcrypt.compare(newPin, data.pinHash);
        if (isMatch) {
          throw new HttpsError("already-exists", "이미 사용 중인 PIN입니다.");
        }
      }
    }

    // 새 PIN 해싱
    const saltRounds = 10;
    const pinHash = await bcrypt.hash(newPin, saltRounds);

    // 변경 이력 업데이트 (최근 3개 유지)
    const changeHistory = existingPin.changeHistory || [];
    changeHistory.unshift({
      changedAt: admin.firestore.Timestamp.now(),
      changedBy: userId
    });
    if (changeHistory.length > 3) {
      changeHistory.pop();
    }

    await pinRef.update({
      pinHash,
      actualPin: newPin, // 실제 PIN 업데이트 (관리자 확인용)
      isLocked: false, // 잠금 해제
      failedAttempts: 0, // 실패 횟수 초기화
      lastChangedAt: admin.firestore.Timestamp.now(),
      changeHistory,
      updatedAt: admin.firestore.Timestamp.now()
    });

    return {
      success: true,
      message: "PIN이 변경되었습니다."
    };
  } catch (error) {
    console.error("PIN 변경 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * PIN 잠금 해제
 */
export const unlockStudentPin = onCall(async (request) => {
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
    const pinRef = db
      .collection("users")
      .doc(userId)
      .collection("attendance_student_pins")
      .doc(studentId);

    const pinDoc = await pinRef.get();
    if (!pinDoc.exists) {
      throw new HttpsError("not-found", "PIN을 찾을 수 없습니다.");
    }

    await pinRef.update({
      isLocked: false,
      failedAttempts: 0,
      updatedAt: admin.firestore.Timestamp.now()
    });

    return {
      success: true,
      message: "PIN 잠금이 해제되었습니다."
    };
  } catch (error) {
    console.error("PIN 잠금 해제 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

// ==================== 출석 체크 링크 관리 ====================

/**
 * 출석 체크 링크 생성
 */
export const createAttendanceCheckLink = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { seatLayoutId, title, description, expiresInDays } = data;

  if (!seatLayoutId || !title) {
    throw new HttpsError("invalid-argument", "seatLayoutId와 title이 필요합니다.");
  }

  try {
    const db = admin.firestore();

    // 좌석 배치도 확인
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
    const seatLayoutName = layoutData?.name || "";

    // 링크 토큰 생성
    const linkToken = uuidv4();
    const baseUrl = process.env.ATTENDANCE_BASE_URL || "https://studyroom-attendance.web.app";
    const linkUrl = `${baseUrl}/attendance/check/${linkToken}`;

    const linkRef = db
      .collection("users")
      .doc(userId)
      .collection("attendance_check_links")
      .doc();

    const linkData: AttendanceCheckLink = {
      id: linkRef.id,
      userId,
      linkToken,
      linkUrl,
      seatLayoutId,
      seatLayoutName,
      title,
      description,
      isActive: true,
      usageCount: 0,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    if (expiresInDays) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      linkData.expiresAt = admin.firestore.Timestamp.fromDate(expiresAt);
    }

    await linkRef.set(linkData);

    return {
      success: true,
      message: "출석 체크 링크가 생성되었습니다.",
      data: {
        linkId: linkRef.id,
        linkToken,
        linkUrl
      }
    };
  } catch (error) {
    console.error("출석 체크 링크 생성 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 출석 체크 링크 목록 조회
 */
export const getAttendanceCheckLinks = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;

  try {
    const db = admin.firestore();
    const snapshot = await db
      .collection("users")
      .doc(userId)
      .collection("attendance_check_links")
      .orderBy("createdAt", "desc")
      .get();

    const links = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      success: true,
      data: links
    };
  } catch (error) {
    console.error("출석 체크 링크 조회 오류:", error);
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * PIN으로 출석/하원 체크
 */
export const checkAttendanceByPin = onCall(async (request) => {
  const { linkToken, pin } = request.data;

  if (!linkToken || !pin) {
    throw new HttpsError("invalid-argument", "linkToken과 pin이 필요합니다.");
  }

  try {
    const db = admin.firestore();

    // 1. 링크 토큰으로 교실 정보 조회
    const linkSnapshot = await db
      .collectionGroup("attendance_check_links")
      .where("linkToken", "==", linkToken)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (linkSnapshot.empty) {
      throw new HttpsError("not-found", "유효하지 않은 출석 체크 링크입니다.");
    }

    const linkDoc = linkSnapshot.docs[0];
    const linkData = linkDoc.data() as AttendanceCheckLink;
    const userId = linkData.userId;
    const seatLayoutId = linkData.seatLayoutId;

    // 링크 만료 확인
    if (linkData.expiresAt && linkData.expiresAt.toMillis() < Date.now()) {
      throw new HttpsError("failed-precondition", "만료된 출석 체크 링크입니다.");
    }

    // 2. PIN 검증 (최적화된 방식)
    const pinsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("attendance_student_pins")
      .where("isActive", "==", true)
      .get();

    let matchedPin: AttendanceStudentPin | null = null;
    let matchedPinRef: admin.firestore.DocumentReference | null = null;
    let lockedPinFound = false;

    // 모든 PIN을 한 번에 검증 (병렬 처리)
    const pinChecks = pinsSnapshot.docs.map(async (doc) => {
      const pinData = doc.data() as AttendanceStudentPin;
      const isMatch = await bcrypt.compare(pin, pinData.pinHash);
      
      return {
        doc,
        pinData,
        isMatch,
        isLocked: pinData.isLocked
      };
    });

    const results = await Promise.all(pinChecks);

    // 결과 분석
    for (const result of results) {
      if (result.isMatch) {
        if (result.isLocked) {
          lockedPinFound = true;
        } else {
          matchedPin = result.pinData;
          matchedPinRef = result.doc.ref;
          break;
        }
      }
    }

    // 잠긴 PIN이 매치된 경우
    if (lockedPinFound && !matchedPin) {
      throw new HttpsError("failed-precondition", "PIN이 잠겨있습니다. 관리자에게 문의하세요.");
    }

    // PIN이 매치되지 않은 경우
    if (!matchedPin || !matchedPinRef) {
      throw new HttpsError("invalid-argument", "잘못된 PIN입니다.");
    }

    const studentId = matchedPin.studentId;
    const studentName = matchedPin.studentName;

    // PIN 성공: failedAttempts 초기화
    await matchedPinRef.update({
      failedAttempts: 0,
      updatedAt: admin.firestore.Timestamp.now()
    });

    // 3. 좌석 할당 확인
    const assignmentSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("seat_assignments")
      .where("studentId", "==", studentId)
      .where("seatLayoutId", "==", seatLayoutId)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (assignmentSnapshot.empty) {
      throw new HttpsError("not-found", "해당 좌석 배치도에 좌석이 할당되지 않았습니다.");
    }

    const assignment = assignmentSnapshot.docs[0].data();
    const today = getTodayInKorea();
    const now = new Date();
    const dayOfWeek = getDayOfWeek(now);
    const recordId = `${studentId}_${today.replace(/-/g, "")}`;

    // 3-1. seatNumber Fallback 로직 (캐싱 누락 방어)
    let seatNumber = assignment.seatNumber;
    if (!seatNumber) {
      const seatDoc = await db
        .collection("users")
        .doc(userId)
        .collection("seats")
        .doc(assignment.seatId)
        .get();

      if (seatDoc.exists) {
        seatNumber = seatDoc.data()?.seatNumber || "";
      } else {
        throw new HttpsError("not-found", "좌석 정보를 찾을 수 없습니다.");
      }
    }

    // 4. 오늘 출석 기록 조회/생성
    const recordRef = db
      .collection("users")
      .doc(userId)
      .collection("student_attendance_records")
      .doc(recordId);

    const recordDoc = await recordRef.get();
    const timestamp = admin.firestore.Timestamp.now();

    if (!recordDoc.exists) {
      // 첫 체크인 (등원)
      const expectedArrival = assignment.expectedSchedule?.[dayOfWeek]?.arrivalTime || "09:00";
      const expectedDeparture = assignment.expectedSchedule?.[dayOfWeek]?.departureTime || "18:00";

      // 지각 계산
      const currentMinutes = now.getHours() * 60 + now.getMinutes() + (9 * 60); // UTC+9
      const expectedMinutes = parseTime(expectedArrival);
      const isLate = currentMinutes > expectedMinutes + 10; // 10분 유예
      const lateMinutes = isLate ? currentMinutes - expectedMinutes : undefined;

      const attendanceData: StudentAttendanceRecord = {
        id: recordId,
        userId,
        studentId,
        studentName,
        seatLayoutId: assignment.seatLayoutId,
        seatId: assignment.seatId,
        seatNumber,
        date: today,
        dayOfWeek,
        expectedArrivalTime: expectedArrival,
        expectedDepartureTime: expectedDeparture,
        actualArrivalTime: timestamp,
        status: "checked_in",
        isLate,
        isEarlyLeave: false,
        lateMinutes,
        checkInMethod: "pin",
        createdAt: timestamp,
        updatedAt: timestamp,
        recordTimestamp: timestamp
      };

      await recordRef.set(attendanceData);

      // 링크 사용 횟수 증가
      await linkDoc.ref.update({
        usageCount: admin.firestore.FieldValue.increment(1),
        updatedAt: timestamp
      });

      return {
        success: true,
        message: `${studentName}님, 등원이 완료되었습니다.${isLate ? " (지각)" : ""}`,
        action: "checked_in",
        data: { isLate, lateMinutes }
      };
    } else {
      // 두 번째 체크 (하원)
      const recordData = recordDoc.data() as StudentAttendanceRecord;

      if (recordData.status === "checked_in") {
        // 조퇴 계산
        const currentMinutes = now.getHours() * 60 + now.getMinutes() + (9 * 60);
        const expectedMinutes = parseTime(recordData.expectedDepartureTime);
        const isEarlyLeave = currentMinutes < expectedMinutes - 30; // 30분 전 조퇴
        const earlyLeaveMinutes = isEarlyLeave ? expectedMinutes - currentMinutes : undefined;

        await recordRef.update({
          actualDepartureTime: timestamp,
          status: "checked_out",
          isEarlyLeave,
          earlyLeaveMinutes,
          checkOutMethod: "pin",
          updatedAt: timestamp
        });

        // 링크 사용 횟수 증가
        await linkDoc.ref.update({
          usageCount: admin.firestore.FieldValue.increment(1),
          updatedAt: timestamp
        });

        return {
          success: true,
          message: `${studentName}님, 하원이 완료되었습니다.${isEarlyLeave ? " (조퇴)" : ""}`,
          action: "checked_out",
          data: { isEarlyLeave, earlyLeaveMinutes }
        };
      } else {
        throw new HttpsError("failed-precondition", "이미 하원 처리되었습니다.");
      }
    }
  } catch (error) {
    console.error("출석 체크 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 학생 출석 기록 조회
 */
export const getStudentAttendanceRecords = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { studentId, startDate, endDate, limit = 30 } = data;

  try {
    const db = admin.firestore();
    let query = db
      .collection("users")
      .doc(userId)
      .collection("student_attendance_records")
      .orderBy("date", "desc");

    if (studentId) {
      query = query.where("studentId", "==", studentId);
    }
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
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 출석 상태 수동 변경 (관리자)
 */
export const updateAttendanceStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { recordId, status, excusedReason, excusedNote } = data;

  if (!recordId || !status) {
    throw new HttpsError("invalid-argument", "recordId와 status가 필요합니다.");
  }

  const validStatuses: StudentAttendanceStatus[] = ["checked_in", "checked_out", "not_arrived", "absent_excused", "absent_unexcused"];
  if (!validStatuses.includes(status)) {
    throw new HttpsError("invalid-argument", "유효하지 않은 status입니다.");
  }

  try {
    const db = admin.firestore();
    const recordRef = db
      .collection("users")
      .doc(userId)
      .collection("student_attendance_records")
      .doc(recordId);

    const recordDoc = await recordRef.get();
    if (!recordDoc.exists) {
      throw new HttpsError("not-found", "출석 기록을 찾을 수 없습니다.");
    }

    const updateData: any = {
      status,
      updatedAt: admin.firestore.Timestamp.now()
    };

    if (status === "absent_excused") {
      updateData.excusedReason = excusedReason;
      updateData.excusedNote = excusedNote;
      updateData.excusedBy = userId;
    }

    await recordRef.update(updateData);

    return {
      success: true,
      message: "출석 상태가 변경되었습니다."
    };
  } catch (error) {
    console.error("출석 상태 변경 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 오늘 출석 기록 조회 (특정 좌석 배치도)
 *
 * 💡 대안: 프론트엔드에서 getStudentAttendanceRecords({ seatLayoutId, startDate: today, endDate: today })로
 * 기존 함수를 재사용하는 것도 가능. 하지만 편의성을 위해 전용 함수 제공
 */
export const getTodayAttendanceRecords = onCall(async (request) => {
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
    const today = getTodayInKorea(); // 기존 유틸리티 함수 사용

    const snapshot = await db
      .collection("users")
      .doc(userId)
      .collection("student_attendance_records")
      .where("seatLayoutId", "==", seatLayoutId)
      .where("date", "==", today)
      .orderBy("recordTimestamp", "desc")
      .get();

    const records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      success: true,
      data: records
    };
  } catch (error) {
    console.error("오늘 출석 기록 조회 오류:", error);
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 출석 기록 상세 조회
 */
export const getAttendanceRecord = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { recordId } = data;

  if (!recordId) {
    throw new HttpsError("invalid-argument", "recordId가 필요합니다.");
  }

  try {
    const db = admin.firestore();
    const recordDoc = await db
      .collection("users")
      .doc(userId)
      .collection("student_attendance_records")
      .doc(recordId)
      .get();

    if (!recordDoc.exists) {
      throw new HttpsError("not-found", "출석 기록을 찾을 수 없습니다.");
    }

    return {
      success: true,
      data: {
        id: recordDoc.id,
        ...recordDoc.data()
      }
    };
  } catch (error) {
    console.error("출석 기록 조회 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 학생 PIN 정보 조회
 */
export const getStudentPin = onCall(async (request) => {
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
    const pinDoc = await db
      .collection("users")
      .doc(userId)
      .collection("attendance_student_pins")
      .doc(studentId)
      .get();

    if (!pinDoc.exists) {
      return {
        success: true,
        data: null,
        message: "PIN이 설정되지 않았습니다."
      };
    }

    const pinData = pinDoc.data() as AttendanceStudentPin;

    // ⚠️ 보안: pinHash는 반환하지 않음
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pinHash, ...safeData } = pinData;

    return {
      success: true,
      data: safeData
    };
  } catch (error) {
    console.error("PIN 조회 오류:", error);
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 출석 체크 링크 비활성화
 */
export const deactivateAttendanceCheckLink = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { linkId } = data;

  if (!linkId) {
    throw new HttpsError("invalid-argument", "linkId가 필요합니다.");
  }

  try {
    const db = admin.firestore();
    const linkRef = db
      .collection("users")
      .doc(userId)
      .collection("attendance_check_links")
      .doc(linkId);

    const linkDoc = await linkRef.get();
    if (!linkDoc.exists) {
      throw new HttpsError("not-found", "출석 체크 링크를 찾을 수 없습니다.");
    }

    await linkRef.update({
      isActive: false,
      updatedAt: admin.firestore.Timestamp.now()
    });

    return {
      success: true,
      message: "출석 체크 링크가 비활성화되었습니다."
    };
  } catch (error) {
    console.error("링크 비활성화 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 출석 체크 링크 활성화
 *
 * 비활성화된 링크를 다시 활성화합니다.
 */
export const activateAttendanceCheckLink = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { linkId } = data;

  if (!linkId) {
    throw new HttpsError("invalid-argument", "linkId가 필요합니다.");
  }

  try {
    const db = admin.firestore();
    const linkRef = db
      .collection("users")
      .doc(userId)
      .collection("attendance_check_links")
      .doc(linkId);

    const linkDoc = await linkRef.get();
    if (!linkDoc.exists) {
      throw new HttpsError("not-found", "출석 체크 링크를 찾을 수 없습니다.");
    }

    await linkRef.update({
      isActive: true,
      updatedAt: admin.firestore.Timestamp.now()
    });

    return {
      success: true,
      message: "출석 체크 링크가 활성화되었습니다."
    };
  } catch (error) {
    console.error("링크 활성화 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 출석 체크 링크 삭제
 *
 * 링크를 완전히 삭제합니다 (되돌릴 수 없음).
 */
export const deleteAttendanceCheckLink = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { linkId } = data;

  if (!linkId) {
    throw new HttpsError("invalid-argument", "linkId가 필요합니다.");
  }

  try {
    const db = admin.firestore();
    const linkRef = db
      .collection("users")
      .doc(userId)
      .collection("attendance_check_links")
      .doc(linkId);

    const linkDoc = await linkRef.get();
    if (!linkDoc.exists) {
      throw new HttpsError("not-found", "출석 체크 링크를 찾을 수 없습니다.");
    }

    // 링크 삭제
    await linkRef.delete();

    return {
      success: true,
      message: "출석 체크 링크가 삭제되었습니다."
    };
  } catch (error) {
    console.error("링크 삭제 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 수동 체크인 (관리자)
 *
 * checkAttendanceByPin과 유사하지만 PIN 검증 없이 관리자가 직접 처리
 */
export const manualCheckIn = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { studentId, seatLayoutId } = data;

  if (!studentId || !seatLayoutId) {
    throw new HttpsError("invalid-argument", "studentId와 seatLayoutId가 필요합니다.");
  }

  try {
    const db = admin.firestore();

    // 1. 학생 정보 조회
    const studentDoc = await db
      .collection("users")
      .doc(userId)
      .collection("students")
      .doc(studentId)
      .get();

    if (!studentDoc.exists) {
      throw new HttpsError("not-found", "학생을 찾을 수 없습니다.");
    }

    const studentName = studentDoc.data()?.name || "";

    // 2. 좌석 할당 확인
    const assignmentSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("seat_assignments")
      .where("studentId", "==", studentId)
      .where("seatLayoutId", "==", seatLayoutId)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (assignmentSnapshot.empty) {
      throw new HttpsError("not-found", "해당 좌석 배치도에 좌석이 할당되지 않았습니다.");
    }

    const assignment = assignmentSnapshot.docs[0].data();
    const today = getTodayInKorea();
    const now = new Date();
    const dayOfWeek = getDayOfWeek(now);
    const recordId = `${studentId}_${today.replace(/-/g, "")}`;

    // seatNumber Fallback
    let seatNumber = assignment.seatNumber;
    if (!seatNumber) {
      const seatDoc = await db
        .collection("users")
        .doc(userId)
        .collection("seats")
        .doc(assignment.seatId)
        .get();

      if (seatDoc.exists) {
        seatNumber = seatDoc.data()?.seatNumber || "";
      } else {
        throw new HttpsError("not-found", "좌석 정보를 찾을 수 없습니다.");
      }
    }

    // 3. 오늘 출석 기록 확인
    const recordRef = db
      .collection("users")
      .doc(userId)
      .collection("student_attendance_records")
      .doc(recordId);

    const recordDoc = await recordRef.get();
    const timestamp = admin.firestore.Timestamp.now();

    if (recordDoc.exists) {
      throw new HttpsError("failed-precondition", "이미 체크인 기록이 있습니다.");
    }

    // 4. 체크인 생성
    const expectedArrival = assignment.expectedSchedule?.[dayOfWeek]?.arrivalTime || "09:00";
    const expectedDeparture = assignment.expectedSchedule?.[dayOfWeek]?.departureTime || "18:00";

    // 지각 계산
    const currentMinutes = now.getHours() * 60 + now.getMinutes() + (9 * 60); // UTC+9
    const expectedMinutes = parseTime(expectedArrival);
    const isLate = currentMinutes > expectedMinutes + 10; // 10분 유예
    const lateMinutes = isLate ? currentMinutes - expectedMinutes : undefined;

    const attendanceData: StudentAttendanceRecord = {
      id: recordId,
      userId,
      studentId,
      studentName,
      seatLayoutId: assignment.seatLayoutId,
      seatId: assignment.seatId,
      seatNumber,
      date: today,
      dayOfWeek,
      expectedArrivalTime: expectedArrival,
      expectedDepartureTime: expectedDeparture,
      actualArrivalTime: timestamp,
      status: "checked_in",
      isLate,
      isEarlyLeave: false,
      lateMinutes,
      checkInMethod: "manual",
      createdAt: timestamp,
      updatedAt: timestamp,
      recordTimestamp: timestamp
    };

    await recordRef.set(attendanceData);

    return {
      success: true,
      message: `${studentName}님 수동 체크인이 완료되었습니다.${isLate ? " (지각)" : ""}`,
      data: { isLate, lateMinutes }
    };
  } catch (error) {
    console.error("수동 체크인 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 수동 체크아웃 (관리자)
 *
 * checkAttendanceByPin의 체크아웃 로직과 유사하지만 PIN 검증 없이 관리자가 직접 처리
 */
export const manualCheckOut = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { studentId, seatLayoutId } = data;

  if (!studentId || !seatLayoutId) {
    throw new HttpsError("invalid-argument", "studentId와 seatLayoutId가 필요합니다.");
  }

  try {
    const db = admin.firestore();

    // 1. 학생 정보 조회
    const studentDoc = await db
      .collection("users")
      .doc(userId)
      .collection("students")
      .doc(studentId)
      .get();

    if (!studentDoc.exists) {
      throw new HttpsError("not-found", "학생을 찾을 수 없습니다.");
    }

    const studentName = studentDoc.data()?.name || "";

    // 2. 오늘 출석 기록 조회
    const today = getTodayInKorea();
    const recordId = `${studentId}_${today.replace(/-/g, "")}`;

    const recordRef = db
      .collection("users")
      .doc(userId)
      .collection("student_attendance_records")
      .doc(recordId);

    const recordDoc = await recordRef.get();

    if (!recordDoc.exists) {
      throw new HttpsError("not-found", "체크인 기록이 없습니다. 먼저 체크인을 진행하세요.");
    }

    const recordData = recordDoc.data() as StudentAttendanceRecord;

    if (recordData.status !== "checked_in") {
      throw new HttpsError("failed-precondition", "이미 체크아웃 처리되었습니다.");
    }

    // 3. 체크아웃 처리
    const now = new Date();
    const timestamp = admin.firestore.Timestamp.now();

    // 조퇴 계산
    const currentMinutes = now.getHours() * 60 + now.getMinutes() + (9 * 60);
    const expectedMinutes = parseTime(recordData.expectedDepartureTime);
    const isEarlyLeave = currentMinutes < expectedMinutes - 30; // 30분 전 조퇴
    const earlyLeaveMinutes = isEarlyLeave ? expectedMinutes - currentMinutes : undefined;

    await recordRef.update({
      actualDepartureTime: timestamp,
      status: "checked_out",
      isEarlyLeave,
      earlyLeaveMinutes,
      checkOutMethod: "manual",
      updatedAt: timestamp
    });

    return {
      success: true,
      message: `${studentName}님 수동 체크아웃이 완료되었습니다.${isEarlyLeave ? " (조퇴)" : ""}`,
      data: { isEarlyLeave, earlyLeaveMinutes }
    };
  } catch (error) {
    console.error("수동 체크아웃 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});
