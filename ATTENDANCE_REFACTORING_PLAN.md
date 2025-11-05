# 출석 시스템 리팩토링 계획안

## 목표

**"내부 수업/자습 시간은 등원 필수, 외부 일정은 제외"하는 효율적인 출석 체크 관리 시스템으로 전환**

---

## 현재 구조 분석

### 1. 현재 출석 시스템의 동작 방식

#### 세션 기반 출석 관리
- 학생이 PIN으로 체크인할 때마다 **새로운 출석 레코드 생성**
- `sessionNumber` (1, 2, 3...)로 하루 내 여러 입/퇴실 추적
- `isLatestSession: true`로 가장 최신 세션 표시

#### 출석 체크 흐름
```typescript
// checkAttendanceByPin (line 465-756)
1. PIN 검증
2. 좌석 배정 확인
3. 오늘 최신 세션 조회
   - 세션 없음 or checked_out → 새 체크인 생성
   - checked_in → 체크아웃 처리
4. 시간표 검증 (assignment.expectedSchedule에서 dailySchedules 확인)
5. 지각/조퇴 계산 (expectedArrival/Departure 기준)
```

#### 데이터 소스
- `seat_assignments.expectedSchedule`: 요일별 등/하원 시간 캐싱
  ```typescript
  expectedSchedule: {
    monday: { arrivalTime: "09:00", departureTime: "18:00", isActive: true },
    tuesday: { ... }
  }
  ```
- 출처: `student_timetables.basicSchedule.dailySchedules`

### 2. 현재 구조의 한계

#### ❌ 시간표 슬롯 정보 부재
- `seat_assignments`에는 **요일별 전체 등/하원 시간만** 캐싱
- `detailedSchedule` (수업별 타임슬롯)은 `student_timetables`에만 존재
- **수업 종류 구분 불가**: `type: "class" | "self_study" | "external"` 정보 없음

#### ❌ 하루 1세션 가정
- `expectedArrivalTime/expectedDepartureTime`이 하루 전체를 대표
- 수업별 출석을 추적하려면 여러 레코드가 필요하지만 현재는 미지원

#### ❌ 동적 생성 방식
- 학생이 PIN 입력해야 레코드 생성
- 미등원 학생 파악을 위해서는 **사전 생성 필요**

---

## 제안 구조: 슬롯 기반 출석 관리

### 핵심 아이디어

1. **매일 새벽 배치**: 모든 학생의 시간표를 조회하여 **수업 슬롯별 출석 레코드 사전 생성**
2. **슬롯 타입 필터링**: `type === "class" | "self_study"` 슬롯만 출석 의무 레코드 생성
3. **외부 일정 제외**: `type === "external"` 슬롯은 레코드 미생성
4. **PIN 체크 시**: 사전 생성된 레코드를 찾아 **상태 업데이트**

---

## 리팩토링 단계별 계획

### Phase 1: 데이터 구조 확장 (하위 호환성 유지)

#### 1.1 `student_attendance_records` 타입 확장

```typescript
interface StudentAttendanceRecord {
  // 기존 필드 유지
  id: string;
  userId: string;
  studentId: string;
  studentName: string;
  seatLayoutId: string;
  seatId: string;
  seatNumber: string;
  date: string;
  dayOfWeek: DayOfWeek;

  // ✅ 신규 필드 추가 (optional - 하위 호환성)
  timetableId?: string;              // 시간표 ID
  timeSlotId?: string;               // 슬롯 ID (detailedSchedule의 timeSlot.id)
  timeSlotSubject?: string;          // 과목명
  timeSlotType?: "class" | "self_study" | "external";  // 슬롯 타입

  expectedArrivalTime: string;       // 슬롯 시작 시간 (기존 용도 변경)
  expectedDepartureTime: string;     // 슬롯 종료 시간 (기존 용도 변경)

  actualArrivalTime?: Timestamp;
  actualDepartureTime?: Timestamp;

  // ✅ 상태 확장
  status: "scheduled" | "checked_in" | "checked_out" | "not_arrived" | "absent_excused" | "absent_unexcused";

  // 기존 필드 유지
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

  // ⚠️ 세션 관련 필드 용도 재정의
  sessionNumber: number;             // → 슬롯 순서 (1: 09:00-10:00, 2: 10:00-11:00...)
  isLatestSession: boolean;          // → 당일 마지막 슬롯 여부

  createdAt: Timestamp;
  updatedAt: Timestamp;
  recordTimestamp: Timestamp;
}
```

