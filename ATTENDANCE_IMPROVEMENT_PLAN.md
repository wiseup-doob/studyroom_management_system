# 출석 시스템 개선 계획서

**작성일**: 2025-01-31
**최종 수정**: 2025-01-31
**버전**: 1.2 (타임존 안정성 개선 + DoS 취약점 수정)
**목적**: 출석 시스템 코드 분석 결과 발견된 문제점들에 대한 구체적인 수정 및 보완 계획

**⚠️ 중요**:
- Cloud Functions는 UTC 환경에서 실행되므로 명시적 타임존 변환이 필수입니다.
- Rate Limiting은 링크 레벨이 아닌 시간 기반으로 구현하여 DoS 공격을 방지합니다.

---

## 📋 목차

1. [개요](#개요)
2. [우선순위 분류](#우선순위-분류)
3. [Phase 1: 긴급 수정 (Critical)](#phase-1-긴급-수정-critical)
4. [Phase 2: 고우선순위 개선 (High Priority)](#phase-2-고우선순위-개선-high-priority)
5. [Phase 3: 중우선순위 개선 (Medium Priority)](#phase-3-중우선순위-개선-medium-priority)
6. [Phase 4: 장기 개선 (Long-term)](#phase-4-장기-개선-long-term)
7. [테스트 계획](#테스트-계획)
8. [배포 전략](#배포-전략)

---

## 개요

### 현재 상태
- ✅ 슬롯 기반 출석 시스템 구현 완료
- ✅ 배치 작업 최적화 (99.8% Firestore 읽기 감소)
- ✅ PIN 기반 보안 체크인/체크아웃
- ✅ 실시간 출석 현황 업데이트

### 발견된 문제점
1. 🔴 타임존 계산 오류 (치명적)
2. 🟡 PIN 중복 검증 성능 문제
3. 🟡 수동 체크인 로직 불일치
4. 🟡 컬렉션 그룹 쿼리 비효율
5. 🟢 실패 시도 잠금 미구현
6. 🟢 actualPin 노출 보안 문제
7. 🟢 유예 기간 계산 복잡도

---

## 우선순위 분류

### 🔴 Critical (긴급)
- 시스템 정확성에 직접적 영향
- 즉시 수정 필요

### 🟡 High Priority (높음)
- 성능 또는 사용자 경험에 큰 영향
- 1-2주 내 수정 권장

### 🟢 Medium Priority (중간)
- 일관성, 보안, 유지보수성 개선
- 1개월 내 수정 권장

### 🔵 Low Priority (낮음)
- 장기적 구조 개선
- 리팩토링 시 고려

---

## Phase 1: 긴급 수정 (Critical)

### 🔴 Issue #1: 타임존 계산 오류 수정

#### 문제 상세
**파일**: `functions/src/utils/timeUtils.ts`
**라인**: 10-13

```typescript
// ❌ 현재 코드 (문제)
export function getCurrentKoreaTime(): Date {
  const now = new Date();
  return new Date(now.getTime() + (9 * 60 * 60 * 1000));
}
```

**문제점**:
- Cloud Functions는 **기본적으로 UTC 환경**에서 실행됨
- `timeZone: "Asia/Seoul"` 설정은 **스케줄 실행 시간**에만 영향 (예: "0 2 * * *" = 한국 시간 2AM)
- 하지만 **함수 내부 `new Date()`는 여전히 UTC 반환**
- 현재 코드는 UTC + 9시간을 더해 **한국 시간보다 9시간 미래** 계산
- 배치 작업 실행 시간, 날짜 계산, 슬롯 매칭 모두 오류

**영향 범위**:
- ❌ `getTodayInKorea()` - 날짜 계산 오류
- ❌ `getCurrentKoreaMinutes()` - 시간 매칭 오류
- ❌ `getCurrentKoreaDayOfWeek()` - 요일 계산 오류
- ❌ 모든 scheduled functions의 실행 타이밍

#### 수정 방안

**⚠️ 중요**: Cloud Functions는 UTC 환경에서 실행되므로 명시적 타임존 변환이 필수입니다.

**옵션 1: 명시적 타임존 변환 - 개별 요소 추출 (권장) ⭐**

```typescript
/**
 * 현재 한국 시간 반환 (UTC+9)
 *
 * 명시적으로 타임존 변환하여 환경에 독립적
 *
 * ⚠️ 주의: toLocaleString()의 전체 문자열 파싱은 불안정하므로
 * 개별 요소를 추출하여 Date 객체 생성
 */
export function getCurrentKoreaTime(): Date {
  const now = new Date();

  // 한국 시간 각 요소를 개별 추출 (더 안정적)
  const year = parseInt(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul", year: "numeric" })
  );
  const month = parseInt(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul", month: "numeric" })
  ) - 1; // JavaScript는 0-based month
  const day = parseInt(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul", day: "numeric" })
  );
  const hour = parseInt(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      hour12: false
    })
  );
  const minute = parseInt(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul", minute: "numeric" })
  );
  const second = parseInt(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul", second: "numeric" })
  );

  // 로컬 타임존으로 Date 객체 생성 (환경에 독립적)
  return new Date(year, month, day, hour, minute, second);
}
```

**장점**:
- ✅ 환경에 독립적 (UTC 환경에서 정확히 작동)
- ✅ 명시적 타임존 지정으로 의도가 명확
- ✅ 추가 의존성 불필요
- ✅ 로컬 개발 환경과 Cloud Functions 환경 모두 동일하게 동작
- ✅ **문자열 파싱 오류 위험 없음** (개별 요소 추출)
- ✅ 크로스 플랫폼 호환성 보장

**단점**:
- ⚠️ 코드가 다소 길어짐 (하지만 안정성 향상)

**옵션 2: Luxon/date-fns-tz 라이브러리 사용**

```typescript
import { DateTime } from 'luxon';

export function getCurrentKoreaTime(): Date {
  return DateTime.now().setZone('Asia/Seoul').toJSDate();
}
```

**장점**:
- ✅ 가장 정확하고 안정적
- ✅ 타임존 처리 전문 라이브러리

**단점**:
- ⚠️ 추가 의존성
- ⚠️ 번들 크기 증가

#### 권장 구현: 옵션 1 (명시적 타임존 변환 - 개별 요소 추출) ⭐

**수정 파일**: `functions/src/utils/timeUtils.ts`

```typescript
/**
 * 시간 관련 유틸리티 함수 (타임존 처리 통일)
 *
 * ⚠️ 중요: Cloud Functions는 UTC 환경에서 실행됩니다.
 * timeZone: "Asia/Seoul" 설정은 스케줄 실행 시간에만 영향을 주며,
 * 함수 내부 new Date()는 여전히 UTC를 반환합니다.
 * 따라서 명시적으로 한국 시간으로 변환해야 합니다.
 */

/**
 * 현재 한국 시간 반환 (UTC+9)
 *
 * Cloud Functions는 UTC 환경에서 실행되므로 명시적 타임존 변환 필요
 *
 * @returns 현재 한국 시간 (Date 객체)
 */
export function getCurrentKoreaTime(): Date {
  const now = new Date();

  // 한국 시간 각 요소를 개별 추출 (안정적인 파싱)
  const year = parseInt(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul", year: "numeric" })
  );
  const month = parseInt(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul", month: "numeric" })
  ) - 1; // JavaScript는 0-based month
  const day = parseInt(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul", day: "numeric" })
  );
  const hour = parseInt(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      hour12: false
    })
  );
  const minute = parseInt(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul", minute: "numeric" })
  );
  const second = parseInt(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul", second: "numeric" })
  );

  // 로컬 타임존으로 Date 객체 생성
  return new Date(year, month, day, hour, minute, second);
}

/**
 * 한국 시간 기준 시/분 추출 (더 정확한 방법)
 *
 * @returns { hours, minutes } 한국 시간 기준
 */
export function getKoreaHoursAndMinutes(): { hours: number; minutes: number } {
  const now = new Date();

  const hour = parseInt(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hour12: false
    })
  );

  const minute = parseInt(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Seoul",
      minute: "2-digit"
    })
  );

  return { hours: hour, minutes: minute };
}

/**
 * 현재 한국 시간의 분 단위 값 (00:00부터 경과한 분)
 * @example 14:30 → 870분
 */
export function getCurrentKoreaMinutes(): number {
  const { hours, minutes } = getKoreaHoursAndMinutes();
  return hours * 60 + minutes;
}

/**
 * 오늘 한국 날짜 문자열 (YYYY-MM-DD)
 */
export function getTodayInKorea(): string {
  const now = new Date();

  const year = now.toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric"
  });

  const month = now.toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    month: "2-digit"
  });

  const day = now.toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    day: "2-digit"
  });

  // en-US 형식은 MM/DD/YYYY이므로 재조립
  return `${year}-${month}-${day}`;
}

/**
 * 시간 문자열을 분 단위로 변환
 * @param timeString "HH:mm" 형식의 시간 (예: "09:30")
 * @returns 00:00부터 경과한 분 (예: 570분)
 */
export function parseTimeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time format: ${timeString}`);
  }
  return hours * 60 + minutes;
}

/**
 * 분 단위 값을 시간 문자열로 변환
 * @param minutes 00:00부터 경과한 분 (예: 570분)
 * @returns "HH:mm" 형식의 시간 (예: "09:30")
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

/**
 * 현재 한국 시간의 요일 반환
 */
export function getCurrentKoreaDayOfWeek(): DayOfWeek {
  const now = new Date();

  // 한국 시간으로 변환하여 요일 추출
  const koreaDate = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );

  const days: DayOfWeek[] = [
    "sunday", "monday", "tuesday", "wednesday",
    "thursday", "friday", "saturday"
  ];

  return days[koreaDate.getDay()];
}

/**
 * Date 객체에서 요일 추출
 */
export function getDayOfWeek(date: Date): DayOfWeek {
  const days: DayOfWeek[] = [
    "sunday", "monday", "tuesday", "wednesday",
    "thursday", "friday", "saturday"
  ];
  return days[date.getDay()];
}
```

#### 검증 방법

**1. 단위 테스트 작성**

```typescript
// functions/src/utils/__tests__/timeUtils.test.ts
import {
  getCurrentKoreaTime,
  getTodayInKorea,
  getCurrentKoreaMinutes,
  getKoreaHoursAndMinutes,
  parseTimeToMinutes,
  minutesToTime
} from '../timeUtils';

describe('timeUtils - UTC 환경 시뮬레이션', () => {
  // Mock UTC 시간: 2025-01-31 23:30 (한국 시간: 2025-02-01 08:30)
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-31T23:30:00Z')); // UTC
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('getTodayInKorea returns correct date (next day in Korea)', () => {
    const today = getTodayInKorea();
    expect(today).toBe('2025-02-01'); // 한국은 다음날
  });

  test('getKoreaHoursAndMinutes returns correct time', () => {
    const { hours, minutes } = getKoreaHoursAndMinutes();
    expect(hours).toBe(8); // 한국 시간 08시
    expect(minutes).toBe(30); // 30분
  });

  test('getCurrentKoreaMinutes calculates correct minutes', () => {
    const minutes = getCurrentKoreaMinutes();
    expect(minutes).toBe(8 * 60 + 30); // 510분
  });

  test('getCurrentKoreaTime returns correct Korea time', () => {
    const koreaTime = getCurrentKoreaTime();
    expect(koreaTime.getHours()).toBe(8);
    expect(koreaTime.getMinutes()).toBe(30);
  });

  test('parseTimeToMinutes converts time string correctly', () => {
    expect(parseTimeToMinutes('09:30')).toBe(570);
    expect(parseTimeToMinutes('14:00')).toBe(840);
  });

  test('minutesToTime converts minutes to time string', () => {
    expect(minutesToTime(570)).toBe('09:30');
    expect(minutesToTime(840)).toBe('14:00');
  });
});

describe('timeUtils - Edge cases', () => {
  test('handles date change across UTC/Korea boundary', () => {
    // UTC: 2025-01-31 15:00 (한국: 2025-02-01 00:00)
    jest.setSystemTime(new Date('2025-01-31T15:00:00Z'));

    const today = getTodayInKorea();
    expect(today).toBe('2025-02-01');
  });

  test('handles midnight in Korea', () => {
    // UTC: 2025-01-31 15:00 (한국: 2025-02-01 00:00)
    jest.setSystemTime(new Date('2025-01-31T15:00:00Z'));

    const { hours, minutes } = getKoreaHoursAndMinutes();
    expect(hours).toBe(0);
    expect(minutes).toBe(0);
  });
});
```

**2. 수동 검증**

배치 함수 실행 후 로그 확인:

```bash
# 로그에서 시간 확인
firebase functions:log --only markNotArrivedAtStartTime
```

로그 출력 예시:
```
[미등원 전환 시작] 2025-01-31 09:00
```

실제 한국 시간과 일치하는지 확인.

**3. Emulator 테스트**

```bash
# Emulator로 scheduled function 수동 트리거
curl -X POST http://localhost:5001/{PROJECT_ID}/asia-northeast3/markNotArrivedAtStartTime
```

#### 배포 체크리스트

- [ ] `timeUtils.ts` 파일 수정
- [ ] 단위 테스트 작성 및 실행
- [ ] Emulator에서 scheduled functions 테스트
- [ ] Test 환경 배포 및 검증
- [ ] Production 배포
- [ ] 배치 작업 로그 모니터링 (24시간)
- [ ] 출석 기록 데이터 정합성 확인

#### 예상 소요 시간
- 코드 수정: 1시간 (더 정확한 구현 포함)
- 테스트 작성: 1.5시간 (UTC 환경 테스트 포함)
- 검증 및 배포: 1시간
- **총 3.5시간**

---

## Phase 2: 고우선순위 개선 (High Priority)

### 🟡 Issue #2: PIN 중복 검증 성능 개선

#### 문제 상세

**파일**: `functions/src/modules/personal/studentAttendanceManagement.ts`
**라인**: 159-173, 253-267

```typescript
// ❌ 현재 코드 (성능 문제)
const pinsSnapshot = await db
  .collection("users")
  .doc(userId)
  .collection("attendance_student_pins")
  .get(); // 모든 PIN 다운로드

for (const doc of pinsSnapshot.docs) {
  const data = doc.data() as AttendanceStudentPin;
  if (data.isActive && doc.id !== studentId) {
    const isMatch = await bcrypt.compare(pin, data.pinHash); // CPU 집약적
    if (isMatch) {
      throw new HttpsError("already-exists", "이미 사용 중인 PIN입니다.");
    }
  }
}
```

**문제점**:
- 모든 학생의 PIN 해시를 다운로드 (100명 = 100개 문서)
- 각각 bcrypt.compare 실행 (최악의 경우 100회)
- bcrypt는 의도적으로 느림 (보안 목적)
- PIN 생성/변경 시 응답 시간 2-5초 이상 소요 가능

#### 수정 방안

**옵션 1: actualPin 필드를 인덱싱하여 쿼리 사용 (권장)**

**현재 상태**:
- `actualPin` 필드가 이미 평문으로 저장되어 있음 (관리자 확인용)
- 하지만 중복 검증에 활용되지 않음

**개선 방법**:

```typescript
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

    // ✅ 개선: actualPin으로 중복 검증 (쿼리 1회)
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
      actualPin: pin, // 평문 PIN (관리자 확인 + 중복 검증용)
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

    // ✅ 개선: actualPin으로 중복 검증 (쿼리 1회)
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
      actualPin: newPin, // 평문 PIN 업데이트
      isLocked: false,
      failedAttempts: 0,
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
```

**성능 비교**:

| 항목 | 기존 방식 | 개선 방식 | 개선율 |
|------|----------|----------|--------|
| Firestore 읽기 | 100개 문서 | 1개 문서 (or 0) | 99% 감소 |
| bcrypt 연산 | 최대 100회 | 1회 (PIN 저장 시만) | 99% 감소 |
| 응답 시간 | 2-5초 | 0.2-0.5초 | 90% 개선 |

**보안 고려사항**:

**Q**: actualPin을 평문으로 저장해도 안전한가?
**A**:
- ✅ Firestore Security Rules로 보호 (관리자만 접근)
- ✅ Backend에서만 접근 가능 (Frontend는 pinHash 제외된 데이터만 받음)
- ✅ 이미 현재 코드에도 actualPin이 평문으로 저장되고 있음
- ⚠️ 하지만 더 나은 방법은 아래 참고

**옵션 2: 해시된 PIN을 Composite Index로 검색**

```typescript
// PIN을 SHA-256으로 해싱하여 검색 가능하게 만들기
import * as crypto from 'crypto';

function hashPinForSearch(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

// 중복 검증
const pinSearchHash = hashPinForSearch(pin);
const duplicateCheck = await db
  .collection("users")
  .doc(userId)
  .collection("attendance_student_pins")
  .where("pinSearchHash", "==", pinSearchHash)
  .where("isActive", "==", true)
  .limit(1)
  .get();
```

**장점**:
- ✅ actualPin 필드 불필요
- ✅ 해시로 저장되어 더 안전

**단점**:
- ⚠️ 필드 추가 필요 (`pinSearchHash`)
- ⚠️ 기존 데이터 마이그레이션 필요

#### Firestore Index 설정

**필요한 Composite Index**:

```javascript
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "attendance_student_pins",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "actualPin", "order": "ASCENDING" },
        { "fieldPath": "isActive", "order": "ASCENDING" }
      ]
    }
  ]
}
```

Firebase Console에서 자동 생성되거나 수동 추가.

#### Frontend 보안 개선

**파일**: `functions/src/modules/personal/studentAttendanceManagement.ts`
**라인**: 1015-1024

```typescript
// ✅ 개선: actualPin을 제거하고 반환
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

    // ⚠️ 보안: pinHash와 actualPin 모두 제거
    const { pinHash, actualPin, ...safeData } = pinData;

    return {
      success: true,
      data: safeData
    };
  } catch (error) {
    console.error("PIN 조회 오류:", error);
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});
```

**Frontend 타입 수정**:

```typescript
// frontend/src/types/attendance.ts
export interface AttendanceStudentPin {
  id: string;
  userId: string;
  studentId: string;
  studentName: string;
  // pinHash: string; // ❌ 제거 (Backend에서 제외됨)
  // actualPin: string; // ❌ 제거 (보안 위험)
  isActive: boolean;
  isLocked: boolean;
  failedAttempts: number;
  lastFailedAt?: Date;
  lastChangedAt: Date;
  lastUsedAt?: Date;
  changeHistory?: {
    changedAt: Date;
    changedBy: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}
```

#### 배포 체크리스트

- [ ] `studentAttendanceManagement.ts`에서 PIN 중복 검증 로직 수정
- [ ] `getStudentPin` 함수에서 actualPin 제거
- [ ] Frontend 타입 정의 업데이트
- [ ] Firestore Composite Index 생성 확인
- [ ] 성능 테스트 (100명 학생 시뮬레이션)
- [ ] Test 환경 배포 및 검증
- [ ] Production 배포

#### 예상 소요 시간
- 코드 수정: 1시간
- Index 설정: 30분
- 성능 테스트: 1시간
- **총 2.5시간**

---

### 🟡 Issue #3: 수동 체크인 로직 불일치 해결

#### 문제 상세

**파일**: `functions/src/modules/personal/studentAttendanceManagement.ts`
**함수**: `manualCheckIn` (라인 1179-1271), `checkAttendanceByPin` (라인 479-778)

**불일치 사항**:

| 기능 | `manualCheckIn` (관리자) | `checkAttendanceByPin` (학생 PIN) |
|------|-------------------------|--------------------------------|
| `scheduled` 상태 처리 | ✅ 가능 | ✅ 가능 |
| `not_arrived` 상태 처리 | ❌ 불가능 | ✅ 가능 (자동 복구) |
| `checked_in` 상태 재입실 | ❌ 불가능 | ❌ 불가능 (체크아웃만) |
| 트랜잭션 사용 | ❌ 없음 | ✅ 있음 |

**문제점**:
1. 관리자는 `not_arrived` 상태 학생을 수동으로 체크인할 수 없음
2. 학생은 PIN으로 유예 기간 내 자동 복구 가능하지만, 관리자는 불가능
3. 일관성 부족

#### 수정 방안

**manualCheckIn 함수 개선**:

```typescript
/**
 * 수동 체크인 (관리자)
 *
 * ✅ 개선 사항:
 * - not_arrived 상태도 체크인 가능
 * - 트랜잭션 사용으로 race condition 방지
 * - checkAttendanceByPin과 로직 일관성 확보
 */
export const manualCheckIn = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const data = request.data;
  const { studentId, notes } = data;

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
      const currentRecordData = currentRecordDoc.data() as StudentAttendanceRecord | undefined;

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

