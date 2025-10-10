# 출석 관리 시스템 Frontend-Backend 통합 계획서

## 문서 개요

본 문서는 실제 코드 분석을 기반으로 작성된 출석 관리 시스템의 Frontend-Backend 통합 계획서입니다.

**작성일**: 2025-01-XX
**분석 대상**:
- Backend: `functions/src/modules/personal/studentAttendanceManagement.ts`
- Backend: `functions/src/modules/personal/seatManagement.ts`
- Frontend: `frontend/src/services/attendanceService.ts`
- Frontend: `frontend/src/hooks/useAttendanceQueries.ts`

---

## 1. 현재 상태 분석

### 1.1 Backend 구현 현황 (✅ 완료된 Functions)

#### PIN 관리 Functions
| Function 이름 | 입력 | 출력 | 상태 |
|---------------|------|------|------|
| `generateStudentPin` | `{ studentId, pin }` | `{ success, message, data }` | ✅ 구현 완료 |
| `updateStudentPin` | `{ studentId, newPin }` | `{ success, message }` | ✅ 구현 완료 |
| `unlockStudentPin` | `{ studentId }` | `{ success, message }` | ✅ 구현 완료 |

**특징**:
- bcrypt로 PIN 해싱
- PIN 중복 검증
- 실패 횟수 추적 및 자동 잠금
- 변경 이력 관리 (최근 3개)

#### 출석 체크 링크 Functions
| Function 이름 | 입력 | 출력 | 상태 |
|---------------|------|------|------|
| `createAttendanceCheckLink` | `{ seatLayoutId, title, description, expiresInDays }` | `{ success, message, data }` | ✅ 구현 완료 |
| `getAttendanceCheckLinks` | `{}` | `{ success, data: [links] }` | ✅ 구현 완료 |
| `checkAttendanceByPin` | `{ linkToken, pin }` | `{ success, message, action, data }` | ✅ 구현 완료 |

**특징**:
- UUID 기반 링크 토큰
- 만료 시간 관리
- 사용 횟수 추적
- PIN 검증 및 출석 체크 통합

#### 출석 기록 Functions
| Function 이름 | 입력 | 출력 | 상태 |
|---------------|------|------|------|
| `getStudentAttendanceRecords` | `{ studentId?, startDate?, endDate?, limit }` | `{ success, data: [records] }` | ✅ 구현 완료 |
| `updateAttendanceStatus` | `{ recordId, status, excusedReason?, excusedNote? }` | `{ success, message }` | ✅ 구현 완료 |

**특징**:
- 날짜별 필터링
- 상태 변경 (checked_in, checked_out, absent_excused 등)
- 사유결석 처리

#### 좌석 관리 Functions
| Function 이름 | 입력 | 출력 | 상태 |
|---------------|------|------|------|
| `assignSeat` | `{ seatId, studentId, timetableId?, seatLayoutId }` | `{ success, message, data }` | ✅ 구현 완료 |

**특징**:
- 학생 시간표 자동 검증
- 예정 등/하원 시간 캐싱
- groups 기반 배치도 검증

### 1.2 추가 구현 완료된 Functions (✅ 이미 존재)

계획서 작성 후 추가 확인 결과, 다음 함수들도 이미 구현되어 있음:

**좌석 관리 Functions (seatManagement.ts)**:
| Function 이름 | 상태 | 위치 |
|---------------|------|------|
| `getSeatLayouts` | ✅ 구현 완료 | line 531 |
| `createSeatLayout` | ✅ 구현 완료 | line 424 |
| `getCurrentSeatAssignment` | ✅ 구현 완료 | line 565 |
| `unassignSeat` | ✅ 구현 완료 | line 350 |
| `validateStudentTimetableForSeat` | ✅ 구현 완료 | line 620 |

**특징**:
- `createSeatLayout`: groups 필드 검증 포함 (출석용 배치도 전용)
- `getCurrentSeatAssignment`: seatLayoutId로 필터링, 학생 정보 캐싱
- `validateStudentTimetableForSeat`: 활성 시간표 검증 및 요일별 시간 확인

