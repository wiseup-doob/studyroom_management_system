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
import {
  getCurrentKoreaMinutes,
  getTodayInKorea,
  parseTimeToMinutes,
  getCurrentKoreaDayOfWeek,
  type DayOfWeek
} from "../../utils/timeUtils";

// CORS 설정: 현재 프로젝트의 도메인 허용
const projectId = process.env.GCLOUD_PROJECT || (process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).projectId : "");
const corsConfig = projectId ? [
  `https://${projectId}.web.app`,
  `https://${projectId}.firebaseapp.com`
] : true;

// ==================== 타입 정의 ====================";

type StudentAttendanceStatus =
  | "scheduled" // 예정 (배치로 사전 생성된 레코드)
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

  // 시간표 슬롯 정보 (optional - 하위 호환성 유지)
  timetableId?: string; // 시간표 ID
  timeSlotId?: string; // 슬롯 ID (slot.id 또는 slot_0, slot_1...)
  timeSlotSubject?: string; // 과목명 (예: "수학", "자습")
  timeSlotType?: "class" | "self_study" | "external"; // 슬롯 타입

  expectedArrivalTime: string;
  expectedDepartureTime: string;
  actualArrivalTime?: admin.firestore.Timestamp;
  actualDepartureTime?: admin.firestore.Timestamp;

  // 시간 로깅 필드 (optional)
  notArrivedAt?: admin.firestore.Timestamp; // 미등원 확정 시간 (수업 시작 시간)
  absentConfirmedAt?: admin.firestore.Timestamp; // 결석 확정 시간 (유예 종료 시간)
  absentMarkedAt?: admin.firestore.Timestamp; // 배치 처리 시간

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
  sessionNumber: number; // 당일 몇 번째 세션인지 (1, 2, 3...)
  isLatestSession: boolean; // 가장 최신 세션 여부
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

/**
 * PIN 시도 로그 (Rate Limiting용)
 *
 * Firestore 컬렉션: pin_attempt_logs
 * 용도: Rate Limiting 및 의심스러운 활동 추적
 *
 * 필드 구조:
 * - linkToken: string - 출석 체크 링크 토큰
 * - success: boolean - PIN 검증 성공 여부
 * - studentId?: string - 학생 ID (성공 시만 기록)
 * - timestamp: Timestamp - 시도 시간
 * - expiresAt: Timestamp - TTL (24시간 후 자동 삭제)
 */

// ==================== 유틸리티 함수 ====================
// Note: 시간 관련 함수는 ../utils/timeUtils.ts로 이동됨

/**
 * PIN 검증 전 Rate Limiting 체크
 *
 * 동일 링크에서 짧은 시간 내 너무 많은 실패 시도 방지
 * 5분 내 20회 이상 실패 시 임시 차단
 *
 * @param db Firestore instance
 * @param linkToken 출석 체크 링크 토큰
 * @throws HttpsError resource-exhausted - 5분 내 20회 이상 실패 시
 */
async function checkRateLimit(
  db: admin.firestore.Firestore,
  linkToken: string
): Promise<void> {
  const now = admin.firestore.Timestamp.now();
  const fiveMinutesAgo = admin.firestore.Timestamp.fromMillis(
    now.toMillis() - 5 * 60 * 1000
  );

  // 최근 5분간 실패 기록 조회
  // IMPORTANT: Firestore requires equality filters BEFORE range filters
  // Index order: linkToken (ASC) → success (ASC) → timestamp (DESC)
  const recentFailures = await db
    .collection("pin_attempt_logs")
    .where("linkToken", "==", linkToken)
    .where("success", "==", false)
    .where("timestamp", ">", fiveMinutesAgo)
    .get();

  // 5분 내 20회 이상 실패 시 임시 차단
  if (recentFailures.size >= 20) {
    throw new HttpsError(
      "resource-exhausted",
      "너무 많은 실패 시도가 있었습니다. 5분 후 다시 시도하세요."
    );
  }
}

/**
 * PIN 시도 로그 기록
 *
 * 성공/실패 여부를 로그에 기록하여 Rate Limiting에 활용
 * 24시간 후 자동 삭제 (Firestore TTL 정책)
 *
 * @param db Firestore instance
 * @param linkToken 출석 체크 링크 토큰
 * @param success PIN 검증 성공 여부
 * @param studentId 학생 ID (성공 시만 기록)
 */
