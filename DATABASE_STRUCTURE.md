# 데이터베이스 구조 (Firestore)

> 이 문서는 백엔드 코드를 직접 분석하여 작성된 실제 DB 구조 문서입니다.

## 개요

- **데이터베이스**: Firebase Firestore
- **아키텍처**: 사용자 기반 데이터 격리 (User-based Data Isolation)
- **인증**: Firebase Authentication (Google OAuth)
- **지역**: asia-northeast3

## 핵심 설계 원칙

1. **완전한 데이터 격리**: 각 사용자는 `/users/{userId}` 하위에 독립적인 데이터 공간을 가집니다
2. **보안**: 모든 Cloud Functions는 `request.auth.uid`를 검증하여 사용자 본인의 데이터만 접근 가능
3. **확장성**: 사용자별 독립 컬렉션으로 무제한 확장 가능
4. **슬롯 기반 출석**: 학생별 시간표의 각 슬롯마다 개별 출석 레코드 생성

---

## 컬렉션 계층 구조

```
Firestore
│
├── users (Root Collection)
│   ├── {userId} (Document)
│   │   ├── authUid: string
│   │   ├── name: string
│   │   ├── email: string
│   │   ├── profilePicture?: string
│   │   ├── googleId: string
│   │   ├── isActive: boolean
│   │   ├── createdAt: Timestamp
│   │   └── updatedAt: Timestamp
│   │
│   └── {userId}/
│       │
│       ├── students/ (학생 정보)
│       ├── student_timetables/ (학생별 시간표)
│       ├── attendance_records/ (관리자 출석 - 자가 체크인/아웃)
│       ├── student_attendance_records/ (학생 출석 기록)
│       ├── attendance_student_pins/ (학생 PIN 정보)
│       ├── attendance_check_links/ (출석 체크 링크)
│       ├── shared_schedules/ (시간표 공유 링크)
│       ├── schedule_contributions/ (외부 기여 내역)
│       ├── seats/ (좌석 정보)
│       ├── seat_assignments/ (좌석 할당)
│       ├── seat_layouts/ (좌석 배치도)
│       ├── class_sections/ (학급 정보)
│       ├── attendance_summaries/ (출석 통계)
│       └── settings/ (사용자 설정)
│
└── pin_attempt_logs (Root Collection - Rate Limiting용)
    └── {attemptId}
        ├── linkToken: string
        ├── success: boolean
        ├── studentId?: string
        ├── timestamp: Timestamp
        └── expiresAt: Timestamp (TTL: 24시간)
```

---

## 상세 컬렉션 스키마

### 1. `users/{userId}` (사용자 프로필)