**변경 포인트**:
- `"scheduled"` 상태 추가: 사전 생성 레코드 표시
- `timetableId`, `timeSlotId`, `timeSlotSubject`, `timeSlotType` 추가
- `expectedArrivalTime/Departure` 의미 변경: 하루 전체 → 슬롯 시간
- `sessionNumber` 의미 변경: 재입실 횟수 → 슬롯 순서

#### 1.2 `seat_assignments` 확장 (선택사항)

현재 `expectedSchedule`에 dailySchedules만 있으므로, detailedSchedule도 캐싱할지 결정:

**옵션 A: 캐싱하지 않음 (권장)**
- 매일 배치 작업에서 `student_timetables` 직접 조회
- 장점: 데이터 중복 최소화, 시간표 변경 시 동기화 불필요
- 단점: 배치 작업 시 추가 쿼리 필요

---

### Phase 2: 배치 작업 구현 (사전 생성 로직)

#### 2.1 Cloud Scheduler 설정

```typescript
// functions/src/scheduled/createDailyAttendanceRecords.ts
import { onSchedule } from "firebase-functions/v2/scheduler";

/**
 * 매일 새벽 2시 실행: 오늘 출석 레코드 사전 생성
 */
export const createDailyAttendanceRecords = onSchedule({
  schedule: "0 2 * * *",  // 매일 02:00 (UTC)
  timeZone: "Asia/Seoul",
  region: "asia-northeast3"
}, async (event) => {
  const db = admin.firestore();
  const today = getTodayInKorea();
  const dayOfWeek = getCurrentKoreaDayOfWeek();

  logger.info(`[배치 시작] ${today} (${dayOfWeek}) 출석 레코드 생성`);

  try {
    // 1. 모든 사용자 조회
    const usersSnapshot = await db.collection("users").get();

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

          // recordId: {studentId}_{YYYYMMDD}_{slotIndex}_{timestamp}
          const recordId = `${studentId}_${today.replace(/-/g, "")}_slot${i + 1}_${timestamp.toMillis()}`;
          const recordRef = db
            .collection("users")
            .doc(userId)
            .collection("student_attendance_records")
            .doc(recordId);

          const recordData: Partial<StudentAttendanceRecord> = {
            id: recordId,
            userId,
            studentId,
            studentName: assignment.studentName || "",
            seatLayoutId,
            seatId,
            seatNumber: seatNumber || "",
            date: today,
            dayOfWeek,

            // 신규 필드
            timetableId,
            timeSlotId: slot.id || `slot_${i}`,
            timeSlotSubject: slot.subject,
            timeSlotType: slot.type,

            expectedArrivalTime: slot.startTime,
            expectedDepartureTime: slot.endTime,

            status: "scheduled",  // 초기 상태
            isLate: false,
            isEarlyLeave: false,

            sessionNumber: i + 1,  // 슬롯 순서
            isLatestSession: (i === obligatorySlots.length - 1),  // 마지막 슬롯

            createdAt: timestamp,
            updatedAt: timestamp,
            recordTimestamp: timestamp
          };

          batch.set(recordRef, recordData);
        }

        await batch.commit();
        logger.info(`[성공] userId=${userId}, studentId=${studentId}: ${obligatorySlots.length}개 슬롯 생성`);
      }
    }

    logger.info(`[배치 완료] ${today} 출석 레코드 생성 완료`);
  } catch (error) {
    logger.error(`[배치 오류] ${today}`, error);
    throw error;
  }
});
```

#### 2.2 배치 작업 최적화

**성능 고려사항**:
- 대규모 사용자 시 배치 시간 증가
- Firestore 읽기/쓰기 비용 증가