### 1.3 Backend 미구현 Functions (❌ 필요)

**실제로 구현 필요한 함수들**:

| Function 이름 | 필요성 | 우선순위 | 호출 위치 | 비고 |
|---------------|--------|----------|----------|------|
| `getSeatAssignments` | 특정 배치도의 좌석 할당 목록 조회 | 🔴 높음 | attendanceService.ts:103 | getCurrentSeatAssignment는 단일 할당만 반환 |
| `getTodayAttendanceRecords` | 오늘 출석 기록 조회 | 🔴 높음 | attendanceService.ts:255 | 또는 기존 함수 재사용 가능 |
| `deactivateAttendanceCheckLink` | 링크 비활성화 | 🔴 높음 | attendanceService.ts:391 | |
| `getAttendanceRecord` | 출석 기록 상세 조회 | 🟡 중간 | attendanceService.ts:275 | |
| `getStudentPin` | 학생 PIN 정보 조회 | 🟡 중간 | attendanceService.ts:233 | |
| `deleteSeatLayout` | 배치도 삭제 | 🟡 중간 | attendanceService.ts:83 | |
| `manualCheckIn` | 수동 체크인 | 🟢 낮음 (선택) | attendanceService.ts:313 | |
| `manualCheckOut` | 수동 체크아웃 | 🟢 낮음 (선택) | attendanceService.ts:331 | |

**⚠️ 주요 발견 사항**:
1. **`getCurrentSeatAssignment`의 한계**: 기존 함수는 seatLayoutId를 받지 않고 사용자의 단일 활성 할당만 반환합니다. 출석 시스템에서는 특정 배치도의 **모든 학생 할당**이 필요하므로 `getSeatAssignments` 함수가 추가로 필요합니다.
2. **`getTodayAttendanceRecords` 최적화 가능**: 기존 `getStudentAttendanceRecords`가 날짜 필터링을 지원하므로, 별도 함수 구현 대신 프론트엔드에서 재사용하는 방법도 고려 가능합니다.

### 1.4 Frontend 구현 현황

**서비스 레이어** (`attendanceService.ts`):
- ✅ 모든 Backend Function 호출 로직 구현
- ✅ 타입 변환 (Timestamp → Date)
- ✅ 에러 처리

**React Query Hooks** (`useAttendanceQueries.ts`):
- ✅ Query hooks: `useSeatLayouts`, `useSeatAssignments`, `useTodayAttendanceRecords`, etc.
- ✅ Mutation hooks: `useAssignSeat`, `useUpdateAttendanceStatus`, etc.
- ✅ 자동 캐싱 및 refetching

**UI 컴포넌트**:
- ✅ Phase 4~6 모든 컴포넌트 구현 완료

---

## 2. 통합 작업 계획

### Phase 1: 누락된 Backend Functions 구현 (우선순위 🔴)

**⚠️ 주의**: getSeatLayouts, createSeatLayout, getCurrentSeatAssignment, unassignSeat, validateStudentTimetableForSeat는 **이미 구현 완료**되어 있으므로 아래 함수들만 구현하면 됩니다.

#### 1.1 좌석 할당 관리 Functions (🔴 높음)

```typescript
// 📁 functions/src/modules/personal/seatManagement.ts

/**
 * 특정 배치도의 좌석 할당 목록 조회
 *
 * ⚠️ getCurrentSeatAssignment는 사용자의 단일 할당만 반환하므로
 * 출석 시스템에서는 이 함수가 필요함
 */
export const getSeatAssignments = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { seatLayoutId } = data;

  if (!seatLayoutId) {
    throw new functions.https.HttpsError("invalid-argument", "seatLayoutId가 필요합니다.");
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
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});
```

#### 1.2 출석 기록 관리 Functions (🔴 높음)

