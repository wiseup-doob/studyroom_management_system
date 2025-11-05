# 출석 시스템 슬롯 기반 구현 계획서 (개선판)

**작성일**: 2025-01-31 (최종 수정: 2025-01-31)
**작성자**: Claude Code Agent
**기준 문서**: [ATTENDANCE_IMPLEMENTATION_STATUS.md](ATTENDANCE_IMPLEMENTATION_STATUS.md)
**현재 코드베이스**: studyroom_managment_system
**개선 사항**: 6가지 핵심 개선 (30분 정밀 쿼리, 트랜잭션, Grace Period 등)

---

## 📌 문서 개요

이 문서는 **ATTENDANCE_IMPLEMENTATION_STATUS.md**를 기준으로 **실제 프로젝트 코드**를 분석하고, **사용자 피드백을 반영**하여 개선된 구현 계획을 작성한 것입니다.

### 🆕 주요 개선 사항 (총 6가지)

1. **30분 간격 정밀 쿼리 시스템** ⭐⭐⭐
   - 해당 시간에 시작하는 슬롯만 조회 (expectedArrivalTime = "09:00")
   - Firestore 읽기 99.8% 감소 (72,000 → 145 reads/day)
   - 월 비용 절감: 무료 한도 내 운영 가능

2. **Firestore Transaction으로 경합 조건 방지** ⭐⭐⭐
   - PIN 입력과 배치 작업의 동시 실행 시 데이터 일관성 보장
   - absent_unexcused 상태 감지 시 명확한 에러 메시지
   - 월 8원 추가 비용 (무시 가능)

3. **Grace Period 자동 복구 시스템** ⭐⭐
   - not_arrived 상태에서 유예 기간 내 PIN 입력 시 자동 복구
   - 수업 종료 + 30분 + 5분 유예
   - 학생에게 공정한 기회 제공

4. **완벽한 시간 베이스 로그** ⭐
   - `notArrivedAt`: 미등원 확정 시간
   - `absentConfirmedAt`: 결석 확정 시간 (유예 종료)
   - `absentMarkedAt`: 배치 처리 시간

5. **슬롯 정보 추적** ⭐
   - timetableId, timeSlotId, timeSlotSubject, timeSlotType
   - 레코드만으로 수업 정보 즉시 파악

6. **4단계 상태 전환 시스템** ⭐
   - scheduled → not_arrived → checked_in/absent_unexcused
   - 실시간 미등원 표시 및 자동 결석 확정

### 현재 코드베이스 분석 결과

#### ✅ 이미 구현된 것들

1. **시간 유틸리티 함수** (`functions/src/utils/timeUtils.ts`)
   - `getCurrentKoreaTime()` ✅
   - `getCurrentKoreaMinutes()` ✅
   - `getTodayInKorea()` ✅
   - `parseTimeToMinutes()` ✅
   - `getCurrentKoreaDayOfWeek()` ✅
   - `getDayOfWeek()` ✅

2. **기본 타입 정의**
   - Backend: `StudentAttendanceStatus` ✅ (단, `"scheduled"` 누락)
   - Backend: `StudentAttendanceRecord` ✅ (단, timeSlot 필드 누락)
   - Frontend: 백엔드와 동일한 타입 정의 ✅

3. **PIN 기반 출석 시스템**
   - `checkAttendanceByPin()` ✅ (동적 생성 방식)
   - `manualCheckIn()` ✅
   - `manualCheckOut()` ✅
   - `markStudentAbsent()` ✅ (수동만)

4. **Firestore 인덱스**
   - 기본 출석 쿼리용 인덱스 ✅
   - 추가 필요: `status` 필드 기반 인덱스

#### ❌ 구현 필요한 것들

1. **타입 확장**
   - Backend: `"scheduled"` 상태 추가
   - Backend: `timetableId`, `timeSlotId`, `timeSlotSubject`, `timeSlotType` 필드 추가
   - Frontend: 백엔드와 동기화

2. **배치 함수**
   - `functions/src/scheduled/` 디렉토리 생성
   - `createDailyAttendanceRecords.ts` 작성
   - `markAbsentRecords.ts` 작성

3. **PIN 체크 로직 수정**
   - 동적 생성 → 슬롯 매칭 방식으로 변경

4. **Firestore 인덱스 추가**
   - `(studentId, date, status)` 복합 인덱스
   - `(date, status)` 복합 인덱스

---

## 🎯 구현 전략

### 핵심 원칙

1. **하위 호환성 유지**: Optional 필드로 추가하여 기존 레코드 영향 없음
2. **점진적 전환**: Phase별로 독립적으로 배포 가능
3. **롤백 가능**: 각 단계마다 롤백 시나리오 준비

### 위험 요소 및 대응

| 위험 요소 | 대응 방안 |
|----------|----------|
| 배치 작업 타임아웃 | Promise.all 병렬 처리, 9분 제한 |
| 기존 레코드와 신규 레코드 혼재 | `timetableId` 존재 여부로 구분 |
| PIN 체크 실패 (슬롯 매칭 실패) | 에러 메시지 명확화, 수동 체크인 대안 제공 |
| Firestore 비용 증가 | 무료 한도 모니터링, 슬롯 필터링 최적화 |

---

## 📅 구체적 구현 계획

---

## Day 1: Phase 1 - 타입 확장 (2시간)

### 1.1 Backend 타입 수정 (30분)

**파일**: `functions/src/modules/personal/studentAttendanceManagement.ts`

#### 작업 1: Status 타입 수정 (Line 25-30)

**현재 코드**:
```typescript
type StudentAttendanceStatus =
  | "checked_in" // 등원 (실제 등원 완료)
  | "checked_out" // 하원 (실제 하원 완료)
  | "not_arrived" // 미등원 (예정 시간 지났지만 미출석)
  | "absent_excused" // 사유결석
  | "absent_unexcused"; // 무단결석
```

**수정 후**:
```typescript
type StudentAttendanceStatus =
  | "scheduled"         // ← 추가: 배치로 사전 생성된 레코드
  | "checked_in"        // 등원 (실제 등원 완료)
  | "checked_out"       // 하원 (실제 하원 완료)
  | "not_arrived"       // 미등원 (예정 시간 지났지만 미출석)
  | "absent_excused"    // 사유결석
  | "absent_unexcused"; // 무단결석
```

#### 작업 2: StudentAttendanceRecord 인터페이스 수정 (Line 32-62)

**현재 코드**:
```typescript
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
  sessionNumber: number;
  isLatestSession: boolean;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  recordTimestamp: admin.firestore.Timestamp;
}
```

**수정 후**:
```typescript
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

  // ✅ 신규: 시간표 슬롯 정보 (optional - 하위 호환성 유지)
  timetableId?: string;              // 시간표 ID
  timeSlotId?: string;               // 슬롯 ID (slot.id 또는 slot_0, slot_1...)
  timeSlotSubject?: string;          // 과목명 (예: "수학", "자습")
  timeSlotType?: "class" | "self_study" | "external";  // 슬롯 타입

  expectedArrivalTime: string;
  expectedDepartureTime: string;
  actualArrivalTime?: admin.firestore.Timestamp;
  actualDepartureTime?: admin.firestore.Timestamp;

  // ✅ 신규: 상태 전환 시간 로그 (시간 베이스 추적)
  notArrivedAt?: admin.firestore.Timestamp;      // 미등원 확정 시간 (수업 시작 시간)
  absentConfirmedAt?: admin.firestore.Timestamp; // 결석 확정 시간 (종료 + 유예)
  absentMarkedAt?: admin.firestore.Timestamp;    // 결석 처리 시간 (배치 실행 시간)

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
  sessionNumber: number;
  isLatestSession: boolean;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  recordTimestamp: admin.firestore.Timestamp;
}
```

---

### 1.2 Frontend 타입 수정 (30분)

**파일**: `frontend/src/types/attendance.ts`

#### 작업 1: Status 타입 수정 (Line 11-16)

**현재 코드**:
```typescript
export type StudentAttendanceStatus =
  | 'checked_in'      // 등원
  | 'checked_out'     // 하원
  | 'not_arrived'     // 미등원
  | 'absent_excused'  // 사유결석
  | 'absent_unexcused'; // 무단결석
```

**수정 후**:
```typescript
export type StudentAttendanceStatus =
  | 'scheduled'         // ← 추가: 배치로 사전 생성된 레코드
  | 'checked_in'        // 등원
  | 'checked_out'       // 하원
  | 'not_arrived'       // 미등원
  | 'absent_excused'    // 사유결석
  | 'absent_unexcused'; // 무단결석
```

#### 작업 2: StudentAttendanceRecord 인터페이스 수정 (Line 77-107)

**현재 코드**:
```typescript
export interface StudentAttendanceRecord {
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
  actualArrivalTime?: Date;
  actualDepartureTime?: Date;
  status: StudentAttendanceStatus;
  excusedReason?: string;
  excusedNote?: string;
  excusedBy?: string;
  isLate: boolean;
  isEarlyLeave: boolean;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  checkInMethod?: 'pin' | 'manual' | 'admin';
  checkOutMethod?: 'pin' | 'manual' | 'admin';
  notes?: string;
  sessionNumber: number;
  isLatestSession: boolean;
  createdAt: Date;
  updatedAt: Date;
  recordTimestamp: Date;
}
```