**최적화 방안**:
1. **병렬 처리**: 사용자별로 Promise.all() 사용
2. **배치 쓰기**: 500개 문서까지 한 번에 처리
3. **증분 처리**: 마지막 처리 시간 기록하여 신규/변경 건만 처리
4. **에러 핸들링**: 일부 실패 시에도 전체 배치 계속 진행

---

### Phase 3: PIN 체크 로직 수정

#### 3.1 `checkAttendanceByPin` 리팩토링

```typescript
export const checkAttendanceByPin = onCall(async (request) => {
  // ... PIN 검증, 좌석 확인 (기존 로직 유지)

  const today = getTodayInKorea();
  const currentMinutes = getCurrentKoreaMinutes();
  const dayOfWeek = getDayOfWeek(new Date());

  // ✅ 변경: 현재 시간에 해당하는 슬롯 찾기
  const applicableSlotsSnapshot = await db
    .collection("users")
    .doc(userId)
    .collection("student_attendance_records")
    .where("studentId", "==", studentId)
    .where("date", "==", today)
    .where("status", "in", ["scheduled", "checked_in", "checked_out"])  // 재입실을 위해 checked_out 추가
    .get();

  if (applicableSlotsSnapshot.empty) {
    throw new HttpsError("not-found", "오늘 출석할 수업이 없습니다.");
  }

  // 현재 시간과 가장 가까운 슬롯 찾기
  let targetRecord: any = null;
  let minTimeDiff = Infinity;

  for (const doc of applicableSlotsSnapshot.docs) {
    const record = doc.data();
    const slotStartMinutes = parseTimeToMinutes(record.expectedArrivalTime);
    const slotEndMinutes = parseTimeToMinutes(record.expectedDepartureTime);

    // 슬롯 시간 범위 내 또는 ±30분 이내
    if (currentMinutes >= slotStartMinutes - 30 && currentMinutes <= slotEndMinutes + 30) {
      const timeDiff = Math.abs(currentMinutes - slotStartMinutes);
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        targetRecord = { ref: doc.ref, data: record };
      }
    }
  }

  if (!targetRecord) {
    throw new HttpsError("failed-precondition",
      "현재 시간에 해당하는 수업이 없습니다. 수업 시작 30분 전부터 체크 가능합니다.");
  }

  const recordRef = targetRecord.ref;
  const recordData = targetRecord.data;
  const timestamp = admin.firestore.Timestamp.now();

  // ✅ 상태 전환
  if (recordData.status === "scheduled") {
    // 최초 체크인
    const expectedMinutes = parseTimeToMinutes(recordData.expectedArrivalTime);
    const isLate = currentMinutes > expectedMinutes + 10;  // 10분 유예

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

  } else if (recordData.status === "checked_in") {
    // 체크아웃
    const expectedMinutes = parseTimeToMinutes(recordData.expectedDepartureTime);
    const isEarlyLeave = currentMinutes < expectedMinutes - 30;  // 30분 전 조퇴

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

  } else if (recordData.status === "checked_out") {
    // 🆕 재입실 처리 (외부 수업 후 복귀 등)
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

**핵심 변경사항**:
1. ❌ 새 레코드 생성 로직 제거
2. ✅ 현재 시간 기준 슬롯 검색 로직 추가
3. ✅ `scheduled` → `checked_in` → `checked_out` 상태 전환
4. 🆕 `checked_out` → `checked_in` 재입실 처리 추가 (외부 수업 복귀)
5. ✅ 슬롯별 지각/조퇴 계산

#### 3.2 `manualCheckIn/Out` 수정

동일한 로직 적용:
- 사전 생성된 레코드 찾기
- 상태 업데이트

---

### Phase 4: 자동 결석 처리

#### 4.1 결석 처리 배치

```typescript
/**
 * 매시간 실행: 시작 시간이 지난 scheduled 상태를 not_arrived로 변경
 */
