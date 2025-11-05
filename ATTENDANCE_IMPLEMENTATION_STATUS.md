# 출석 시스템 슬롯 기반 리팩토링 구현 가이드

**작성일**: 2025-01-31
**기준 문서**: [ATTENDANCE_REFACTORING_PLAN.md](ATTENDANCE_REFACTORING_PLAN.md)
**구현 방식**: 옵션 2 - 풀 슬롯 기반 시스템
**예상 기간**: 6일 (46시간)

---

## 📊 개요

이 문서는 현재 세션 기반 출석 시스템을 **슬롯 기반 시스템**으로 전환하는 구체적인 구현 가이드입니다.

### 현재 문제점

1. ❌ **학생이 PIN을 입력해야만 출석 레코드 생성** → 미등원 학생 파악 불가
2. ❌ **수업별 출석 추적 불가** → 하루 단위 세션만 존재
3. ❌ **외부 일정 구분 불가** → 모든 시간대가 출석 대상
4. ❌ **자동 결석 처리 없음** → 수동으로만 결석 표시 가능

### 목표 시스템

✅ **사전 생성**: 매일 새벽 2시 배치로 오늘 출석 레코드 자동 생성 (`status: "scheduled"`)
✅ **슬롯 기반**: 수업/자습 시간대별로 독립적인 출석 레코드
✅ **자동 결석**: 시간이 지난 `scheduled` 레코드를 자동으로 `not_arrived` 처리
✅ **시간표 연동**: `student_timetables.detailedSchedule.timeSlots` 기반

---

## 🗓️ 6일 구현 일정

| Day | Phase | 작업 내용 | 시간 |
|-----|-------|----------|------|
| **Day 1** | Phase 1 | Backend/Frontend 타입 확장 | 2시간 |
| **Day 2** | Phase 2 | 배치 함수 작성 (createDailyAttendanceRecords) | 6시간 |
| **Day 3** | Phase 2 | 초기 배포 및 테스트 | 8시간 |
| **Day 4** | Phase 3 | PIN 체크 로직 수정 (Part 1) | 8시간 |
| **Day 5** | Phase 3 | PIN 체크 로직 수정 (Part 2) + 테스트 | 8시간 |
| **Day 6** | Phase 4 | 자동 결석 처리 배치 함수 | 3시간 |
| **Week 3-4** | Phase 5 | 모니터링 및 점진적 배포 | 11시간 |

---

## Day 1: Phase 1 - 데이터 구조 확장 (2시간)

### 목표

기존 코드와 호환되면서 새로운 슬롯 필드를 추가합니다.

### 1.1 Backend 타입 확장 (30분)

**파일**: [`functions/src/modules/personal/studentAttendanceManagement.ts`](functions/src/modules/personal/studentAttendanceManagement.ts)

#### 현재 코드 (Line 25-30)

```typescript
type StudentAttendanceStatus =
  | "checked_in"
  | "checked_out"
  | "not_arrived"
  | "absent_excused"
  | "absent_unexcused";
```

#### 수정 후

```typescript
type StudentAttendanceStatus =
  | "scheduled"          // ← 추가: 배치로 사전 생성된 레코드
  | "checked_in"
  | "checked_out"
  | "not_arrived"
  | "absent_excused"
  | "absent_unexcused";
```

#### 현재 코드 (Line 32-62)

```typescript
interface StudentAttendanceRecord {
  id: string;
  userId: string;
  studentId: string;
  studentName: string;
  seatLayoutId: string;
  seatId: string;
  seatNumber: string;
  date: string;
  dayOfWeek: DayOfWeek;
  expectedArrivalTime: string;
  expectedDepartureTime: string;
  actualArrivalTime?: Timestamp;
  actualDepartureTime?: Timestamp;
  status: StudentAttendanceStatus;
  // ... 기타 필드들
  sessionNumber: number;
  isLatestSession: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  recordTimestamp: Timestamp;
}
```

#### 수정 후