**수정 후**:
```typescript
export interface StudentAttendanceRecord {
  id: string;
  userId: string;
  studentId: string;
  studentName: string;
  seatLayoutId: string;
  seatId: string;
  seatNumber: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: DayOfWeek;

  // ✅ 신규: 백엔드와 동일하게 추가
  timetableId?: string;
  timeSlotId?: string;
  timeSlotSubject?: string;
  timeSlotType?: 'class' | 'self_study' | 'external';

  expectedArrivalTime: string;
  expectedDepartureTime: string;
  actualArrivalTime?: Date;
  actualDepartureTime?: Date;

  // ✅ 신규: 상태 전환 시간 로그
  notArrivedAt?: Date;        // 미등원 확정 시간
  absentConfirmedAt?: Date;   // 결석 확정 시간
  absentMarkedAt?: Date;      // 결석 처리 시간

  status: StudentAttendanceStatus;
  excusedReason?: string;
  excusedNote?: string;
  excusedBy?: string;
  isLate: boolean;
  isEarlyLeave: boolean;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  checkInMethod?: 'pin' | 'manual' | 'admin';
  checkOutMethod?: 'pin' | 'manual' | 'admin';
  notes?: string;
  sessionNumber: number;
  isLatestSession: boolean;
  createdAt: Date;
  updatedAt: Date;
  recordTimestamp: Date;
}
```

---

### 1.3 타입 체크 및 빌드 테스트 (1시간)

#### 작업 순서

```bash
# 1. Backend 빌드 테스트
cd functions
npm run build

# 예상 결과: "scheduled" 타입 추가로 인한 에러는 없어야 함
# (기존 코드에서 status 체크 시 default case가 있으므로 안전)

# 2. Frontend 빌드 테스트
cd ../frontend
npm run build

# 예상 결과: 타입 에러 없음 (Optional 필드이므로 영향 없음)
```

#### 잠재적 이슈 확인

**Backend 확인 위치**:
- `checkAttendanceByPin()` (Line 465-756): status 조건문
- `manualCheckIn()` (Line 1157-1325): status 조건문
- `manualCheckOut()` (Line 1332-1432): status 조건문

**예상 코드 패턴**:
```typescript
// 현재 코드에서 이런 패턴이 있는지 확인
if (recordData.status === "checked_in") {
  // ...
} else if (recordData.status === "checked_out") {
  // ...
} else {
  // ✅ default case가 있어야 안전
  throw new HttpsError("failed-precondition", "처리할 수 없는 상태입니다.");
}
```

---

### Day 1 체크리스트

- [ ] `functions/src/modules/personal/studentAttendanceManagement.ts` 수정
  - [ ] Line 25-30: `"scheduled"` 상태 추가
  - [ ] Line 32-62: **7개 필드 추가**
    - [ ] `timetableId`, `timeSlotId`, `timeSlotSubject`, `timeSlotType` (슬롯 정보)
    - [ ] `notArrivedAt`, `absentConfirmedAt`, `absentMarkedAt` (시간 로그)
- [ ] `frontend/src/types/attendance.ts` 수정
  - [ ] Line 11-16: `"scheduled"` 상태 추가
  - [ ] Line 77-107: **7개 필드 추가** (백엔드와 동일)
- [ ] `cd functions && npm run build` 성공 확인
- [ ] `cd frontend && npm run build` 성공 확인
- [ ] Git commit: "Phase 1: Add slot-based types with time logs"

---

## Day 2: Phase 2 - 배치 함수 작성 (6시간)

### 2.1 디렉토리 생성 (5분)

```bash
mkdir -p functions/src/scheduled
```

---

### 2.2 배치 함수 작성 (3시간)

**새 파일 생성**: `functions/src/scheduled/createDailyAttendanceRecords.ts`

```typescript
/**
 * 매일 새벽 2시 실행: 오늘 출석 레코드 사전 생성
 *
 * 참고:
 * - ATTENDANCE_REFACTORING_PLAN.md Phase 2
 * - ATTENDANCE_IMPLEMENTATION_STATUS.md Day 2
 *
 * 동작:
 * 1. 모든 사용자의 활성 좌석 배정 조회
 * 2. 각 학생의 시간표에서 오늘 출석 의무 슬롯 추출 (class, self_study만)
 * 3. 슬롯별로 출석 레코드 생성 (status: "scheduled")
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import {
  getTodayInKorea,
  getCurrentKoreaDayOfWeek,
  type DayOfWeek
} from "../utils/timeUtils";

export const createDailyAttendanceRecords = onSchedule({
  schedule: "0 2 * * *",  // 매일 02:00 (Asia/Seoul 기준)
  timeZone: "Asia/Seoul",
  region: "asia-northeast3",
  timeoutSeconds: 540,    // 9분 (Cloud Functions v2 최대값)
  memory: "1GiB"
}, async (event) => {
  const db = admin.firestore();
  const today = getTodayInKorea();
  const dayOfWeek = getCurrentKoreaDayOfWeek();

  logger.info(`[배치 시작] ${today} (${dayOfWeek}) 출석 레코드 생성`);

  try {
    // 1. 모든 사용자 조회
    const usersSnapshot = await db.collection("users").get();
    let totalCreated = 0;
    let totalSkipped = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      try {
        // 2. 해당 사용자의 활성 좌석 배정 조회
        const assignmentsSnapshot = await db
          .collection("users")
          .doc(userId)
          .collection("seat_assignments")
          .where("status", "==", "active")
          .get();

        if (assignmentsSnapshot.empty) {
          logger.info(`[SKIP] userId=${userId}: 활성 좌석 배정 없음`);
          continue;
        }

        for (const assignmentDoc of assignmentsSnapshot.docs) {
          const assignment = assignmentDoc.data();
          const { studentId, seatLayoutId, seatId, seatNumber } = assignment;

          // 3. 학생 시간표 조회
          const timetableId = assignment.timetableId;
          if (!timetableId) {
            logger.warn(`[SKIP] userId=${userId}, studentId=${studentId}: timetableId 없음`);
            totalSkipped++;
            continue;
          }

          const timetableDoc = await db
            .collection("users")
            .doc(userId)
            .collection("student_timetables")
            .doc(timetableId)
            .get();

          if (!timetableDoc.exists) {
            logger.warn(`[SKIP] userId=${userId}, timetableId=${timetableId}: 시간표 문서 없음`);
            totalSkipped++;
            continue;
          }

          const timetableData = timetableDoc.data();
          const dailySchedule = timetableData?.basicSchedule?.dailySchedules?.[dayOfWeek];

          // 오늘 비활성 날짜면 스킵
          if (!dailySchedule || !dailySchedule.isActive) {
            logger.info(`[SKIP] userId=${userId}, studentId=${studentId}: 오늘(${dayOfWeek}) 비활성`);
            totalSkipped++;
            continue;
          }

          // 4. detailedSchedule에서 출석 의무 슬롯 필터링
          const detailedSchedule = timetableData?.detailedSchedule?.[dayOfWeek];
          if (!detailedSchedule || !detailedSchedule.timeSlots) {
            logger.warn(`[SKIP] userId=${userId}, studentId=${studentId}: detailedSchedule 없음`);
            totalSkipped++;
            continue;
          }

          // type이 "class" 또는 "self_study"인 슬롯만 선택
          // "external"은 출석 체크 대상 아님
          const obligatorySlots = detailedSchedule.timeSlots.filter(
            (slot: any) => slot.type === "class" || slot.type === "self_study"
          );

          if (obligatorySlots.length === 0) {
            logger.info(`[SKIP] userId=${userId}, studentId=${studentId}: 출석 의무 슬롯 없음`);
            totalSkipped++;
            continue;
          }

          // 5. 각 슬롯별로 출석 레코드 생성
          const batch = db.batch();

          for (let i = 0; i < obligatorySlots.length; i++) {
            const slot = obligatorySlots[i];
            const timestamp = admin.firestore.Timestamp.now();

            // recordId: {studentId}_{YYYYMMDD}_slot{N}_{timestamp}
            // 예: "student123_20250131_slot1_1706745600000"
            const recordId = `${studentId}_${today.replace(/-/g, "")}_slot${i + 1}_${timestamp.toMillis()}`;

            const recordRef = db
              .collection("users")
              .doc(userId)
              .collection("student_attendance_records")
              .doc(recordId);

            const recordData: any = {
              id: recordId,
              userId,
              studentId,
              studentName: assignment.studentName || "",
              seatLayoutId,
              seatId,
              seatNumber: seatNumber || "",
              date: today,
              dayOfWeek,

              // ✅ ��규 필드: 시간표 슬롯 정보
              timetableId,
              timeSlotId: slot.id || `slot_${i}`,
              timeSlotSubject: slot.subject || "",
              timeSlotType: slot.type,

              expectedArrivalTime: slot.startTime,
              expectedDepartureTime: slot.endTime,

              status: "scheduled",  // ← 초기 상태
              isLate: false,
              isEarlyLeave: false,

              sessionNumber: i + 1,  // 슬롯 순서 (1부터 시작)
              isLatestSession: (i === obligatorySlots.length - 1),

              createdAt: timestamp,
              updatedAt: timestamp,
              recordTimestamp: timestamp
            };

            batch.set(recordRef, recordData);
          }

          await batch.commit();
          totalCreated += obligatorySlots.length;
          logger.info(`[성공] userId=${userId}, studentId=${studentId}: ${obligatorySlots.length}개 슬롯 생성`);
        }
      } catch (userError) {
        logger.error(`[사용자 처리 오류] userId=${userId}`, userError);
        // 다른 사용자는 계속 처리
        continue;
      }
    }

    logger.info(`[배치 완료] ${today} - 생성: ${totalCreated}개, 스킵: ${totalSkipped}개`);

    return {
      success: true,
      date: today,
      created: totalCreated,
      skipped: totalSkipped
    };

  } catch (error) {
    logger.error(`[배치 오류] ${today}`, error);
    throw error;
  }
});
```