export const markAbsentRecords = onSchedule({
  schedule: "0 * * * *",  // 매시 정각
  timeZone: "Asia/Seoul",
  region: "asia-northeast3"
}, async (event) => {
  const db = admin.firestore();
  const today = getTodayInKorea();
  const currentMinutes = getCurrentKoreaMinutes();

  // 모든 사용자 순회
  const usersSnapshot = await db.collection("users").get();

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

    const batch = db.batch();

    for (const doc of scheduledRecords.docs) {
      const record = doc.data();
      const slotEndMinutes = parseTimeToMinutes(record.expectedDepartureTime);

      // 수업 종료 시간이 지났으면 not_arrived 처리
      if (currentMinutes > slotEndMinutes + 30) {  // 30분 유예
        batch.update(doc.ref, {
          status: "not_arrived",
          updatedAt: admin.firestore.Timestamp.now()
        });
      }
    }

    if (scheduledRecords.docs.length > 0) {
      await batch.commit();
      logger.info(`[결석 처리] userId=${userId}: ${scheduledRecords.docs.length}건`);
    }
  }
});
```

---

### Phase 5: 데이터 마이그레이션 및 호환성

#### 5.1 기존 데이터 유지

**전략**: 신규 필드만 추가, 기존 레코드는 유지
- `timetableId`, `timeSlotId` 등이 없는 레코드는 "레거시" 취급
- 기존 세션 기반 레코드는 조회 시 필터링 가능

#### 5.2 점진적 전환

1. **Phase 1~2 배포**: 신규 레코드만 슬롯 기반으로 생성
2. **1주일 병행 운영**: 기존 PIN 체크 로직 유지, 신규 레코드만 사전 생성
3. **Phase 3 배포**: PIN 체크 로직 전환
4. **모니터링**: 2주간 오류 감시
5. **Phase 4 배포**: 자동 결석 처리 활성화

---

## 예상 효과

### ✅ 장점

1. **명확한 출석 추적**: 어떤 수업에 빠졌는지 슬롯 단위로 파악
2. **자동화**: 배치 작업으로 결석 자동 처리
3. **확장성**: 복잡한 시간표도 유연하게 처리
4. **외부 일정 분리**: `type: "external"` 슬롯 제외

### ⚠️ 주의사항

1. **비용 증가**: Firestore 읽기/쓰기 증가 (슬롯당 1개 문서)
2. **배치 실행 시간**: 학생 수 많으면 처리 시간 증가
3. **시간표 변경**: 이미 생성된 오늘 레코드는 반영 안 됨 (다음날부터 반영)
4. **재입실 처리**: 같은 슬롯 내 여러 번 입/퇴실 시 최초/최종 시간만 기록, 중간 시간은 notes에만 기록

---

## 대안: 간소화 버전

**슬롯 기반이 과도하다면**, 중간 단계로 다음 방식 고려:

### 하이브리드 방식
1. **하루 1개 레코드 유지** (현재 구조)
2. **배치로 사전 생성**: `status: "scheduled"` 상태로 하루 전체 레코드 생성
3. **PIN 체크 시**: 기존 로직 유지, `scheduled` → `checked_in` 업데이트
4. **결석 처리**: 하원 시간 지나면 `scheduled` → `not_arrived`

**장점**: 구조 변경 최소화, 빠른 도입
**단점**: 수업별 출석 추적 불가, 외부 일정 구분 어려움

---

## 구현 우선순위

### 1단계 (필수)
- [ ] `student_attendance_records` 타입 확장
- [ ] 배치 작업 구현 (사전 생성)
- [ ] 배치 스케줄러 설정

### 2단계 (핵심)
- [ ] `checkAttendanceByPin` 로직 수정
- [ ] `manualCheckIn/Out` 로직 수정
- [ ] 테스트 및 검증

### 3단계 (자동화)
- [ ] 자동 결석 처리 배치
- [ ] 모니터링 대시보드 구축

### 4단계 (최적화)
- [ ] 배치 작업 성능 최적화
- [ ] 에러 처리 강화
- [ ] 로깅 및 알림 시스템

---

## 참고사항

### 관련 파일
- `functions/src/modules/personal/studentAttendanceManagement.ts`: 출석 체크 로직
- `functions/src/modules/personal/seatManagement.ts`: 좌석 배정 (expectedSchedule 캐싱)
- `functions/src/modules/personal/studentTimetableManagement.ts`: 시간표 관리
- `functions/src/utils/timeUtils.ts`: 시간 유틸리티
- `functions/src/types/index.ts`: 타입 정의

### 테스트 시나리오
1. ✅ 수업 시간 정확히 체크인/아웃
2. ✅ 지각 (10분 초과)
3. ✅ 조퇴 (30분 전)
4. ✅ 미등원 (수업 종료 후에도 scheduled)
5. ✅ 외부 일정 (레코드 미생성)
6. ✅ 시간표 없는 학생 (스킵)
7. ✅ 비활성 요일 (스킵)
8. 🆕 외부 수업 후 재입실 (checked_out → checked_in)
9. 🆕 같은 슬롯 내 여러 번 재입실 (notes에 기록)

---

## 🆕 재입실 처리 상세 설계

### 시나리오: 외부 수업으로 인한 일시 외출 후 복귀

```typescript
// 시간표 구조
09:00-11:00 자습 (슬롯1, type: "self_study")
11:00-13:00 외부 수업 (슬롯2, type: "external") ← 레코드 미생성
13:00-20:00 자습 (슬롯3, type: "self_study")