**경로**: `/users/{userId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `authUid` | string | Firebase Auth UID |
| `name` | string | 사용자 이름 |
| `email` | string | 이메일 |
| `profilePicture` | string? | 프로필 사진 URL |
| `googleId` | string | Google OAuth ID |
| `isActive` | boolean | 활성 상태 |
| `createdAt` | Timestamp | 생성 시간 |
| `updatedAt` | Timestamp | 수정 시간 |
| `deactivatedAt` | Timestamp? | 비활성화 시간 (소프트 삭제) |
| `restoredAt` | Timestamp? | 복구 시간 |

**관련 Functions**:
- `createOrUpdateUserProfile`: 프로필 생성/수정
- `getUserProfile`: 프로필 조회
- `deactivateUserProfile`: 계정 비활성화
- `deleteUserProfile`: 계정 완전 삭제 (하위 컬렉션 포함)
- `restoreUserProfile`: 계정 복구
- `getUserDataStats`: 데이터 통계 조회
- `createUserDataBackup`: 데이터 백업 생성

---

### 2. `users/{userId}/students` (학생 정보)

**경로**: `/users/{userId}/students/{studentId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 학생 ID (문서 ID와 동일) |
| `userId` | string | 소유 사용자 ID |
| `name` | string | 학생 이름 |
| `email` | string | 이메일 |
| `grade` | string | 학년 (초1~고3) |
| `school` | string? | 학교 |
| `phone` | string? | 전화번호 (010-0000-0000) |
| `parentName` | string? | 보호자 이름 |
| `parentPhone` | string? | 보호자 전화번호 |
| `address` | string? | 주소 |
| `status` | "active" \| "withdrawn" | 상태 |
| `enrollmentDate` | Timestamp | 등록일 |
| `withdrawalDate` | Timestamp? | 퇴원일 |
| `isActive` | boolean | 활성 상태 (하위 호환성) |
| `createdAt` | Timestamp | 생성 시간 |
| `updatedAt` | Timestamp | 수정 시간 |

**관련 Functions**:
- `createStudent`: 학생 생성 (시간표 + PIN 자동 생성)
- `getStudents`: 학생 목록 조회
- `getStudent`: 특정 학생 조회
- `updateStudent`: 학생 정보 수정
- `deleteStudent`: 학생 삭제 (관련 데이터 일괄 삭제)
- `searchStudents`: 학생 검색 (이름/이메일)
- `getStudentsWithTimetables`: 학생 + 시간표 통합 조회
- `getStudentWithTimetable`: 특정 학생 + 시간표 조회

**삭제 시 연쇄 삭제 대상**:
- `student_timetables`: 해당 학생의 모든 시간표
- `seat_assignments`: 해당 학생의 좌석 할당
- `student_attendance_records`: 해당 학생의 출석 기록
- `attendance_student_pins`: 해당 학생의 PIN

---

### 3. `users/{userId}/student_timetables` (학생별 시간표)

**경로**: `/users/{userId}/student_timetables/{timetableId}`

#### 기본 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 시간표 ID |
| `userId` | string | 소유 사용자 ID |
| `studentId` | string | 학생 ID |
| `studentName` | string | 학생 이름 (캐싱) |
| `name` | string | 시간표 이름 |
| `description` | string? | 설명 |
| `isActive` | boolean | 활성 시간표 여부 |
| `isDefault` | boolean | 기본 시간표 여부 |
| `createdAt` | Timestamp | 생성 시간 |
| `updatedAt` | Timestamp | 수정 시간 |

#### basicSchedule (1차 레이어: 등/하원 기본 틀)

```typescript
basicSchedule: {
  dailySchedules: {
    monday: {
      arrivalTime: string,      // "09:00"
      departureTime: string,    // "18:00"
      isActive: boolean         // 해당 요일 활성화 여부
    },
    tuesday: { ... },
    wednesday: { ... },
    thursday: { ... },
    friday: { ... },
    saturday: { ... },
    sunday: { ... }
  },
  timeSlotInterval: number      // 시간 간격 (분 단위, 최소 15분)
}
```

#### detailedSchedule (2차 레이어: 구체적인 일정)

```typescript
detailedSchedule: {
  [dayOfWeek: string]: {
    timeSlots: [
      {
        id?: string,
        startTime: string,                           // "09:00"
        endTime: string,                             // "10:00"
        subject: string,                             // "수학"
        type: "class" | "self_study" | "external",  // 슬롯 타입
        isAutoGenerated: boolean,                    // 자동 생성 여부
        color?: string,                              // 색상 코드
        teacher?: string,                            // 교사명
        location?: string,                           // 장소
        notes?: string                               // 메모
      }
    ]
  }
}
```

**슬롯 타입**:
- `class`: 수업 (출석 체크 대상 ✓)
- `self_study`: 자습 (출석 체크 대상 ✓)
- `external`: 외부 활동 (출석 체크 대상 ✗)

#### autoFillSettings (자동 채우기 설정)

```typescript
autoFillSettings: {
  enabled: boolean,           // 자동 채우기 활성화
  defaultSubject: string,     // 기본 과목 ("자습")
  fillEmptySlots: boolean     // 빈 슬롯 채우기
}
```

**관련 Functions**:
- `createStudentTimetable`: 시간표 생성
- `getStudentTimetables`: 학생별 시간표 목록
- `updateStudentTimetable`: 시간표 수정
- `deleteStudentTimetable`: 시간표 삭제 (연쇄 삭제)
- `setActiveStudentTimetable`: 활성 시간표 설정
- `autoFillStudentTimetable`: 자동 자습시간 채우기
- `updateTimeSlot`: 개별 슬롯 수정
- `deleteTimeSlot`: 개별 슬롯 삭제
- `duplicateStudentTimetable`: 시간표 복제
- `updateBasicSchedule`: 기본 스케줄 수정

**삭제 시 연쇄 삭제 대상**:
- `seat_assignments.timetableId`: 좌석 할당의 시간표 참조 제거
- `shared_schedules`: 해당 시간표의 공유 링크
- `schedule_contributions`: 해당 시간표의 기여 내역

---

### 4. `users/{userId}/student_attendance_records` (학생 출석 기록)

**경로**: `/users/{userId}/student_attendance_records/{recordId}`

**recordId 형식**: `{studentId}_{YYYYMMDD}_slot{N}_{timestamp}`
- 예: `student123_20250131_slot1_1706745600000`

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 레코드 ID |
| `userId` | string | 소유 사용자 ID |
| `studentId` | string | 학생 ID |
| `studentName` | string | 학생 이름 (캐싱) |
| `seatLayoutId` | string | 좌석 배치도 ID |
| `seatId` | string | 좌석 ID |
| `seatNumber` | string | 좌석 번호 (캐싱) |
| `date` | string | 날짜 (YYYY-MM-DD) |
| `dayOfWeek` | DayOfWeek | 요일 |
| **시간표 슬롯 정보** | | |
| `timetableId` | string? | 시간표 ID |
| `timeSlotId` | string? | 슬롯 ID |
| `timeSlotSubject` | string? | 과목명 |
| `timeSlotType` | "class" \| "self_study" \| "external"? | 슬롯 타입 |
| **시간 정보** | | |
| `expectedArrivalTime` | string | 예정 등원 시간 (HH:mm) |
| `expectedDepartureTime` | string | 예정 하원 시간 (HH:mm) |
| `actualArrivalTime` | Timestamp? | 실제 등원 시간 |
| `actualDepartureTime` | Timestamp? | 실제 하원 시간 |
| **상태 추적** | | |
| `status` | StudentAttendanceStatus | 출석 상태 (6가지) |
| `notArrivedAt` | Timestamp? | 미등원 확정 시간 |
| `absentConfirmedAt` | Timestamp? | 결석 확정 시간 |
| `absentMarkedAt` | Timestamp? | 배치 처리 시간 |
| **사유결석** | | |
| `excusedReason` | string? | 결석 사유 |
| `excusedNote` | string? | 결석 메모 |
| `excusedBy` | string? | 처리자 ID |
| **지각/조퇴** | | |
| `isLate` | boolean | 지각 여부 |
| `isEarlyLeave` | boolean | 조퇴 여부 |
| `lateMinutes` | number? | 지각 시간 (분) |
| `earlyLeaveMinutes` | number? | 조퇴 시간 (분) |
| **체크 방법** | | |
| `checkInMethod` | "pin" \| "manual" \| "admin"? | 등원 체크 방법 |
| `checkOutMethod` | "pin" \| "manual" \| "admin"? | 하원 체크 방법 |
| **세션 정보** | | |
| `sessionNumber` | number | 당일 세션 번호 (1, 2, 3...) |
| `isLatestSession` | boolean | 최신 세션 여부 |
| `notes` | string? | 메모 |
| `createdAt` | Timestamp | 생성 시간 |
| `updatedAt` | Timestamp | 수정 시간 |
| `recordTimestamp` | Timestamp | 레코드 타임스탬프 |

#### 출석 상태 (StudentAttendanceStatus)

| 상태 | 설명 | 전환 가능 상태 |
|------|------|----------------|
| `scheduled` | 예정 (배치 작업으로 사전 생성) | → `checked_in`, `not_arrived` |
| `checked_in` | 등원 완료 | → `checked_out` |
| `checked_out` | 하원 완료 | → `checked_in` (재입실) |
| `not_arrived` | 미등원 (수업 시작 시간 지남) | → `checked_in`, `absent_unexcused` |
| `absent_excused` | 사유결석 | - |
| `absent_unexcused` | 무단결석 (유예 기간 종료) | - |

#### 상태 전환 흐름

```
scheduled (02:00 배치 생성)
    ↓
    ├─ (체크인) → checked_in
    │                 ↓
    │              (체크아웃) → checked_out
    │                              ↓
    │                           (재입실) → checked_in
    │
    └─ (수업 시작) → not_arrived
                        ↓
                        ├─ (유예 기간 내 체크인) → checked_in
                        └─ (유예 기간 종료) → absent_unexcused
```

**관련 Functions**:
- `checkAttendanceByPin`: PIN으로 출석/하원 체크 (학생 자가 체크)
- `getStudentAttendanceRecords`: 출석 기록 조회
- `updateAttendanceStatus`: 출석 상태 수동 변경 (관리자)
- `getTodayAttendanceRecords`: 오늘 출석 기록 조회
- `getAttendanceRecord`: 출석 기록 상세 조회
- `manualCheckIn`: 수동 체크인 (관리자)
- `manualCheckOut`: 수동 체크아웃 (관리자)
- `markStudentAbsent`: 학생 결석 처리 (관리자)

**Scheduled Functions** (자동 배치 작업):
- `createDailyAttendanceRecords`: 매일 02:00 실행 - `scheduled` 레코드 생성
- `markNotArrivedAtStartTime`: 30분마다 실행 (09:00-23:00) - `scheduled` → `not_arrived`
- `markAbsentUnexcused`: 10분마다 실행 - `not_arrived` → `absent_unexcused` (유예 기간 종료)

---

### 5. `users/{userId}/attendance_student_pins` (학생 PIN)

**경로**: `/users/{userId}/attendance_student_pins/{studentId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 학생 ID (문서 ID와 동일) |
| `userId` | string | 소유 사용자 ID |
| `studentId` | string | 학생 ID |
| `studentName` | string | 학생 이름 |
| `pinHash` | string | bcrypt 해시값 (10 rounds) |
| `actualPin` | string | 실제 PIN (관리자 확인용) |
| `isActive` | boolean | 활성 상태 |
| `isLocked` | boolean | 잠금 상태 (5회 실패 시) |
| `failedAttempts` | number | 실패 시도 횟수 |
| `lastFailedAt` | Timestamp? | 마지막 실패 시간 |
| `lastChangedAt` | Timestamp | 마지막 변경 시간 |
| `lastUsedAt` | Timestamp? | 마지막 사용 시간 |
| `changeHistory` | Array? | 변경 이력 (최대 3개) |
| `createdAt` | Timestamp | 생성 시간 |
| `updatedAt` | Timestamp | 수정 시간 |

**PIN 규칙**:
- 4-6자리 숫자
- 중복 불가 (같은 사용자 내)
- 자동 생성 시 100000~999999 범위

**보안**:
- bcrypt 해싱 (10 rounds)
- 5회 실패 시 자동 잠금
- Rate Limiting (5분 내 20회 실패 시 임시 차단)

**관련 Functions**:
- `generateStudentPin`: PIN 생성 (자동 중복 체크)
- `updateStudentPin`: PIN 변경
- `unlockStudentPin`: PIN 잠금 해제
- `getStudentPin`: PIN 정보 조회 (해시 제외)

---

### 6. `users/{userId}/attendance_check_links` (출석 체크 링크)

**경로**: `/users/{userId}/attendance_check_links/{linkId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 링크 ID |
| `userId` | string | 소유 사용자 ID |
| `linkToken` | string | UUID 토큰 |
| `linkUrl` | string | 전체 URL |
| `seatLayoutId` | string | 좌석 배치도 ID |
| `seatLayoutName` | string | 좌석 배치도 이름 (캐싱) |
| `title` | string | 링크 제목 |
| `description` | string? | 설명 |
| `isActive` | boolean | 활성 상태 |
| `expiresAt` | Timestamp? | 만료 시간 |
| `usageCount` | number | 사용 횟수 |
| `createdAt` | Timestamp | 생성 시간 |
| `updatedAt` | Timestamp | 수정 시간 |

**URL 형식**: `https://{baseUrl}/attendance/check/{linkToken}`

**관련 Functions**:
- `createAttendanceCheckLink`: 링크 생성
- `getAttendanceCheckLinks`: 링크 목록 조회
- `deactivateAttendanceCheckLink`: 링크 비활성화
- `activateAttendanceCheckLink`: 링크 활성화
- `deleteAttendanceCheckLink`: 링크 삭제

---

### 7. `pin_attempt_logs` (PIN 시도 로그 - Root Collection)

**경로**: `/pin_attempt_logs/{attemptId}`

**목적**: Rate Limiting 및 의심스러운 활동 추적

| 필드 | 타입 | 설명 |
|------|------|------|
| `linkToken` | string | 출석 체크 링크 토큰 |
| `success` | boolean | PIN 검증 성공 여부 |
| `studentId` | string? | 학생 ID (성공 시만 기록) |
| `timestamp` | Timestamp | 시도 시간 |
| `expiresAt` | Timestamp | TTL (24시간 후 자동 삭제) |

**인덱스** (필수):
- `linkToken` (ASC) → `success` (ASC) → `timestamp` (DESC)

**Rate Limiting 규칙**:
- 5분 내 20회 이상 실패 시 임시 차단

---

### 8. `users/{userId}/seat_layouts` (좌석 배치도)

**경로**: `/users/{userId}/seat_layouts/{layoutId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `name` | string | 배치도 이름 |
| `layout` | object | 좌석 배치 정보 |
| `createdAt` | Timestamp | 생성 시간 |
| `updatedAt` | Timestamp | 수정 시간 |

#### layout 구조 (출석용 배치도)

```typescript
layout: {
  // 좌석 그룹 (출석용)
  groups?: [
    {
      id: string,              // 그룹 ID
      name: string,            // 그룹 이름
      rows: number,            // 행 수
      cols: number,            // 열 수
      position: { x: number, y: number }
    }
  ],

  // 좌석 정보
  seats: [
    {
      id: string,              // 좌석 ID
      position: { x: number, y: number },
      size: { width: number, height: number },

      // 출석용 추가 필드
      groupId?: string,        // 그룹 ID
      row?: number,            // 행 번호
      col?: number,            // 열 번호
      label?: string           // 좌석 라벨
    }
  ],

  // 배치도 크기
  dimensions: {
    width: number,
    height: number
  }
}
```

**검증 규칙**:
- 출석용 배치도는 `groups` 필수
- 각 좌석의 `groupId`, `row`, `col` 필수
- `row`, `col`은 그룹 범위 내여야 함

**관련 Functions**:
- `createSeatLayout`: 배치도 생성 (groups 검증)
- `getSeatLayouts`: 배치도 목록 조회
- `updateSeatLayout`: 배치도 수정
- `deleteSeatLayout`: 배치도 삭제 (연쇄 삭제)

**삭제 시 연쇄 삭제 대상**:
- `seat_assignments`: 해당 배치도의 모든 좌석 할당
- `student_attendance_records`: 해당 배치도의 출석 기록
- `attendance_check_links`: 해당 배치도의 출석 체크 링크

---

### 9. `users/{userId}/seat_assignments` (좌석 할당)

**경로**: `/users/{userId}/seat_assignments/{assignmentId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `seatId` | string | 좌석 ID |
| `assignedAt` | Timestamp | 할당 시간 |
| `expiresAt` | Timestamp? | 만료 시간 |
| `status` | AssignmentStatus | 할당 상태 |
| `updatedAt` | Timestamp | 수정 시간 |
| **출석 시스템용 확장 필드** | | |
| `studentId` | string? | 학생 ID |
| `studentName` | string? | 학생 이름 (캐싱) |
| `seatNumber` | string? | 좌석 번호 (캐싱) |
| `timetableId` | string? | 시간표 ID |
| `seatLayoutId` | string? | 좌석 배치도 ID |
| `expectedSchedule` | object? | 예정 등/하원 시간 캐싱 |

#### AssignmentStatus

| 상태 | 설명 |
|------|------|
| `active` | 활성 할당 |
| `expired` | 만료 |
| `cancelled` | 취소 |

#### expectedSchedule 구조

```typescript
expectedSchedule: {
  [dayOfWeek: string]: {
    arrivalTime: string,      // "09:00"
    departureTime: string,    // "18:00"
    isActive: boolean         // 해당 요일 활성화 여부
  }
}
```

**관련 Functions**:
- `assignSeat`: 좌석 할당 (시간표 캐싱 + 당일 출석 레코드 자동 생성)
- `unassignSeat`: 좌석 할당 해제
- `getCurrentSeatAssignment`: 현재 좌석 할당 조회
- `getSeatAssignments`: 특정 배치도의 좌석 할당 목록
- `validateStudentTimetableForSeat`: 좌석 할당 전 시간표 검증

**자동 동작**:
- `assignSeat` 실행 시 오늘 남은 수업의 출석 레코드 즉시 생성 (새벽 2시 이후 등록 학생 대응)

---

### 10. `users/{userId}/seats` (좌석 정보)

**경로**: `/users/{userId}/seats/{seatId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `seatNumber` | string | 좌석 번호 |
| `location` | object | 좌석 위치 `{x, y}` |
| `status` | SeatStatus | 좌석 상태 |
| `createdAt` | Timestamp | 생성 시간 |
| `updatedAt` | Timestamp | 수정 시간 |

#### SeatStatus

| 상태 | 설명 |
|------|------|
| `available` | 사용 가능 |
| `occupied` | 사용 중 |
| `maintenance` | 정비 중 |

**관련 Functions**:
- `createSeat`: 좌석 생성
- `getSeats`: 좌석 목록 조회

---

### 11. `users/{userId}/shared_schedules` (시간표 공유 링크)

**경로**: `/users/{userId}/shared_schedules/{shareId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `shareToken` | string | UUID 공유 토큰 |
| `timetableId` | string | 시간표 ID |
| `title` | string? | 링크 제목 |
| `description` | string? | 설명 |
| `permissions` | object | 기본 권한 |
| `editPermissions` | object? | 확장 편집 권한 |
| `accessSettings` | object | 접근 설정 |
| `linkSettings` | object | 링크 설정 |
| `createdAt` | Timestamp | 생성 시간 |
| `updatedAt` | Timestamp | 수정 시간 |

#### permissions

```typescript
permissions: {
  canEdit: boolean,
  canView: boolean,
  canComment: boolean
}
```

#### editPermissions (확장 편집 권한)

```typescript
editPermissions: {
  // detailedSchedule 권한
  canAddSlots: boolean,
  canDeleteSlots: boolean,
  canModifySlots: boolean,
  restrictedTimeSlots?: string[],

  // basicSchedule 권한
  canEditBasicSchedule?: boolean,
  canEditDailySchedules?: boolean,
  canEditTimeSlotInterval?: boolean,

  // 요일별 세부 권한
  dailySchedulePermissions?: {
    [dayOfWeek: string]: {
      canEditArrivalTime: boolean,
      canEditDepartureTime: boolean,
      canToggleActive: boolean
    }
  },

  timeSlotIntervalOptions?: number[]
}
```

#### accessSettings

```typescript
accessSettings: {
  requireName: boolean,
  requireEmail: boolean,
  maxContributions?: number
}
```

#### linkSettings

```typescript
linkSettings: {
  isActive: boolean,
  expiresAt?: Timestamp,
  createdAt: Timestamp,
  lastUsedAt?: Timestamp,
  usageCount: number
}
```

**관련 Functions**:
- `createStudentTimetableEditLink`: 시간표 편집 링크 생성 (고유성 보장)

---

### 12. `users/{userId}/schedule_contributions` (외부 기여 내역)

**경로**: `/users/{userId}/schedule_contributions/{contributionId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `shareToken` | string | 공유 토큰 |
| `timetableId` | string | 시간표 ID |
| `contributor` | object | 기여자 정보 |
| `contributions` | array | 기여 내용 |
| `status` | ContributionStatus | 기여 상태 |
| `appliedAt` | Timestamp? | 적용 시간 |
| `submittedAt` | Timestamp | 제출 시간 |
| `processedAt` | Timestamp? | 처리 시간 |
| `processedBy` | string? | 처리자 ID |

#### contributor

```typescript
contributor: {
  name?: string,
  email?: string,
  ipAddress: string
}
```

#### contributions

```typescript
contributions: [
  {
    dayOfWeek: string,
    timeSlots: [
      {
        startTime: string,
        endTime: string,
        subject: string,
        type: "class" | "self_study",
        color?: string,
        note?: string
      }
    ]
  }
]
```

#### ContributionStatus

| 상태 | 설명 |
|------|------|
| `pending` | 대기 중 |
| `approved` | 승인됨 |
| `rejected` | 거부됨 |
| `applied` | 적용됨 |

---

### 13. `users/{userId}/attendance_records` (관리자 출석)

**경로**: `/users/{userId}/attendance_records/{date}`

**문서 ID**: YYYY-MM-DD 형식의 날짜

**용도**: 관리자(사용자) 본인의 자가 체크인/아웃 기록 (학생 출석과 별도)

| 필드 | 타입 | 설명 |
|------|------|------|
| `date` | string | 날짜 (YYYY-MM-DD) |
| `status` | AttendanceStatus | 출석 상태 |
| `seatId` | string? | 좌석 ID |
| `checkInTime` | Timestamp? | 체크인 시간 |
| `checkOutTime` | Timestamp? | 체크아웃 시간 |
| `notes` | string? | 메모 |
| `createdAt` | Timestamp | 생성 시간 |
| `updatedAt` | Timestamp | 수정 시간 |

#### AttendanceStatus

| 상태 | 설명 |
|------|------|
| `present` | 출석 |
| `absent` | 결석 |
| `late` | 지각 |
| `early_leave` | 조퇴 |

**관련 Functions**:
- `checkIn`: 체크인
- `checkOut`: 체크아웃
- `getAttendanceRecords`: 출석 기록 조회
- `updateAttendanceSummary`: 출석 통계 생성/업데이트

---

### 14. `users/{userId}/attendance_summaries` (출석 통계)

**경로**: `/users/{userId}/attendance_summaries/{period}`

**문서 ID**: YYYY-MM 형식의 기간

| 필드 | 타입 | 설명 |
|------|------|------|
| `period` | string | 기간 (YYYY-MM) |
| `totalDays` | number | 총 일수 |
| `presentDays` | number | 출석 일수 |
| `absentDays` | number | 결석 일수 |
| `lateDays` | number | 지각 일수 |
| `earlyLeaveDays` | number | 조퇴 일수 |
| `attendanceRate` | number | 출석률 (%) |
| `createdAt` | Timestamp | 생성 시간 |
| `updatedAt` | Timestamp | 수정 시간 |

**관련 Functions**:
- `updateAttendanceSummary`: 통계 생성/업데이트

---

### 15. `users/{userId}/class_sections` (학급 정보)

**경로**: `/users/{userId}/class_sections/{sectionId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `name` | string | 학급명 |
| `description` | string? | 설명 |
| `schedule` | object | 수업 시간 |
| `createdAt` | Timestamp | 생성 시간 |
| `updatedAt` | Timestamp | 수정 시간 |

#### schedule

```typescript
schedule: {
  startTime: string,
  endTime: string,
  daysOfWeek: number[]  // 0(일)~6(토)
}
```

---

### 16. `users/{userId}/settings` (사용자 설정)

**경로**: `/users/{userId}/settings/{settingId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `notifications` | object | 알림 설정 |
| `preferences` | object | 환경 설정 |
| `createdAt` | Timestamp | 생성 시간 |
| `updatedAt` | Timestamp | 수정 시간 |

#### notifications

```typescript
notifications: {
  attendance: boolean,
  schedule: boolean,
  announcements: boolean
}
```

#### preferences

```typescript
preferences: {
  theme: "light" | "dark",
  language: string
}
```

---

## Scheduled Functions (자동 배치 작업)

### 1. `createDailyAttendanceRecords`

- **실행 시간**: 매일 02:00 (Asia/Seoul)
- **목적**: 오늘 출석 레코드 사전 생성
- **동작**:
  1. 모든 사용자의 활성 좌석 배정 조회
  2. 각 학생의 시간표에서 오늘 출석 의무 슬롯 추출 (`class`, `self_study`만)
  3. 슬롯별로 `scheduled` 상태의 출석 레코드 생성

**참고**: [createDailyAttendanceRecords.ts](functions/src/scheduled/createDailyAttendanceRecords.ts:1-182)

### 2. `markNotArrivedAtStartTime`

- **실행 시간**: 30분마다 (09:00-23:00, Asia/Seoul)
- **목적**: 수업 시작 시간 지난 `scheduled` 레코드를 `not_arrived`로 변경
- **동작**:
  1. 오늘 날짜의 `scheduled` 상태 레코드 조회
  2. 현재 시간이 `expectedArrivalTime`을 지났는지 확인
  3. 지났으면 `not_arrived` 상태로 변경

**참고**: [markNotArrivedAtStartTime.ts](functions/src/scheduled/markNotArrivedAtStartTime.ts)

### 3. `markAbsentUnexcused`

- **실행 시간**: 10분마다 (Asia/Seoul)
- **목적**: 유예 기간 종료된 `not_arrived` 레코드를 `absent_unexcused`로 변경
- **동작**:
  1. 오늘 날짜의 `not_arrived` 상태 레코드 조회
  2. 유예 기간(수업 시작 후 30분) 경과 여부 확인
  3. 경과했으면 `absent_unexcused` 상태로 변경

**참고**: [markAbsentUnexcused.ts](functions/src/scheduled/markAbsentUnexcused.ts)

---

## Firestore Triggers

### 1. `onTimetableUpdate`

- **트리거**: `users/{userId}/student_timetables/{timetableId}` 업데이트 시
- **목적**: 좌석 할당의 시간표 캐시 자동 동기화
- **동작**:
  1. 시간표가 업데이트되면 자동 실행
  2. 해당 시간표를 참조하는 모든 좌석 할당의 `expectedSchedule` 캐시 업데이트

**참고**: [onTimetableUpdate.ts](functions/src/triggers/onTimetableUpdate.ts)

---

## 인덱스 요구사항

### 복합 인덱스

1. **pin_attempt_logs**
   - `linkToken` (ASC) → `success` (ASC) → `timestamp` (DESC)
   - 용도: Rate Limiting 조회

2. **student_attendance_records**
   - `studentId` (ASC) → `date` (ASC) → `recordTimestamp` (DESC)
   - 용도: 학생별 출석 기록 조회

   - `seatLayoutId` (ASC) → `date` (ASC) → `recordTimestamp` (DESC)
   - 용도: 배치도별 출석 기록 조회

   - `studentId` (ASC) → `date` (ASC) → `status` (ASC)
   - 용도: 학생별 특정 상태 레코드 조회

3. **seat_assignments**
   - `seatLayoutId` (ASC) → `status` (ASC) → `assignedAt` (DESC)
   - 용도: 배치도별 활성 좌석 할당 조회

   - `studentId` (ASC) → `seatLayoutId` (ASC) → `status` (ASC)
   - 용도: 학생별 특정 배치도 할당 조회

4. **student_timetables**
   - `studentId` (ASC) → `isActive` (ASC) → `createdAt` (DESC)
   - 용도: 학생별 활성 시간표 조회

5. **students**
   - `email` (ASC) → `isActive` (ASC)
   - 용도: 이메일 중복 확인

6. **attendance_student_pins**
   - `actualPin` (ASC) → `isActive` (ASC)
   - 용도: PIN 중복 확인

---

## 보안 규칙 (Firestore Security Rules)

모든 데이터는 사용자 기반 격리 원칙을 따릅니다:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 사용자별 데이터 접근 제한
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // pin_attempt_logs는 Cloud Functions에서만 접근
    match /pin_attempt_logs/{attemptId} {
      allow read, write: if false;
    }

    // 공유 링크 조회 (토큰 기반)
    match /users/{userId}/shared_schedules/{shareId} {
      allow read: if resource.data.linkSettings.isActive == true;
    }

    match /users/{userId}/attendance_check_links/{linkId} {
      allow read: if resource.data.isActive == true;
    }
  }
}
```

---

## 타입 정의 요약

### DayOfWeek

```typescript
type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday"
               | "friday" | "saturday" | "sunday";
```

### StudentAttendanceStatus

```typescript
type StudentAttendanceStatus =
  | "scheduled"          // 예정
  | "checked_in"         // 등원
  | "checked_out"        // 하원
  | "not_arrived"        // 미등원
  | "absent_excused"     // 사유결석
  | "absent_unexcused";  // 무단결석
```

### TimeSlotType

```typescript
type TimeSlotType = "class" | "self_study" | "external";
```

### AssignmentStatus

```typescript
type AssignmentStatus = "active" | "expired" | "cancelled";
```

### SeatStatus

```typescript
type SeatStatus = "available" | "occupied" | "maintenance";
```

### ContributionStatus

```typescript
type ContributionStatus = "pending" | "approved" | "rejected" | "applied";
```

---

## 주요 비즈니스 로직

### 1. 학생 생성 플로우

1. `createStudent` 호출
2. 학생 문서 생성
3. 기본 시간표 자동 생성 (월-금 09:00-18:00)
4. 6자리 PIN 자동 생성 (중복 체크 10회 시도)
5. 실패 시 전체 롤백 (학생 + 시간표 삭제)

### 2. 좌석 할당 플로우

1. `assignSeat` 호출
2. 좌석 배치도 검증 (groups 필수)
3. 학생 시간표 조회 및 검증
4. 좌석 할당 생성 + 시간표 캐싱
5. **당일 출석 레코드 즉시 생성** (오늘 남은 수업만)

### 3. 출석 체크 플로우 (PIN 기반)

1. `checkAttendanceByPin` 호출 (linkToken + PIN)
2. Rate Limiting 체크 (5분 20회 제한)
3. 링크 토큰 검증 (활성 + 만료 확인)
4. PIN 검증 (bcrypt 비교, 병렬 처리)
5. 좌석 할당 확인
6. 현재 시간에 해당하는 슬롯 찾기 (±30분 이내)
7. 상태 전환 (scheduled/not_arrived → checked_in → checked_out)
8. 트랜잭션으로 동시성 제어

### 4. 출석 자동 배치 플로우

**02:00 - 레코드 생성**:
- 모든 사용자의 활성 좌석 할당 조회
- 각 학생의 오늘 수업 슬롯 추출 (`class`, `self_study`)
- `scheduled` 상태 레코드 생성

**30분마다 - 미등원 마킹**:
- `scheduled` 레코드 중 수업 시작 시간 지난 것 조회
- `not_arrived` 상태로 변경

**10분마다 - 무단결석 확정**:
- `not_arrived` 레코드 중 유예 기간(30분) 지난 것 조회
- `absent_unexcused` 상태로 변경

---

## 데이터 흐름 다이어그램

### 학생 등록 → 출석 체크

```
[사용자]
  ↓
createStudent
  ├─ students/{studentId}
  ├─ student_timetables/{timetableId} (자동 생성)
  └─ attendance_student_pins/{studentId} (자동 생성)

  ↓
assignSeat
  ├─ seat_assignments/{assignmentId}
  │   └─ expectedSchedule 캐싱
  └─ student_attendance_records/* (당일 레코드 즉시 생성)

  ↓ (매일 02:00)
createDailyAttendanceRecords (Scheduled)
  └─ student_attendance_records/* (scheduled)

  ↓ (30분마다)
markNotArrivedAtStartTime (Scheduled)
  └─ scheduled → not_arrived

  ↓ (학생 PIN 입력)
checkAttendanceByPin
  └─ not_arrived/scheduled → checked_in → checked_out

  ↓ (10분마다)
markAbsentUnexcused (Scheduled)
  └─ not_arrived → absent_unexcused
```

---

## 참고 문서

- `CLAUDE.md`: 프로젝트 전체 개요 및 개발 가이드
- `DATABASE_DESIGN.md`: 기존 데이터베이스 설계 문서
- `ATTENDANCE_IMPLEMENTATION_STATUS.md`: 출석 시스템 구현 상태
- `ATTENDANCE_SLOT_IMPLEMENTATION_PLAN.md`: 슬롯 기반 출석 시스템 설계
- `EVENT_BASE_ATTENDANCE_PLAN.md`: 향후 이벤트 기반 출석 시스템 계획

---

## 주의사항

1. **트랜잭션 사용**: 동시성 제어가 필요한 작업은 반드시 트랜잭션 사용
2. **배치 제한**: Firestore 배치는 500개 문서까지만 가능
3. **인덱스 필수**: 복합 쿼리는 사전에 인덱스 생성 필요
4. **TTL**: `pin_attempt_logs`는 24시간 후 자동 삭제
5. **캐싱**: 자주 조회되는 데이터는 관련 문서에 캐싱 (성능 최적화)
6. **보안**: 모든 Functions는 `request.auth.uid` 검증 필수

---

**작성일**: 2025-01-19
**백엔드 코드 기준**: `/functions/src/**/*.ts`