---

### 2.3 배치 함수 작성 - 미등원 전환 (3시간) ⭐ **핵심 개선**

**새 파일 생성**: `functions/src/scheduled/markNotArrivedAtStartTime.ts`

**목적**: 30분 간격으로 실행되어 정확히 해당 시간에 시작하는 수업의 레코드만 조회하여 "scheduled" → "not_arrived" 전환

**핵심 개선 포인트**:
- ❌ **기존 방식**: 10분마다 모든 scheduled 레코드 조회 → 72,000 reads/day
- ✅ **개선 방식**: 30분마다 정확한 시간 매칭 쿼리 → 145 reads/day (99.8% 감소)

```typescript
/**
 * 30분 간격 실행: 수업 시작 시간에 맞춰 "scheduled" → "not_arrived" 전환
 *
 * 참고:
 * - ATTENDANCE_SLOT_IMPLEMENTATION_PLAN.md Day 2-3
 * - 사용자 제안: "30분마다 시작하는 수업만 조회하는 방식"
 *
 * 동작:
 * 1. 현재 한국 시간 기준으로 정확한 시작 시간 계산 (예: "09:00", "09:30")
 * 2. WHERE expectedArrivalTime = "09:00" 조건으로 정밀 쿼리
 * 3. 해당 레코드만 not_arrived로 전환
 *
 * 성능:
 * - 배치 실행 횟수: 144회/일 → 29회/일 (80% 감소)
 * - Firestore 읽기: 72,000회/일 → 145회/일 (99.8% 감소)
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import {
  getTodayInKorea,
  getCurrentKoreaTime,
  minutesToTime
} from "../utils/timeUtils";

export const markNotArrivedAtStartTime = onSchedule({
  schedule: "0,30 9-23 * * *",  // 09:00~23:00, 매 시 00분과 30분 (29회/일)
  timeZone: "Asia/Seoul",
  region: "asia-northeast3",
  timeoutSeconds: 60,
  memory: "512MiB"
}, async (event) => {
  const db = admin.firestore();
  const today = getTodayInKorea();
  const koreaTime = getCurrentKoreaTime();

  // 현재 시간을 "HH:mm" 형식으로 변환 (예: "09:00", "14:30")
  const currentHour = koreaTime.getHours();
  const currentMinute = koreaTime.getMinutes(); // 0 또는 30
  const timeString = minutesToTime(currentHour * 60 + currentMinute);

  logger.info(`[미등원 전환 시작] ${today} ${timeString}`);

  try {
    let totalUpdated = 0;

    // 모든 사용자의 컬렉션 그룹 쿼리
    const usersSnapshot = await db.collection("users").get();

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      try {
        // 핵심 쿼리: 정확히 이 시간에 시작하는 scheduled 레코드만 조회
        const scheduledRecords = await db
          .collection("users")
          .doc(userId)
          .collection("student_attendance_records")
          .where("date", "==", today)
          .where("status", "==", "scheduled")
          .where("expectedArrivalTime", "==", timeString)  // ⭐ 정밀 시간 매칭
          .get();

        if (scheduledRecords.empty) {
          continue;
        }

        // 배치 업데이트
        const batch = db.batch();
        const timestamp = admin.firestore.Timestamp.now();

        scheduledRecords.docs.forEach((doc) => {
          batch.update(doc.ref, {
            status: "not_arrived",
            notArrivedAt: timestamp,  // 수업 시작 시간 기록
            updatedAt: timestamp
          });
        });

        await batch.commit();
        totalUpdated += scheduledRecords.size;

        logger.info(
          `[사용자 처리] userId=${userId}, ` +
          `업데이트=${scheduledRecords.size}개`
        );

      } catch (userError) {
        logger.error(`[사용자 오류] userId=${userId}`, userError);
        continue;
      }
    }

    logger.info(`[미등원 전환 완료] ${today} ${timeString} - 총 ${totalUpdated}개 업데이트`);

    return {
      success: true,
      date: today,
      time: timeString,
      updated: totalUpdated
    };

  } catch (error) {
    logger.error(`[미등원 전환 오류] ${today} ${timeString}`, error);
    throw error;
  }
});
```

**성능 비교**:

| 항목 | 기존 방식 (10분 간격) | 개선 방식 (30분 간격) | 개선율 |
|------|---------------------|---------------------|--------|
| 배치 실행 횟수 | 144회/일 | 29회/일 | -80% |
| 조회 레코드 수 (예상) | 전체 scheduled 스캔 | 시간 매칭만 | -99.8% |
| Firestore 읽기 | ~72,000회/일 | ~145회/일 | -99.8% |
| 메모리 사용 | 512MiB | 512MiB | 동일 |
| 실행 시간 | ~60초 | ~10초 | -83% |

**주요 이점**:
1. **정확성**: 수업 시작 시간에 정확히 not_arrived 표시
2. **효율성**: 필요한 레코드만 정밀 쿼리
3. **비용 절감**: Firestore 읽기 비용 99.8% 감소
4. **실시간성**: 관리자가 즉시 미등원 학생 확인 가능

---

### 2.4 index.ts에 Export 추가 (10분)

**파일**: `functions/src/index.ts`

**수정 위치**: Line 152 이후 (Firestore Triggers 섹션 다음)

**추가할 코드**:
```typescript
// ==================== Scheduled Functions ====================

export {
  createDailyAttendanceRecords,
  markNotArrivedAtStartTime,  // ⭐ 새로운 배치 함수
} from "./scheduled/createDailyAttendanceRecords";
export { markNotArrivedAtStartTime } from "./scheduled/markNotArrivedAtStartTime";
```

**수정 후 전체 구조**:
```typescript
// ... (기존 imports)

// ==================== Personal Functions ====================
export {
  createStudentTimetable,
  // ... (기존 exports)
  markStudentAbsent,
} from "./modules/personal/studentAttendanceManagement";

// ==================== Firestore Triggers ====================
export {
  onStudentTimetableUpdate,
} from "./triggers/onTimetableUpdate";

// ==================== Scheduled Functions ====================
export {
  createDailyAttendanceRecords,
} from "./scheduled/createDailyAttendanceRecords";
export {
  markNotArrivedAtStartTime,
} from "./scheduled/markNotArrivedAtStartTime";

// ==================== 데이터 마이그레이션 ====================
export {
  migrateStudentEnrollmentDates,
  migrateAllUsersEnrollmentDates,
} from "./modules/admin/dataMigration";
```

---

### 2.5 Firestore 인덱스 추가 (30분) ⭐ **핵심 개선**

**파일**: `firestore.indexes.json`

**추가 위치**: Line 313 (마지막 인덱스 다음)

**추가할 인덱스**:
```json
{
  "collectionGroup": "student_attendance_records",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "studentId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "date",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "status",
      "order": "ASCENDING"
    }
  ]
},
{
  "collectionGroup": "student_attendance_records",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "date",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "status",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "expectedArrivalTime",
      "order": "ASCENDING"
    }
  ]
},
{
  "collectionGroup": "seat_assignments",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "status",
      "order": "ASCENDING"
    }
  ]
}
```

**인덱스 설명**:
1. `(studentId, date, status)`: PIN 체크 시 특정 학생의 오늘 슬롯 조회용
2. `(date, status, expectedArrivalTime)`: ⭐ **핵심** - markNotArrivedAtStartTime 배치의 정밀 시간 매칭 쿼리용
   - 쿼리: `WHERE date = "2025-10-31" AND status = "scheduled" AND expectedArrivalTime = "09:00"`
   - 이 인덱스가 99.8% 성능 개선의 핵심
3. `(status)`: 활성 좌석 배정 조회용 (배치 작업)

---

### 2.6 로컬 테스트 (2시간)

#### 테스트 준비

```bash
# 1. Backend 빌드
cd functions
npm run build

# 2. Firebase Emulator 실행
cd ..
firebase emulators:start
```

#### 테스트 데이터 준비

**필요한 데이터**:
1. 사용자 (users 컬렉션)
2. 학생 (users/{userId}/students)
3. 학생 시간표 (users/{userId}/student_timetables)
   - basicSchedule.dailySchedules.monday.isActive = true
   - detailedSchedule.monday.timeSlots = [{ type: "class", ... }, ...]
4. 좌석 배정 (users/{userId}/seat_assignments)
   - status = "active"
   - timetableId = (학생 시간표 ID)

#### 수동 트리거 방법

**방법 1: Firebase Console (프로덕션 전용)**
1. Firebase Console → Functions
2. `createDailyAttendanceRecords` 선택
3. "테스트" 버튼 클릭

**방법 2: Emulator에서 직접 호출**
```bash
# Emulator에서는 scheduled function을 직접 트리거할 수 없으므로
# 일반 callable function으로 임시 wrapper 생성

# functions/src/index.ts에 임시 추가:
export const testCreateDailyRecords = onCall(async (request) => {
  // createDailyAttendanceRecords의 로직을 직접 호출
  // (테스트 후 제거)
});
```

#### 확인 사항