// 배치 작업 결과 (새벽 2시)
recordId1: { timeSlotId: "slot1", status: "scheduled", expectedArrivalTime: "09:00", expectedDepartureTime: "11:00" }
recordId3: { timeSlotId: "slot3", status: "scheduled", expectedArrivalTime: "13:00", expectedDepartureTime: "20:00" }

// 학생 행동 및 시스템 처리
08:55 PIN 입력
→ 슬롯1 매칭 (09:00-11:00)
→ recordId1: status = "checked_in", actualArrivalTime = 08:55

11:00 PIN 입력 (외부 수업 출발)
→ 슬롯1 매칭 (09:00-11:00)
→ recordId1: status = "checked_out", actualDepartureTime = 11:00

13:00 PIN 입력 (외부 수업 복귀)
→ 슬롯3 매칭 (13:00-20:00) ← 다른 슬롯!
→ recordId3: status = "checked_in", actualArrivalTime = 13:00

20:00 PIN 입력 (하원)
→ 슬롯3 매칭 (13:00-20:00)
→ recordId3: status = "checked_out", actualDepartureTime = 20:00
```

### 출결 관리 결과

```typescript
// 최종 레코드 상태
[
  {
    id: "recordId1",
    timeSlotSubject: "자습",
    timeSlotType: "self_study",
    expectedArrivalTime: "09:00",
    expectedDepartureTime: "11:00",
    actualArrivalTime: "08:55",
    actualDepartureTime: "11:00",
    status: "checked_out",
    isLate: false,
    isEarlyLeave: false
  },
  {
    id: "recordId3",
    timeSlotSubject: "자습",
    timeSlotType: "self_study",
    expectedArrivalTime: "13:00",
    expectedDepartureTime: "20:00",
    actualArrivalTime: "13:00",
    actualDepartureTime: "20:00",
    status: "checked_out",
    isLate: false,
    isEarlyLeave: false
  }
]

// 관리자 보기
✅ 오전 자습 (09:00-11:00): 정상 출석
✅ 오후 자습 (13:00-20:00): 정상 출석
📝 외부 수업 (11:00-13:00): 출석 의무 없음 (레코드 없음)

결론: 지각/조퇴 없음
```

### 시나리오 2: 같은 슬롯 내 여러 번 재입실

```typescript
// 시간표
13:00-20:00 자습 (슬롯1, type: "self_study")

// 학생 행동
13:00 PIN 입력 → status = "checked_in", actualArrivalTime = 13:00
15:00 PIN 입력 → status = "checked_out", actualDepartureTime = 15:00 (간식)
15:30 PIN 입력 → status = "checked_in", notes = "재입실: 15:30" ✨
17:00 PIN 입력 → status = "checked_out", actualDepartureTime = 17:00 (저녁)
17:30 PIN 입력 → status = "checked_in", notes = "재입실: 15:30\n재입실: 17:30" ✨
20:00 PIN 입력 → status = "checked_out", actualDepartureTime = 20:00