async function logPinAttempt(
  db: admin.firestore.Firestore,
  linkToken: string,
  success: boolean,
  studentId?: string
): Promise<void> {
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + 24 * 60 * 60 * 1000 // 24시간 후
  );

  await db.collection("pin_attempt_logs").add({
    linkToken,
    success,
    studentId: studentId || null,
    timestamp: now,
    expiresAt
  });
}

// ==================== PIN 관리 Functions ====================

/**
 * 학생 PIN 생성
 */
export const generateStudentPin = onCall({ cors: corsConfig }, async (request) => {
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

    // ✅ 개선: actualPin으로 중복 검증 (쿼리 1회, bcrypt 연산 불필요)
    const duplicateCheck = await db
      .collection("users")
      .doc(userId)
      .collection("attendance_student_pins")
      .where("actualPin", "==", pin)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    // 자기 자신이 아닌 다른 학생이 이미 사용 중인 경우
    if (!duplicateCheck.empty && duplicateCheck.docs[0].id !== studentId) {
      throw new HttpsError(
        "already-exists",
        "이미 사용 중인 PIN입니다. 다른 PIN을 선택해주세요."
      );
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
export const updateStudentPin = onCall({ cors: corsConfig }, async (request) => {
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

    // ✅ 개선: actualPin으로 중복 검증 (쿼리 1회, bcrypt 연산 불필요)
    const duplicateCheck = await db
      .collection("users")
      .doc(userId)
      .collection("attendance_student_pins")
      .where("actualPin", "==", newPin)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    // 자기 자신이 아닌 다른 학생이 이미 사용 중인 경우
    if (!duplicateCheck.empty && duplicateCheck.docs[0].id !== studentId) {
      throw new HttpsError("already-exists", "이미 사용 중인 PIN입니다.");
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
export const unlockStudentPin = onCall({ cors: corsConfig }, async (request) => {
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
export const createAttendanceCheckLink = onCall({ cors: corsConfig }, async (request) => {
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
export const getAttendanceCheckLinks = onCall({ cors: corsConfig }, async (request) => {
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
export const checkAttendanceByPin = onCall({ cors: corsConfig }, async (request) => {
  const { linkToken, pin } = request.data;

  if (!linkToken || !pin) {
    throw new HttpsError("invalid-argument", "linkToken과 pin이 필요합니다.");
  }

  try {
    const db = admin.firestore();

    // ✅ 0. Rate Limiting 체크 (먼저 실행하여 과도한 시도 차단)
    await checkRateLimit(db, linkToken);

    // ===== 1. 링크 토큰 조회 (컬렉션 그룹 쿼리) =====
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

    // ===== 2. PIN 검증 (최적화된 방식) =====
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
      // ✅ 실패 로그 기록
      await logPinAttempt(db, linkToken, false);
      throw new HttpsError("invalid-argument", "잘못된 PIN입니다.");
    }

    const studentId = matchedPin.studentId;
    const studentName = matchedPin.studentName;

    // ✅ 성공 로그 기록
    await logPinAttempt(db, linkToken, true, studentId);

    // PIN 성공: failedAttempts 초기화
    await matchedPinRef.update({
      failedAttempts: 0,
      lastUsedAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    // ===== 3. 좌석 할당 확인 =====
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

    const today = getTodayInKorea();
    const currentMinutes = getCurrentKoreaMinutes();

    // ===== 4. 슬롯 기반 조회: 현재 시간에 해당하는 슬롯 찾기 =====
    const applicableSlotsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("student_attendance_records")
      .where("studentId", "==", studentId)
      .where("date", "==", today)
      .where("status", "in", ["scheduled", "not_arrived", "checked_in", "checked_out"])
      .get();

    if (applicableSlotsSnapshot.empty) {
      throw new HttpsError(
        "not-found",
        "오늘 출석할 수업이 없습니다. 배치 작업 실행을 확인하세요."
      );
    }

    // ===== 5. 현재 시간과 가장 가까운 슬롯 찾기 (±30분 이내) =====
    let targetRecord: any = null;
    let minTimeDiff = Infinity;

    for (const doc of applicableSlotsSnapshot.docs) {
      const record = doc.data();
      const slotStartMinutes = parseTimeToMinutes(record.expectedArrivalTime);
      const slotEndMinutes = parseTimeToMinutes(record.expectedDepartureTime);

      // 슬롯 시간 범위 내 또는 ±30분 이내
      if (currentMinutes >= slotStartMinutes - 30 &&
          currentMinutes <= slotEndMinutes + 30) {
        const timeDiff = Math.abs(currentMinutes - slotStartMinutes);
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          targetRecord = { ref: doc.ref, data: record };
        }
      }
    }

    if (!targetRecord) {
      throw new HttpsError(
        "failed-precondition",
        "현재 시간에 해당하는 수업이 없습니다. 수업 시작 30분 전부터 체크 가능합니다."
      );
    }

    const recordRef = targetRecord.ref as admin.firestore.DocumentReference;
    const recordData = targetRecord.data;
    const timestamp = admin.firestore.Timestamp.now();

    // ===== 6. 상태 전환 로직 =====

    // 6-1. scheduled/not_arrived → checked_in (트랜잭션 사용) ⭐
    if (recordData.status === "scheduled" || recordData.status === "not_arrived") {
      const result = await db.runTransaction(async (transaction) => {
        // 최신 상태 재확인 (배치 작업이 변경했을 수 있음)
        const currentRecordDoc = await transaction.get(recordRef);
        const currentRecordData = currentRecordDoc.data() as StudentAttendanceRecord | undefined;

        // 상태 검증
        if (!currentRecordData) {
          throw new HttpsError("not-found", "출석 레코드를 찾을 수 없습니다.");
        }

        if (currentRecordData.status === "absent_unexcused") {
          // 배치가 이미 결석 확정함 (유예 기간 종료)
          throw new HttpsError(
            "failed-precondition",
            "유예 기간이 종료되어 출석 처리가 불가능합니다."
          );
        }

        if (currentRecordData.status !== "scheduled" &&
            currentRecordData.status !== "not_arrived") {
          // 다른 상태로 이미 변경됨
          throw new HttpsError(
            "failed-precondition",
            `현재 상태(${currentRecordData.status})에서는 체크인할 수 없습니다.`
          );
        }

        // 체크인 처리
        const expectedMinutes = parseTimeToMinutes(currentRecordData.expectedArrivalTime);
        const isLate = currentMinutes > expectedMinutes + 10;

        const updateData: any = {
          actualArrivalTime: timestamp,
          status: "checked_in",
          isLate,
          checkInMethod: "pin",
          updatedAt: timestamp
        };

        if (isLate) {
          updateData.lateMinutes = currentMinutes - expectedMinutes;
        }

        // not_arrived에서 복구된 경우 로그 추가
        if (currentRecordData.status === "not_arrived") {
          updateData.notes = currentRecordData.notes ?
            `${currentRecordData.notes}\n자동 복구: 유예 기간 내 체크인` :
            "자동 복구: 유예 기간 내 체크인";
        }

        // 트랜잭션으로 업데이트
        transaction.update(recordRef, updateData);

        return {
          success: true,
          message: `${currentRecordData.timeSlotSubject || studentName} 수업 체크인 완료${isLate ? " (지각)" : ""}${
            currentRecordData.status === "not_arrived" ? " - 자동 복구됨" : ""
          }`,
          action: "checked_in",
          data: { ...currentRecordData, ...updateData }
        };
      });

      // 링크 사용 횟수 증가 (트랜잭션 밖에서 별도 처리)
      await linkDoc.ref.update({
        usageCount: admin.firestore.FieldValue.increment(1),
        updatedAt: timestamp
      });

      return result;
    }

    // 6-2. checked_in → checked_out (체크아웃)
    if (recordData.status === "checked_in") {
      const expectedMinutes = parseTimeToMinutes(recordData.expectedDepartureTime);
      const isEarlyLeave = currentMinutes < expectedMinutes - 30;

      const updateData: any = {
        actualDepartureTime: timestamp,
        status: "checked_out",
        isEarlyLeave,
        checkOutMethod: "pin",
        updatedAt: timestamp
      };

      if (isEarlyLeave) {
        updateData.earlyLeaveMinutes = expectedMinutes - currentMinutes;
      }

      await recordRef.update(updateData);

      await linkDoc.ref.update({
        usageCount: admin.firestore.FieldValue.increment(1),
        updatedAt: timestamp
      });

      return {
        success: true,
        message: `${recordData.timeSlotSubject || studentName} 수업 체크아웃 완료${isEarlyLeave ? " (조퇴)" : ""}`,
        action: "checked_out",
        data: { ...recordData, ...updateData }
      };
    }

    // 6-3. checked_out → checked_in (재입실)
    if (recordData.status === "checked_out") {
      const updateData: any = {
        status: "checked_in",
        checkInMethod: "pin",
        updatedAt: timestamp,
        notes: recordData.notes ?
          `${recordData.notes}\n재입실: ${timestamp.toDate().toLocaleTimeString("ko-KR")}` :
          `재입실: ${timestamp.toDate().toLocaleTimeString("ko-KR")}`
      };

      await recordRef.update(updateData);

      await linkDoc.ref.update({
        usageCount: admin.firestore.FieldValue.increment(1),
        updatedAt: timestamp
      });

      return {
        success: true,
        message: `${recordData.timeSlotSubject || studentName} 재입실 완료`,
        action: "re_checked_in",
        data: { ...recordData, ...updateData }
      };
    }

    throw new HttpsError("failed-precondition", "처리할 수 없는 출석 상태입니다.");
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
export const getStudentAttendanceRecords = onCall({ cors: corsConfig }, async (request) => {
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
export const updateAttendanceStatus = onCall({ cors: corsConfig }, async (request) => {
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
      if (excusedNote) {
        updateData.excusedNote = excusedNote;
      }
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
export const getTodayAttendanceRecords = onCall({ cors: corsConfig }, async (request) => {
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
export const getAttendanceRecord = onCall({ cors: corsConfig }, async (request) => {
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
export const getStudentPin = onCall({ cors: corsConfig }, async (request) => {
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
export const deactivateAttendanceCheckLink = onCall({ cors: corsConfig }, async (request) => {
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
export const activateAttendanceCheckLink = onCall({ cors: corsConfig }, async (request) => {
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
export const deleteAttendanceCheckLink = onCall({ cors: corsConfig }, async (request) => {
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
export const manualCheckIn = onCall({ cors: corsConfig }, async (request) => {
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
    const today = getTodayInKorea();
    const currentMinutes = getCurrentKoreaMinutes();

    // ===== 1. 슬롯 기반 조회: scheduled 또는 not_arrived 상태 레코드 조회 =====
    const applicableSlotsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("student_attendance_records")
      .where("studentId", "==", studentId)
      .where("date", "==", today)
      .where("status", "in", ["scheduled", "not_arrived"]) // ✅ not_arrived 추가
      .get();

    if (applicableSlotsSnapshot.empty) {
      throw new HttpsError("not-found", "오늘 출석할 수업이 없습니다.");
    }

    // ===== 2. 현재 시간에 가장 가까운 슬롯 찾기 =====
    let targetRecord: any = null;
    let minTimeDiff = Infinity;

    for (const doc of applicableSlotsSnapshot.docs) {
      const record = doc.data();
      const slotStartMinutes = parseTimeToMinutes(record.expectedArrivalTime);
      const slotEndMinutes = parseTimeToMinutes(record.expectedDepartureTime);

      // 슬롯 시간 범위 내 또는 ±30분 이내
      if (currentMinutes >= slotStartMinutes - 30 &&
          currentMinutes <= slotEndMinutes + 30) {
        const timeDiff = Math.abs(currentMinutes - slotStartMinutes);
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          targetRecord = { ref: doc.ref, data: record };
        }
      }
    }

    if (!targetRecord) {
      throw new HttpsError("failed-precondition",
        "현재 시간에 해당하는 수업이 없습니다.");
    }

    // ===== 3. 트랜잭션으로 체크인 처리 =====
    const result = await db.runTransaction(async (transaction) => {
      const recordRef = targetRecord.ref as admin.firestore.DocumentReference;

      // 최신 상태 재확인
      const currentRecordDoc = await transaction.get(recordRef);
      const currentRecordData = currentRecordDoc.data();

      if (!currentRecordData) {
        throw new HttpsError("not-found", "출석 레코드를 찾을 수 없습니다.");
      }

      // 상태 검증
      if (currentRecordData.status !== "scheduled" &&
          currentRecordData.status !== "not_arrived") {
        throw new HttpsError(
          "failed-precondition",
          `현재 상태(${currentRecordData.status})에서는 체크인할 수 없습니다.`
        );
      }

      // 지각 계산
      const expectedMinutes = parseTimeToMinutes(currentRecordData.expectedArrivalTime);
      const isLate = currentMinutes > expectedMinutes + 10;

      const timestamp = admin.firestore.Timestamp.now();
      const updateData: any = {
        actualArrivalTime: timestamp,
        status: "checked_in",
        isLate,
        checkInMethod: "manual",
        updatedAt: timestamp
      };

      if (isLate) {
        updateData.lateMinutes = currentMinutes - expectedMinutes;
      }

      // not_arrived에서 복구된 경우
      if (currentRecordData.status === "not_arrived") {
        const recoveryNote = "관리자 수동 복구: 유예 기간 내 체크인";
        updateData.notes = currentRecordData.notes ?
          `${currentRecordData.notes}\n${recoveryNote}` : recoveryNote;
      }

      // 트랜잭션으로 업데이트
      transaction.update(recordRef, updateData);

      return {
        success: true,
        action: "checked_in",
        message: `${currentRecordData.timeSlotSubject || currentRecordData.studentName} 수동 체크인 완료${isLate ? " (지각)" : ""}${
          currentRecordData.status === "not_arrived" ? " - 자동 복구됨" : ""
        }`,
        data: { ...currentRecordData, ...updateData }
      };
    });

    return result;
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
export const manualCheckOut = onCall({ cors: corsConfig }, async (request) => {
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
    const today = getTodayInKorea();
    const currentMinutes = getCurrentKoreaMinutes();

    // ===== 1. checked_in 상태 슬롯 조회 =====
    const checkedInSlotsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("student_attendance_records")
      .where("studentId", "==", studentId)
      .where("date", "==", today)
      .where("status", "==", "checked_in")
      .get();

    if (checkedInSlotsSnapshot.empty) {
      throw new HttpsError("not-found", "체크인된 수업이 없습니다.");
    }

    // ===== 2. 현재 시간에 가장 가까운 슬롯 찾기 =====
    let targetRecord: any = null;
    let minTimeDiff = Infinity;

    for (const doc of checkedInSlotsSnapshot.docs) {
      const record = doc.data();
      const slotEndMinutes = parseTimeToMinutes(record.expectedDepartureTime);
      const timeDiff = Math.abs(currentMinutes - slotEndMinutes);

      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        targetRecord = { ref: doc.ref, data: record };
      }
    }

    if (!targetRecord) {
      throw new HttpsError("failed-precondition",
        "체크아웃할 수업을 찾을 수 없습니다.");
    }

    // ===== 3. 체크아웃 처리 =====
    const recordRef = targetRecord.ref as admin.firestore.DocumentReference;
    const recordData = targetRecord.data;
    const timestamp = admin.firestore.Timestamp.now();
    const expectedMinutes = parseTimeToMinutes(recordData.expectedDepartureTime);
    const isEarlyLeave = currentMinutes < expectedMinutes - 30;

    const updateData: any = {
      actualDepartureTime: timestamp,
      status: "checked_out",
      isEarlyLeave,
      checkOutMethod: "manual",
      updatedAt: timestamp
    };

    if (isEarlyLeave) {
      updateData.earlyLeaveMinutes = expectedMinutes - currentMinutes;
    }

    await recordRef.update(updateData);

    return {
      success: true,
      action: "checked_out",
      message: `${recordData.timeSlotSubject || recordData.studentName} 수동 체크아웃 완료${isEarlyLeave ? " (조퇴)" : ""}`,
      data: { ...recordData, ...updateData }
    };
  } catch (error) {
    console.error("수동 체크아웃 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 학생 결석 처리 (관리자)
 *
 * 출석 기록이 없는 미등원 학생을 결석 처리합니다.
 * - 출석 기록이 없으면 자동으로 생성
 * - 출석 기록이 있으면 상태 검증 후 업데이트
 * - not_arrived 상태에서만 결석 처리 가능
 */
export const markStudentAbsent = onCall({ cors: corsConfig }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { studentId, seatLayoutId, status, excusedReason, excusedNote } = data;

  if (!studentId || !seatLayoutId || !status) {
    throw new HttpsError("invalid-argument", "studentId, seatLayoutId, status가 필요합니다.");
  }

  // status 검증
  if (status !== "absent_excused" && status !== "absent_unexcused") {
    throw new HttpsError("invalid-argument", "status는 absent_excused 또는 absent_unexcused만 가능합니다.");
  }

  // 사유결석인데 사유가 없으면 에러
  if (status === "absent_excused" && !excusedReason) {
    throw new HttpsError("invalid-argument", "사유결석의 경우 excusedReason이 필요합니다.");
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

    // 2. 좌석 할당 확인 (시간표 정보 가져오기)
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
    const dayOfWeek = getCurrentKoreaDayOfWeek();

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

    // 3. 시간표 검증
    if (!assignment.expectedSchedule || !assignment.expectedSchedule[dayOfWeek]) {
      throw new HttpsError(
        "failed-precondition",
        `오늘(${dayOfWeek})의 시간표 정보가 없습니다. 좌석을 다시 할당하거나 시간표를 확인해주세요.`
      );
    }

    const expectedArrival = assignment.expectedSchedule[dayOfWeek].arrivalTime;
    const expectedDeparture = assignment.expectedSchedule[dayOfWeek].departureTime;

    // 4. 오늘 출석 기록 조회
    const timestamp = admin.firestore.Timestamp.now();
    const latestRecordSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("student_attendance_records")
      .where("studentId", "==", studentId)
      .where("date", "==", today)
      .where("isLatestSession", "==", true)
      .limit(1)
      .get();

    // 5-A. 출석 기록이 없으면 새로 생성
    if (latestRecordSnapshot.empty) {
      const newRecordId = `${studentId}_${today.replace(/-/g, "")}_${timestamp.toMillis()}`;
      const recordRef = db
        .collection("users")
        .doc(userId)
        .collection("student_attendance_records")
        .doc(newRecordId);

      const attendanceData: any = {
        id: newRecordId,
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
        status,
        isLate: false,
        isEarlyLeave: false,
        sessionNumber: 1,
        isLatestSession: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        recordTimestamp: timestamp
      };

      // 사유결석인 경우 추가 정보
      if (status === "absent_excused") {
        attendanceData.excusedReason = excusedReason;
        if (excusedNote) {
          attendanceData.excusedNote = excusedNote;
        }
        attendanceData.excusedBy = userId;
      }

      await recordRef.set(attendanceData);

      return {
        success: true,
        message: `${studentName}님이 ${status === "absent_excused" ? "사유결석" : "무단결석"} 처리되었습니다.`,
        data: attendanceData
      };
    }

    // 5-B. 출석 기록이 있으면 상태 검증 후 업데이트
    const existingRecord = latestRecordSnapshot.docs[0];
    const existingData = existingRecord.data() as StudentAttendanceRecord;

    // not_arrived 상태만 결석 처리 가능
    if (existingData.status !== "not_arrived") {
      const statusMap: { [key: string]: string } = {
        checked_in: "이미 등원",
        checked_out: "이미 하원",
        absent_excused: "이미 사유결석 처리",
        absent_unexcused: "이미 무단결석 처리"
      };
      throw new HttpsError(
        "failed-precondition",
        `${statusMap[existingData.status] || "이미 처리"}되었습니다. 결석 처리할 수 없습니다.`
      );
    }

    // not_arrived → absent_* 업데이트
    const updateData: any = {
      status,
      updatedAt: timestamp
    };

    if (status === "absent_excused") {
      updateData.excusedReason = excusedReason;
      if (excusedNote) {
        updateData.excusedNote = excusedNote;
      }
      updateData.excusedBy = userId;
    }

    await existingRecord.ref.update(updateData);

    // 업데이트된 레코드 조회
    const updatedDoc = await existingRecord.ref.get();
    const updatedRecord = updatedDoc.data();

    return {
      success: true,
      message: `${studentName}님이 ${status === "absent_excused" ? "사유결석" : "무단결석"} 처리되었습니다.`,
      data: updatedRecord
    };
  } catch (error) {
    console.error("결석 처리 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});