```typescript
// 📁 functions/src/modules/personal/studentAttendanceManagement.ts

/**
 * 오늘 출석 기록 조회 (특정 좌석 배치도)
 *
 * 💡 대안: 프론트엔드에서 getStudentAttendanceRecords({ seatLayoutId, startDate: today, endDate: today })로
 * 기존 함수를 재사용하는 것도 가능. 하지만 편의성을 위해 전용 함수 제공
 */
export const getTodayAttendanceRecords = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { seatLayoutId } = data;

  if (!seatLayoutId) {
    throw new functions.https.HttpsError("invalid-argument", "seatLayoutId가 필요합니다.");
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
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});

/**
 * 출석 기록 상세 조회
 */
export const getAttendanceRecord = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { recordId } = data;

  if (!recordId) {
    throw new functions.https.HttpsError("invalid-argument", "recordId가 필요합니다.");
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
      throw new functions.https.HttpsError("not-found", "출석 기록을 찾을 수 없습니다.");
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
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});
```

#### 1.3 PIN 관리 Functions (🟡 중간)

```typescript
/**
 * 학생 PIN 정보 조회
 */
export const getStudentPin = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { studentId } = data;

  if (!studentId) {
    throw new functions.https.HttpsError("invalid-argument", "studentId가 필요합니다.");
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
    const { pinHash, ...safeData } = pinData;

    return {
      success: true,
      data: {
        id: pinDoc.id,
        ...safeData
      }
    };
  } catch (error) {
    console.error("PIN 조회 오류:", error);
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});
```

#### 1.4 출석 체크 링크 Functions (🔴 높음)

```typescript
/**
 * 출석 체크 링크 비활성화
 */
export const deactivateAttendanceCheckLink = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { linkId } = data;

  if (!linkId) {
    throw new functions.https.HttpsError("invalid-argument", "linkId가 필요합니다.");
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
      throw new functions.https.HttpsError("not-found", "출석 체크 링크를 찾을 수 없습니다.");
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
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});
```

#### 1.5 좌석 배치도 관리 Functions (🟡 중간)

```typescript
// 📁 functions/src/modules/personal/seatManagement.ts

/**
 * 좌석 배치도 삭제
 */
export const deleteSeatLayout = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { seatLayoutId } = data;

  if (!seatLayoutId) {
    throw new functions.https.HttpsError("invalid-argument", "seatLayoutId가 필요합니다.");
  }

  try {
    const db = admin.firestore();

    // 1. 활성 할당이 있는지 확인
    const activeAssignments = await db
      .collection("users")
      .doc(userId)
      .collection("seat_assignments")
      .where("seatLayoutId", "==", seatLayoutId)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (!activeAssignments.empty) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "활성 좌석 할당이 있는 배치도는 삭제할 수 없습니다. 먼저 모든 좌석 할당을 해제하세요."
      );
    }

    // 2. 배치도 삭제
    await db
      .collection("users")
      .doc(userId)
      .collection("seat_layouts")
      .doc(seatLayoutId)
      .delete();

    return {
      success: true,
      message: "좌석 배치도가 삭제되었습니다."
    };
  } catch (error) {
    console.error("좌석 배치도 삭제 오류:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
  }
});
```

---

### Phase 2: 수동 체크인/체크아웃 Functions 구현 (우선순위 🟢)

```typescript
/**
 * 수동 체크인 (관리자)
 */
export const manualCheckIn = functions.https.onCall(async (data: any, context: any) => {
  // 구현 필요
  // checkAttendanceByPin 로직과 유사
  // checkInMethod: 'manual' 또는 'admin'
});

/**
 * 수동 체크아웃 (관리자)
 */
export const manualCheckOut = functions.https.onCall(async (data: any, context: any) => {
  // 구현 필요
  // checkOutMethod: 'manual' 또는 'admin'
});
```

---

## 3. Frontend 수정 사항

### 3.1 수정 필요 없음 ✅

Frontend의 `attendanceService.ts`와 `useAttendanceQueries.ts`는 **이미 모든 Backend Function 호출을 구현**했습니다. Backend Functions만 추가되면 즉시 작동합니다.

### 3.2 타입 정의 검증