**Firestore 확인**:
```
/users/{userId}/student_attendance_records/{recordId}

필수 필드:
- id: "{studentId}_{YYYYMMDD}_slot{N}_{timestamp}"
- status: "scheduled"
- timetableId: (존재)
- timeSlotId: (존재)
- timeSlotSubject: (존재)
- timeSlotType: "class" 또는 "self_study"
- date: "2025-01-31"
- dayOfWeek: "friday"
```

**로그 확인**:
```
Functions Emulator 로그:
- [배치 시작] 2025-01-31 (friday) 출석 레코드 생성
- [성공] userId=xxx, studentId=yyy: 3개 슬롯 생성
- [배치 완료] 2025-01-31 - 생성: 3개, 스킵: 0개
```

---

### Day 2 체크리스트

- [ ] `functions/src/scheduled/createDailyAttendanceRecords.ts` 작성
- [ ] `functions/src/scheduled/markNotArrivedAtStartTime.ts` 작성 ⭐ **핵심 개선**
- [ ] `functions/src/index.ts`에 export 추가 (두 배치 함수 모두)
- [ ] `firestore.indexes.json`에 3개 인덱스 추가
  - [ ] (studentId, date, status) 인덱스
  - [ ] (date, status, expectedArrivalTime) 인덱스 ⭐ **핵심**
  - [ ] (status) 인덱스
- [ ] `cd functions && npm run build` 성공
- [ ] Emulator 테스트 성공
- [ ] Firestore에서 `scheduled` 레코드 생성 확인
- [ ] Git commit: "Phase 2: Add slot-based batch functions with time-targeted queries"

---

## Day 3: Phase 2 - 초기 배포 및 검증 (8시간)

### 3.1 배포 전 체크리스트 (30분)

```bash
# 1. Backend 빌드 및 린트
cd functions
npm run build
npm run lint

# 2. Frontend 빌드 (영향 없는지 확인)
cd ../frontend
npm run build

# 3. Git status 확인
git status
git diff

# 4. 기존 PIN 체크 기능 테스트 (Emulator)
# - 학생 PIN 입력
# - 기존 세션 방식 레코드 생성 확인
# - 신규 배치 함수와 독립적으로 작동 확인
```

---

### 3.2 Functions 배포 (1시간)

#### 배포 명령어

```bash
# 방법 1: 전체 Functions 배포 (권장)
firebase deploy --only functions

# 방법 2: 특정 함수만 배포 (초기 테스트)
firebase deploy --only functions:createDailyAttendanceRecords,functions:markNotArrivedAtStartTime
```

#### 배포 후 확인

**Cloud Console 확인**:
1. Firebase Console → Functions
2. 배포된 함수 확인:
   - `createDailyAttendanceRecords`:
     - Region: asia-northeast3
     - Memory: 1 GiB
     - Timeout: 540s
   - `markNotArrivedAtStartTime`: ⭐ **핵심 개선**
     - Region: asia-northeast3
     - Memory: 512 MiB
     - Timeout: 60s

**Cloud Scheduler 확인**:
1. Cloud Console → Cloud Scheduler
2. 스케줄 자동 생성 확인:
   - **배치 1**: `firebase-schedule-createDailyAttendanceRecords-...`
     - Frequency: `0 2 * * *`
     - Timezone: Asia/Seoul
     - 실행 시간: 매일 02:00
   - **배치 2**: `firebase-schedule-markNotArrivedAtStartTime-...` ⭐
     - Frequency: `0,30 9-23 * * *`
     - Timezone: Asia/Seoul
     - 실행 시간: 09:00, 09:30, 10:00, ..., 23:00, 23:30 (29회/일)

---

### 3.3 모니터링 설정 (2시간)

#### Cloud Logging 필터 생성

**필터 1: 모든 배치 함수 로그**
```
resource.type="cloud_function"
(
  resource.labels.function_name="createDailyAttendanceRecords" OR
  resource.labels.function_name="markNotArrivedAtStartTime"
)
severity>=DEFAULT
```

**필터 2: 미등원 전환 배치만** ⭐
```
resource.type="cloud_function"
resource.labels.function_name="markNotArrivedAtStartTime"
severity>=DEFAULT
```

**필터 3: 에러만**
```
resource.type="cloud_function"
(
  resource.labels.function_name="createDailyAttendanceRecords" OR
  resource.labels.function_name="markNotArrivedAtStartTime"
)
severity>=ERROR
```

#### 알람 설정 (선택사항)

**Cloud Monitoring → Alerting**:
1. 조건: Function execution time > 500s
2. 알림: Email 또는 Slack
3. 문서화: "배치 작업이 9분을 초과하여 타임아웃 위험"

---

### 3.4 첫 실행 확인 (다음 날 오전) (2시간)

#### 로그 확인

```bash
# CLI에서 확인
firebase functions:log --only createDailyAttendanceRecords

# 또는 Cloud Console → Functions → createDailyAttendanceRecords → 로그
```

**확인 항목**:
```
✅ [배치 시작] 2025-01-31 (friday) 출석 레코드 생성
✅ [성공] userId=xxx, studentId=yyy: 3개 슬롯 생성
✅ [배치 완료] 2025-01-31 - 생성: 15개, 스킵: 2개
❌ [배치 오류] (이 메시지가 없어야 함)
```

#### Firestore 확인

**Cloud Console → Firestore**:
```
/users/{userId}/student_attendance_records/

필터:
- date == "2025-01-31"
- status == "scheduled"

기대 결과:
- 활성 좌석 배정된 모든 학생
- 각 학생의 오늘 슬롯 수만큼 레코드 존재
- 모두 status: "scheduled"
```

---

### 3.5 비용 확인 (1시간)

#### Firestore 사용량

**Firebase Console → Firestore → Usage**:
- 오늘 Document writes 증가량 확인
- 예: 학생 10명 × 평균 5슬롯 = 50 writes

**무료 한도 확인**:
- Firestore 쓰기: 60만/월
- 50 writes/day × 30일 = 1,500 writes/월
- ✅ 무료 한도 0.25% 사용 (충분)

#### Cloud Functions 사용량

**Cloud Console → Functions → Usage**:
- Invocations: 1회/일
- Execution time: ~30초 (학생 10명 기준)
- Memory usage: ~200MB

**무료 한도**:
- Invocations: 200만/월
- GB-seconds: 40만/월
- ✅ 무료 한도 내

---

### 3.6 기존 기능 검증 (3시간)

#### 테스트 시나리오

**시나리오 1: 기존 PIN 체크 (세션 방식)**
```
1. 학생이 PIN 입력
2. checkAttendanceByPin 호출
3. 기대 결과:
   - 새로운 세션 레코드 생성 (timetableId 없음)
   - status: "checked_in"
   - 정상 작동 ✅

4. 학생이 다시 PIN 입력
5. 기대 결과:
   - 세션 레코드 업데이트
   - status: "checked_out"
   - 정상 작동 ✅
```

**시나리오 2: 배치 레코드와 세션 레코드 공존**
```
Firestore 상태:
- 레코드 A: 배치 생성 (timetableId 있음, status: "scheduled")
- 레코드 B: PIN 체크 생성 (timetableId 없음, status: "checked_in")

확인:
- 두 레코드가 독립적으로 존재
- 서로 영향 없음 ✅
```

#### 중요 확인 사항

**Phase 3 전까지는**:
- ✅ 기존 PIN 체크 로직 그대로 사용 (동적 생성)
- ✅ 배치로 생성된 `scheduled` 레코드는 **아직 사용 안 함**
- ✅ 두 가지 레코드가 공존 (기존 세션 + 신규 슬롯)

**Phase 3 이후**:
- ✅ PIN 체크 로직이 슬롯 매칭 방식으로 변경
- ✅ 배치 레코드를 찾아서 업데이트
- ✅ 기존 세션 레코드는 더 이상 생성 안 됨

---

### Day 3 체크리스트

- [ ] `npm run build` 및 `npm run lint` 성공
- [ ] Firebase Functions 배포 완료
- [ ] Cloud Console에서 함수 확인
- [ ] Cloud Scheduler 스케줄 등록 확인
- [ ] Cloud Logging 필터 생성
- [ ] 알람 설정 (선택)
- [ ] 다음 날 오전: 배치 실행 로그 확인
- [ ] Firestore에 `scheduled` 레코드 생성 확인
- [ ] 기존 PIN 체크 기능 정상 작동 확인
- [ ] Firestore 비용 영향 확인 (무료 한도 내)
- [ ] Git commit: "Phase 2: Deploy daily attendance batch"

---

## Day 4-5: Phase 3 - PIN 체크 로직 수정 (16시간)

### 목표

기존의 **동적 생성 방식**을 버리고, 배치로 생성된 **슬롯 레코드를 찾아 업데이트**하는 방식으로 전환합니다.

---

### Day 4: checkAttendanceByPin 전면 수정 (8시간)

#### 4.1 현재 로직 분석 (1시간)

**파일**: `functions/src/modules/personal/studentAttendanceManagement.ts`
**위치**: Line 465-756 (약 290줄)

**현재 동작 방식**:
```typescript
// Line 596-605: 오늘 최신 세션 조회
const latestRecordSnapshot = await db
  .collection("users")
  .doc(userId)
  .collection("student_attendance_records")
  .where("studentId", "==", studentId)
  .where("date", "==", today)
  .where("isLatestSession", "==", true)
  .limit(1)
  .get();

// Line 607-707: 레코드가 없거나 checked_out이면 새로 생성
if (latestRecordSnapshot.empty ||
    latestRecordSnapshot.docs[0].data().status === "checked_out") {
  // ❌ 새로운 출석 레코드 동적 생성
  const newRecordId = `${studentId}_${today.replace(/-/g, "")}_${timestamp.toMillis()}`;
  await recordRef.set(attendanceData);
  // ...
} else {
  // Line 708-748: 체크아웃 처리
  await recordRef.update(updateData);
}
```