```typescript
interface StudentAttendanceRecord {
  id: string;
  userId: string;
  studentId: string;
  studentName: string;
  seatLayoutId: string;
  seatId: string;
  seatNumber: string;
  date: string;
  dayOfWeek: DayOfWeek;

  // ✅ 신규: 시간표 슬롯 정보 (optional - 하위 호환성 유지)
  timetableId?: string;              // 시간표 ID
  timeSlotId?: string;               // 슬롯 ID
  timeSlotSubject?: string;          // 과목명 (예: "수학", "자습")
  timeSlotType?: "class" | "self_study" | "external";  // 슬롯 타입

  expectedArrivalTime: string;
  expectedDepartureTime: string;
  actualArrivalTime?: Timestamp;
  actualDepartureTime?: Timestamp;
  status: StudentAttendanceStatus;
  // ... 기타 필드들
  sessionNumber: number;
  isLatestSession: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  recordTimestamp: Timestamp;
}
```

---

### 1.2 Frontend 타입 동기화 (30분)

**파일**: [`frontend/src/types/attendance.ts`](frontend/src/types/attendance.ts)

#### 현재 코드 (Line 11-16)

```typescript
export type StudentAttendanceStatus =
  | 'checked_in'
  | 'checked_out'
  | 'not_arrived'
  | 'absent_excused'
  | 'absent_unexcused';
```

#### 수정 후

```typescript
export type StudentAttendanceStatus =
  | 'scheduled'          // ← 추가
  | 'checked_in'
  | 'checked_out'
  | 'not_arrived'
  | 'absent_excused'
  | 'absent_unexcused';
```

#### 현재 코드 (Line 77-107)

```typescript
export interface StudentAttendanceRecord {
  id: string;
  userId: string;
  studentId: string;
  // ... (백엔드와 동일한 필드들)
  sessionNumber: number;
  isLatestSession: boolean;
  createdAt: Date;
  updatedAt: Date;
  recordTimestamp: Date;
}
```

#### 수정 후

```typescript
export interface StudentAttendanceRecord {
  id: string;
  userId: string;
  studentId: string;
  // ... 기존 필드들 ...

  // ✅ 신규: 백엔드와 동일하게 추가
  timetableId?: string;
  timeSlotId?: string;
  timeSlotSubject?: string;
  timeSlotType?: 'class' | 'self_study' | 'external';

  sessionNumber: number;
  isLatestSession: boolean;
  createdAt: Date;
  updatedAt: Date;
  recordTimestamp: Date;
}
```

---

### 1.3 타입 에러 수정 (1시간)

#### 변경 영향 범위

```bash
# Backend
functions/src/modules/personal/studentAttendanceManagement.ts (1,631줄)
- checkAttendanceByPin (Line 465-756)
- manualCheckIn (Line 1157-1325)
- manualCheckOut (Line 1332-1432)
- markStudentAbsent (Line 1433-1631)

# Frontend
frontend/src/components/domain/Attendance/ (여러 컴포넌트)
frontend/src/services/attendanceService.ts
```

#### 수정 전략

- ✅ `status` 타입에 `"scheduled"` 추가되어도 기존 로직은 영향 없음 (아직 사용 안 함)
- ✅ Optional 필드이므로 기존 레코드와 호환
- ⚠️ TypeScript 컴파일 에러 확인 후 필요 시 수정

#### 테스트

```bash
cd functions
npm run build  # 백엔드 타입 체크

cd ../frontend
npm run build  # 프론트엔드 타입 체크
```

---

### Day 1 체크리스트

- [ ] Backend `StudentAttendanceStatus`에 `"scheduled"` 추가
- [ ] Backend `StudentAttendanceRecord`에 4개 필드 추가
- [ ] Frontend 타입 동기화
- [ ] `npm run build` 성공 확인

---

## Day 2: Phase 2 - 배치 함수 작성 (6시간)

### 목표

매일 새벽 2시 자동으로 오늘의 출석 레코드를 사전 생성하는 배치 함수를 작성합니다.

### 2.1 디렉토리 생성 (5분)

```bash
mkdir -p functions/src/scheduled
```

---

### 2.2 배치 함수 작성 (3시간)

**새 파일**: [`functions/src/scheduled/createDailyAttendanceRecords.ts`](functions/src/scheduled/createDailyAttendanceRecords.ts)