**Frontend 타입** (`frontend/src/types/attendance.ts`):
```typescript
// 이미 Backend와 일치하는 타입 정의 완료
export interface SeatLayout { ... }
export interface SeatAssignment { ... }
export interface StudentAttendanceRecord { ... }
export interface AttendanceCheckLink { ... }
export interface AttendanceStudentPin { ... }
```

**Backend 타입** (`functions/src/modules/personal/studentAttendanceManagement.ts`):
```typescript
interface StudentAttendanceRecord { ... }
interface AttendanceCheckLink { ... }
interface AttendanceStudentPin { ... }
```

✅ **검증 결과**: 타입 구조 일치

---

## 4. 데이터베이스 구조 확인

### 4.1 Firestore Collections

```
users/{userId}/
  ├── seat_layouts/{layoutId}          ← 배치도
  ├── seat_assignments/{assignmentId}  ← 좌석 할당
  ├── student_attendance_records/{recordId}  ← 출석 기록
  ├── attendance_check_links/{linkId}  ← 출석 체크 링크
  ├── attendance_student_pins/{studentId}  ← 학생 PIN
  ├── students/{studentId}             ← 학생 정보
  └── student_timetables/{timetableId} ← 학생 시간표
```

### 4.2 필수 인덱스 (Firestore Indexes)