// 최종 레코드
{
  actualArrivalTime: "13:00",  // 최초 입실
  actualDepartureTime: "20:00",  // 최종 퇴실
  status: "checked_out",
  notes: "재입실: 15:30\n재입실: 17:30",
  isLate: false,
  isEarlyLeave: false
}
```

**판단**:
- ✅ 출결 관리 목적: 최초 등원(13:00), 최종 하원(20:00) 기록 OK
- ✅ 지각/조퇴 판단: 정확한 계산 가능
- ⚠️ 중간 시간: notes에만 기록 (상세 추적은 안 됨)
- ✅ 외부 수업 전/후: 자동으로 다른 슬롯 처리

---

## 구현 체크리스트

### Phase 1: 데이터 구조 (2일)
- [ ] Backend Types 수정
  - [ ] `StudentAttendanceRecord` 타입 확장
  - [ ] `status`에 `"scheduled"` 추가
  - [ ] `timetableId`, `timeSlotId`, `timeSlotSubject`, `timeSlotType` 추가
- [ ] Frontend Types 동기화
  - [ ] `frontend/src/types/attendance.ts` 업데이트
  - [ ] 기존 컴포넌트 타입 에러 확인

### Phase 2: 배치 작업 (5일)
- [ ] Cloud Function 생성
  - [ ] `functions/src/scheduled/createDailyAttendanceRecords.ts` 작성
  - [ ] Cloud Scheduler 설정 (매일 02:00 Asia/Seoul)
- [ ] 배치 로직 구현
  - [ ] 활성 좌석 배정 조회
  - [ ] 시간표 detailedSchedule 조회
  - [ ] 출석 의무 슬롯 필터링 (`type === "class" | "self_study"`)
  - [ ] 슬롯별 레코드 생성 (`status: "scheduled"`)
- [ ] 최적화
  - [ ] 병렬 처리 (사용자별 Promise.all)
  - [ ] 배치 쓰기 (500개 제한)
  - [ ] 에러 핸들링 (일부 실패해도 계속 진행)
  - [ ] 로깅 (성공/실패 건수)

### Phase 3: PIN 체크 로직 (3일)
- [ ] `checkAttendanceByPin` 수정
  - [ ] 슬롯 검색 로직 (현재 시간 ±30분)
  - [ ] `scheduled` → `checked_in` 처리
  - [ ] `checked_in` → `checked_out` 처리
  - [ ] 🆕 `checked_out` → `checked_in` 재입실 처리
  - [ ] notes에 재입실 시간 기록
- [ ] `manualCheckIn` 수정
  - [ ] 슬롯 기반 체크인 로직
- [ ] `manualCheckOut` 수정
  - [ ] 슬롯 기반 체크아웃 로직

### Phase 4: 자동 결석 처리 (2일)
- [ ] Cloud Function 생성
  - [ ] `functions/src/scheduled/markAbsentRecords.ts` 작성
  - [ ] Cloud Scheduler 설정 (매시 정각)
- [ ] 결석 처리 로직
  - [ ] `status === "scheduled"` 레코드 조회
  - [ ] 수업 종료 시간 확인 (expectedDepartureTime + 30분 유예)
  - [ ] `scheduled` → `not_arrived` 업데이트

### Phase 5: 점진적 전환 (2주)
- [ ] Phase 1~2 배포 (신규 레코드만 사전 생성)
- [ ] 1주일 모니터링
  - [ ] 배치 작업 로그 확인
  - [ ] 레코드 생성 현황 확인
  - [ ] 비용 모니터링
- [ ] Phase 3 배포 (PIN 체크 로직 전환)
- [ ] 1주일 모니터링
  - [ ] 재입실 처리 확인
  - [ ] 슬롯 매칭 정확도 확인
- [ ] Phase 4 배포 (자동 결석 처리)
- [ ] 최종 검증