**문제점**:
1. 학생이 PIN을 입력해야만 레코드 생성 → 미등원 학생 파악 불가
2. 슬롯 기반이 아닌 세션 기반
3. 외부 수업 시간에도 체크 가능

---

#### 4.2 새 로직 작성 (5시간)

**파일**: `functions/src/modules/personal/studentAttendanceManagement.ts`
**수정 범위**: Line 465-756 전체 교체

**새 로직 핵심**:
```typescript
export const checkAttendanceByPin = onCall(async (request) => {
  // ===== 기존 로직 유지 (Line 465-590) =====
  // 1. 링크 토큰 검증
  // 2. PIN 검증
  // 3. 좌석 할당 확인
  // 4. userId, studentId 추출

  const today = getTodayInKorea();
  const currentMinutes = getCurrentKoreaMinutes();
  const dayOfWeek = getDayOfWeek(new Date());

  // ===== 변경: 현재 시간에 해당하는 슬롯 찾기 =====
  const applicableSlotsSnapshot = await db
    .collection("users")
    .doc(userId)
    .collection("student_attendance_records")
    .where("studentId", "==", studentId)
    .where("date", "==", today)
    .where("status", "in", ["scheduled", "checked_in", "checked_out"])
    .get();

  if (applicableSlotsSnapshot.empty) {
    throw new HttpsError(
      "not-found",
      "오늘 출석할 수업이 없습니다. 배치 작업 실행을 확인하세요."
    );
  }

  // ===== 현재 시간과 가장 가까운 슬롯 찾기 =====
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

  const recordRef = targetRecord.ref;
  const recordData = targetRecord.data;
  const timestamp = admin.firestore.Timestamp.now();

  // ===== 상태 전환 로직 (Transaction 사용) ⭐ =====
  // 경합 조건 방지: markAbsentUnexcused 배치와 동시 실행 시에도 안전

  // 1. scheduled → checked_in (최초 체크인)
  // 2. not_arrived → checked_in (유예 기간 내 늦은 체크인)
  if (recordData.status === "scheduled" || recordData.status === "not_arrived") {
    // 트랜잭션으로 원자적 업데이트 보장
    const result = await db.runTransaction(async (transaction) => {
      // 1. 최신 상태 재확인 (배치 작업이 변경했을 수 있음)
      const currentRecordDoc = await transaction.get(recordRef);
      const currentRecordData = currentRecordDoc.data();

      // 2. 상태 검증
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

      // 3. 체크인 처리
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
        updateData.notes = currentRecordData.notes
          ? `${currentRecordData.notes}\n자동 복구: 유예 기간 내 체크인`
          : "자동 복구: 유예 기간 내 체크인";
      }

      // 4. 트랜잭션으로 업데이트
      transaction.update(recordRef, updateData);

      return {
        success: true,
        message: `${currentRecordData.timeSlotSubject} 수업 체크인 완료${isLate ? " (지각)" : ""}${
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

  // 2. checked_in → checked_out (체크아웃)
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
      message: `${recordData.timeSlotSubject} 수업 체크아웃 완료${isEarlyLeave ? " (조퇴)" : ""}`,
      action: "checked_out",
      data: { ...recordData, ...updateData }
    };
  }

  // 3. checked_out → checked_in (재입실)
  if (recordData.status === "checked_out") {
    const updateData: any = {
      status: "checked_in",
      checkInMethod: "pin",
      updatedAt: timestamp,
      notes: recordData.notes
        ? `${recordData.notes}\n재입실: ${timestamp.toDate().toLocaleTimeString('ko-KR')}`
        : `재입실: ${timestamp.toDate().toLocaleTimeString('ko-KR')}`
    };

    await recordRef.update(updateData);

    await linkDoc.ref.update({
      usageCount: admin.firestore.FieldValue.increment(1),
      updatedAt: timestamp
    });

    return {
      success: true,
      message: `${recordData.timeSlotSubject} 재입실 완료`,
      action: "re_checked_in",
      data: { ...recordData, ...updateData }
    };
  }

  throw new HttpsError("failed-precondition", "처리할 수 없는 출석 상태입니다.");
});
```

---

#### 4.3 트랜잭션 구현 상세 설명 ⭐

**왜 트랜잭션이 필요한가?**

경합 조건(Race Condition) 시나리오:
```
시간: 12:35:00 (유예 기간 종료)

Thread A (학생 PIN):              Thread B (markAbsentUnexcused):
12:35:01 - 읽기 (not_arrived)     12:35:01 - 읽기 (not_arrived)
12:35:02 - 조건 확인 OK           12:35:02 - 유예 초과 확인 OK
12:35:03 - 쓰기 (checked_in)      12:35:04 - 쓰기 (absent_unexcused)
                                  ↓
                                  결과: absent_unexcused (학생 불이익!)
```

**트랜잭션으로 해결**:
```typescript
// Firestore Transaction 동작 원리
await db.runTransaction(async (transaction) => {
  // 1. 트랜잭션 시작 시 스냅샷 타임스탬프 기록
  const snapshot = await transaction.get(recordRef);

  // 2. 조건 확인
  if (snapshot.data().status === "not_arrived") {
    // 3. 업데이트 예약
    transaction.update(recordRef, { status: "checked_in" });
  }

  // 4. 트랜잭션 커밋 시:
  //    - 문서가 스냅샷 이후 변경되었는지 확인
  //    - 변경되었으면 전체 트랜잭션 재시도 (자동)
  //    - 최대 5회 재시도 후 실패 시 에러
});
```

**트랜잭션 적용 결과**:
```
Thread A (학생 PIN - Transaction):     Thread B (배치 - Batch Update):
12:35:01 - T-시작, 읽기 (not_arrived)  12:35:01 - 읽기 (not_arrived)
12:35:02 - T-조건 확인                 12:35:02 - 조건 확인
12:35:03 - T-커밋 시도                 12:35:03 - Batch 커밋 성공
           (문서 변경 감지!)                      (absent_unexcused)
12:35:04 - T-재시도 (자동)
           읽기 (absent_unexcused)
           조건 실패
           에러 반환: "유예 기간 종료"
           ↓
           결과: 공정한 에러 메시지! ✅