```json
{
  "indexes": [
    {
      "collectionGroup": "seat_assignments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "seatLayoutId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "student_attendance_records",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "seatLayoutId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "attendance_check_links",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "linkToken", "order": "ASCENDING" },
        { "fieldPath": "isActive", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## 5. 통합 작업 순서

### Step 1: Backend Functions 구현 상태 확인

**✅ 이미 구현 완료** (구현 불필요):
1. ✅ `getSeatLayouts` - seatManagement.ts:531
2. ✅ `createSeatLayout` - seatManagement.ts:424
3. ✅ `getCurrentSeatAssignment` - seatManagement.ts:565
4. ✅ `unassignSeat` - seatManagement.ts:350
5. ✅ `assignSeat` - seatManagement.ts:159
6. ✅ `validateStudentTimetableForSeat` - seatManagement.ts:620
7. ✅ `generateStudentPin` - studentAttendanceManagement.ts:124
8. ✅ `updateStudentPin` - studentAttendanceManagement.ts:218
9. ✅ `unlockStudentPin` - studentAttendanceManagement.ts:306
10. ✅ `createAttendanceCheckLink` - studentAttendanceManagement.ts:355
11. ✅ `getAttendanceCheckLinks` - studentAttendanceManagement.ts:440
12. ✅ `checkAttendanceByPin` - studentAttendanceManagement.ts:474
13. ✅ `getStudentAttendanceRecords` - studentAttendanceManagement.ts:709
14. ✅ `updateAttendanceStatus` - studentAttendanceManagement.ts:756

**❌ 구현 필요** (총 6개):
1. ❌ `getSeatAssignments` (🔴 높음) - 약 1시간
2. ❌ `getTodayAttendanceRecords` (🔴 높음) - 약 1시간
3. ❌ `getAttendanceRecord` (🟡 중간) - 약 30분
4. ❌ `getStudentPin` (🟡 중간) - 약 30분
5. ❌ `deactivateAttendanceCheckLink` (🔴 높음) - 약 30분
6. ❌ `deleteSeatLayout` (🟡 중간) - 약 1시간
7. ⚠️ `manualCheckIn` (🟢 낮음, 선택) - 약 2시간
8. ⚠️ `manualCheckOut` (🟢 낮음, 선택) - 약 2시간

**예상 소요 시간**:
- 필수 (1-6번): 약 5시간
- 선택 (7-8번): 약 4시간

### Step 2: Functions Export 확인

**현재 상태**: `functions/src/modules/personal/index.ts`에서 이미 모든 파일을 `export *`로 내보내고 있음:
```typescript
export * from "./seatManagement";
export * from "./studentAttendanceManagement";
```

**✅ 추가 작업 불필요**: 새로운 함수들을 각 파일에 추가하면 자동으로 export됨

### Step 3: Firebase Indexes 설정
1. `firestore.indexes.json` 파일 업데이트
2. `firebase deploy --only firestore:indexes`

### Step 4: Backend 배포 및 테스트
```bash
cd functions
npm run build
firebase deploy --only functions
```

**테스트 체크리스트** (신규 함수만):
- [ ] getSeatAssignments로 특정 배치도의 할당 목록 조회
- [ ] getTodayAttendanceRecords 호출 성공
- [ ] getAttendanceRecord로 기록 상세 조회
- [ ] getStudentPin으로 PIN 정보 조회
- [ ] deactivateAttendanceCheckLink로 링크 비활성화
- [ ] deleteSeatLayout로 배치도 삭제 (활성 할당 없을 때)

### Step 5: Frontend 통합 테스트 (1일)
1. Frontend 빌드 및 실행
2. 전체 시나리오 테스트:
   - 배치도 생성 → 학생 할당 → PIN 생성 → 출석 체크 링크 생성 → QR 코드 스캔 → 출석 확인

---

## 6. 알려진 이슈 및 개선 사항

### 6.1 Frontend TODO 항목

**AssignSeatModal.tsx** (61-66줄):
```typescript
// TODO: 시간표 검증 로직 추가
// const student = students.find(s => s.id === selectedStudentId);
// if (!student.activeTimetable) {
//   setError('해당 학생에게 활성 시간표가 없습니다. 먼저 시간표를 생성해주세요.');
//   return;
// }
```

**해결 방법**:
- `validateStudentTimetableForSeat` Function 구현 후 주석 해제
- `attendanceService.assignSeat()`에서 자동 호출됨

### 6.2 Backend 개선 사항

1. **에러 메시지 한국어화** ✅ (이미 완료)
2. **PIN 검증 병렬 처리** ✅ (이미 완료, 519-531줄)
3. **캐싱 필드 자동 업데이트**:
   - 학생 이름 변경 시 `seat_assignments.studentName` 업데이트 (선택사항)

### 6.3 보안 고려사항

1. **PIN 해싱**: ✅ bcrypt 사용 (이미 완료)
2. **PIN 중복 방지**: ✅ 구현 완료
3. **링크 토큰**: ✅ UUID 사용
4. **데이터 격리**: ✅ userId 기반 격리 (이미 완료)

---

## 7. 예상 일정 (수정됨)

**⚠️ 주요 변경사항**: 대부분의 함수가 이미 구현되어 있어 일정이 대폭 단축됨

| 작업 | 소요 시간 | 담당 |
|------|----------|------|
| 누락된 Backend Functions 구현 (6개) | 0.5-1일 (5시간) | Backend 개발자 |
| (선택) manualCheckIn/Out 구현 | 0.5일 (4시간) | Backend 개발자 |
| Functions Export 확인 | 불필요 (자동) | - |
| Firestore Indexes 설정 | 0.5일 | Backend 개발자 |
| Backend 배포 및 테스트 | 0.5일 | Backend/QA |
| Frontend 통합 테스트 | 0.5일 | Frontend/QA |
| 버그 수정 및 최적화 | 0.5-1일 | 전체 팀 |
| **총 예상 시간** | **2.5-3.5일** (선택 포함 시 3.5-4.5일) | |

---

## 8. 성공 기준

### 8.1 기능 완성도
- [ ] 배치도 생성/조회/삭제
- [ ] 학생 좌석 할당/해제
- [ ] PIN 생성/변경/잠금해제
- [ ] 출석 체크 링크 생성/비활성화
- [ ] QR 코드로 출석 체크
- [ ] 출석 기록 조회 및 상태 변경

### 8.2 성능
- [ ] 좌석 배치도 렌더링 < 1초 (100개 좌석 기준)
- [ ] PIN 검증 < 500ms
- [ ] 출석 기록 조회 < 300ms

### 8.3 안정성
- [ ] 에러 발생 시 사용자 친화적 메시지 표시
- [ ] 네트워크 오류 시 자동 재시도 (React Query 기본 기능)
- [ ] 중복 요청 방지

---

## 9. 참고 자료

- **데이터베이스 설계**: `ATTENDANCE_DATABASE_DESIGN.md`
- **Frontend 구현 계획**: `ATTENDANCE_FRONTEND_IMPLEMENTATION_PLAN.md`
- **Backend 코드**: `functions/src/modules/personal/studentAttendanceManagement.ts`
- **Frontend 서비스**: `frontend/src/services/attendanceService.ts`

---

## 10. 작업 체크리스트 (수정됨)

### Backend 구현 (실제 필요한 함수만)

**✅ 이미 완료됨** (구현 불필요):
- [x] getSeatLayouts
- [x] createSeatLayout
- [x] getCurrentSeatAssignment
- [x] unassignSeat
- [x] validateStudentTimetableForSeat
- [x] assignSeat
- [x] generateStudentPin
- [x] updateStudentPin
- [x] unlockStudentPin
- [x] createAttendanceCheckLink
- [x] getAttendanceCheckLinks
- [x] checkAttendanceByPin
- [x] getStudentAttendanceRecords
- [x] updateAttendanceStatus

**❌ 구현 필요**:
- [ ] getSeatAssignments (🔴 높음) - getCurrentSeatAssignment는 단일 할당만 반환
- [ ] getTodayAttendanceRecords (🔴 높음)
- [ ] deactivateAttendanceCheckLink (🔴 높음)
- [ ] getAttendanceRecord (🟡 중간)
- [ ] getStudentPin (🟡 중간)
- [ ] deleteSeatLayout (🟡 중간)
- [ ] manualCheckIn (🟢 선택)
- [ ] manualCheckOut (🟢 선택)

### 배포 및 설정
- [ ] functions/src/modules/personal/index.ts 확인 (이미 export * 사용 중)
- [ ] firestore.indexes.json 업데이트 (필요시)
- [ ] firebase deploy --only functions
- [ ] firebase deploy --only firestore:indexes (필요시)

### 테스트
- [ ] 신규 Backend Functions 단위 테스트 (6개)
- [ ] Frontend-Backend 통합 테스트
- [ ] 전체 시나리오 테스트

---

**문서 버전**: 2.1 (피드백 반영)
**최초 작성일**: 2025-01-XX
**최종 수정일**: 2025-01-XX (실제 코드 재검증 후 수정)
**작성자**: Claude Code

## 주요 변경 이력

### v2.1 (2025-01-XX) - 피드백 반영
- **getCurrentSeatAssignment 한계 발견**: 단일 할당만 반환하므로 getSeatAssignments 함수 추가 필요
- getSeatAssignments 함수를 Phase 1.1에 추가 (특정 배치도의 모든 할당 조회)
- getTodayAttendanceRecords에 대안 제시 (기존 함수 재사용 가능하지만 편의성을 위해 전용 함수 유지)
- 구현 필요한 함수 5개 → 6개로 조정
- 예상 일정 2-3일 → 2.5-3.5일로 소폭 조정

### v2.0 (2025-01-XX)
- 실제 백엔드 코드 재검증 완료
- 이미 구현된 함수 14개 확인 (getSeatLayouts, createSeatLayout, getCurrentSeatAssignment, unassignSeat, validateStudentTimetableForSeat, assignSeat, generateStudentPin, updateStudentPin, unlockStudentPin, createAttendanceCheckLink, getAttendanceCheckLinks, checkAttendanceByPin, getStudentAttendanceRecords, updateAttendanceStatus)
- 실제 구현 필요한 함수 5개로 축소 (getTodayAttendanceRecords, deactivateAttendanceCheckLink, getAttendanceRecord, getStudentPin, deleteSeatLayout)
- 예상 일정 6-8일 → 2-3일로 단축
- Phase 1 구현 계획 업데이트 (실제 코드 예시 포함)

### v1.0 (2025-01-XX)
- 초기 작성
- 백엔드/프론트엔드 코드 분석
- 통합 계획 수립