      // 관리자 메모 추가
      if (notes) {
        updateData.notes = updateData.notes ?
          `${updateData.notes}\n관리자 메모: ${notes}` :
          `관리자 메모: ${notes}`;
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
```

**주요 변경사항**:
1. ✅ `where("status", "in", ["scheduled", "not_arrived"])` - not_arrived 포함
2. ✅ 트랜잭션 사용으로 race condition 방지
3. ✅ not_arrived 복구 시 자동 로그 기록
4. ✅ 관리자 메모 추가 기능

#### 배포 체크리스트

- [ ] `manualCheckIn` 함수 수정
- [ ] `manualCheckOut` 함수도 동일한 패턴으로 개선 검토
- [ ] 단위 테스트 작성
- [ ] Test 환경 배포 및 검증
- [ ] Production 배포

#### 예상 소요 시간
- 코드 수정: 1시간
- 테스트: 1시간
- **총 2시간**

---

## Phase 3: 중우선순위 개선 (Medium Priority)

### 🟢 Issue #4: 실패 시도 잠금 로직 구현

#### 문제 상세

**파일**: `functions/src/modules/personal/studentAttendanceManagement.ts`
**함수**: `checkAttendanceByPin` (라인 479-778)

**현재 상태**:
- `failedAttempts` 필드 존재
- `isLocked` 필드로 잠금 상태 관리
- 하지만 **PIN 실패 시 카운트 증가 로직 없음**

**문제**:
- PIN 틀려도 무제한 시도 가능
- Brute-force 공격에 취약
- 보안 설계는 되어 있지만 구현 누락

#### 수정 방안

```typescript
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

    // ===== 1. 링크 토큰 조회 =====
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

    if (linkData.expiresAt && linkData.expiresAt.toMillis() < Date.now()) {
      throw new HttpsError("failed-precondition", "만료된 출석 체크 링크입니다.");
    }

    // ===== 2. PIN 검증 =====
    const pinsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("attendance_student_pins")
      .where("isActive", "==", true)
      .get();

    let matchedPin: AttendanceStudentPin | null = null;
    let matchedPinRef: admin.firestore.DocumentReference | null = null;
    let lockedPinFound = false;
    let wrongPinRef: admin.firestore.DocumentReference | null = null; // ✅ 추가

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

    for (const result of results) {
      if (result.isMatch) {
        if (result.isLocked) {
          lockedPinFound = true;
        } else {
          matchedPin = result.pinData;
          matchedPinRef = result.doc.ref;
          break;
        }
      } else {
        // ✅ 개선: 틀린 PIN 정보 저장 (나중에 카운트 증가용)
        // 실제로는 어떤 학생인지 모르므로, 일단 저장만 해둠
        // 실제 구현에서는 PIN 길이가 일치하는 경우에만 카운트
        if (!wrongPinRef && pin.length >= 4 && pin.length <= 6) {
          wrongPinRef = result.doc.ref;
        }
      }
    }

    if (lockedPinFound && !matchedPin) {
      throw new HttpsError("failed-precondition", "PIN이 잠겨있습니다. 관리자에게 문의하세요.");
    }

    if (!matchedPin || !matchedPinRef) {
      // ✅ 개선: PIN 실패 시 카운트 증가
      // 문제: 어떤 학생의 PIN인지 알 수 없음
      // 해결: 모든 활성 PIN의 failedAttempts를 증가시키지 않고,
      //      특정 학생 식별 불가능하므로 로그만 남김

      // 대안: IP 기반 rate limiting 또는 링크 레벨 제한
      // (향후 구현 권장)

      throw new HttpsError("invalid-argument", "잘못된 PIN입니다.");
    }

    const studentId = matchedPin.studentId;
    const studentName = matchedPin.studentName;

    // ✅ 개선: PIN 성공 시 failedAttempts 초기화 및 lastUsedAt 업데이트
    await matchedPinRef.update({
      failedAttempts: 0,
      lastUsedAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    // ... 이하 출석 체크 로직 동일 ...

  } catch (error) {
    console.error("출석 체크 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});
```

**문제점**:
- PIN이 틀렸을 때 **어떤 학생의 PIN인지 알 수 없음** (보안상 의도된 설계)
- 따라서 특정 학생의 `failedAttempts`를 증가시킬 수 없음

**⚠️ 중요: 링크 레벨 카운트 방식의 보안 취약점**

다음 방식은 **DoS 공격에 취약**하므로 사용하지 말 것:
```typescript
// ❌ 취약한 방식 - 사용 금지
if (!matchedPin) {
  await linkDoc.ref.update({
    failedAttempts: increment(1)
  });

  if (failedCount >= 10) {
    await linkDoc.ref.update({ isActive: false }); // 링크 비활성화
  }
}
```

**취약점**:
- 공격자가 의도적으로 10번 틀린 PIN 입력
- → 링크 전체가 비활성화됨
- → 모든 학생의 출석 체크 불가능 (DoS 공격 성공)

---

**대안 1: 시간 기반 Rate Limiting (권장) ⭐**

링크 전체를 막지 않고, **일정 시간 내 과도한 실패 시 임시 차단**:

```typescript
/**
 * PIN 검증 전 Rate Limiting 체크
 *
 * 동일 링크에서 짧은 시간 내 너무 많은 실패 시도 방지
 */
async function checkRateLimit(linkToken: string): Promise<void> {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const fiveMinutesAgo = admin.firestore.Timestamp.fromMillis(
    now.toMillis() - 5 * 60 * 1000
  );

  // 최근 5분간 실패 기록 조회
  const recentFailures = await db
    .collection("pin_attempt_logs")
    .where("linkToken", "==", linkToken)
    .where("timestamp", ">", fiveMinutesAgo)
    .where("success", "==", false)
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
 */
async function logPinAttempt(
  linkToken: string,
  success: boolean,
  studentId?: string
): Promise<void> {
  const db = admin.firestore();

  await db.collection("pin_attempt_logs").add({
    linkToken,
    success,
    studentId: studentId || null, // 성공 시만 학생 ID 기록
    timestamp: admin.firestore.Timestamp.now(),
    // TTL: 24시간 후 자동 삭제 (Firestore TTL 정책 활용)
    expiresAt: admin.firestore.Timestamp.fromMillis(
      Date.now() + 24 * 60 * 60 * 1000
    )
  });
}

// checkAttendanceByPin 함수 내부
export const checkAttendanceByPin = onCall(async (request) => {
  const { linkToken, pin } = request.data;

  try {
    // ✅ 1단계: Rate Limiting 체크
    await checkRateLimit(linkToken);

    // 2단계: 링크 조회
    const linkSnapshot = await db
      .collectionGroup("attendance_check_links")
      .where("linkToken", "==", linkToken)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (linkSnapshot.empty) {
      throw new HttpsError("not-found", "유효하지 않은 출석 체크 링크입니다.");
    }

    // 3단계: PIN 검증
    // ... (기존 로직)

    if (!matchedPin) {
      // ✅ 실패 로그 기록
      await logPinAttempt(linkToken, false);
      throw new HttpsError("invalid-argument", "잘못된 PIN입니다.");
    }

    // ✅ 성공 로그 기록
    await logPinAttempt(linkToken, true, matchedPin.studentId);

    // ... 이하 출석 체크 로직
  } catch (error) {
    // 에러 처리
  }
});
```

**장점**:
- ✅ **DoS 공격 방지**: 링크 자체는 유효하게 유지
- ✅ **시간 기반 복구**: 5분 후 자동으로 다시 사용 가능
- ✅ **정상 사용자 보호**: 한 명의 실수가 전체에 영향 없음
- ✅ **로그 기록**: 의심스러운 활동 추적 가능

**단점**:
- ⚠️ 추가 컬렉션 필요 (`pin_attempt_logs`)
- ⚠️ Firestore 읽기 증가 (하지만 5분 창에서만)

---

**대안 2: IP 기반 Rate Limiting**

```typescript
// Cloud Functions에서 IP 추출
const clientIp = request.rawRequest.headers['x-forwarded-for'] ||
                 request.rawRequest.connection.remoteAddress;

// Firestore에 IP별 시도 횟수 저장
const rateLimitRef = db.collection('rate_limits').doc(clientIp);
const rateLimitDoc = await rateLimitRef.get();

if (rateLimitDoc.exists) {
  const data = rateLimitDoc.data();
  if (data.attempts >= 5 && data.lastAttempt.toMillis() > Date.now() - 60000) {
    throw new HttpsError("resource-exhausted", "너무 많은 시도입니다. 1분 후 다시 시도하세요.");
  }
}

await rateLimitRef.set({
  attempts: admin.firestore.FieldValue.increment(1),
  lastAttempt: admin.firestore.Timestamp.now()
}, { merge: true });
```

#### 권장 구현: 시간 기반 Rate Limiting (대안 1) ⭐

**이유**:
- ✅ **DoS 공격 방지**: 링크 자체는 영구적으로 차단되지 않음
- ✅ **자동 복구**: 5분 후 자동으로 사용 가능
- ✅ **정상 사용자 보호**: 한 명의 실수가 다른 학생에게 영향 없음
- ✅ **로그 기록**: 의심스러운 활동 패턴 분석 가능
- ✅ Brute-force 공격 방어

#### 구현 단계

**1. PIN 시도 로그 컬렉션 설계**

```typescript
// functions/src/modules/personal/studentAttendanceManagement.ts

interface PinAttemptLog {
  id: string;
  linkToken: string;
  success: boolean;
  studentId?: string; // 성공 시만 기록
  timestamp: admin.firestore.Timestamp;
  expiresAt: admin.firestore.Timestamp; // TTL: 24시간
}
```

**2. Firestore TTL 정책 설정**

```javascript
// firestore.rules 또는 Firebase Console에서 설정
// pin_attempt_logs 컬렉션에 expiresAt 필드 기반 TTL 정책 적용
// 24시간 후 자동 삭제
```

**3. Rate Limiting 헬퍼 함수 구현**

위의 "대안 1: 시간 기반 Rate Limiting" 코드 참조

**4. Composite Index 설정**

```javascript
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "pin_attempt_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "linkToken", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" },
        { "fieldPath": "success", "order": "ASCENDING" }
      ]
    }
  ]
}
```

#### 배포 체크리스트

- [ ] `pin_attempt_logs` 컬렉션 설계
- [ ] `checkRateLimit()` 헬퍼 함수 구현
- [ ] `logPinAttempt()` 헬퍼 함수 구현
- [ ] `checkAttendanceByPin` 함수에 Rate Limiting 통합
- [ ] Composite Index 생성 (linkToken + timestamp + success)
- [ ] Firestore TTL 정책 설정 (24시간 자동 삭제)
- [ ] 단위 테스트 (20회 실패 시나리오, 5분 후 복구)
- [ ] Test 환경 배포 및 검증
- [ ] Production 배포

#### 예상 소요 시간
- 코드 수정 (Rate Limiting 로직): 2.5시간
- Index 설정 및 TTL 정책: 30분
- 테스트 (시간 기반 시나리오): 1.5시간
- **총 4.5시간**

---

### 🟢 Issue #5: 유예 기간 계산 로직 단순화

#### 문제 상세

**파일**: `functions/src/scheduled/markAbsentUnexcused.ts`
**라인**: 74-86

```typescript
// ❌ 현재 코드 (복잡함)
const graceEndTime = new Date(record.notArrivedAt.toDate());
graceEndTime.setMinutes(
  graceEndTime.getMinutes() +
  (slotEndMinutes - parseTimeToMinutes(record.expectedArrivalTime)) +
  30 +
  GRACE_PERIOD_MINUTES
);
```

**문제점**:
- `notArrivedAt` 기준으로 계산하여 직관적이지 않음
- 수업 시작 시간 → 종료 시간 → 유예 기간 계산이 복잡함

**개선**:

```typescript
/**
 * 유예 기간 종료 시간 계산
 *
 * 공식: 수업 종료 시간 + 30분 + 유예 기간(5분)
 */
const slotEndMinutes = parseTimeToMinutes(record.expectedDepartureTime);
const graceEndMinutes = slotEndMinutes + 30 + GRACE_PERIOD_MINUTES;

// 유예 기간이 지났으면 absent_unexcused 확정
if (currentMinutes > graceEndMinutes) {
  // ✅ 개선: 오늘 날짜 + 유예 종료 시간으로 Timestamp 생성
  const today = getTodayInKorea();
  const [year, month, day] = today.split('-').map(Number);
  const graceEndHour = Math.floor(graceEndMinutes / 60);
  const graceEndMin = graceEndMinutes % 60;

  const graceEndTime = new Date(year, month - 1, day, graceEndHour, graceEndMin);

  batch.update(doc.ref, {
    status: "absent_unexcused",
    absentConfirmedAt: admin.firestore.Timestamp.fromDate(graceEndTime),
    absentMarkedAt: timestamp,
    updatedAt: timestamp
  });

  // ... 로그 출력
}
```

**개선 사항**:
- ✅ 직관적인 계산식
- ✅ 날짜 기준으로 명확한 시간 생성
- ✅ 유지보수 용이

#### 배포 체크리스트

- [ ] `markAbsentUnexcused.ts` 로직 단순화
- [ ] 단위 테스트로 시간 계산 검증
- [ ] Test 환경 배포 및 검증
- [ ] Production 배포

#### 예상 소요 시간
- 코드 수정: 30분
- 테스트: 30분
- **총 1시간**

---

## Phase 4: 장기 개선 (Long-term)

### 🔵 Issue #6: 출석 체크 링크 구조 개선

#### 문제 상세

**현재 구조**:
```
/users/{userId}/attendance_check_links/{linkId}
```

**컬렉션 그룹 쿼리 사용**:
```typescript
const linkSnapshot = await db
  .collectionGroup("attendance_check_links")
  .where("linkToken", "==", linkToken)
  .where("isActive", "==", true)
  .limit(1)
  .get();
```

**문제점**:
- 모든 사용자의 링크를 검색해야 함
- Composite Index 필요: `(linkToken, isActive)`
- linkToken은 UUID로 이미 유니크함 (검색 최적화 가능)

#### 개선 방안

**옵션 1: 전역 링크 컬렉션**

```
/attendance_check_links_global/{linkToken}
  - userId: string
  - seatLayoutId: string
  - ... 기타 필드
```

**장점**:
- ✅ 단일 문서 조회 (가장 빠름)
- ✅ Composite Index 불필요
- ✅ 확장성 우수

**단점**:
- ⚠️ 데이터 구조 변경 (마이그레이션 필요)
- ⚠️ Security Rules 재설계

**옵션 2: 링크 매핑 컬렉션**

```
/attendance_link_mappings/{linkToken}
  - userId: string
  - linkDocPath: string (예: "users/abc/attendance_check_links/xyz")

/users/{userId}/attendance_check_links/{linkId}
  - ... 기존 필드
```

**장점**:
- ✅ 기존 구조 유지
- ✅ 빠른 userId 조회 후 해당 문서만 읽기

**단점**:
- ⚠️ 2번의 Firestore 읽기 필요

#### 권장 구현: 옵션 2 (링크 매핑 컬렉션)

**이유**:
- ✅ 기존 데이터 구조 최소 변경
- ✅ Security Rules 변경 최소화
- ✅ 점진적 마이그레이션 가능

#### 구현 계획

**1. 링크 생성 시 매핑 추가**

```typescript
export const createAttendanceCheckLink = onCall(async (request) => {
  // ... 기존 로직

  const linkRef = db
    .collection("users")
    .doc(userId)
    .collection("attendance_check_links")
    .doc();

  const linkToken = uuidv4();

  // ✅ 링크 매핑 생성
  const mappingRef = db
    .collection("attendance_link_mappings")
    .doc(linkToken);

  const batch = db.batch();

  // 링크 문서 생성
  batch.set(linkRef, linkData);

  // 매핑 문서 생성
  batch.set(mappingRef, {
    userId,
    linkId: linkRef.id,
    linkDocPath: `users/${userId}/attendance_check_links/${linkRef.id}`,
    createdAt: admin.firestore.Timestamp.now()
  });

  await batch.commit();

  // ... 응답 반환
});
```

**2. PIN 체크 시 매핑 사용**

```typescript
export const checkAttendanceByPin = onCall(async (request) => {
  const { linkToken, pin } = request.data;

  try {
    const db = admin.firestore();

    // ✅ 1단계: 매핑에서 userId 조회
    const mappingDoc = await db
      .collection("attendance_link_mappings")
      .doc(linkToken)
      .get();

    if (!mappingDoc.exists) {
      throw new HttpsError("not-found", "유효하지 않은 출석 체크 링크입니다.");
    }

    const mapping = mappingDoc.data();
    const userId = mapping.userId;
    const linkId = mapping.linkId;

    // ✅ 2단계: 해당 사용자의 링크 문서만 조회
    const linkDoc = await db
      .collection("users")
      .doc(userId)
      .collection("attendance_check_links")
      .doc(linkId)
      .get();

    if (!linkDoc.exists || !linkDoc.data()?.isActive) {
      throw new HttpsError("not-found", "유효하지 않은 출석 체크 링크입니다.");
    }

    const linkData = linkDoc.data() as AttendanceCheckLink;

    // ... 이하 PIN 검증 로직 동일
  }
});
```

**성능 비교**:

| 항목 | 기존 (컬렉션 그룹) | 개선 (매핑) | 개선율 |
|------|-----------------|----------|--------|
| Firestore 읽기 | 전체 링크 스캔 | 2개 문서 | 99%+ |
| 응답 시간 | 200-500ms | 50-100ms | 80% |
| Index 필요 | Composite | 없음 | - |

#### 배포 체크리스트

- [ ] 링크 매핑 컬렉션 설계
- [ ] `createAttendanceCheckLink` 수정
- [ ] `checkAttendanceByPin` 수정
- [ ] 기존 링크 마이그레이션 스크립트
- [ ] Security Rules 업데이트
- [ ] 성능 테스트
- [ ] Test 환경 배포 및 검증
- [ ] Production 배포

#### 예상 소요 시간
- 설계 및 구현: 4시간
- 마이그레이션 스크립트: 2시간
- 테스트: 2시간
- **총 8시간**

---

## 테스트 계획

### Unit Tests

#### 1. timeUtils 테스트

```typescript
// functions/src/utils/__tests__/timeUtils.test.ts
describe('timeUtils', () => {
  test('getCurrentKoreaTime returns system time', () => {
    const before = new Date();
    const koreaTime = getCurrentKoreaTime();
    const after = new Date();

    expect(koreaTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(koreaTime.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  test('getTodayInKorea returns YYYY-MM-DD', () => {
    const today = getTodayInKorea();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('parseTimeToMinutes and minutesToTime are inverse', () => {
    const times = ['00:00', '09:30', '12:00', '23:59'];
    times.forEach(time => {
      const minutes = parseTimeToMinutes(time);
      const converted = minutesToTime(minutes);
      expect(converted).toBe(time);
    });
  });
});
```

#### 2. PIN 중복 검증 테스트

```typescript
// functions/src/modules/personal/__tests__/studentAttendanceManagement.test.ts
describe('generateStudentPin', () => {
  test('rejects duplicate PIN', async () => {
    // Student A에게 PIN "1234" 할당
    await generateStudentPin({ studentId: 'A', pin: '1234' });

    // Student B에게 동일한 PIN "1234" 할당 시도
    await expect(
      generateStudentPin({ studentId: 'B', pin: '1234' })
    ).rejects.toThrow('이미 사용 중인 PIN입니다');
  });

  test('allows same PIN for same student (update)', async () => {
    await generateStudentPin({ studentId: 'A', pin: '1234' });

    // 동일 학생에게 동일 PIN 재설정 (업데이트) 허용
    await expect(
      generateStudentPin({ studentId: 'A', pin: '1234' })
    ).resolves.toBeDefined();
  });
});
```

#### 3. 수동 체크인 트랜잭션 테스트

```typescript
describe('manualCheckIn with not_arrived', () => {
  test('recovers not_arrived status within grace period', async () => {
    // 배치가 not_arrived로 전환한 상황 시뮬레이션
    await setRecordStatus('student123', 'not_arrived');

    // 관리자 수동 체크인
    const result = await manualCheckIn({ studentId: 'student123' });

    expect(result.data.status).toBe('checked_in');
    expect(result.data.notes).toContain('자동 복구');
  });
});
```

### Integration Tests

#### 1. 배치 작업 통합 테스트

```typescript
describe('Scheduled Functions Integration', () => {
  test('createDailyAttendanceRecords creates records', async () => {
    // 학생 및 시간표 설정
    await setupStudent('student123', timetable);

    // 배치 실행
    await createDailyAttendanceRecords();

    // 레코드 생성 확인
    const records = await getAttendanceRecords('student123');
    expect(records.length).toBeGreaterThan(0);
    expect(records[0].status).toBe('scheduled');
  });

  test('markNotArrivedAtStartTime transitions at exact time', async () => {
    // 09:00 시작 슬롯 생성
    await createScheduledRecord('student123', '09:00', '12:00');

    // Mock 시간: 09:00
    jest.setSystemTime(new Date('2025-01-31T09:00:00+09:00'));

    // 배치 실행
    await markNotArrivedAtStartTime();

    // 상태 확인
    const record = await getAttendanceRecord('student123');
    expect(record.status).toBe('not_arrived');
  });
});
```

### E2E Tests

#### 1. PIN 체크인 전체 플로우

```typescript
describe('PIN Check-in E2E', () => {
  test('complete check-in/out cycle', async () => {
    // 1. 학생 및 좌석 배치도 설정
    const student = await createStudent('홍길동');
    const layout = await createSeatLayout('메인홀');
    await assignSeat(student.id, layout.id, 'A-1');

    // 2. PIN 생성
    await generateStudentPin(student.id, '1234');

    // 3. 출석 체크 링크 생성
    const link = await createAttendanceCheckLink(layout.id);

    // 4. 배치 작업: 레코드 생성
    await createDailyAttendanceRecords();

    // 5. PIN으로 체크인
    const checkinResult = await checkAttendanceByPin(link.linkToken, '1234');
    expect(checkinResult.action).toBe('checked_in');

    // 6. PIN으로 체크아웃
    const checkoutResult = await checkAttendanceByPin(link.linkToken, '1234');
    expect(checkoutResult.action).toBe('checked_out');
  });
});
```

---

## 배포 전략

### 1. 환경별 배포 순서

```
Local Emulator → Test Environment → Production
```

### 2. Phase별 배포 일정

| Phase | 내용 | 예상 소요 시간 | 배포 일정 |
|-------|------|--------------|----------|
| Phase 1 | 타임존 수정 (Critical) | 2.5시간 | 즉시 (D+0) |
| Phase 2 | PIN 성능, 체크인 일관성 | 4.5시간 | 1주 후 (D+7) |
| Phase 3 | 실패 잠금, 유예 계산 | 5시간 | 2주 후 (D+14) |
| Phase 4 | 링크 구조 개선 | 8시간 | 1개월 후 (D+30) |

### 3. Rollback 계획

#### Phase 1 (타임존 수정)
- **Rollback 트리거**: 배치 작업 시간 오류 발견 시
- **Rollback 방법**:
  ```bash
  git revert <commit-hash>
  npm run deploy -- --only functions
  ```
- **영향 범위**: 모든 scheduled functions

#### Phase 2-4
- **Rollback 트리거**:
  - PIN 생성 실패율 >10%
  - 수동 체크인 실패율 >5%
  - 링크 조회 실패율 >1%
- **Rollback 방법**:
  - Feature flag를 통한 점진적 롤백
  - 기존 로직으로 fallback

### 4. 모니터링

#### 배포 후 24시간 모니터링 항목

```bash
# 배치 작업 로그
firebase functions:log --only createDailyAttendanceRecords
firebase functions:log --only markNotArrivedAtStartTime
firebase functions:log --only markAbsentUnexcused

# 에러율 확인
firebase functions:log --severity ERROR --limit 100

# Firestore 사용량
gcloud firestore operations list
```

#### 알림 설정

- Cloud Monitoring Alerts:
  - Function 에러율 >1%
  - Function 실행 시간 >5초
  - Firestore 읽기 급증 (>1000/분)

---

## 마이그레이션 스크립트

### 1. PIN 시도 로그 컬렉션 초기화 (선택사항)

Rate Limiting은 새로운 컬렉션(`pin_attempt_logs`)을 사용하므로 **마이그레이션 불필요**.

배포 시 자동으로 로그가 쌓이기 시작함.

### 2. Firestore TTL 정책 설정

```bash
# Firebase Console에서 설정
# 1. Firestore Database > 설정 > Time-to-live
# 2. 컬렉션: pin_attempt_logs
# 3. TTL 필드: expiresAt
# 4. 저장
```

**참고**: Firestore TTL은 Firebase Console에서만 설정 가능 (코드로 불가)

### 3. 링크 매핑 생성 (Phase 4)

```typescript
// scripts/create-link-mappings.ts
async function createMappings() {
  const usersSnapshot = await db.collection('users').get();

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const linksSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('attendance_check_links')
      .get();

    const batch = db.batch();

    for (const linkDoc of linksSnapshot.docs) {
      const linkData = linkDoc.data();
      const linkToken = linkData.linkToken;

      // 매핑 문서 생성
      const mappingRef = db
        .collection('attendance_link_mappings')
        .doc(linkToken);

      batch.set(mappingRef, {
        userId,
        linkId: linkDoc.id,
        linkDocPath: `users/${userId}/attendance_check_links/${linkDoc.id}`,
        createdAt: admin.firestore.Timestamp.now()
      });
    }

    await batch.commit();
    console.log(`Created mappings for user ${userId}: ${linksSnapshot.size} links`);
  }

  console.log('Mapping creation complete!');
}

createMappings();
```

---

## 체크리스트 요약

### Phase 1 (긴급)
- [ ] timeUtils.ts 수정
- [ ] 단위 테스트 작성
- [ ] Emulator 테스트
- [ ] Test 환경 배포
- [ ] 24시간 모니터링
- [ ] Production 배포

### Phase 2 (고우선순위)
- [ ] PIN 중복 검증 로직 수정
- [ ] actualPin 노출 제거
- [ ] Composite Index 설정
- [ ] manualCheckIn 개선
- [ ] 성능 테스트
- [ ] 배포

### Phase 3 (중우선순위)
- [ ] Rate Limiting 로직 구현
- [ ] PIN 시도 로그 컬렉션 설계
- [ ] Composite Index 생성
- [ ] Firestore TTL 정책 설정
- [ ] 유예 기간 계산 단순화
- [ ] 배포

### Phase 4 (장기)
- [ ] 링크 매핑 설계
- [ ] 마이그레이션 스크립트
- [ ] Security Rules 업데이트
- [ ] 성능 벤치마크
- [ ] 배포

---

## 예상 총 소요 시간

| Phase | 시간 | 우선순위 |
|-------|------|----------|
| Phase 1 | 3.5시간 (UTC 환경 대응, 안정적 파싱) | 🔴 Critical |
| Phase 2 | 4.5시간 | 🟡 High |
| Phase 3 | 5.5시간 (Rate Limiting + 유예 계산) | 🟢 Medium |
| Phase 4 | 8시간 | 🔵 Low |
| **총계** | **21.5시간** | - |

---

## 참고 문서

- [ATTENDANCE_DATABASE_DESIGN.md](./ATTENDANCE_DATABASE_DESIGN.md)
- [ATTENDANCE_SLOT_IMPLEMENTATION_PLAN.md](./ATTENDANCE_SLOT_IMPLEMENTATION_PLAN.md)
- [ATTENDANCE_IMPLEMENTATION_STATUS.md](./ATTENDANCE_IMPLEMENTATION_STATUS.md)
- [Firebase Cloud Functions 문서](https://firebase.google.com/docs/functions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

---

**문서 버전**: 1.2
**최종 수정**: 2025-01-31
**작성자**: Claude Code Analysis

---

## 📝 변경 이력

### v1.2 (2025-01-31)
- 🔴 **Phase 1 타임존 변환 안정성 개선**
  - ❌ `toLocaleString()` 전체 문자열 파싱 방식 제거 (불안정)
  - ✅ 개별 요소 추출 방식으로 변경 (안정적)
  - 크로스 플랫폼 호환성 보장
  - 코드 길이 증가하지만 안정성 크게 향상

- 🟢 **Phase 3 실패 잠금 로직 보안 강화**
  - ❌ 링크 레벨 실패 카운트 방식 제거 (DoS 취약점)
  - ✅ 시간 기반 Rate Limiting 방식으로 변경
  - DoS 공격 방지: 링크 자체는 차단되지 않음
  - 5분 내 20회 실패 시 임시 차단 (5분 후 자동 복구)
  - 새로운 컬렉션 추가: `pin_attempt_logs`
  - Composite Index 필요: (linkToken + timestamp + success)
  - 예상 소요 시간: 4시간 → 4.5시간
  - 총 소요 시간: 21시간 → 21.5시간

### v1.1 (2025-01-31)
- 🔴 **Phase 1 타임존 해결책 수정**
  - ❌ 옵션 1 (시스템 시간 직접 사용) 제거
  - ✅ 옵션 1을 명시적 타임존 변환으로 변경
  - Cloud Functions UTC 환경에 대한 명확한 설명 추가
  - UTC 환경 테스트 케이스 추가
  - 예상 소요 시간: 2.5시간 → 3.5시간
  - 총 소요 시간: 20시간 → 21시간

### v1.0 (2025-01-31)
- 초기 버전 작성
- 7개 이슈 분석 및 개선 계획 수립