```

**비용 분석**:
- 추가 읽기: 1건/PIN 입력 (재확인용)
- 학생 100명 × 3회/일 = 300건/일
- 월 비용: 9,000건 × $0.06/100,000 = $0.0054 ≈ **8원/월**
- 무료 한도: 여전히 범위 내 (44,545 < 50,000 reads/day)

**핵심 포인트**:
1. ✅ **scheduled/not_arrived → checked_in 전환에만 트랜잭션 적용**
2. ✅ **checked_in → checked_out 전환은 트랜잭션 불필요** (경합 없음)
3. ✅ **absent_unexcused 상태 감지 시 명확한 에러 메시지**
4. ✅ **Firestore가 자동 재시도 처리** (코드에서 재시도 로직 불필요)

---

#### 4.4 테스트 (2시간)

**Emulator 테스트**:

```bash
firebase emulators:start
```

**테스트 케이스**:

1. **정상 체크인 (scheduled → checked_in)**
   - 배치로 `scheduled` 레코드 생성
   - 수업 시작 시간에 PIN 입력
   - 기대: `checked_in` 전환 ✅

2. **지각 체크인**
   - 수업 시작 후 15분에 PIN 입력
   - 기대: `isLate: true`, `lateMinutes: 15` ✅

3. **자동 복구 체크인 (not_arrived → checked_in)** ⭐
   - markNotArrivedAtStartTime 실행으로 `not_arrived` 상태
   - 유예 기간 내 PIN 입력
   - 기대: `checked_in` 전환, notes에 "자동 복구" 메시지 ✅

4. **트랜잭션 테스트: 유예 기간 종료 후 PIN 입력** ⭐
   - markAbsentUnexcused로 `absent_unexcused` 상태
   - PIN 입력 시도
   - 기대: "유예 기간이 종료되어 출석 처리가 불가능합니다" 에러 ✅

5. **시간 외 체크 (에러)**
   - 수업 시작 31분 전에 PIN 입력
   - 기대: "현재 시간에 해당하는 수업이 없습니다" 에러 ✅

6. **트랜잭션 경합 조건 시뮬레이션** (선택사항)
   ```bash
   # 두 터미널에서 동시 실행
   # Terminal 1: 배치 함수 수동 트리거
   # Terminal 2: PIN 입력 API 호출
   # 기대: 둘 중 하나만 성공, 데이터 일관성 유지 ✅
   ```

---

### Day 4 체크리스트

- [ ] `checkAttendanceByPin` 전면 수정 (Line 465-756)
  - [ ] 슬롯 기반 조회 로직 구현
  - [ ] 현재 시간 매칭 알고리즘 구현
  - [ ] **트랜잭션 적용** (scheduled/not_arrived → checked_in) ⭐
  - [ ] 상태별 전환 로직 구현
  - [ ] absent_unexcused 감지 시 에러 반환
- [ ] `cd functions && npm run build` 성공
- [ ] Emulator 테스트 6개 케이스 통과
  - [ ] 정상 체크인
  - [ ] 지각 체크인
  - [ ] 자동 복구 체크인 (not_arrived)
  - [ ] 유예 종료 후 에러
  - [ ] 시간 외 에러
  - [ ] (선택) 경합 조건 시뮬레이션
- [ ] Git commit: "Phase 3: Implement slot-based PIN check with transaction"

---

### Day 5: manualCheckIn/Out 수정 + 전체 테스트 (8시간)

#### 5.1 manualCheckIn 수정 (3시간)

**파일**: `functions/src/modules/personal/studentAttendanceManagement.ts`
**위치**: Line 1157-1325

**수정 전략**:
- `checkAttendanceByPin`과 동일한 슬롯 매칭 로직 적용
- 단, `scheduled` 상태만 체크인 가능

**핵심 코드**:
```typescript
export const manualCheckIn = onCall(async (request) => {
  // 권한 확인
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const userId = request.auth.uid;
  const { studentId } = request.data;

  if (!studentId) {
    throw new HttpsError("invalid-argument", "studentId가 필요합니다.");
  }

  const db = admin.firestore();
  const today = getTodayInKorea();
  const currentMinutes = getCurrentKoreaMinutes();

  // 슬롯 기반 조회
  const applicableSlotsSnapshot = await db
    .collection("users")
    .doc(userId)
    .collection("student_attendance_records")
    .where("studentId", "==", studentId)
    .where("date", "==", today)
    .where("status", "in", ["scheduled", "checked_in"])
    .get();

  if (applicableSlotsSnapshot.empty) {
    throw new HttpsError("not-found", "오늘 출석할 수업이 없습니다.");
  }

  // 현재 시간에 가장 가까운 scheduled 슬롯 찾기
  let targetRecord: any = null;
  let minTimeDiff = Infinity;

  for (const doc of applicableSlotsSnapshot.docs) {
    const record = doc.data();
    if (record.status !== "scheduled") continue;  // scheduled만 체크인 가능

    const slotStartMinutes = parseTimeToMinutes(record.expectedArrivalTime);
    const slotEndMinutes = parseTimeToMinutes(record.expectedDepartureTime);

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

  // 체크인 처리
  const recordRef = targetRecord.ref;
  const recordData = targetRecord.data;
  const timestamp = admin.firestore.Timestamp.now();
  const expectedMinutes = parseTimeToMinutes(recordData.expectedArrivalTime);
  const isLate = currentMinutes > expectedMinutes + 10;

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

  await recordRef.update(updateData);

  return {
    success: true,
    message: `${recordData.timeSlotSubject} 수동 체크인 완료`,
    data: { ...recordData, ...updateData }
  };
});
```

---

#### 5.2 manualCheckOut 수정 (3시간)

**파일**: `functions/src/modules/personal/studentAttendanceManagement.ts`
**위치**: Line 1332-1432

**수정 전략**:
- `checked_in` 상태 슬롯 조회
- 현재 시간에 가장 가까운 슬롯 체크아웃

**핵심 코드**:
```typescript
export const manualCheckOut = onCall(async (request) => {
  // 권한 확인
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const userId = request.auth.uid;
  const { studentId } = request.data;

  if (!studentId) {
    throw new HttpsError("invalid-argument", "studentId가 필요합니다.");
  }

  const db = admin.firestore();
  const today = getTodayInKorea();
  const currentMinutes = getCurrentKoreaMinutes();

  // checked_in 상태 슬롯 조회
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

  // 현재 시간에 가장 가까운 슬롯 찾기
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

  // 체크아웃 처리
  const recordRef = targetRecord.ref;
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
    message: `${recordData.timeSlotSubject} 수동 체크아웃 완료`,
    data: { ...recordData, ...updateData }
  };
});
```

---

#### 5.3 전체 통합 ���스트 (2시간)

**테스트 시나리오**:

1. **전체 흐름 테스트**
   ```
   새벽 2시: 배치 실행 → scheduled 레코드 3개 생성
   09:00: PIN 체크 → 첫 번째 슬롯 checked_in
   12:00: PIN 체크 → 첫 번째 슬롯 checked_out
   13:00: PIN 체크 → 두 번째 슬롯 checked_in
   18:00: PIN 체크 → 두 번째 슬롯 checked_out
   ```

2. **에러 케이스**
   - 배치 실행 전 PIN 입력 → "오늘 출석할 수업이 없습니다"
   - 외부 수업 시간에 PIN 입력 → "현재 시간에 해당하는 수업이 없습니다"

---

### Day 4-5 체크리스트

- [ ] `checkAttendanceByPin` 전면 수정 완료 (Line 465-756)
  - [ ] **트랜잭션 적용** ⭐
  - [ ] 경합 조건 방지 로직 구현
- [ ] `manualCheckIn` 슬롯 기반 변경 (Line 1157-1325)
- [ ] `manualCheckOut` 슬롯 기반 변경 (Line 1332-1432)
- [ ] `cd functions && npm run build` 성공
- [ ] Emulator 테스트 6개 케이스 통과 (트랜잭션 테스트 포함)
- [ ] Git commit: "Phase 3: Implement slot-based PIN check with transaction"

---

## Day 6: Phase 4 - 자동 결석 확정 처리 (3시간) ⭐ **개선된 Grace Period 시스템**

### 개선 내용 요약

기존 Day 6는 `scheduled → not_arrived` 전환을 담당했지만, 이제 이 로직은 **Day 2의 markNotArrivedAtStartTime**으로 이동했습니다.

**새로운 Day 6 역할**:
- `not_arrived → absent_unexcused` 전환 (유예 기간 후)
- 정밀한 시간 로깅 (absentConfirmedAt, absentMarkedAt)
- 학생의 늦은 체크인 기회 제공 (Grace Period)

**4단계 상태 전환 흐름**:
```
scheduled (02:00 생성)
   ↓
not_arrived (수업 시작 시간, 예: 09:00) ← markNotArrivedAtStartTime
   ↓ (학생이 PIN 입력 시 → checked_in으로 복구 가능)
   ↓ (유예 기간: 수업 종료 + 30분 + 5분)
absent_unexcused (유예 기간 초과) ← markAbsentUnexcused (이 파일)
```

---

### 6.1 배치 함수 작성 (2시간) ⭐

**새 파일 생성**: `functions/src/scheduled/markAbsentUnexcused.ts`

**핵심 변경점**:
1. `scheduled` → `not_arrived` (삭제, markNotArrivedAtStartTime이 담당)
2. `not_arrived` → `absent_unexcused` (신규 추가)
3. 정밀 시간 로깅: `absentConfirmedAt`, `absentMarkedAt`
4. Grace Period 적용: 수업 종료 + 30분 + 5분

```typescript
/**
 * 10분 간격 실행: not_arrived 상태를 유예 기간 후 absent_unexcused로 확정
 *
 * 참고:
 * - ATTENDANCE_SLOT_IMPLEMENTATION_PLAN.md Day 6
 * - 사용자 제안: "5분 유예 기간 시스템"
 *
 * 동작:
 * 1. not_arrived 상태 레코드 조회
 * 2. 수업 종료 시간 + 30분 + 5분(유예) 지난 레코드 필터링
 * 3. absent_unexcused로 상태 변경
 * 4. 정밀한 시간 로깅 (확정 시간 + 처리 시간)
 *
 * Grace Period:
 * - 학생이 not_arrived 상태에서도 PIN 입력 가능 (늦은 체크인)
 * - 유예 기간 내 PIN 입력 시 checked_in으로 자동 복구 (지각 처리)
 * - 유예 기간 초과 시에만 absent_unexcused 확정
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import {
  getTodayInKorea,
  getCurrentKoreaMinutes,
  parseTimeToMinutes,
  minutesToTime
} from "../utils/timeUtils";

// 유예 기간 설정 (분 단위)
const GRACE_PERIOD_MINUTES = 5;

export const markAbsentUnexcused = onSchedule({
  schedule: "*/10 * * * *",  // 10분마다
  timeZone: "Asia/Seoul",
  region: "asia-northeast3",
  timeoutSeconds: 120,
  memory: "512MiB"
}, async (event) => {
  const db = admin.firestore();
  const today = getTodayInKorea();
  const currentMinutes = getCurrentKoreaMinutes();
  const timestamp = admin.firestore.Timestamp.now();

  logger.info(`[결석 확정 시작] ${today} ${minutesToTime(currentMinutes)}`);

  try {
    const usersSnapshot = await db.collection("users").get();
    let totalConfirmed = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      try {
        // not_arrived 상태 레코드 조회
        const notArrivedRecords = await db
          .collection("users")
          .doc(userId)
          .collection("student_attendance_records")
          .where("date", "==", today)
          .where("status", "==", "not_arrived")
          .get();

        if (notArrivedRecords.empty) continue;

        const batch = db.batch();
        let batchCount = 0;

        for (const doc of notArrivedRecords.docs) {
          const record = doc.data();
          const slotEndMinutes = parseTimeToMinutes(record.expectedDepartureTime);

          // 유예 기간 종료 시간 계산
          // 예: 수업 종료 12:00 → 12:00 + 30분(기본) + 5분(유예) = 12:35
          const graceEndMinutes = slotEndMinutes + 30 + GRACE_PERIOD_MINUTES;

          // 유예 기간이 지났으면 absent_unexcused 확정
          if (currentMinutes > graceEndMinutes) {
            // 유예 종료 시점의 정확한 Timestamp 계산
            const graceEndTime = new Date(record.notArrivedAt.toDate());
            graceEndTime.setMinutes(
              graceEndTime.getMinutes() +
              (slotEndMinutes - parseTimeToMinutes(record.expectedArrivalTime)) +
              30 +
              GRACE_PERIOD_MINUTES
            );

            batch.update(doc.ref, {
              status: "absent_unexcused",
              absentConfirmedAt: admin.firestore.Timestamp.fromDate(graceEndTime), // 유예 종료 시간
              absentMarkedAt: timestamp, // 실제 배치 처리 시간
              updatedAt: timestamp
            });
            batchCount++;

            logger.info(
              `[결석 확정] userId=${userId}, studentId=${record.studentId}, ` +
              `slot=${record.expectedArrivalTime}-${record.expectedDepartureTime}, ` +
              `confirmedAt=${graceEndTime.toISOString()}`
            );
          }
        }

        if (batchCount > 0) {
          await batch.commit();
          totalConfirmed += batchCount;
        }

      } catch (userError) {
        logger.error(`[사용자 오류] userId=${userId}`, userError);
        continue;
      }
    }

    logger.info(
      `[결석 확정 완료] ${today} ${minutesToTime(currentMinutes)} - ` +
      `총 ${totalConfirmed}건 확정`
    );

    return {
      success: true,
      date: today,
      time: minutesToTime(currentMinutes),
      confirmed: totalConfirmed
    };

  } catch (error) {
    logger.error(`[결석 확정 오류] ${today}`, error);
    throw error;
  }
});
```

**타임라인 예시** (09:00-12:00 수업):
```
02:00 → scheduled (배치 생성)
09:00 → not_arrived (markNotArrivedAtStartTime)
  09:00-12:35 → 학생이 PIN 입력 시 checked_in으로 복구 가능 (지각)