```typescript
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import {
  getTodayInKorea,
  getCurrentKoreaDayOfWeek,
  getDayOfWeek
} from "../utils/timeUtils";

/**
 * 매일 새벽 2시 실행: 오늘 출석 레코드 사전 생성
 *
 * 참고: ATTENDANCE_REFACTORING_PLAN.md Phase 2
 */
export const createDailyAttendanceRecords = onSchedule({
  schedule: "0 2 * * *",  // 매일 02:00 (UTC+9 기준)
  timeZone: "Asia/Seoul",
  region: "asia-northeast3",
  timeoutSeconds: 540,    // 9분 (최대값)
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

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      // 2. 해당 사용자의 활성 좌석 배정 조회
      const assignmentsSnapshot = await db
        .collection("users")
        .doc(userId)
        .collection("seat_assignments")
        .where("status", "==", "active")
        .get();

      for (const assignmentDoc of assignmentsSnapshot.docs) {
        const assignment = assignmentDoc.data();
        const { studentId, seatLayoutId, seatId, seatNumber } = assignment;

        // 3. 학생 시간표 조회
        const timetableId = assignment.timetableId;
        if (!timetableId) {
          logger.warn(`[SKIP] userId=${userId}, studentId=${studentId}: timetableId 없음`);
          continue;
        }

        const timetableDoc = await db
          .collection("users")
          .doc(userId)
          .collection("student_timetables")
          .doc(timetableId)
          .get();

        if (!timetableDoc.exists) {
          logger.warn(`[SKIP] userId=${userId}, timetableId=${timetableId}: 시간표 없음`);
          continue;
        }

        const timetableData = timetableDoc.data();
        const dailySchedule = timetableData?.basicSchedule?.dailySchedules?.[dayOfWeek];

        // 오늘 비활성 날짜면 스킵
        if (!dailySchedule || !dailySchedule.isActive) {
          logger.info(`[SKIP] userId=${userId}, studentId=${studentId}: 오늘(${dayOfWeek}) 비활성`);
          continue;
        }

        // 4. detailedSchedule에서 출석 의무 슬롯 필터링
        const detailedSchedule = timetableData?.detailedSchedule?.[dayOfWeek];
        if (!detailedSchedule || !detailedSchedule.timeSlots) {
          logger.warn(`[SKIP] userId=${userId}, studentId=${studentId}: detailedSchedule 없음`);
          continue;
        }

        const obligatorySlots = detailedSchedule.timeSlots.filter(
          (slot: any) => slot.type === "class" || slot.type === "self_study"
        );

        if (obligatorySlots.length === 0) {
          logger.info(`[SKIP] userId=${userId}, studentId=${studentId}: 출석 의무 슬롯 없음`);
          continue;
        }

        // 5. 각 슬롯별로 출석 레코드 생성
        const batch = db.batch();

        for (let i = 0; i < obligatorySlots.length; i++) {
          const slot = obligatorySlots[i];
          const timestamp = admin.firestore.Timestamp.now();

          // recordId: {studentId}_{YYYYMMDD}_slot{N}_{timestamp}
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

            // ✅ 신규 필드
            timetableId,
            timeSlotId: slot.id || `slot_${i}`,
            timeSlotSubject: slot.subject,
            timeSlotType: slot.type,

            expectedArrivalTime: slot.startTime,
            expectedDepartureTime: slot.endTime,

            status: "scheduled",  // ← 초기 상태
            isLate: false,
            isEarlyLeave: false,

            sessionNumber: i + 1,  // 슬롯 순서
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
    }

    logger.info(`[배치 완료] ${today} 총 ${totalCreated}개 레코드 생성`);
  } catch (error) {
    logger.error(`[배치 오류] ${today}`, error);
    throw error;
  }
});
```

---

### 2.3 index.ts에 Export 추가 (10분)

**파일**: [`functions/src/index.ts`](functions/src/index.ts)

```typescript
// Line 147 이후에 추가

// ==================== Scheduled Functions ====================

export {
  createDailyAttendanceRecords,
} from "./scheduled/createDailyAttendanceRecords";
```

---

### 2.4 Firestore 인덱스 생성 (30분)

**파일**: [`firestore.indexes.json`](firestore.indexes.json)

```json
{
  "indexes": [
    {
      "collectionGroup": "student_attendance_records",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "studentId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "student_attendance_records",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "date", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "seat_assignments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

### 2.5 로컬 테스트 (2시간)

#### Emulator 실행

```bash
cd functions
npm run build

