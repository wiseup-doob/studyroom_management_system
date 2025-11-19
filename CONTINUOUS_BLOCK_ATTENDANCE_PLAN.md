# 연속 블럭 기반 출석 시스템 구현 계획서

**작성일**: 2025-01-20
**버전**: 1.2
**목적**: 외부수업 기준 연속 블럭 그룹화로 출석 체크 횟수 최소화 + 과목별 출석 관리

---

## 📋 목차

1. [개요](#개요)
2. [현재 시스템 분석](#현재-시스템-분석)
3. [요구사항](#요구사항)
4. [설계 방안](#설계-방안)
5. [구현 계획](#구현-계획)
6. [테스트 시나리오](#테스트-시나리오)
7. [롤백 계획](#롤백-계획)

---

## 개요

### 배경

현재 출석 시스템은 각 타임슬롯(수업, 자습)마다 개별 출석 레코드를 생성하여, 연속된 수업이 있어도 매번 체크인/체크아웃이 필요한 불편함이 있습니다.

### 목표

- **연속 블럭 처리**: `class`와 `self_study`가 연속되면 1개 블럭으로 처리
- **외부수업 단절**: `external` 타입을 기준으로 블럭 분리
- **사용자 경험 개선**: 하루 종일 연속 수업 시 등원/하원 각 1회만 체크
- **과목별 출석 관리**: 블럭 내 개별 슬롯 정보 저장으로 과목별 결석 처리 가능
- **선생님 권한 강화**: 실수 복구 및 예외 상황은 선생님이 직접 수정

### 핵심 원칙

```
수업(class) + 자습(self_study) = 연속 블럭 (1번 체크인/아웃)
외부수업(external) = 블럭 단절 기준
```

---

## 현재 시스템 분석

### 현재 동작 방식

#### 1. 배치 작업 (`createDailyAttendanceRecords.ts`)

```typescript
// Line 103-105: 출석 의무 슬롯 필터링
const obligatorySlots = detailedSchedule.timeSlots.filter(
  (slot: any) => slot.type === "class" || slot.type === "self_study"
);

// Line 116-163: 각 슬롯마다 개별 레코드 생성
for (let i = 0; i < obligatorySlots.length; i++) {
  const slot = obligatorySlots[i];

  const recordData = {
    timeSlotType: slot.type,
    expectedArrivalTime: slot.startTime,    // 슬롯 시작
    expectedDepartureTime: slot.endTime,    // 슬롯 종료
    sessionNumber: i + 1,
    // ...
  };
}
```

#### 2. 데이터 구조

```typescript
// StudentAttendanceRecord (functions/src/modules/personal/studentAttendanceManagement.ts:78-79)
interface StudentAttendanceRecord {
  sessionNumber: number;           // 당일 몇 번째 세션 (1, 2, 3...)
  isLatestSession: boolean;        // 가장 최신 세션 여부
  timeSlotType: 'class' | 'self_study' | 'external';
  expectedArrivalTime: string;     // 슬롯 시작 시간
  expectedDepartureTime: string;   // 슬롯 종료 시간
  // ...
}
```

### 현재 시스템의 문제점

#### 예시: 하루 종일 연속 수업

**시간표**:
```
09:00-12:00  수학 (class)
12:00-14:00  자습 (self_study)
14:00-17:00  영어 (class)
```

**현재 동작**:
- 레코드 3개 생성 (수학, 자습, 영어 각각)
- 학생은 총 6번 PIN 입력 필요 (09:00, 12:00, 12:00, 14:00, 14:00, 17:00)
- 중간 시간(12:00, 14:00)에 불필요한 체크인/아웃 반복

**기대 동작**:
- 레코드 1개 생성 (09:00-17:00 전체 블럭)
- 학생은 총 2번 PIN 입력 (09:00 등원, 17:00 하원)

---

## 요구사항

### 기능 요구사항

#### FR-1: 연속 블럭 자동 그룹화

**조건**:
- `class`와 `self_study` 타입이 시간순으로 연속되면 하나의 블럭으로 처리
- 블럭 경계는 `external` 타입으로만 구분

**예시**:
```
✅ 연속 블럭:
09:00-10:00 수학(class)
10:00-11:00 자습(self_study)
11:00-12:00 영어(class)
→ 1개 블럭: 09:00-12:00

❌ 분리 블럭:
09:00-10:00 수학(class)
10:00-11:00 외부수업(external)  ← 단절
11:00-12:00 영어(class)
→ 2개 블럭: 09:00-10:00, 11:00-12:00
```

#### FR-2: 블럭 정보 저장

각 블럭 레코드는 다음 정보를 포함:
- `blockNumber`: 당일 몇 번째 블럭인지 (1, 2, 3...)
- `blockSlotCount`: 블럭에 포함된 슬롯 개수
- `blockSubjects`: 블럭 내 과목 목록 ("수학, 자습, 영어")
- `blockSlots`: ⭐ **슬롯 상세 정보 배열** (과목별 출석 관리용)
- `expectedArrivalTime`: 블럭 시작 시간 (첫 슬롯 시작)
- `expectedDepartureTime`: 블럭 종료 시간 (마지막 슬롯 종료)

#### FR-3: 출석 체크 로직 간소화

- PIN 기반 체크인/체크아웃 로직 유지
- 블럭 단위 레코드에서도 동일하게 동작
- **상태 전환 간소화**: `scheduled` → `checked_in` → `checked_out` (재입실 제거)
- 실수로 하원한 경우 선생님이 수동으로 복구 (`updateAttendanceStatus` 사용)

#### FR-4: 과목별 결석 처리 시스템

- 블럭 체크인 시 **기본값은 모든 슬롯 출석**
- 선생님이 개별 슬롯에 대해 결석 처리 가능
- 새 컬렉션 `class_absence_events` 사용
- 통계 조회 시 블럭 레코드 + 결석 이벤트 병합

### 비기능 요구사항

#### NFR-1: 하위 호환성
- 기존 슬롯 단위 레코드와 공존 가능
- `blockNumber` 필드 존재 여부로 구분

#### NFR-2: 성능
- 배치 작업 실행 시간 변화 최소화 (±10% 이내)
- Firestore 쓰기 횟수 감소 (블럭 단위로 축소)

#### NFR-3: 데이터 무결성
- 트랜잭션 안전성 유지
- 블럭 내 슬롯 시간 연속성 검증

---

## 설계 방안

### 아키텍처 설계

#### 1. 블럭 그룹화 알고리즘

```
입력: detailedSchedule.timeSlots (정렬되지 않은 슬롯 배열)

단계:
1. 시간 순서대로 정렬 (startTime 기준)
2. 슬롯을 순회하며 블럭 그룹화:
   - class/self_study: 현재 블럭에 추가
   - external: 현재 블럭 종료 & 다음 블럭 시작
3. 각 블럭의 startTime/endTime 계산
4. 블럭마다 출석 레코드 생성

출력: continuousBlocks (블럭 배열)
```

#### 2. 데이터 구조 변경

**StudentAttendanceRecord 확장**:

```typescript
interface StudentAttendanceRecord {
  // ===== 기존 필드 =====
  id: string;
  userId: string;
  studentId: string;
  studentName: string;
  date: string;
  status: StudentAttendanceStatus;
  expectedArrivalTime: string;     // 블럭 시작 시간 (의미 변경)
  expectedDepartureTime: string;   // 블럭 종료 시간 (의미 변경)
  sessionNumber: number;            // 블럭 번호와 동일
  isLatestSession: boolean;
  // ...

  // ===== 신규 필드 (optional - 하위 호환성) =====
  blockNumber?: number;             // 블럭 번호 (1, 2, 3...)
  blockSlotCount?: number;          // 블럭 내 슬롯 개수
  blockSubjects?: string;           // 블럭 내 과목 목록 ("수학, 자습, 영어")
  blockSlots?: Array<{              // ⭐ 슬롯 상세 정보 배열 (과목별 출석 관리용)
    slotId: string;
    subject: string;
    type: 'class' | 'self_study';
    startTime: string;
    endTime: string;
  }>;

  // ===== 기존 슬롯 필드 (optional로 변경) =====
  timeSlotId?: string;
  timeSlotSubject?: string;
  timeSlotType?: 'class' | 'self_study' | 'external';
}
```

**구분 방법**:
```typescript
// 블럭 단위 레코드
if (record.blockNumber !== undefined) {
  // 블럭 처리
}

// 기존 슬롯 단위 레코드
else {
  // 슬롯 처리 (하위 호환)
}
```

### 상세 설계

#### 파일 0: `functions/src/utils/attendanceUtils.ts` (신규 생성 - 최우선)

⚠️ **중요**: 이 파일을 가장 먼저 생성해야 합니다. 파일 1, 2가 이 파일을 import합니다.

**목적**: 블럭 그룹화 로직 공통 모듈화

**파일 위치**: `functions/src/utils/attendanceUtils.ts` (새 파일 생성)

**전체 코드**:
```typescript
/**
 * 블럭 그룹화 유틸리티
 * external 타입을 기준으로 연속 블럭 생성
 */

export interface ContinuousBlock {
  slots: any[];
  startTime: string;
  endTime: string;
  subjects: string[];
}

/**
 * 슬롯 배열을 external 기준으로 연속 블럭으로 그룹화
 *
 * @param sortedSlots 시간순 정렬된 슬롯 배열
 * @returns 블럭 배열
 */
export function groupSlotsByExternalBreak(sortedSlots: any[]): ContinuousBlock[] {
  const blocks: ContinuousBlock[] = [];
  let currentBlock: any[] = [];

  for (const slot of sortedSlots) {
    if (slot.type === "class" || slot.type === "self_study") {
      currentBlock.push(slot);
    } else if (slot.type === "external") {
      // external 만나면 현재 블럭 종료
      if (currentBlock.length > 0) {
        blocks.push({
          slots: currentBlock,
          startTime: currentBlock[0].startTime,
          endTime: currentBlock[currentBlock.length - 1].endTime,
          subjects: currentBlock.map((s: any) => s.subject)
        });
        currentBlock = [];
      }
      // external 자체는 블럭에 포함 안 함
    }
  }

  // 마지막 블럭 처리
  if (currentBlock.length > 0) {
    blocks.push({
      slots: currentBlock,
      startTime: currentBlock[0].startTime,
      endTime: currentBlock[currentBlock.length - 1].endTime,
      subjects: currentBlock.map((s: any) => s.subject)
    });
  }

  return blocks;
}
```

**사용 위치**:
- `createDailyAttendanceRecords.ts`
- `seatManagement.ts` (createTodayAttendanceRecordsForStudent)

---

#### 파일 1: `createDailyAttendanceRecords.ts`

**수정 위치**: Line 101-167

**Before**:
```typescript
const obligatorySlots = detailedSchedule.timeSlots.filter(
  (slot: any) => slot.type === "class" || slot.type === "self_study"
);

for (let i = 0; i < obligatorySlots.length; i++) {
  const slot = obligatorySlots[i];
  // 개별 슬롯 레코드 생성
}
```

**After**:
```typescript
// 파일 상단에 import 추가
import { groupSlotsByExternalBreak } from "../utils/attendanceUtils";

// ... (기존 코드) ...

// 1. 시간 순서대로 정렬 (detailedSchedule.timeSlots는 정렬 안 되어 있을 수 있음)
const sortedSlots = [...detailedSchedule.timeSlots].sort((a, b) =>
  a.startTime.localeCompare(b.startTime)
);

// 2. 연속 블럭 그룹화
const continuousBlocks = groupSlotsByExternalBreak(sortedSlots);

if (continuousBlocks.length === 0) {
  logger.info(`[SKIP] userId=${userId}, studentId=${studentId}: 출석 의무 슬롯 없음`);
  totalSkipped++;
  continue;
}

// 3. 블럭마다 레코드 생성
const batch = db.batch();

for (let i = 0; i < continuousBlocks.length; i++) {
  const block = continuousBlocks[i];
  const timestamp = admin.firestore.Timestamp.now();

  // ⭐ recordId: {studentId}_{YYYYMMDD}_block{N}_{timestamp}
  // 변경: slot → block
  const recordId = `${studentId}_${today.replace(/-/g, "")}_block${i + 1}_${timestamp.toMillis()}`;

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

    // ⭐ 블럭 정보 (신규)
    blockNumber: i + 1,
    blockSlotCount: block.slots.length,
    blockSubjects: block.slots.map((s: any) => s.subject).join(', '),
    blockSlots: block.slots.map((s: any, idx: number) => ({
      slotId: s.id || `slot_${idx}`,
      subject: s.subject || "",
      type: s.type,
      startTime: s.startTime,
      endTime: s.endTime
    })),

    // 시간표 정보 (첫 번째 슬롯 기준)
    timetableId,
    timeSlotId: block.slots[0].id || `slot_0`,
    timeSlotSubject: block.slots.map((s: any) => s.subject).join(', '),
    timeSlotType: block.slots[0].type,

    expectedArrivalTime: block.startTime,      // 블럭 시작
    expectedDepartureTime: block.endTime,      // 블럭 종료

    status: "scheduled",
    isLate: false,
    isEarlyLeave: false,

    sessionNumber: i + 1,                      // 블럭 번호와 동일
    isLatestSession: (i === continuousBlocks.length - 1),

    createdAt: timestamp,
    updatedAt: timestamp,
    recordTimestamp: timestamp
  };

  batch.set(recordRef, recordData);
}

await batch.commit();
totalCreated += continuousBlocks.length;  // 블럭 개수
logger.info(`[성공] userId=${userId}, studentId=${studentId}: ${continuousBlocks.length}개 블럭 생성 (${sortedSlots.filter((s: any) => s.type === 'class' || s.type === 'self_study').length}개 슬롯)`);
```

#### 파일 2: `seatManagement.ts`

**수정 위치**: Line 119-210 (당일 등록 학생용)

**Before**:
```typescript
const obligatorySlots = detailedSchedule.timeSlots.filter(
  (slot: any) => {
    if (slot.type !== "class" && slot.type !== "self_study") return false;
    const slotStartMinutes = parseTimeToMinutes(slot.startTime);
    return slotStartMinutes >= currentMinutes - 30;
  }
);

for (let i = 0; i < obligatorySlots.length; i++) {
  const slot = obligatorySlots[i];
  const recordId = `${studentId}_${today.replace(/-/g, "")}_slot${i + 1}_${timestamp.toMillis()}`;
  // 개별 슬롯 레코드 생성
}
```

**After**:
```typescript
// 파일 상단에 import 추가
import { groupSlotsByExternalBreak } from "../../utils/attendanceUtils";

// ... (기존 코드) ...

// 1. 현재 시간 이후 슬롯만 필터링
const futureSlots = detailedSchedule.timeSlots.filter((slot: any) => {
  if (slot.type !== "class" && slot.type !== "self_study") return false;
  const slotStartMinutes = parseTimeToMinutes(slot.startTime);
  return slotStartMinutes >= currentMinutes - 30;
});

if (futureSlots.length === 0) {
  return; // 오늘 남은 수업 없음
}

// 2. 시간 순서대로 정렬
const sortedSlots = [...futureSlots].sort((a, b) =>
  a.startTime.localeCompare(b.startTime)
);

// 3. 블럭 그룹화
const continuousBlocks = groupSlotsByExternalBreak(sortedSlots);

if (continuousBlocks.length === 0) {
  return;
}

// 4. 블럭마다 레코드 생성
const batch = db.batch();

for (let i = 0; i < continuousBlocks.length; i++) {
  const block = continuousBlocks[i];

  // ⭐ recordId: block 사용
  const recordId = `${studentId}_${today.replace(/-/g, "")}_block${i + 1}_${timestamp.toMillis()}`;

  const recordRef = db
    .collection("users")
    .doc(userId)
    .collection("student_attendance_records")
    .doc(recordId);

  const slotStartMinutes = parseTimeToMinutes(block.startTime);
  const hasStarted = currentMinutes > slotStartMinutes;

  const recordData: any = {
    id: recordId,
    userId,
    studentId,
    studentName,
    seatLayoutId,
    seatId,
    seatNumber,
    date: today,
    dayOfWeek,

    // ⭐ 블럭 정보
    blockNumber: i + 1,
    blockSlotCount: block.slots.length,
    blockSubjects: block.slots.map((s: any) => s.subject).join(', '),
    blockSlots: block.slots.map((s: any, idx: number) => ({
      slotId: s.id || `slot_${idx}`,
      subject: s.subject || "",
      type: s.type,
      startTime: s.startTime,
      endTime: s.endTime
    })),

    // 시간표 정보
    timetableId,
    timeSlotId: block.slots[0].id || `slot_0`,
    timeSlotSubject: block.slots.map((s: any) => s.subject).join(', '),
    timeSlotType: block.slots[0].type,

    expectedArrivalTime: block.startTime,
    expectedDepartureTime: block.endTime,

    status: hasStarted ? "not_arrived" : "scheduled",
    isLate: false,
    isEarlyLeave: false,

    sessionNumber: i + 1,
    isLatestSession: (i === continuousBlocks.length - 1),

    createdAt: timestamp,
    updatedAt: timestamp,
    recordTimestamp: timestamp
  };

  if (hasStarted) {
    recordData.notArrivedAt = timestamp;
  }

  batch.set(recordRef, recordData);
}

await batch.commit();

console.log(
  `[당일 등록 출석 레코드 생성] userId=${userId}, studentId=${studentId}: ` +
  `${continuousBlocks.length}개 블럭 생성 (오늘 남은 수업)`
);
```

#### 파일 3: `studentAttendanceManagement.ts`

**수정 위치**: Line 40-83 (타입 정의), Line 842-866 (재입실 로직 제거)

##### 3-1. 타입 정의 확장

**수정 위치**: Line 40-83 (StudentAttendanceRecord 인터페이스)

```typescript
interface StudentAttendanceRecord {
  // ===== 기존 필드 (유지) =====
  id: string;
  userId: string;
  studentId: string;
  studentName: string;
  seatLayoutId: string;
  seatId: string;
  seatNumber: string;
  date: string;
  dayOfWeek: DayOfWeek;

  // 시간표 슬롯 정보 (optional - 하위 호환성 유지)
  timetableId?: string;
  timeSlotId?: string;
  timeSlotSubject?: string;
  timeSlotType?: "class" | "self_study" | "external";

  expectedArrivalTime: string;
  expectedDepartureTime: string;
  actualArrivalTime?: admin.firestore.Timestamp;
  actualDepartureTime?: admin.firestore.Timestamp;

  // ... 기타 필드 ...

  // ===== ⭐ 신규 필드 추가 (여기에 추가) =====
  blockNumber?: number;
  blockSlotCount?: number;
  blockSubjects?: string;
  blockSlots?: Array<{
    slotId: string;
    subject: string;
    type: 'class' | 'self_study';
    startTime: string;
    endTime: string;
  }>;

  sessionNumber: number;
  isLatestSession: boolean;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  recordTimestamp: admin.firestore.Timestamp;
}
```

##### 3-2. 재입실 로직 제거

**수정 위치**: Line 842-866 (checkAttendanceByPin 함수 내부)

**Before (현재 코드 - 삭제할 부분)**:
```typescript
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
```

**After (신규 코드 - 교체)**:
```typescript
// 6-3. checked_out 상태 차단 (재입실 제거)
if (recordData.status === "checked_out") {
  throw new HttpsError(
    "failed-precondition",
    "이미 하원 처리되었습니다.\n실수로 하원한 경우 선생님에게 문의하여 출석 상태를 변경해주세요."
  );
}
```

#### 파일 4: `frontend/src/types/attendance.ts`

**수정 위치**: Line 78-121 (StudentAttendanceRecord 인터페이스)

⚠️ **의존성**: 파일 3 (백엔드 타입 정의) 완료 후 진행

프론트엔드 타입 동기화:
```typescript
export interface StudentAttendanceRecord {
  // ===== 기존 필드 (유지) =====
  id: string;
  userId: string;
  studentId: string;
  studentName: string;
  seatLayoutId: string;
  seatId: string;
  seatNumber: string;
  date: string;
  dayOfWeek: DayOfWeek;

  timetableId?: string;
  timeSlotId?: string;
  timeSlotSubject?: string;
  timeSlotType?: 'class' | 'self_study' | 'external';

  expectedArrivalTime: string;
  expectedDepartureTime: string;
  actualArrivalTime?: Date;
  actualDepartureTime?: Date;

  notArrivedAt?: Date;
  absentConfirmedAt?: Date;
  absentMarkedAt?: Date;

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

  // ===== ⭐ 신규 필드 추가 =====
  blockNumber?: number;
  blockSlotCount?: number;
  blockSubjects?: string;
  blockSlots?: Array<{
    slotId: string;
    subject: string;
    type: 'class' | 'self_study';
    startTime: string;
    endTime: string;
  }>;

  sessionNumber: number;
  isLatestSession: boolean;
  createdAt: Date;
  updatedAt: Date;
  recordTimestamp: Date;
}

// ===== ⭐ ClassAbsenceEvent 타입 추가 (AttendanceStudentPin 다음) =====
export interface ClassAbsenceEvent {
  id: string;
  userId: string;
  studentId: string;
  studentName: string;
  date: string;

  attendanceRecordId: string;
  blockNumber: number;

  slotId: string;
  subject: string;
  slotStartTime: string;
  slotEndTime: string;

  markedBy: string;
  markedByName: string;
  markedAt: Date;
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

#### 파일 5: 과목별 결석 처리 시스템 (신규)

**파일 위치**: `functions/src/modules/personal/studentAttendanceManagement.ts`

##### 5-1. ClassAbsenceEvent 타입 정의

**추가 위치**: Line 100 이후 (AttendanceCheckLink 인터페이스 다음)
```typescript
interface ClassAbsenceEvent {
  id: string;
  userId: string;
  studentId: string;
  studentName: string;
  date: string; // YYYY-MM-DD

  // 블럭 레코드 참조
  attendanceRecordId: string;
  blockNumber: number;

  // 결석 처리된 슬롯
  slotId: string;
  subject: string;
  slotStartTime: string;
  slotEndTime: string;

  // 처리 정보
  markedBy: string;           // 선생님 userId
  markedByName: string;
  markedAt: admin.firestore.Timestamp;
  notes?: string;

  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}
```

##### 5-2. 새 Cloud Functions 구현

**추가 위치**: 파일 끝부분 (기존 함수들 다음)

```typescript
/**
 * 개별 슬롯 결석 처리
 */
export const markClassAbsence = onCall({ cors: corsConfig }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const { attendanceRecordId, slotId, notes } = request.data;

  if (!attendanceRecordId || !slotId) {
    throw new HttpsError("invalid-argument", "필수 필드가 누락되었습니다.");
  }

  try {
    const db = admin.firestore();

    // 1. 출석 레코드 조회
    const recordDoc = await db
      .collection("users")
      .doc(userId)
      .collection("student_attendance_records")
      .doc(attendanceRecordId)
      .get();

    if (!recordDoc.exists) {
      throw new HttpsError("not-found", "출석 레코드를 찾을 수 없습니다.");
    }

    const record = recordDoc.data() as StudentAttendanceRecord;

    // 2. blockSlots에서 해당 슬롯 찾기
    if (!record.blockSlots) {
      throw new HttpsError("failed-precondition", "블럭 시스템 레코드가 아닙니다.");
    }

    const targetSlot = record.blockSlots.find((s) => s.slotId === slotId);

    if (!targetSlot) {
      throw new HttpsError("not-found", "해당 슬롯을 찾을 수 없습니다.");
    }

    // 3. 이미 결석 처리되었는지 확인
    const existingAbsence = await db
      .collection("users")
      .doc(userId)
      .collection("class_absence_events")
      .where("attendanceRecordId", "==", attendanceRecordId)
      .where("slotId", "==", slotId)
      .limit(1)
      .get();

    if (!existingAbsence.empty) {
      throw new HttpsError("already-exists", "이미 결석 처리된 슬롯입니다.");
    }

    // 4. 결석 이벤트 생성
    const timestamp = admin.firestore.Timestamp.now();
    const absenceData: Omit<ClassAbsenceEvent, 'id'> = {
      userId,
      studentId: record.studentId,
      studentName: record.studentName,
      date: record.date,

      attendanceRecordId,
      blockNumber: record.blockNumber || 1,

      slotId,
      subject: targetSlot.subject,
      slotStartTime: targetSlot.startTime,
      slotEndTime: targetSlot.endTime,

      markedBy: userId,
      markedByName: request.auth.token.name || "관리자",
      markedAt: timestamp,
      notes: notes || "",

      createdAt: timestamp,
      updatedAt: timestamp
    };

    const absenceRef = await db
      .collection("users")
      .doc(userId)
      .collection("class_absence_events")
      .add(absenceData);

    return {
      success: true,
      message: `${targetSlot.subject} 수업 결석 처리 완료`,
      data: {
        id: absenceRef.id,
        ...absenceData
      }
    };
  } catch (error) {
    console.error("결석 처리 오류:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 결석 처리 취소
 */
export const cancelClassAbsence = onCall({ cors: corsConfig }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const { absenceEventId } = request.data;

  if (!absenceEventId) {
    throw new HttpsError("invalid-argument", "absenceEventId가 필요합니다.");
  }

  try {
    const db = admin.firestore();

    await db
      .collection("users")
      .doc(userId)
      .collection("class_absence_events")
      .doc(absenceEventId)
      .delete();

    return {
      success: true,
      message: "결석 처리가 취소되었습니다."
    };
  } catch (error) {
    console.error("결석 취소 오류:", error);
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 결석 이벤트 조회
 */
export const getClassAbsenceEvents = onCall({ cors: corsConfig }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = request.auth.uid;
  const { attendanceRecordId, studentId, startDate, endDate } = request.data;

  try {
    const db = admin.firestore();
    let query = db
      .collection("users")
      .doc(userId)
      .collection("class_absence_events") as admin.firestore.Query;

    if (attendanceRecordId) {
      query = query.where("attendanceRecordId", "==", attendanceRecordId);
    }
    if (studentId) {
      query = query.where("studentId", "==", studentId);
    }
    if (startDate) {
      query = query.where("date", ">=", startDate);
    }
    if (endDate) {
      query = query.where("date", "<=", endDate);
    }

    const snapshot = await query.get();

    const events = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      success: true,
      data: events
    };
  } catch (error) {
    console.error("결석 이벤트 조회 오류:", error);
    throw new HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});
```

#### 파일 6: `index.ts`

**수정 위치**: Line 130 근처 (studentAttendanceManagement export 부분)

**추가 export**:
```typescript
// functions/src/index.ts
export {
  // ... 기존 export ...
  checkAttendanceByPin,
  updateAttendanceStatus,
  getTodayAttendanceRecords,
  getStudentAttendanceRecords,

  // ⭐ 과목별 결석 처리 시스템 (신규)
  markClassAbsence,
  cancelClassAbsence,
  getClassAbsenceEvents,
} from "./modules/personal/studentAttendanceManagement";
```

---

## 구현 계획

### Phase 0: 공통 유틸리티 생성 (15분) ⭐ 최우선

**작업**:
1. `functions/src/utils/attendanceUtils.ts` 파일 생성
2. `groupSlotsByExternalBreak` 함수 구현
3. `ContinuousBlock` 인터페이스 정의

**체크리스트**:
- [ ] 디렉토리 확인: `functions/src/utils/` 존재하는지 확인
- [ ] 파일 생성: `attendanceUtils.ts`
- [ ] 함수 구현: `groupSlotsByExternalBreak`
- [ ] TypeScript 컴파일 테스트 (`npm run build`)
- [ ] export 확인

**의존성**: 없음 (가장 먼저 실행)

---

### Phase 1: 백엔드 타입 정의 (45분)

**작업**:
1. `functions/src/modules/personal/studentAttendanceManagement.ts` 타입 확장
2. `ClassAbsenceEvent` 타입 정의

**체크리스트**:
- [ ] `StudentAttendanceRecord`에 `blockNumber`, `blockSlotCount`, `blockSubjects`, `blockSlots` 필드 추가
- [ ] `ClassAbsenceEvent` 인터페이스 정의 (Line 100 이후)
- [ ] TypeScript 컴파일 성공 확인

**의존성**: Phase 0 완료 후 진행

---

### Phase 2: 블럭 그룹화 로직 구현 (1시간)

**작업**:
1. `createDailyAttendanceRecords.ts` 수정
   - `groupSlotsByExternalBreak` import 추가
   - 슬롯 정렬 로직 구현
   - 블럭 레코드 생성 로직 구현
2. recordId 형식 변경: `slot${i}` → `block${i + 1}`

**체크리스트**:
- [ ] import 추가: `import { groupSlotsByExternalBreak } from "../utils/attendanceUtils";`
- [ ] 슬롯 정렬 로직 구현 (Line 103-105 수정)
- [ ] 블럭 그룹화 적용 (Line 116-167 전체 교체)
- [ ] blockSlots 데이터 할당
- [ ] recordId 형식 변경 확인
- [ ] 로그 메시지 업데이트
- [ ] TypeScript 컴파일 확인

**의존성**: Phase 0, 1 완료 후 진행

### Phase 3: 당일 등록 학생 처리 (30분)

**작업**:
1. `seatManagement.ts` - `createTodayAttendanceRecordsForStudent` 수정 (Line 119-210)
2. 블럭 그룹화 로직 재사용

**체크리스트**:
- [ ] import 추가: `import { groupSlotsByExternalBreak } from "../../utils/attendanceUtils";`
- [ ] 블럭 단위 레코드 생성 적용 (Line 119-210 전체 교체)
- [ ] recordId 형식 변경 확인
- [ ] blockSlots 데이터 할당
- [ ] 에러 처리 유지
- [ ] TypeScript 컴파일 확인

**의존성**: Phase 2 완료 후 진행

### Phase 4: 재입실 로직 제거 및 선생님 권한 강화 (30분)

**작업**:
1. `studentAttendanceManagement.ts` - `checkAttendanceByPin` 함수 수정 (Line 842-866)
2. `checked_out` 상태에서 PIN 입력 시 에러 처리로 변경

**체크리스트**:
- [ ] Line 842-866 기존 재입실 로직 **삭제**
- [ ] 새 에러 처리 코드 **추가** (HttpsError throw)
- [ ] 에러 메시지 확인: "이미 하원 처리되었습니다.\n실수로 하원한 경우 선생님에게 문의하여 출석 상태를 변경해주세요."
- [ ] TypeScript 컴파일 확인
- [ ] 프론트엔드 에러 핸들링 확인 (추후)

**의존성**: Phase 1 완료 후 진행 가능 (Phase 2, 3와 독립적)

### Phase 5: 과목별 결석 처리 시스템 구현 (1.5시간)

**작업**:
1. `studentAttendanceManagement.ts`에 3개 함수 추가
   - `markClassAbsence`
   - `cancelClassAbsence`
   - `getClassAbsenceEvents`
2. `index.ts`에 export 추가

**체크리스트**:
- [ ] `markClassAbsence` 함수 구현 (파일 끝부분 추가)
- [ ] `cancelClassAbsence` 함수 구현
- [ ] `getClassAbsenceEvents` 함수 구현
- [ ] `index.ts` Line 145 근처에 export 추가
- [ ] TypeScript 컴파일 확인

**의존성**: Phase 1 (ClassAbsenceEvent 타입 정의) 완료 후 진행

---

### Phase 6: 프론트엔드 타입 동기화 (30분)

**작업**:
1. `frontend/src/types/attendance.ts` 타입 업데이트
   - `StudentAttendanceRecord`에 블럭 필드 추가
   - `ClassAbsenceEvent` 타입 추가

**체크리스트**:
- [ ] `blockNumber`, `blockSlotCount`, `blockSubjects`, `blockSlots` 필드 추가
- [ ] `ClassAbsenceEvent` 인터페이스 추가
- [ ] TypeScript 컴파일 확인

**의존성**: Phase 1 (백엔드 타입 정의) 완료 후 진행

---

### Phase 7: 프론트엔드 UI 구현 (2시간)

**작업**:
1. `attendanceService.ts`에 API 함수 추가
2. StudentDetailSidebar에 슬롯별 출석 UI 추가
3. 결석 처리/취소 버튼 구현

**체크리스트**:
- [ ] attendanceService에 3개 API 함수 추가
- [ ] 슬롯별 출석 상태 표시 UI 구현
- [ ] 결석 처리 버튼 구현
- [ ] 결석 취소 버튼 구현
- [ ] TypeScript 컴파일 확인

**의존성**: Phase 5, 6 완료 후 진행

### Phase 8: 테스트 및 배포 (1시간)

**작업**:
1. 로컬 테스트 (Firebase Emulator)
2. 테스트 환경 배포 및 검증
3. 프로덕션 배포

**체크리스트**:
- [ ] 시나리오 1-5 테스트 완료
- [ ] recordId 형식 변경 영향도 확인 (기존 레코드 조회 가능 여부)
- [ ] 기존 데이터 영향 없음 확인
- [ ] Firestore 백업 완료
- [ ] 프로덕션 배포 완료

**의존성**: 모든 Phase 완료 후 진행

---

## 구현 의존성 다이어그램

```
Phase 0 (utils 생성)
    ↓
Phase 1 (타입 정의) ────┐
    ↓                   ↓
Phase 2 (배치 작업)     Phase 4 (재입실 제거)
    ↓                   ↓
Phase 3 (당일 등록)     Phase 5 (과목별 결석)
    ↓                   ↓
    └─────────┬─────────┘
              ↓
         Phase 6 (FE 타입)
              ↓
         Phase 7 (FE UI)
              ↓
         Phase 8 (테스트/배포)
```

**병렬 실행 가능**:
- Phase 2, 3 완료 후 → Phase 4, 5 동시 진행 가능
- Phase 4는 독립적이므로 Phase 1 완료 후 언제든 진행 가능

---

## 테스트 시나리오

### 시나리오 1: 연속 블럭 (외부수업 없음)

**입력 데이터**:
```json
{
  "timeSlots": [
    { "startTime": "09:00", "endTime": "12:00", "subject": "수학", "type": "class" },
    { "startTime": "12:00", "endTime": "14:00", "subject": "자습", "type": "self_study" },
    { "startTime": "14:00", "endTime": "17:00", "subject": "영어", "type": "class" }
  ]
}
```

**기대 결과**:
```json
{
  "continuousBlocks": [
    {
      "blockNumber": 1,
      "blockSlotCount": 3,
      "blockSubjects": "수학, 자습, 영어",
      "startTime": "09:00",
      "endTime": "17:00"
    }
  ]
}
```

**생성된 레코드**: 1개

**학생 행동**:
- 09:05 PIN 입력 → `checked_in` (09:00-17:00 블럭)
- 17:00 PIN 입력 → `checked_out`

### 시나리오 2: 외부수업으로 블럭 분리

**입력 데이터**:
```json
{
  "timeSlots": [
    { "startTime": "09:00", "endTime": "12:00", "subject": "수학", "type": "class" },
    { "startTime": "12:00", "endTime": "14:00", "subject": "외부수업", "type": "external" },
    { "startTime": "14:00", "endTime": "17:00", "subject": "영어", "type": "class" }
  ]
}
```

**기대 결과**:
```json
{
  "continuousBlocks": [
    {
      "blockNumber": 1,
      "blockSlotCount": 1,
      "blockSubjects": "수학",
      "startTime": "09:00",
      "endTime": "12:00"
    },
    {
      "blockNumber": 2,
      "blockSlotCount": 1,
      "blockSubjects": "영어",
      "startTime": "14:00",
      "endTime": "17:00"
    }
  ]
}
```

**생성된 레코드**: 2개

**학생 행동**:
- 09:05 PIN → `checked_in` (블럭 1)
- 12:00 PIN → `checked_out` (블럭 1)
- 14:05 PIN → `checked_in` (블럭 2)
- 17:00 PIN → `checked_out` (블럭 2)

### 시나리오 3: 복잡한 케이스 (다중 외부수업)

**입력 데이터**:
```json
{
  "timeSlots": [
    { "startTime": "09:00", "endTime": "10:00", "subject": "수학", "type": "class" },
    { "startTime": "10:00", "endTime": "11:00", "subject": "외부수업1", "type": "external" },
    { "startTime": "11:00", "endTime": "12:00", "subject": "영어", "type": "class" },
    { "startTime": "12:00", "endTime": "14:00", "subject": "자습", "type": "self_study" },
    { "startTime": "14:00", "endTime": "15:00", "subject": "외부수업2", "type": "external" },
    { "startTime": "15:00", "endTime": "17:00", "subject": "과학", "type": "class" }
  ]
}
```

**기대 결과**:
```json
{
  "continuousBlocks": [
    {
      "blockNumber": 1,
      "blockSlotCount": 1,
      "blockSubjects": "수학",
      "startTime": "09:00",
      "endTime": "10:00"
    },
    {
      "blockNumber": 2,
      "blockSlotCount": 2,
      "blockSubjects": "영어, 자습",
      "startTime": "11:00",
      "endTime": "14:00"
    },
    {
      "blockNumber": 3,
      "blockSlotCount": 1,
      "blockSubjects": "과학",
      "startTime": "15:00",
      "endTime": "17:00"
    }
  ]
}
```

**생성된 레코드**: 3개

### 시나리오 4: 정렬되지 않은 슬롯 (엣지 케이스)

**입력 데이터** (역순):
```json
{
  "timeSlots": [
    { "startTime": "14:00", "endTime": "17:00", "subject": "영어", "type": "class" },
    { "startTime": "09:00", "endTime": "12:00", "subject": "수학", "type": "class" },
    { "startTime": "12:00", "endTime": "14:00", "subject": "자습", "type": "self_study" }
  ]
}
```

**기대 결과**: 정렬 후 시나리오 1과 동일

**검증 포인트**: `sortedSlots` 로직 정상 동작 확인

### 시나리오 5: 하위 호환성 (기존 레코드 공존)

**상황**:
- 2025-01-19: 기존 슬롯 단위 레코드 (blockNumber 없음)
- 2025-01-20: 신규 블럭 단위 레코드 (blockNumber 있음)

**검증**:
```typescript
// checkAttendanceByPin 함수에서 두 타입 모두 처리 가능
const record = await getAttendanceRecord(...);

if (record.blockNumber !== undefined) {
  // 블럭 단위 레코드 처리
  console.log(`블럭 ${record.blockNumber}: ${record.blockSubjects}`);
} else {
  // 기존 슬롯 단위 레코드 처리
  console.log(`슬롯: ${record.timeSlotSubject}`);
}
```

---

### 시나리오 6: recordId 형식 변경 호환성 테스트

**목적**: `slot` → `block` 변경이 기존 코드에 미치는 영향 확인

**테스트 케이스**:

1. **Firestore 쿼리 테스트**
   ```typescript
   // ✅ 필드 기반 쿼리는 문제없음
   const records = await db
     .collection("student_attendance_records")
     .where("studentId", "==", studentId)
     .where("date", "==", today)
     .get();

   // ✅ blockNumber 유무로 구분
   records.forEach(doc => {
     const data = doc.data();
     if (data.blockNumber) {
       console.log("블럭 레코드:", doc.id);
     } else {
       console.log("슬롯 레코드:", doc.id);
     }
   });
   ```

2. **recordId 패턴 매칭 검색**
   ```bash
   # 프로젝트 전체에서 recordId 직접 사용 코드 검색
   grep -r "slot[0-9]" functions/src/
   grep -r "_slot" functions/src/

   # 예상 결과: 패턴 매칭 로직이 없으면 영향 없음
   ```

3. **기존 레코드 조회 가능 여부**
   ```typescript
   // ✅ document ID로 직접 조회 - 문제없음
   const oldRecord = await db
     .doc(`users/${userId}/student_attendance_records/${oldRecordId}`)
     .get();

   // oldRecordId 형식: "student123_20250119_slot1_1706745600000"
   // 여전히 조회 가능
   ```

**검증 포인트**:
- ✅ Firestore 쿼리는 대부분 필드 기반 → 영향 없음
- ✅ recordId는 unique identifier로만 사용 → 패턴 매칭 없으면 영향 없음
- ⚠️ recordId에 정규식이나 문자열 파싱 로직이 있다면 주의 필요

**권장 조치**:
- [ ] `grep` 명령어로 recordId 직접 사용 코드 검색
- [ ] 발견된 코드에서 패턴 매칭 로직 확인
- [ ] 필요 시 하위 호환 로직 추가

---

## 롤백 계획

### 롤백 트리거

다음 경우 즉시 롤백:
1. **배치 작업 실패율 > 10%** (로그 모니터링)
2. **레코드 생성 개수 급감** (통계 이상)
3. **PIN 체크 실패 급증** (사용자 불만)
4. **프로덕션 크리티컬 버그** (데이터 손실 등)

### 롤백 절차

#### 1단계: 즉시 조치 (5분)

```bash
# Git 이전 커밋으로 복구
git revert <commit-hash>
git push origin main

# Firebase Functions 재배포
cd functions
npm run deploy
```

#### 2단계: 데이터 확인 (10분)

```javascript
// Firestore에서 문제 레코드 확인
db.collectionGroup('student_attendance_records')
  .where('date', '==', getTodayInKorea())
  .where('blockNumber', '>', 0)
  .get()
  .then(snapshot => {
    console.log('블럭 레코드 수:', snapshot.size);
    // 필요 시 삭제
  });
```

#### 3단계: 재배포 (15분)

- 기존 슬롯 단위 로직으로 복구
- 배치 작업 재실행 확인
- 사용자 공지 (필요 시)

### 롤백 영향 최소화

**신규 레코드만 영향받음**:
- 기존 레코드 (blockNumber 없음) → 변경 없음
- 신규 레코드 (blockNumber 있음) → 롤백 후 재생성

**데이터 손실 방지**:
- 배포 전 백업: Firestore 익스포트
- 롤백 후 재생성: 배치 작업 수동 실행

---

## 부록

### A. 예상 질문 (FAQ)

#### Q1: 시간 간격이 있어도 블럭으로 처리되나요?

**A**: 네, `external`만 블럭 분리 기준입니다.

**예시**:
```
09:00-12:00 수학
12:00-13:00 점심시간 (빈 시간)
13:00-17:00 영어

→ 1개 블럭: 09:00-17:00
```

**이유**: 점심시간에도 학원 내부에 있으므로 연속으로 처리

#### Q2: 블럭 중간에 조퇴하면 어떻게 되나요?

**A**: 기존 로직과 동일하게 처리됩니다.

**시나리오**:
```
블럭: 09:00-17:00 (수학, 자습, 영어)
14:00 조퇴 (PIN 입력)

→ status: checked_out
→ isEarlyLeave: true
→ earlyLeaveMinutes: 180 (17:00 - 14:00)

선생님이 개별 슬롯 결석 처리:
- 영어 수업 (14:00-17:00) → class_absence_events에 결석 이벤트 추가
```

#### Q2-1: 실수로 하원 버튼을 누르면 어떻게 하나요?

**A**: 재입실 기능이 제거되어 학생이 스스로 복구할 수 없습니다.

**해결 방법**:
```
1. 학생이 선생님에게 알림
2. 선생님이 출석 화면에서 해당 학생 선택
3. updateAttendanceStatus 함수로 checked_out → checked_in 변경
```

**장점**:
- 실수로 여러 번 출입하는 것 방지
- 중간 외출 시 선생님이 파악 가능
- 운영 정책 명확화

#### Q3: 블럭 전체가 미등원이면?

**A**: 블럭 시작 시간(09:00) 기준으로 `not_arrived` 처리됩니다.

**동작**:
- 09:00 `markNotArrivedAtStartTime` 실행
- 블럭 전체가 `scheduled` → `not_arrived`
- 유예 기간 후 `absent_unexcused` 확정

#### Q4: 과목별 출석률은 어떻게 계산하나요?

**A**: 블럭 레코드 + 결석 이벤트를 병합하여 계산합니다.

**시나리오**:
```
날짜: 2025-01-20
블럭 1: 09:00-17:00 (수학, 자습, 영어) - checked_out
결석 이벤트: 수학 (09:00-12:00) - teacher_marked

계산:
- 수학: 결석 (class_absence_events에 존재)
- 자습: 출석 (결석 이벤트 없음)
- 영어: 출석 (결석 이벤트 없음)
```

**통계 조회**:
```typescript
// 블럭 레코드에서 모든 슬롯 추출
const allSlots = record.blockSlots;

// 결석 이벤트 조회
const absences = await getClassAbsenceEvents(record.id);

// 과목별 출석 여부 판단
allSlots.forEach(slot => {
  const isAbsent = absences.some(e => e.slotId === slot.slotId);
  stats[slot.subject].total++;
  if (isAbsent) {
    stats[slot.subject].absent++;
  } else {
    stats[slot.subject].attended++;
  }
});
```

#### Q5: 부분 출석 (오후만 등원)은 어떻게 처리하나요?

**A**: 블럭 전체에 지각 표시되고, 선생님이 개별 슬롯 결석 처리합니다.

**시나리오**:
```
블럭: 09:00-17:00 (수학, 자습, 영어)
학생 등원: 14:05

출석 레코드:
- actualArrivalTime: 14:05
- isLate: true
- lateMinutes: 305 (5시간 5분)

선생님 처리:
- 수학 (09:00-12:00) → 결석 처리
- 자습 (12:00-14:00) → 결석 처리
- 영어 (14:00-17:00) → 정상 (자동)

결과:
- 학생은 등원/하원 1번씩만 처리
- 과목별 출석 데이터 정확하게 기록
```

### B. 참고 문서

- [ATTENDANCE_IMPLEMENTATION_STATUS.md](ATTENDANCE_IMPLEMENTATION_STATUS.md)
- [ATTENDANCE_SLOT_IMPLEMENTATION_PLAN.md](ATTENDANCE_SLOT_IMPLEMENTATION_PLAN.md)
- [DATABASE_DESIGN.md](DATABASE_DESIGN.md)
- [Issue #1 해결 커밋](functions/src/modules/personal/seatManagement.ts)

### C. 관련 이슈

- **Issue #1**: 당일 신규 등록 학생 출석 기록 누락 ✅ 해결 완료
- **Issue #2**: 연강 시 체크인/아웃 모호성 ⏳ 검토 중
- **Issue #3**: 30분 단위 시간 제한 ⏳ 검증 필요

---

## 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0 | 2025-01-20 | Claude | 초안 작성 |
| 1.1 | 2025-01-20 | Claude | blockSlots 필드 추가, 재입실 로직 제거, 과목별 결석 처리 시스템 추가 |
| 1.2 | 2025-01-20 | Claude | 코드 검증 후 수정사항 반영: Phase 0 추가 (utils 생성 최우선), 파일 위치 명확화, 재입실 로직 Before/After 구분, 타입 추가 위치 정정, 프론트엔드 타입 동기화 별도 Phase 추가, recordId 변경 영향도 테스트 시나리오 추가, 의존성 다이어그램 추가 |

---

## 📝 구현 시 주의사항 요약

### ⚠️ 필수 확인 사항

1. **파일 생성 순서 엄수**
   - Phase 0 (utils/attendanceUtils.ts) → Phase 1 (타입) → Phase 2, 3 (배치/당일등록)
   - utils 파일 없이 Phase 2, 3를 진행하면 컴파일 에러 발생

2. **재입실 로직 수정 주의**
   - Line 842-866의 **기존 코드를 삭제**하고 새 에러 처리 코드로 **교체**
   - "추가"가 아닌 "교체"임을 명심

3. **타입 추가 위치**
   - ClassAbsenceEvent는 Line 100 이후 (AttendanceCheckLink 다음)
   - Line 84가 아님

4. **recordId 변경 영향**
   - 배포 전 `grep -r "_slot" functions/src/` 실행 권장
   - recordId 패턴 매칭 로직 확인

5. **프론트엔드 타입 동기화**
   - 백엔드 구현 후 즉시 진행
   - ClassAbsenceEvent 타입도 추가 필수

### ✅ 성공 기준

- [ ] 모든 Phase의 TypeScript 컴파일 성공
- [ ] 시나리오 1-6 테스트 통과
- [ ] 기존 슬롯 레코드와 신규 블럭 레코드 공존 확인
- [ ] 재입실 차단 동작 확인
- [ ] 과목별 결석 처리 동작 확인

---

**문서 종료**