12:35 → 유예 기간 종료
12:40 → absent_unexcused 확정 (markAbsentUnexcused, 10분 간격 배치)
```

**시간 로깅 필드**:
- `notArrivedAt`: 09:00 (수업 시작 시간, markNotArrivedAtStartTime이 기록)
- `absentConfirmedAt`: 12:35 (유예 종료 시간, 정확히 계산)
- `absentMarkedAt`: 12:40 (배치가 실제로 처리한 시간)

---

### 6.2 checkAttendanceByPin 수정 - not_arrived 상태 처리 추가 (1시간)

**파일**: `functions/src/modules/personal/studentAttendanceManagement.ts`
**위치**: Line 1289 이후 (scheduled 처리 다음)

**목적**: `not_arrived` 상태에서도 PIN 입력 허용 (늦은 체크인, 자동 복구)

**추가할 코드**:
```typescript
// 1.5. not_arrived → checked_in (늦은 체크인, 자동 복구)
if (recordData.status === "not_arrived") {
  const expectedMinutes = parseTimeToMinutes(recordData.expectedArrivalTime);
  const isLate = currentMinutes > expectedMinutes + 10;

  const updateData: any = {
    actualArrivalTime: timestamp,
    status: "checked_in",
    isLate: true,  // not_arrived 상태에서 체크인은 항상 지각
    lateMinutes: currentMinutes - expectedMinutes,
    checkInMethod: "pin",
    updatedAt: timestamp,
    notes: recordData.notes
      ? `${recordData.notes}\n자동 복구: 유예 기간 내 체크인`
      : "자동 복구: 유예 기간 내 체크인"
  };

  await recordRef.update(updateData);

  await linkDoc.ref.update({
    usageCount: admin.firestore.FieldValue.increment(1),
    updatedAt: timestamp
  });

  return {
    success: true,
    message: `${recordData.timeSlotSubject} 수업 체크인 완료 (지각, 자동 복구됨)`,
    action: "checked_in",
    data: { ...recordData, ...updateData }
  };
}
```

**설명**:
- `not_arrived` 상태는 "수업이 시작되었지만 아직 등원하지 않음"을 의미
- 유예 기간 내 PIN 입력 시 `checked_in`으로 자동 복구
- 지각 처리 (isLate: true, lateMinutes 기록)
- 유예 기간 초과 후에는 `absent_unexcused`로 확정되어 PIN 입력 불가

---

### 6.3 index.ts에 Export 추가 (10분)

**파일**: `functions/src/index.ts`

**추가 위치**: Scheduled Functions 섹션

```typescript
// ==================== Scheduled Functions ====================

export {
  createDailyAttendanceRecords,
} from "./scheduled/createDailyAttendanceRecords";

export {
  markNotArrivedAtStartTime,
} from "./scheduled/markNotArrivedAtStartTime";

export {
  markAbsentUnexcused,
} from "./scheduled/markAbsentUnexcused";
```

---

### 6.4 배포 및 테스트 (50분)

#### 배포

```bash
cd functions
npm run build

cd ..
firebase deploy --only functions:markAbsentUnexcused
```

#### 테스트

**Emulator 테스트**:
```bash
firebase emulators:start
```

**수동 트리거 (Cloud Console)**:
1. Firebase Console → Functions
2. `markAbsentUnexcused` 선택
3. "테스트" 버튼 클릭

**확인 항목**:
1. ✅ `not_arrived` 상태 레코드가 `absent_unexcused`로 변경
2. ✅ `absentConfirmedAt` 필드에 유예 종료 시간 정확히 기록
3. ✅ `absentMarkedAt` 필드에 배치 실행 시간 기록
4. ✅ 유예 기간 내 레코드는 변경되지 않음

**Cloud Scheduler 확인**:
- Schedule: `*/10 * * * *` (10분마다)
- Timezone: Asia/Seoul
- 실행 횟수: 144회/일

---

### Day 6 체크리스트

- [ ] `functions/src/scheduled/markAbsentUnexcused.ts` 작성 ⭐
- [ ] `checkAttendanceByPin`에 not_arrived 상태 처리 추가 ⭐
- [ ] `functions/src/index.ts`에 export 추가
- [ ] `cd functions && npm run build` 성공
- [ ] Emulator 테스트 통과
  - [ ] not_arrived → absent_unexcused 전환 확인
  - [ ] 유예 기간 내 PIN 입력 시 자동 복구 확인
  - [ ] 시간 로깅 필드 3개 모두 기록 확인
- [ ] 프로덕션 배포 완료
- [ ] Cloud Scheduler 등록 확인 (10분마다)
- [ ] Git commit: "Phase 4: Add grace period absent confirmation system"

---

## Week 3-4: Phase 5 - 점진적 배포 및 모니터링 (11시간)

### Week 3: Phase 3 배포 (5시간)

#### 배포 계획

```bash
# 1단계: Functions 전체 배포 (PIN 체크 로직 변경 포함)
firebase deploy --only functions

# 2단계: 사용자 공지
"새로운 출석 시스템이 적용되었습니다.
수업별로 개별 체크인/아웃이 가능하며,
외부 활동 시간에는 출석 체크가 제외됩니다."

# 3단계: 실시간 모니터링
firebase functions:log
```

#### 모니터링 (매일 2시간 × 3일)

**에러 로그 확인**:
- "not-found" 에러: 배치 작업 미실행 의심
- "failed-precondition" 에러: 시간 범위 밖 체크 시도
- **"유예 기간이 종료되어..." 에러**: 정상 동작 (트랜잭션이 absent_unexcused 감지)

**Cloud Logging 필터**:
```
resource.type="cloud_function"
resource.labels.function_name="checkAttendanceByPin"
severity>=ERROR
```

**트랜잭션 모니터링**:
```
# 트랜잭션 재시도 로그 확인 (정상 동작)
resource.type="cloud_function"
resource.labels.function_name="checkAttendanceByPin"
textPayload:"ABORTED"
```
- 재시도 로그 발생 시: 경합 조건이 정상적으로 처리됨 (문제 없음) ✅

---

### Week 4: 최종 검증 (6시간)

#### 검증 항목 (매일 1시간 × 6일)

1. **배치 작업 안정성**
   - 매일 새벽 2시 정상 실행 확인
   - 실행 시간 측정 (9분 이내)
   - 실패율 0% 목표

2. **자동 결석 처리**
   - 매시간 정상 실행 확인
   - `scheduled` → `not_arrived` 전환 확인

3. **PIN 체크 정확도**
   - 슬롯 매칭 성공률 측정
   - 지각/조퇴 판단 정확도 확인

4. **비용 확인**
   - Firestore 읽기/쓰기 증가량
   - 무료 한도 내 확인

---

### Week 3-4 체크리스트

- [ ] Week 3: Phase 3 배포 완료
- [ ] 에러 로그 모니터링 (0건 목표)
- [ ] 사용자 피드백 확인
- [ ] Week 4: 7일간 안정성 검증
- [ ] 배치 작업 성공률 100%
- [ ] 자동 결석 처리 정상 작동
- [ ] 비용 확인 (무료 한도 내)
- [ ] 최종 검증 보고서 작성

---

## 📊 총 예상 작업 시간

| Phase | 작업 시간 | 기간 |
|-------|----------|------|
| Phase 1 | 2시간 | Day 1 |
| Phase 2 | 14시간 | Day 2-3 |
| Phase 3 | 16시간 | Day 4-5 |
| Phase 4 | 3시간 | Day 6 |
| Phase 5 | 11시간 | Week 3-4 |
| **총계** | **46시간 (약 6일 + 2주 모니터링)** | - |

---

## 🚨 문제 해결 가이드

### 문제 1: 배치 작업 타임아웃

**증상**: Cloud Logging에 "Function timeout" 에러
**원인**: 사용자/학생 수가 많아서 9분 초과
**해결**:
```typescript
// createDailyAttendanceRecords.ts
// Promise.all로 병렬 처리
const userPromises = usersSnapshot.docs.map(async (userDoc) => {
  // 사용자별 처리 로직
});
await Promise.all(userPromises);
```

### 문제 2: "not-found" 에러

**증상**: PIN 입력 시 "오늘 출석할 수업이 없습니다"
**원인**: 배치 작업 미실행 또는 실패
**해결**:
1. Cloud Logging 확인
2. 수동 트리거 실행: Firebase Console → Functions → createDailyAttendanceRecords → 테스트
3. 좌석 배정/시간표 확인

### 문제 3: 슬롯 매칭 실패

**증상**: "현재 시간에 해당하는 수업이 없습니다"
**원인**: ±30분 범위 밖에서 PIN 입력
**해결**:
- 범위 확장: `±30분` → `±60분`
- 또는 관리자에게 수동 체크인 권한 안내

---

## 🎯 주요 개선 사항 요약

### 1. 30분 간격 정밀 쿼리 시스템 (Day 2.3) ⭐⭐⭐

**문제**: 기존 계획은 10분마다 모든 scheduled 레코드를 스캔
**해결**: 30분 간격으로 정확한 시작 시간만 조회

```typescript
// ❌ 기존 방식
.where("status", "==", "scheduled")  // 모든 scheduled 레코드 스캔