cd ..
firebase emulators:start
```

#### 수동 트리거 (Cloud Console)

1. Firebase Console → Functions
2. `createDailyAttendanceRecords` 선택
3. "테스트" 버튼 클릭
4. Firestore에서 레코드 생성 확인

#### 확인 사항

```bash
# Firestore에서 확인
/users/{userId}/student_attendance_records/{recordId}

# 필수 필드 확인
- status: "scheduled"
- timetableId: (존재)
- timeSlotId: (존재)
- timeSlotSubject: (존재)
- timeSlotType: "class" 또는 "self_study"
```

---

### Day 2 체크리스트

- [ ] `functions/src/scheduled/createDailyAttendanceRecords.ts` 작성
- [ ] `functions/src/index.ts`에 export 추가
- [ ] `firestore.indexes.json` 인덱스 추가
- [ ] Emulator 테스트 성공
- [ ] 레코드 생성 확인 (Firestore Console)

---

## Day 3: Phase 2 - 초기 배포 및 검증 (8시간)

### 목표

배치 함수를 프로덕션에 배포하고 기존 PIN 체크 로직에 영향이 없는지 확인합니다.

### 3.1 배포 전 체크리스트 (30분)

- [ ] `npm run build` 성공 (functions/)
- [ ] `npm run lint` 성공
- [ ] Emulator 테스트 완료
- [ ] 기존 PIN 체크 기능 정상 작동 (영향 없음 확인)

---

### 3.2 Functions 배포 (1시간)

```bash
# Functions만 배포
firebase deploy --only functions

# 또는 특정 함수만
firebase deploy --only functions:createDailyAttendanceRecords
```

**배포 후 확인**:
- Cloud Console → Functions → `createDailyAttendanceRecords` 존재 확인
- Cloud Scheduler → 스케줄 등록 확인 (매일 02:00 Asia/Seoul)

---

### 3.3 모니터링 설정 (2시간)

#### Cloud Logging 필터

```
resource.type="cloud_function"
resource.labels.function_name="createDailyAttendanceRecords"
severity>=DEFAULT
```

#### 알람 설정

1. Cloud Monitoring → Alerting
2. 조건: Function execution time > 500s
3. 알림: Email 또는 Slack

---

### 3.4 첫 실행 확인 (다음 날 오전)

#### 로그 확인

```bash
firebase functions:log --only createDailyAttendanceRecords
```

**확인 항목**:
- ✅ `[배치 시작]` 로그
- ✅ `[성공]` 로그 (각 학생별)
- ✅ `[배치 완료]` 로그
- ❌ `[배치 오류]` 없음

#### Firestore 확인

```bash
# 오늘 날짜 레코드 조회
/users/{userId}/student_attendance_records/
  where date == "2025-01-31"
  where status == "scheduled"
```

**기대 결과**:
- 활성 좌석 배정된 모든 학생
- 각 학생의 오늘 슬롯 수만큼 레코드 존재
- 모두 `status: "scheduled"` 상태

---

### 3.5 비용 확인 (1시간)

#### Firestore 사용량

- Firebase Console → Firestore → Usage
- 읽기/쓰기 증가량 확인

**예상 비용** (월간):
- 학생 100명, 평균 5슬롯/일
- 월 15,000개 문서 쓰기 (배치)
- ✅ 무료 한도 60만/월 이내

---

### 3.6 기존 기능 검증 (3시간)

#### PIN 체크 테스트

1. 학생 PIN 입력 (기존 방식)
2. 체크인/체크아웃 정상 작동 확인
3. 새로운 세션 레코드 생성 확인 (기존 로직 유지)

**중요**:
- ✅ Phase 3 전까지는 기존 PIN 체크 로직 그대로 사용
- ✅ 배치로 생성된 `scheduled` 레코드는 아직 사용 안 함
- ✅ 두 가지 레코드가 공존 (기존 세션 + 신규 슬롯)

---

### Day 3 체크리스트

- [ ] Functions 배포 완료
- [ ] Cloud Scheduler 등록 확인
- [ ] 모니터링/알람 설정 완료
- [ ] 다음 날 배치 실행 확인
- [ ] Firestore에 `scheduled` 레코드 생성 확인
- [ ] 기존 PIN 체크 기능 정상 작동 확인
- [ ] 비용 영향 확인

---

## Day 4-5: Phase 3 - PIN 체크 로직 수정 (16시간)

### 목표

기존 동적 생성 방식을 버리고, 배치로 생성된 슬롯 레코드를 찾아 업데이트하는 방식으로 변경합니다.

### 현재 로직 (변경 전)

**파일**: [`functions/src/modules/personal/studentAttendanceManagement.ts`](functions/src/modules/personal/studentAttendanceManagement.ts:465-756)

```typescript
// Line 465-756: checkAttendanceByPin
export const checkAttendanceByPin = onCall(async (request) => {
  // ... PIN 검증, 좌석 확인 ...

  // ❌ 문제: 오늘 최신 세션 조회
  const latestRecordSnapshot = await db
    .collection("users")
    .doc(userId)
    .collection("student_attendance_records")
    .where("studentId", "==", studentId)
    .where("date", "==", today)
    .where("isLatestSession", "==", true)
    .limit(1)
    .get();

  // ❌ 문제: 레코드가 없거나 checked_out이면 새로 생성
  if (latestRecordSnapshot.empty ||
      latestRecordSnapshot.docs[0].data().status === "checked_out") {
    // 새로운 출석 레코드 동적 생성
    const newRecordId = `${studentId}_${today.replace(/-/g, "")}_${timestamp.toMillis()}`;
    await recordRef.set(attendanceData);
    // ...
  } else {
    // 체크아웃 처리
    await recordRef.update(updateData);
  }
});
```

---

### 새 로직 (변경 후)

#### Day 4 작업: checkAttendanceByPin 전면 수정 (8시간)

**파일**: [`functions/src/modules/personal/studentAttendanceManagement.ts`](functions/src/modules/personal/studentAttendanceManagement.ts:465-756)

```typescript
// Line 465-756 전체 교체
export const checkAttendanceByPin = onCall(async (request) => {
  // ===== 기존 로직 유지 =====
  // 1. PIN 검증
  // 2. 좌석 확인
  // 3. userId, studentId 추출
  // ... (Line 465-590 유지)

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

  // ===== 상태 전환 로직 =====

  // 1. scheduled → checked_in (최초 체크인)
  if (recordData.status === "scheduled") {
    const expectedMinutes = parseTimeToMinutes(recordData.expectedArrivalTime);
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

    await recordRef.update(updateData);

    return {
      success: true,
      message: `${recordData.timeSlotSubject} 수업 체크인 완료${isLate ? " (지각)" : ""}`,
      action: "checked_in",
      data: { ...recordData, ...updateData }
    };
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

#### Day 5 작업: manualCheckIn/Out 수정 + 테스트 (8시간)

##### manualCheckIn 수정

**파일**: [`functions/src/modules/personal/studentAttendanceManagement.ts`](functions/src/modules/personal/studentAttendanceManagement.ts:1157-1325)

```typescript
// Line 1157-1325: manualCheckIn
export const manualCheckIn = onCall(async (request) => {
  // ===== 권한 확인 (기존 유지) =====
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

  // ===== 변경: 슬롯 기반 조회 (checkAttendanceByPin과 동일) =====
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

  // 현재 시간에 가장 가까운 슬롯 찾기
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

  // ===== 체크인 처리 (기존과 유사) =====
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

##### manualCheckOut 수정

**파일**: [`functions/src/modules/personal/studentAttendanceManagement.ts`](functions/src/modules/personal/studentAttendanceManagement.ts:1332-1432)

```typescript
// Line 1332-1432: manualCheckOut
export const manualCheckOut = onCall(async (request) => {
  // ===== 권한 확인 (기존 유지) =====
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

  // ===== 변경: checked_in 상태 슬롯 조회 =====
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

  // ===== 체크아웃 처리 =====
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

### 테스트 (3시간)

#### Emulator 테스트

```bash
firebase emulators:start
```

#### 테스트 케이스

1. **케이스 1: 정상 체크인/아웃**
   - 배치로 `scheduled` 레코드 생성
   - PIN 입력 → `checked_in` 전환 확인
   - 다시 PIN 입력 → `checked_out` 전환 확인

2. **케이스 2: 지각**
   - 수업 시작 후 15분에 PIN 입력
   - `isLate: true`, `lateMinutes: 15` 확인

3. **케이스 3: 조퇴**
   - 수업 종료 40분 전에 체크아웃
   - `isEarlyLeave: true` 확인

4. **케이스 4: 재입실**
   - `checked_out` 상태에서 다시 PIN 입력
   - `checked_in` 전환 + `notes` 추가 확인

5. **케이스 5: 시간 외 체크**
   - 수업 시작 31분 전에 PIN 입력
   - 에러 메시지 확인

---

### Day 4-5 체크리스트

- [ ] `checkAttendanceByPin` 전면 수정 완료
- [ ] `manualCheckIn` 슬롯 기반 변경
- [ ] `manualCheckOut` 슬롯 기반 변경
- [ ] Emulator 테스트 5개 케이스 통과
- [ ] 빌드 성공 (`npm run build`)

---

## Day 6: Phase 4 - 자동 결석 처리 (3시간)

### 목표

매시간 실행되어 시작 시간이 지난 `scheduled` 상태를 `not_arrived`로 자동 변경하는 배치 함수를 작성합니다.

### 4.1 배치 함수 작성 (2시간)

**새 파일**: [`functions/src/scheduled/markAbsentRecords.ts`](functions/src/scheduled/markAbsentRecords.ts)

```typescript
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import {
  getTodayInKorea,
  getCurrentKoreaMinutes,
  parseTimeToMinutes
} from "../utils/timeUtils";

/**
 * 매시간 실행: 시작 시간이 지난 scheduled 상태를 not_arrived로 변경
 *
 * 참고: ATTENDANCE_REFACTORING_PLAN.md Phase 4
 */
export const markAbsentRecords = onSchedule({
  schedule: "0 * * * *",  // 매시 정각
  timeZone: "Asia/Seoul",
  region: "asia-northeast3",
  timeoutSeconds: 300
}, async (event) => {
  const db = admin.firestore();
  const today = getTodayInKorea();
  const currentMinutes = getCurrentKoreaMinutes();

  logger.info(`[결석 처리 시작] ${today} ${currentMinutes}분`);

  // 모든 사용자 순회
  const usersSnapshot = await db.collection("users").get();

  let totalProcessed = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;

    // 오늘 scheduled 상태 레코드 조회
    const scheduledRecords = await db
      .collection("users")
      .doc(userId)
      .collection("student_attendance_records")
      .where("date", "==", today)
      .where("status", "==", "scheduled")
      .get();

    if (scheduledRecords.empty) continue;

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of scheduledRecords.docs) {
      const record = doc.data();
      const slotEndMinutes = parseTimeToMinutes(record.expectedDepartureTime);

      // 수업 종료 시간 + 30분 유예가 지났으면 not_arrived 처리
      if (currentMinutes > slotEndMinutes + 30) {
        batch.update(doc.ref, {
          status: "not_arrived",
          updatedAt: admin.firestore.Timestamp.now()
        });
        batchCount++;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      totalProcessed += batchCount;
      logger.info(`[결석 처리] userId=${userId}: ${batchCount}건`);
    }
  }

  logger.info(`[결석 처리 완료] 총 ${totalProcessed}건 처리`);
});
```

---

### 4.2 index.ts에 Export 추가 (10분)

**파일**: [`functions/src/index.ts`](functions/src/index.ts)

```typescript
// Scheduled Functions 섹션에 추가
export {
  createDailyAttendanceRecords,
} from "./scheduled/createDailyAttendanceRecords";

export {
  markAbsentRecords,
} from "./scheduled/markAbsentRecords";
```

---

### 4.3 배포 및 테스트 (50분)

#### 배포

```bash
cd functions
npm run build

cd ..
firebase deploy --only functions:markAbsentRecords
```

#### 테스트

1. **Emulator 테스트**
   ```bash
   firebase emulators:start
   ```

2. **수동 트리거**
   - Firebase Console → Functions → `markAbsentRecords`
   - "테스트" 버튼 클릭

3. **확인**
   ```typescript
   // 수업 종료 + 30분 지난 scheduled 레코드가
   // not_arrived로 변경되었는지 확인
   ```

---

### Day 6 체크리스트

- [ ] `markAbsentRecords.ts` 작성 완료
- [ ] `functions/src/index.ts`에 export 추가
- [ ] 빌드 성공
- [ ] Emulator 테스트 통과
- [ ] 프로덕션 배포 완료
- [ ] Cloud Scheduler 등록 확인 (매시 정각)

---

## Week 3-4: Phase 5 - 점진적 배포 및 모니터링 (11시간)

### 목표

신규 시스템을 프로덕션에 안전하게 전환하고 모니터링합니다.

### 5.1 Week 3: Phase 3 배포 (5시간)

#### 배포 계획

```bash
# 1단계: Functions 배포 (PIN 체크 로직 변경)
firebase deploy --only functions

# 2단계: 사용자 공지
"새로운 출석 시스템이 적용되었습니다. 수업별로 개별 체크인/아웃이 가능합니다."

# 3단계: 실시간 모니터링
firebase functions:log
```

#### 모니터링 항목

1. **에러 로그 확인**
   ```
   "not-found" 에러: 배치 작업 미실행 의심
   "failed-precondition" 에러: 시간 범위 밖 체크 시도
   ```

2. **Cloud Logging 필터**
   ```
   resource.type="cloud_function"
   resource.labels.function_name="checkAttendanceByPin"
   severity>=ERROR
   ```

3. **사용자 피드백 수집**
   - "수업을 찾을 수 없다" → 배치 로그 확인
   - "체크가 안 된다" → 시간대 확인

---

### 5.2 Week 4: 최종 검증 (6시간)

#### 검증 항목

1. **배치 작업 안정성**
   - 매일 새벽 2시 정상 실행 확인 (7일간)
   - 실행 시간 측정 (9분 이내)
   - 실패율 0% 목표

2. **자동 결석 처리**
   - 매시간 정상 실행 확인
   - `scheduled` → `not_arrived` 전환 확인
   - 유예 시간 (30분) 정확도 검증

3. **PIN 체크 정확도**
   - 슬롯 매칭 성공률 측정
   - 지각/조퇴 판단 정확도 확인
   - 재입실 처리 테스트

4. **비용 확인**
   - Firestore 읽기/쓰기 증가량
   - Cloud Functions 실행 시간
   - ✅ 무료 한도 내 확인

---

### 5.3 문제 해결 가이드

#### 문제 1: 배치 작업 타임아웃 (9분 초과)

**원인**: 사용자/학생 수가 많을 경우
**해결**:
```typescript
// Promise.all로 병렬 처리
const userPromises = usersSnapshot.docs.map(async (userDoc) => {
  // ...
});
await Promise.all(userPromises);
```

#### 문제 2: "not-found" 에러 (오늘 출석할 수업 없음)

**원인**: 배치 작업 미실행 또는 실패
**해결**:
1. Cloud Logging 확인
2. 수동 트리거 실행
3. 좌석 배정/시간표 확인

#### 문제 3: 슬롯 매칭 실패 (시간 범위 밖)

**원인**: ±30분 범위 밖에서 PIN 입력
**해결**:
- 범위 확장 (`±30분` → `±60분`)
- 또는 관리자에게 수동 체크인 권한 안내

#### 문제 4: 기존 세션 레코드와 슬롯 레코드 혼재

**원인**: Phase 3 전환 전 생성된 레코드
**해결**:
```typescript
// 조회 시 timetableId 존재 여부로 구분
if (record.timetableId) {
  // 신규 슬롯 기반 레코드
} else {
  // 기존 세션 레코드 (무시 또는 별도 처리)
}
```

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

## 📋 전체 구현 체크리스트 (최종 요약)

### Phase 1: 데이터 구조 확장 (Day 1)
- [ ] Backend `StudentAttendanceStatus`에 `"scheduled"` 추가
- [ ] Backend `StudentAttendanceRecord`에 4개 필드 추가
- [ ] Frontend 타입 동기화
- [ ] 빌드 성공 확인

### Phase 2: 배치 작업 구현 (Day 2-3)
- [ ] `functions/src/scheduled/` 디렉토리 생성
- [ ] `createDailyAttendanceRecords.ts` 작성
- [ ] `functions/src/index.ts`에 export 추가
- [ ] `firestore.indexes.json` 인덱스 추가
- [ ] 프로덕션 배포 및 첫 실행 확인

### Phase 3: PIN 체크 로직 수정 (Day 4-5)
- [ ] `checkAttendanceByPin` 전면 수정
- [ ] `manualCheckIn` 슬롯 기반 변경
- [ ] `manualCheckOut` 슬롯 기반 변경
- [ ] Emulator 테스트 통과

### Phase 4: 자동 결석 처리 (Day 6)
- [ ] `markAbsentRecords.ts` 작성
- [ ] `functions/src/index.ts`에 export 추가
- [ ] 프로덕션 배포 및 테스트

### Phase 5: 점진적 전환 (Week 3-4)
- [ ] Week 3 배포 및 모니터링
- [ ] Week 4 최종 검증
- [ ] 안정성 확인 (7일간)
- [ ] 최종 보고서 작성

---

## ⏱️ 총 예상 작업 시간

| Phase | 작업 시간 | 기간 |
|-------|----------|------|
| Phase 1 | 2시간 | Day 1 |
| Phase 2 | 14시간 | Day 2-3 |
| Phase 3 | 16시간 | Day 4-5 |
| Phase 4 | 3시간 | Day 6 |
| Phase 5 | 11시간 | Week 3-4 |
| **총계** | **46시간 (약 6일 + 2주 모니터링)** | - |

---

## 🚨 주요 주의사항

### 1. 기존 데이터 호환성

**현재 DB에 있는 레코드**:
- `timeSlotId`, `timeSlotSubject`, `timeSlotType` 필드 없음
- `status`에 "scheduled" 값 없음

**처리 방안**:
- ✅ Optional 필드로 정의하여 기존 레코드 유지
- ✅ 신규 레코드만 새 필드 사용
- ✅ 조회 시 `timetableId` 존재 여부로 신구 레코드 구분

---

### 2. Firestore 비용

**예상 비용** (월간):
- 학생 100명, 하루 평균 5슬롯
- 월 15,000개 문서 쓰기 (배치)
- 월 45,000개 문서 읽기 (PIN 체크)

**무료 한도**:
- 쓰기: 60만/월
- 읽기: 150만/월

✅ **결론**: 무료 한도 내에서 충분

---

### 3. Cloud Scheduler 실행 시간

**createDailyAttendanceRecords**:
- 설정: 매일 02:00 (Asia/Seoul)
- Timeout: 540초 (9분)
- 대규모 사용자 시 타임아웃 가능성

**해결책**:
- `Promise.all`로 병렬 처리
- Batch Write 활용 (500개 제한)
- 필요 시 여러 함수로 분산

---

### 4. 시간표 변경 시 당일 레코드

**문제**:
- 새벽 2시 배치 후 시간표 변경 시 당일 레코드 불일치

**해결책**:
- Trigger 추가: `onStudentTimetableUpdate`에서 당일 레코드 재생성
- 또는 관리자에게 "내일부터 반영" 안내

---

## 📚 관련 문서

- [ATTENDANCE_REFACTORING_PLAN.md](ATTENDANCE_REFACTORING_PLAN.md) - 리팩토링 계획 원본
- [EVENT_BASE_ATTENDANCE_PLAN.md](EVENT_BASE_ATTENDANCE_PLAN.md) - 이��트 기반 미래 계획
- [BACKEND_DATA_STRUCTURE.md](BACKEND_DATA_STRUCTURE.md) - Firestore 구조
- [CLAUDE.md](CLAUDE.md) - 프로젝트 전체 가이드

---

## 📝 다음 단계 (구현 후)

### 단기 개선 사항

1. **Frontend UI 업데이트**
   - 수업별 출석 현황 표시
   - `timeSlotSubject` 과목명 표시
   - `timeSlotType` 아이콘 구분

2. **통계 대시보드**
   - 수업별 출석률
   - 지각/조퇴 통계
   - 미등원 학생 알림

3. **모니터링 개선**
   - BigQuery 연동 (선택)
   - Cloud Monitoring 대시보드
   - 자동 알림 설정

### 장기 로드맵

**이벤트 기반 시스템으로 마이그레이션** ([EVENT_BASE_ATTENDANCE_PLAN.md](EVENT_BASE_ATTENDANCE_PLAN.md) 참고)
- 부분 출석 지원 (09:00-14:00 결석, 14:00-20:00 출석)
- 외부 활동 이벤트 기록
- 복잡한 시나리오 대응

---

**작성**: AI Assistant
**검증**: 실제 코드베이스 분석 기반
**최종 업데이트**: 2025-01-31
**구현 방식**: 옵션 2 - 풀 슬롯 기반 시스템