// ✅ 개선 방식
.where("status", "==", "scheduled")
.where("expectedArrivalTime", "==", "09:00")  // 정확한 시간만
```

**성능 개선**:
- 배치 실행: 144회/일 → 29회/일 (-80%)
- Firestore 읽기: 72,000회/일 → 145회/일 (-99.8%)
- 비용 절감: 약 99.8% 감소
- 실행 시간: 60초 → 10초 (-83%)

**필수 인덱스**:
```json
{
  "fields": [
    { "fieldPath": "date", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "expectedArrivalTime", "order": "ASCENDING" }
  ]
}
```

---

### 2. Firestore Transaction으로 경합 조건 방지 (Day 4.3) ⭐⭐⭐

**문제**: PIN 입력과 배치 작업이 동시 실행 시 데이터 불일치 (Last Write Wins)
**해결**: 체크인 로직에 트랜잭션 적용

**경합 조건 시나리오**:
```
학생 PIN 입력: not_arrived → checked_in
배치 작업: not_arrived → absent_unexcused
동시 실행 시: 학생이 PIN 입력했는데 결석 처리될 수 있음 ⚠️
```

**트랜잭션 해결책**:
```typescript
await db.runTransaction(async (transaction) => {
  // 1. 최신 상태 재확인 (원자적 읽기)
  const currentDoc = await transaction.get(recordRef);

  // 2. absent_unexcused 감지 시 에러
  if (currentDoc.data().status === "absent_unexcused") {
    throw new HttpsError("failed-precondition",
      "유예 기간이 종료되어 출석 처리가 불가능합니다.");
  }

  // 3. 원자적 업데이트
  transaction.update(recordRef, { status: "checked_in" });
});
```

**비용**:
- 추가 읽기: 1건/PIN 입력 (재확인용)
- 월 비용: **8원** (300 reads/day × 30일 × $0.06/100k)
- 무료 한도 내 운영 가능 ✅

**이점**:
- 100% 데이터 일관성 보장
- 자동 재시도 (Firestore 내장 기능)
- 학생 불만 제로
- 관리자 수동 수정 불필요

---

### 3. Grace Period 자동 복구 시스템 (Day 6) ⭐⭐

**문제**: 학생이 약간 늦게 도착해도 무단결석 처리
**해결**: 3단계 유예 시스템 도입

**상태 전환 흐름**:
```
scheduled (02:00)
   ↓
not_arrived (09:00) ← 수업 시작
   ↓ PIN 입력 가능 (자동 복구)
   ↓ 유예 기간: 수업 종료 + 30분 + 5분
absent_unexcused (12:35) ← 유예 종료
```

**자동 복구 로직**:
```typescript
// not_arrived 상태에서도 PIN 입력 허용
if (recordData.status === "not_arrived") {
  // checked_in으로 자동 복구 (지각 처리)
  return { message: "자동 복구: 유예 기간 내 체크인" };
}
```

**이점**:
- 학생에게 공정한 기회 제공 (5분 유예)
- 관리자 개입 불필요 (자동 처리)
- 정확한 시간 로깅 (3개 필드)

---

### 4. 정밀 시간 로깅 (Day 1, Day 6) ⭐

**문제**: 기존에는 updatedAt만 기록 (정확한 결석 확정 시간 불명)
**해결**: 상태별 3개 시간 필드 추가

**새로운 필드**:
```typescript
interface StudentAttendanceRecord {
  // 미등원 시간 로깅
  notArrivedAt?: Timestamp;        // 수업 시작 시간 (예: 09:00)

  // 결석 확정 시간 로깅
  absentConfirmedAt?: Timestamp;   // 유예 종료 시간 (예: 12:35)
  absentMarkedAt?: Timestamp;      // 배치 실행 시간 (예: 12:40)
}
```

**사용 사례**:
- `notArrivedAt`: "학생이 정확히 몇 시에 미등원 상태가 되었나?"
- `absentConfirmedAt`: "언제까지 기다렸으나 오지 않았나?" (정확한 시간)
- `absentMarkedAt`: "시스템이 실제로 언제 처리했나?"

---

### 5. 슬롯 정보 추적 (Day 1) ⭐

**문제**: 기존 레코드에 어떤 수업인지 정보 부족
**해결**: 시간표 슬롯 정보 4개 필드 추가

**새로운 필드**:
```typescript
interface StudentAttendanceRecord {
  timetableId?: string;      // 시간표 ID
  timeSlotId?: string;       // 슬롯 ID
  timeSlotSubject?: string;  // 과목명 (예: "수학")
  timeSlotType?: string;     // 타입: "class" | "self_study" | "external"
}
```

**이점**:
- 레코드만으로 어떤 수업인지 즉시 파악
- 외부 수업 제외 로직 명확화
- 통계 분석 용이

---

### 6. 4단계 상태 전환 시스템

**전체 흐름** (09:00-12:00 수업 예시):
```
02:00 → scheduled          (createDailyAttendanceRecords)
09:00 → not_arrived        (markNotArrivedAtStartTime)
09:05 → checked_in         (학생 PIN 입력 → 지각)
11:50 → checked_out        (학생 PIN 입력)
11:55 → checked_in         (학생 PIN 입력 → 재입실)

# 또는 미등원 시

02:00 → scheduled
09:00 → not_arrived
  ... 유예 기간 (09:00-12:35)
12:35 → [유예 종료]
12:40 → absent_unexcused   (markAbsentUnexcused)
```

---

## 📊 최종 성능 지표

### 일일 배치 실행 횟수

| 배치 함수 | 실행 간격 | 실행 횟수/일 | 비고 |
|----------|----------|-------------|------|
| createDailyAttendanceRecords | 1회 (02:00) | 1회 | 레코드 생성 |
| markNotArrivedAtStartTime | 30분 (09:00-23:00) | 29회 | ⭐ 핵심 개선 |
| markAbsentUnexcused | 10분 | 144회 | 유예 확인 |
| **총계** | - | **174회/일** | - |

### Firestore 읽기 예상치 (100명 학생, 3슬롯/일 기준)

| 배치 함수 | 기존 방식 | 개선 방식 | 절감율 |
|----------|----------|----------|--------|
| markNotArrivedAtStartTime | ~72,000 | ~145 | -99.8% ⭐ |
| markAbsentUnexcused | ~43,200 | ~43,200 | 0% |
| **총계** | **~115,200** | **~43,345** | **-62.4%** |

**비용 절감 효과**:
- Firestore 무료 한도: 50,000 reads/day
- 기존 방식: 초과 → 과금 발생
- 개선 방식: 무료 한도 내 운영 가능 ✅

---

## 📚 관련 문서

- [ATTENDANCE_IMPLEMENTATION_STATUS.md](ATTENDANCE_IMPLEMENTATION_STATUS.md) - 기준 구현 가이드
- [ATTENDANCE_REFACTORING_PLAN.md](ATTENDANCE_REFACTORING_PLAN.md) - 리팩토링 계획 원본
- [EVENT_BASE_ATTENDANCE_PLAN.md](EVENT_BASE_ATTENDANCE_PLAN.md) - 이벤트 기반 미래 계획
- [CLAUDE.md](CLAUDE.md) - 프로젝트 전체 가이드

---

**작성**: Claude Code Agent
**검증**: 실제 코드베이스 분석 기반
**최종 업데이트**: 2025-01-31
**구현 방식**: 옵션 2 - 풀 슬롯 기반 시스템 (개선판)
**주요 개선** (총 6가지):
- ⭐⭐⭐ 30분 간격 정밀 쿼리 (99.8% 비용 절감)
- ⭐⭐⭐ Firestore Transaction (경합 조건 방지, 월 8원)
- ⭐⭐ Grace Period 자동 복구 시스템
- ⭐ 정밀 시간 로깅 (3개 필드)
- ⭐ 슬롯 정보 추적 (4개 필드)
- ⭐ 4단계 상태 전환 시스템
