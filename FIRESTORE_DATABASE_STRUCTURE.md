# Firestore Database Structure

이 문서는 학습실 관리 시스템의 Firestore 데이터베이스 구조를 상세히 설명합니다.

## 목차

- [아키텍처 개요](#아키텍처-개요)
- [데이터베이스 구조](#데이터베이스-구조)
- [컬렉션 상세](#컬렉션-상세)
  - [1. users (Root Collection)](#1-users-root-collection)
  - [2. students](#2-students)
  - [3. student_timetables](#3-student_timetables)
  - [4. attendance_records (관리자 자가 출석)](#4-attendance_records-관리자-자가-출석)
  - [5. student_attendance_records (학생 출석)](#5-student_attendance_records-학생-출석)
  - [6. attendance_check_links](#6-attendance_check_links)
  - [7. attendance_student_pins](#7-attendance_student_pins)
  - [8. shared_schedules](#8-shared_schedules)
  - [9. schedule_contributions](#9-schedule_contributions)
  - [10. seats](#10-seats)
  - [11. seat_assignments](#11-seat_assignments)
  - [12. seat_layouts](#12-seat_layouts)
  - [13. class_sections](#13-class_sections)
  - [14. attendance_summaries](#14-attendance_summaries)
  - [15. settings](#15-settings)
  - [16. pin_attempt_logs (Global Collection)](#16-pin_attempt_logs-global-collection)
- [인덱스 전략](#인덱스-전략)

---

## 아키텍처 개요

### 사용자 기반 데이터 격리 (User-Based Data Isolation)

이 시스템은 **완전한 사용자별 데이터 격리** 아키텍처를 따릅니다:

- 모든 데이터는 `/users/{userId}/` 하위에 저장됨
- Firebase Auth의 `request.auth.uid`로 사용자 식별
- 각 사용자는 자신의 데이터에만 접근 가능
- Custom Claims 불필요 (직접 UID 매칭)

```
Firestore
├── users (Root Collection)
│   ├── {userId} (Document)
│   │   ├── students (Subcollection)
│   │   ├── student_timetables (Subcollection)
│   │   ├── attendance_records (Subcollection)
│   │   ├── student_attendance_records (Subcollection)
│   │   ├── attendance_check_links (Subcollection)
│   │   ├── attendance_student_pins (Subcollection)
│   │   ├── shared_schedules (Subcollection)
│   │   ├── schedule_contributions (Subcollection)
│   │   ├── seats (Subcollection)
│   │   ├── seat_assignments (Subcollection)
│   │   ├── seat_layouts (Subcollection)
│   │   ├── class_sections (Subcollection)
│   │   ├── attendance_summaries (Subcollection)
│   │   └── settings (Subcollection)
│   └── ...
└── pin_attempt_logs (Global Collection, TTL 24시간)
```

---

## 데이터베이스 구조

### 컬렉션 경로 규칙

- **사용자별 컬렉션**: `/users/{userId}/{collectionName}`
- **전역 컬렉션**: `/{collectionName}` (예: `pin_attempt_logs`)

---

## 컬렉션 상세

### 1. users (Root Collection)

**경로**: `/users`
**Document ID**: Firebase Auth UID

사용자 프로필 정보를 저장하는 루트 컬렉션입니다.

#### 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `authUid` | string | ✅ | Firebase Auth UID (문서 ID와 동일) |
| `name` | string | ✅ | 사용자 이름 |
| `email` | string | ✅ | 이메일 주소 |
| `profilePicture` | string | ❌ | 프로필 이미지 URL |
| `googleId` | string | ✅ | Google 계정 ID |
| `isActive` | boolean | ✅ | 계정 활성화 상태 |
| `deactivatedAt` | Timestamp | ❌ | 비활성화 시간 (계정 비활성화 시) |
| `createdAt` | Timestamp | ✅ | 생성 시간 |
| `updatedAt` | Timestamp | ✅ | 최종 수정 시간 |

#### 인덱스

- `email` (ASC)
- `isActive` (ASC) + `createdAt` (DESC)

---

### 2. students

**경로**: `/users/{userId}/students`
**Document ID**: Auto-generated

학생 정보를 관리하는 컬렉션입니다.

#### 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | ✅ | 문서 ID와 동일 |
| `userId` | string | ✅ | 소유자 UID |
| `name` | string | ✅ | 학생 이름 |
| `email` | string | ✅ | 학생 이메일 |
| `grade` | string | ✅ | 학년 (예: "중1", "고2") |
| `school` | string | ❌ | 학교명 |
| `phone` | string | ❌ | 전화번호 (010-0000-0000) |
| `parentName` | string | ❌ | 보호자 이름 |
| `parentPhone` | string | ❌ | 보호자 전화번호 |
| `address` | string | ❌ | 주소 |
| `status` | string | ✅ | "active" \| "withdrawn" |
| `enrollmentDate` | Timestamp | ✅ | 등록일 |
| `withdrawalDate` | Timestamp | ❌ | 퇴원일 (status=withdrawn일 때) |
| `isActive` | boolean | ✅ | 활성 상태 (하위 호환성) |
| `createdAt` | Timestamp | ✅ | 생성 시간 |
| `updatedAt` | Timestamp | ✅ | 최종 수정 시간 |

#### 인덱스

- `email` (ASC) + `isActive` (ASC)
- `name` (ASC) + `isActive` (ASC)
- `isActive` (ASC) + `createdAt` (DESC)

#### 생성 시 자동 처리

학생 생성 시 다음이 자동으로 생성됩니다:
1. **기본 시간표** (`student_timetables` 컬렉션)
2. **6자리 랜덤 PIN** (`attendance_student_pins` 컬렉션)

실패 시 트랜잭션 롤백됩니다.

---

### 3. student_timetables

**경로**: `/users/{userId}/student_timetables`
**Document ID**: Auto-generated

학생별 시간표 데이터를 저장하는 컬렉션입니다. **2계층 구조**를 사용합니다.

#### 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | ✅ | 문서 ID와 동일 |
| `userId` | string | ✅ | 소유자 UID |
| `studentId` | string | ✅ | 학생 ID |
| `studentName` | string | ✅ | 학생 이름 (캐싱) |
| `name` | string | ✅ | 시간표 이름 |
| `description` | string | ❌ | 시간표 설명 |
| `basicSchedule` | Object | ✅ | **1차 레이어**: 기본 일정 (등원/하원 시간) |
| `detailedSchedule` | Object | ✅ | **2차 레이어**: 상세 일정 (수업별 시간표) |
| `autoFillSettings` | Object | ✅ | 자동 채우기 설정 |
| `version` | string | ❌ | 버전 관리 (UUID, 동시성 제어용, 현재 미사용) |
| `lastUpdatedAt` | Timestamp | ❌ | 최종 수정 시간 (현재 미사용) |
| `lastUpdatedBy` | string | ❌ | 최종 수정자 ("admin" \| "student", 현재 미사용) |
| `isActive` | boolean | ✅ | 활성 시간표 여부 |
| `isDefault` | boolean | ✅ | 기본 시간표 여부 |
| `createdAt` | Timestamp | ✅ | 생성 시간 |
| `updatedAt` | Timestamp | ✅ | 최종 수정 시간 |

**참고**: `version`, `lastUpdatedAt`, `lastUpdatedBy` 필드는 타입 정의에는 존재하지만 현재 구현에서는 사용되지 않습니다. 향후 동시성 제어 및 편집 이력 추적에 사용될 예정입니다.

#### basicSchedule 구조

```typescript
{
  dailySchedules: {
    monday: {
      arrivalTime: "09:00",      // 등원 시간
      departureTime: "18:00",     // 하원 시간
      isActive: true              // 해당 요일 활성화 여부
    },
    tuesday: { ... },
    // ... (7개 요일)
  },
  timeSlotInterval: 30  // 시간 슬롯 간격 (분)
}
```

#### detailedSchedule 구조

```typescript
{
  monday: {
    timeSlots: [
      {
        id: "slot_1",
        startTime: "09:00",
        endTime: "10:00",
        subject: "수학",
        type: "class" | "self_study" | "external",
        isAutoGenerated: false,
        color: "#FF5722",
        teacher: "홍길동",
        location: "3-1",
        notes: "중간고사 대비"
      }
    ]
  },
  // ... (7개 요일)
}
```

**TimeSlot type 설명**:
- `class`: 수업 (출석 체크 대상 ✅)
- `self_study`: 자습 (출석 체크 대상 ✅)
- `external`: 외부 활동 (출석 체크 대상 ❌)

#### autoFillSettings 구조

```typescript
{
  enabled: true,
  defaultSubject: "자습",
  fillEmptySlots: true
}
```

#### 인덱스

- `studentId` (ASC) + `isActive` (ASC)
- `studentId` (ASC) + `createdAt` (DESC)

---

### 4. attendance_records (관리자 자가 출석)

**경로**: `/users/{userId}/attendance_records`
**Document ID**: Auto-generated

**관리자 본인의 출석 기록**을 관리하는 컬렉션입니다. 학생 출석과는 별도입니다.

#### 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `date` | string | ✅ | 날짜 (YYYY-MM-DD) |
| `status` | string | ✅ | "present" \| "absent" \| "late" \| "early_leave" |
| `seatId` | string | ❌ | 좌석 ID |
| `checkInTime` | Timestamp | ❌ | 입실 시간 |
| `checkOutTime` | Timestamp | ❌ | 퇴실 시간 |
| `notes` | string | ❌ | 메모 |
| `createdAt` | Timestamp | ✅ | 생성 시간 |
| `updatedAt` | Timestamp | ✅ | 최종 수정 시간 |

#### 인덱스

- `date` (DESC)
- `status` (ASC) + `date` (DESC)

---

### 5. student_attendance_records (학생 출석)

**경로**: `/users/{userId}/student_attendance_records`
**Document ID**: `{studentId}_{YYYYMMDD}_slot{N}_{timestamp}`

**학생 출석 기록**을 관리하는 핵심 컬렉션입니다. **슬롯 기반** 출석 시스템을 사용합니다.

#### 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | ✅ | 문서 ID와 동일 |
| `userId` | string | ✅ | 소유자 UID |
| `studentId` | string | ✅ | 학생 ID |
| `studentName` | string | ✅ | 학생 이름 (캐싱) |
| `seatLayoutId` | string | ✅ | 좌석 배치도 ID |
| `seatId` | string | ✅ | 좌석 ID |
| `seatNumber` | string | ✅ | 좌석 번호 (캐싱) |
| `date` | string | ✅ | 날짜 (YYYY-MM-DD) |
| `dayOfWeek` | string | ✅ | 요일 ("monday" ~ "sunday") |
| `timetableId` | string | ❌ | 시간표 ID (하위 호환성) |
| `timeSlotId` | string | ❌ | 슬롯 ID (예: "slot_1") |
| `timeSlotSubject` | string | ❌ | 과목명 (예: "수학") |
| `timeSlotType` | string | ❌ | "class" \| "self_study" \| "external" |
| `expectedArrivalTime` | string | ✅ | 예정 등원 시간 (HH:mm) |
| `expectedDepartureTime` | string | ✅ | 예정 하원 시간 (HH:mm) |
| `actualArrivalTime` | Timestamp | ❌ | 실제 등원 시간 |
| `actualDepartureTime` | Timestamp | ❌ | 실제 하원 시간 |
| `notArrivedAt` | Timestamp | ❌ | 미등원 확정 시간 |
| `absentConfirmedAt` | Timestamp | ❌ | 결석 확정 시간 |
| `absentMarkedAt` | Timestamp | ❌ | 배치 처리 시간 |
| `status` | string | ✅ | 출석 상태 (6가지) |
| `excusedReason` | string | ❌ | 사유결석 사유 |
| `excusedNote` | string | ❌ | 사유결석 메모 |
| `excusedBy` | string | ❌ | 사유결석 처리자 UID |
| `isLate` | boolean | ✅ | 지각 여부 |
| `isEarlyLeave` | boolean | ✅ | 조퇴 여부 |
| `lateMinutes` | number | ❌ | 지각 시간 (분) |
| `earlyLeaveMinutes` | number | ❌ | 조퇴 시간 (분) |
| `checkInMethod` | string | ❌ | "pin" \| "manual" \| "admin" |
| `checkOutMethod` | string | ❌ | "pin" \| "manual" \| "admin" |
| `notes` | string | ❌ | 관리자 메모 |
| `sessionNumber` | number | ✅ | 당일 슬롯 순서 (1부터 시작) |
| `isLatestSession` | boolean | ✅ | 최신 슬롯 여부 |
| `createdAt` | Timestamp | ✅ | 생성 시간 |
| `updatedAt` | Timestamp | ✅ | 최종 수정 시간 |
| `recordTimestamp` | Timestamp | ✅ | 레코드 타임스탬프 |

#### 출석 상태 (status) 6가지

| 상태 | 설명 | 전환 조건 |
|------|------|----------|
| `scheduled` | 예정 | 배치 작업으로 사전 생성 (매일 2AM) |
| `checked_in` | 입실 | PIN 입력 또는 수동 체크인 |
| `checked_out` | 퇴실 | PIN 입력 또는 수동 체크아웃 |
| `not_arrived` | 미등원 | 수업 시작 시간 경과 (배치 작업, 30분마다) |
| `absent_excused` | 사유결석 | 관리자 수동 처리 |
| `absent_unexcused` | 무단결석 | 유예 기간 경과 후 자동 전환 (배치 작업, 10분마다) |

#### 상태 전환 흐름

```
scheduled → checked_in → checked_out
    ↓           ↓           ↓
not_arrived → absent_unexcused (유예 기간 후)
    ↓
absent_excused (관리자 처리)
```

**트랜잭션 사용**:
- `scheduled/not_arrived → checked_in`: 트랜잭션으로 처리 (배치와 충돌 방지)

#### 인덱스

- `studentId` (ASC) + `date` (DESC)
- `date` (ASC) + `status` (ASC)
- `seatLayoutId` (ASC) + `date` (ASC) + `recordTimestamp` (DESC)
- `studentId` (ASC) + `date` (ASC) + `isLatestSession` (ASC)
- `studentId` (ASC) + `date` (ASC) + `status` (ASC)
- `date` (ASC) + `expectedArrivalTime` (ASC) + `status` (ASC)

#### 배치 작업과의 연관

1. **매일 02:00** - `createDailyAttendanceRecords`:
   - `student_timetables`의 `detailedSchedule`에서 오늘의 `class`, `self_study` 슬롯 추출
   - 슬롯별로 `scheduled` 상태 레코드 생성

2. **30분마다 (09:00-23:00)** - `markNotArrivedAtStartTime`:
   - `scheduled` 상태 레코드 중 `expectedArrivalTime` 경과한 레코드를 `not_arrived`로 변경

3. **10분마다** - `markAbsentUnexcused`:
   - `not_arrived` 상태 레코드 중 유예 기간 경과한 레코드를 `absent_unexcused`로 변경

---

### 6. attendance_check_links

**경로**: `/users/{userId}/attendance_check_links`
**Document ID**: Auto-generated

학생들이 PIN을 입력할 수 있는 **공유 링크**를 관리합니다.

#### 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | ✅ | 문서 ID와 동일 |
| `userId` | string | ✅ | 소유자 UID |
| `linkToken` | string | ✅ | UUID 토큰 (URL 경로에 사용) |
| `linkUrl` | string | ✅ | 완전한 URL |
| `seatLayoutId` | string | ✅ | 좌석 배치도 ID |
| `seatLayoutName` | string | ✅ | 좌석 배치도 이름 (캐싱) |
| `title` | string | ✅ | 링크 제목 |
| `description` | string | ❌ | 링크 설명 |
| `isActive` | boolean | ✅ | 활성화 여부 |
| `expiresAt` | Timestamp | ❌ | 만료 시간 |
| `usageCount` | number | ✅ | 사용 횟수 (누적) |
| `createdAt` | Timestamp | ✅ | 생성 시간 |
| `updatedAt` | Timestamp | ✅ | 최종 수정 시간 |

#### 인덱스

- `linkToken` (ASC) + `isActive` (ASC)
- `seatLayoutId` (ASC) + `createdAt` (DESC)
- `isActive` (ASC) + `createdAt` (DESC)

#### 링크 생성 예시

```
https://studyroom-attendance.web.app/attendance/check/550e8400-e29b-41d4-a716-446655440000
```

---

### 7. attendance_student_pins

**경로**: `/users/{userId}/attendance_student_pins`
**Document ID**: `{studentId}` (학생 ID와 동일)

학생별 **출석 PIN**을 관리합니다. bcrypt 해싱을 사용합니다.

#### 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | ✅ | studentId와 동일 |
| `userId` | string | ✅ | 소유자 UID |
| `studentId` | string | ✅ | 학생 ID |
| `studentName` | string | ✅ | 학생 이름 (캐싱) |
| `pinHash` | string | ✅ | bcrypt 해시값 |
| `actualPin` | string | ✅ | 실제 PIN (관리자 확인용) |
| `isActive` | boolean | ✅ | 활성화 여부 |
| `isLocked` | boolean | ✅ | 잠금 여부 (5회 실패 시) |
| `failedAttempts` | number | ✅ | 실패 횟수 |
| `lastFailedAt` | Timestamp | ❌ | 마지막 실패 시간 |
| `lastChangedAt` | Timestamp | ✅ | PIN 변경 시간 |
| `lastUsedAt` | Timestamp | ❌ | 마지막 사용 시간 |
| `changeHistory` | Array | ❌ | 변경 이력 (최근 3개) |
| `createdAt` | Timestamp | ✅ | 생성 시간 |
| `updatedAt` | Timestamp | ✅ | 최종 수정 시간 |

#### changeHistory 구조

```typescript
[
  {
    changedAt: Timestamp,
    changedBy: "userId"
  }
]
```

#### 보안 기능

- **bcrypt 해싱**: 솔트 라운드 10
- **자동 잠금**: 5회 연속 실패 시 `isLocked = true`
- **중복 검증**: `actualPin` 필드로 쿼리 1회로 중복 확인
- **Rate Limiting**: `pin_attempt_logs` 컬렉션 활용 (5분 내 20회 실패 시 차단)

#### 인덱스

- `actualPin` (ASC) + `isActive` (ASC)
- `studentId` (ASC)
- `isLocked` (ASC) + `isActive` (ASC)

---

### 8. shared_schedules

**경로**: `/users/{userId}/shared_schedules`
**Document ID**: Auto-generated

시간표 공유 링크를 관리합니다. **학생이 시간표를 직접 편집**할 수 있는 기능을 제공합니다.

#### 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `shareToken` | string | ✅ | UUID 토큰 |
| `timetableId` | string | ✅ | 시간표 ID |
| `permissions` | Object | ✅ | 기본 권한 |
| `editPermissions` | Object | ❌ | 세부 편집 권한 |
| `accessSettings` | Object | ✅ | 접근 설정 |
| `linkSettings` | Object | ✅ | 링크 설정 |
| `title` | string | ❌ | 공유 제목 |
| `description` | string | ❌ | 공유 설명 |
| `createdAt` | Timestamp | ✅ | 생성 시간 |
| `updatedAt` | Timestamp | ✅ | 최종 수정 시간 |

#### permissions 구조

```typescript
{
  canEdit: true,
  canView: true,
  canComment: false
}
```

#### editPermissions 구조

```typescript
{
  // detailedSchedule 권한
  canAddSlots: true,
  canDeleteSlots: true,
  canModifySlots: true,
  restrictedTimeSlots: ["09:00-10:00"],  // 제한된 시간대

  // basicSchedule 권한
  canEditBasicSchedule: true,
  canEditDailySchedules: true,
  canEditTimeSlotInterval: false,

  // 요일별 세부 권한
  dailySchedulePermissions: {
    monday: {
      canEditArrivalTime: true,
      canEditDepartureTime: true,
      canToggleActive: false
    },
    // ... (7개 요일)
  },

  timeSlotIntervalOptions: [30, 60]  // 허용된 간격
}
```

#### accessSettings 구조

```typescript
{
  requireName: true,
  requireEmail: false,
  maxContributions: 5  // 최대 제출 횟수
}
```

#### linkSettings 구조

```typescript
{
  isActive: true,
  expiresAt: Timestamp,
  createdAt: Timestamp,
  lastUsedAt: Timestamp,
  usageCount: 0
}
```

#### 인덱스

- `shareToken` (ASC) + `linkSettings.isActive` (ASC)
- `timetableId` (ASC) + `linkSettings.isActive` (ASC)

---

### 9. schedule_contributions

**경로**: `/users/{userId}/schedule_contributions`
**Document ID**: Auto-generated

학생이 제출한 **시간표 편집 제안**을 관리합니다.

#### 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `shareToken` | string | ✅ | 공유 링크 토큰 |
| `timetableId` | string | ✅ | 시간표 ID |
| `contributor` | Object | ✅ | 기여자 정보 |
| `contributions` | Array | ✅ | 변경 내역 |
| `status` | string | ✅ | "pending" \| "approved" \| "rejected" \| "applied" |
| `appliedAt` | Timestamp | ❌ | 적용 시간 |
| `submittedAt` | Timestamp | ✅ | 제출 시간 |
| `processedAt` | Timestamp | ❌ | 처리 시간 |
| `processedBy` | string | ❌ | 처리자 UID |

#### contributor 구조

```typescript
{
  name: "홍길동",
  email: "student@example.com",
  ipAddress: "123.123.123.123"
}
```

#### contributions 구조

```typescript
[
  {
    dayOfWeek: "monday",
    timeSlots: [
      {
        startTime: "09:00",
        endTime: "10:00",
        subject: "수학",
        type: "class",
        color: "#FF5722",
        note: "변경 사유"
      }
    ]
  }
]
```

#### 인덱스

- `timetableId` (ASC) + `status` (ASC) + `submittedAt` (DESC)
- `shareToken` (ASC) + `status` (ASC)
- `status` (ASC) + `submittedAt` (DESC)

---

### 10. seats

**경로**: `/users/{userId}/seats`
**Document ID**: Auto-generated

개별 좌석 정보를 관리합니다.

#### 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `seatNumber` | string | ✅ | 좌석 번호 (예: "A1") |
| `location` | Object | ✅ | 좌석 위치 |
| `status` | string | ✅ | "available" \| "occupied" \| "maintenance" |
| `createdAt` | Timestamp | ✅ | 생성 시간 |
| `updatedAt` | Timestamp | ✅ | 최종 수정 시간 |

#### location 구조

```typescript
{
  x: 100,  // 픽셀 좌표
  y: 200
}
```

#### 인덱스

- `seatNumber` (ASC)
- `status` (ASC) + `seatNumber` (ASC)

---

### 11. seat_assignments

**경로**: `/users/{userId}/seat_assignments`
**Document ID**: Auto-generated

학생-좌석 할당 정보를 관리합니다. **출석 시스템과 긴밀히 연동**됩니다.

#### 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `seatId` | string | ✅ | 좌석 ID |
| `assignedAt` | Timestamp | ✅ | 할당 시간 |
| `expiresAt` | Timestamp | ❌ | 만료 시간 |
| `status` | string | ✅ | "active" \| "expired" \| "cancelled" |
| `updatedAt` | Timestamp | ✅ | 최종 수정 시간 |
| `studentId` | string | ❌ | 학생 ID (출석 시스템용) |
| `studentName` | string | ❌ | 학생 이름 (캐싱) |
| `seatNumber` | string | ❌ | 좌석 번호 (캐싱) |
| `timetableId` | string | ❌ | 시간표 ID (출석 시스템용) |
| `seatLayoutId` | string | ❌ | 좌석 배치도 ID (출석 시스템용) |
| `expectedSchedule` | Object | ❌ | 예정 등/하원 시간 캐싱 |

#### expectedSchedule 구조

시간표의 `basicSchedule.dailySchedules`를 캐싱하여 성능 최적화합니다.

```typescript
{
  monday: {
    arrivalTime: "09:00",
    departureTime: "18:00",
    isActive: true
  },
  // ... (7개 요일)
}
```

#### 캐싱 전략

- **시간표 변경 시 자동 동기화**: `onStudentTimetableUpdate` 트리거가 자동으로 `expectedSchedule` 업데이트
- **출석 레코드 생성 시 사용**: 배치 작업에서 빠르게 예정 시간 조회

#### 인덱스

- `studentId` (ASC) + `seatLayoutId` (ASC) + `status` (ASC)
- `timetableId` (ASC) + `status` (ASC)
- `status` (ASC) + `assignedAt` (DESC)

---

### 12. seat_layouts

**경로**: `/users/{userId}/seat_layouts`
**Document ID**: Auto-generated

좌석 배치도를 관리합니다. **출석 시스템용 groups 구조**를 지원합니다.

#### 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | string | ✅ | 배치도 이름 |
| `layout` | Object | ✅ | 배치도 레이아웃 |
| `createdAt` | Timestamp | ✅ | 생성 시간 |
| `updatedAt` | Timestamp | ✅ | 최종 수정 시간 |

#### layout 구조

```typescript
{
  // 출석 시스템용 그룹 기반 배치 (optional)
  groups: [
    {
      id: "group_1",
      name: "A구역",
      rows: 3,     // 행 수
      cols: 4,     // 열 수
      position: { x: 0, y: 0 }
    }
  ],

  // 좌석 목록
  seats: [
    {
      id: "seat_1",
      position: { x: 100, y: 200 },
      size: { width: 50, height: 50 },
      groupId: "group_1",  // 그룹 ID (optional)
      row: 0,              // 그룹 내 행 (optional)
      col: 0,              // 그룹 내 열 (optional)
      label: "A1"          // 좌석 레이블 (optional)
    }
  ],

  // 전체 캔버스 크기
  dimensions: {
    width: 1200,
    height: 800
  }
}
```

#### 인덱스

- `name` (ASC)
- `createdAt` (DESC)

---

### 13. class_sections

**경로**: `/users/{userId}/class_sections`
**Document ID**: Auto-generated

학급/반 정보를 관리합니다.

#### 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | string | ✅ | 학급명 |
| `description` | string | ❌ | 학급 설명 |
| `schedule` | Object | ✅ | 학급 일정 |
| `createdAt` | Timestamp | ✅ | 생성 시간 |
| `updatedAt` | Timestamp | ✅ | 최종 수정 시간 |

#### schedule 구조

```typescript
{
  startTime: "09:00",
  endTime: "18:00",
  daysOfWeek: [1, 2, 3, 4, 5]  // 0=일요일, 1=월요일, ...
}
```

#### 인덱스

- `name` (ASC)

---

### 14. attendance_summaries

**경로**: `/users/{userId}/attendance_summaries`
**Document ID**: Auto-generated

출석 통계 요약 정보를 저장합니다.

#### 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `period` | string | ✅ | 기간 (예: "2025-01") |
| `totalDays` | number | ✅ | 총 일수 |
| `presentDays` | number | ✅ | 출석 일수 |
| `absentDays` | number | ✅ | 결석 일수 |
| `lateDays` | number | ✅ | 지각 일수 |
| `earlyLeaveDays` | number | ✅ | 조퇴 일수 |
| `attendanceRate` | number | ✅ | 출석률 (%) |
| `createdAt` | Timestamp | ✅ | 생성 시간 |
| `updatedAt` | Timestamp | ✅ | 최종 수정 시간 |

#### 인덱스

- `period` (DESC)

---

### 15. settings

**경로**: `/users/{userId}/settings`
**Document ID**: `"preferences"` (고정값)

사용자 설정을 관리합니다. 단일 문서로 사용자당 하나의 설정 문서만 존재합니다.

#### 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `notifications` | Object | ✅ | 알림 설정 |
| `preferences` | Object | ✅ | 사용자 선호 설정 |
| `createdAt` | Timestamp | ✅ | 생성 시간 |
| `updatedAt` | Timestamp | ✅ | 최종 수정 시간 |

#### notifications 구조

```typescript
{
  attendance: true,
  schedule: true,
  announcements: false
}
```

#### preferences 구조

```typescript
{
  theme: "light" | "dark",
  language: "ko"
}
```

---

### 16. pin_attempt_logs (Global Collection)

**경로**: `/pin_attempt_logs`
**Document ID**: Auto-generated

**전역 컬렉션**으로, PIN 입력 시도 로그를 기록하여 **Rate Limiting**에 활용합니다.

#### 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `linkToken` | string | ✅ | 출석 체크 링크 토큰 |
| `success` | boolean | ✅ | PIN 검증 성공 여부 |
| `studentId` | string | ❌ | 학생 ID (성공 시만 기록) |
| `timestamp` | Timestamp | ✅ | 시도 시간 |
| `expiresAt` | Timestamp | ✅ | 만료 시간 (TTL 24시간) |

#### TTL (Time To Live)

Firestore TTL 정책을 사용하여 24시간 후 자동 삭제됩니다.

#### Rate Limiting 정책

- **5분 내 20회 실패**: 임시 차단 (5분간 대기)
- **로직 위치**: `checkAttendanceByPin` 함수 내부

#### 인덱스

- `linkToken` (ASC) + `success` (ASC) + `timestamp` (DESC)
- `expiresAt` (ASC) - TTL 인덱스

---

## 인덱스 전략

### 복합 인덱스 요구 사항

Firestore는 다음 경우 복합 인덱스가 필요합니다:

1. **여러 필드에 대한 동등 필터 + 범위/정렬 필터**
2. **orderBy가 where와 다른 필드일 때**

### 주요 복합 인덱스

#### student_attendance_records

```
1. studentId (ASC) + date (DESC)
2. date (ASC) + status (ASC)
3. seatLayoutId (ASC) + date (ASC) + recordTimestamp (DESC)
4. studentId (ASC) + date (ASC) + isLatestSession (ASC)
5. studentId (ASC) + date (ASC) + status (ASC)
6. date (ASC) + expectedArrivalTime (ASC) + status (ASC)
```

#### pin_attempt_logs

```
1. linkToken (ASC) + success (ASC) + timestamp (DESC)
   - Rate Limiting 조회용
   - IMPORTANT: 동등 필터(linkToken, success)를 범위 필터(timestamp) 앞에 배치
```

#### seat_assignments

```
1. studentId (ASC) + seatLayoutId (ASC) + status (ASC)
2. timetableId (ASC) + status (ASC)
3. status (ASC) + assignedAt (DESC)
```

#### shared_schedules

```
1. shareToken (ASC) + linkSettings.isActive (ASC)
2. timetableId (ASC) + linkSettings.isActive (ASC)
```

### 인덱스 생성 방법

Firebase Console에서 자동 생성 요청을 받거나, `firestore.indexes.json` 파일을 사용합니다.

---

## 데이터 흐름 예시

### 학생 생성 플로우

```
1. createStudent 함수 호출
2. students 컬렉션에 학생 문서 생성
3. student_timetables 컬렉션에 기본 시간표 자동 생성
4. attendance_student_pins 컬렉션에 6자리 PIN 자동 생성
5. 실패 시 트랜잭션 롤백 (모두 삭제)
```

### 출석 레코드 생성 플로우

```
1. [매일 02:00] createDailyAttendanceRecords 배치 실행
2. 모든 사용자의 seat_assignments (status=active) 조회
3. 각 학생의 student_timetables 조회
4. basicSchedule.dailySchedules에서 오늘이 활성화되어 있는지 확인
5. detailedSchedule에서 type이 "class" 또는 "self_study"인 슬롯 필터링
6. 각 슬롯별로 student_attendance_records 생성 (status=scheduled)
```

### PIN 기반 출석 체크 플로우

```
1. 학생이 링크(linkToken)에서 PIN 입력
2. checkAttendanceByPin 함수 호출
3. Rate Limiting 체크 (5분 내 20회 실패 시 차단)
4. linkToken으로 attendance_check_links 조회
5. bcrypt로 PIN 검증 (attendance_student_pins)
6. 현재 시간에 해당하는 student_attendance_records 슬롯 조회
7. 트랜잭션으로 상태 전환 (scheduled/not_arrived → checked_in)
8. 성공 시 PIN 실패 횟수 초기화, 링크 사용 횟수 증가
```

### 배치 작업 플로우

```
[매일 02:00] createDailyAttendanceRecords
  → scheduled 상태 레코드 생성

[30분마다, 09:00-23:00] markNotArrivedAtStartTime
  → scheduled → not_arrived (수업 시작 시간 경과)

[10분마다] markAbsentUnexcused
  → not_arrived → absent_unexcused (유예 기간 경과)
```

---

## 데이터 정합성 유지

### 트리거 (Firestore Functions)

#### onStudentTimetableUpdate

**경로**: `users/{userId}/student_timetables/{timetableId}`
**트리거 시점**: `onDocumentUpdated`

**동작**:
1. 시간표의 `basicSchedule.dailySchedules` 변경 감지
2. 해당 시간표를 사용하는 모든 `seat_assignments` 조회
3. `expectedSchedule` 필드 자동 업데이트 (캐시 동기화)

**목적**: 시간표 변경 시 좌석 할당 정보 자동 동기화

### 삭제 시 연관 데이터 처리

#### deleteStudent 함수

학생 삭제 시 다음을 일괄 삭제 (Batch):
1. `student_timetables` (학생의 모든 시간표)
2. `seat_assignments` (학생의 좌석 할당)
3. `student_attendance_records` (학생의 출석 기록)
4. `attendance_student_pins` (학생의 PIN)
5. `students` (학생 문서)

#### deleteStudentTimetable 함수

시간표 삭제 시 다음 처리:
1. `seat_assignments`의 `timetableId` 필드 제거 (Batch Update)
2. `shared_schedules` 삭제 (해당 시간표의 공유 링크)
3. `schedule_contributions` 삭제 (해당 시간표의 기여 내역)
4. `student_timetables` 삭제 (시간표 문서)

---

## 보안 규칙 고려사항

Firestore Security Rules에서 다음을 구현해야 합니다:

```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    // 사용자별 데이터 격리
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // 전역 컬렉션 (pin_attempt_logs)
    match /pin_attempt_logs/{logId} {
      allow read: if false;  // 프론트엔드 읽기 금지
      allow write: if request.auth != null;
    }
  }
}
```

---

## 성능 최적화 전략

### 1. 캐싱 전략

- **seat_assignments.expectedSchedule**: 시간표 정보 캐싱
- **seat_assignments.studentName, seatNumber**: 자주 사용되는 정보 캐싱
- **student_attendance_records.timeSlotSubject**: 과목명 캐싱

### 2. 인덱스 최적화

- 배치 작업 쿼리를 위한 복합 인덱스 사전 생성
- TTL 인덱스로 자동 삭제 (pin_attempt_logs)

### 3. 배치 크기 제한

- Firestore Batch: 최대 500개 작업
- 대용량 데이터 처리 시 여러 배치로 분할

### 4. 트랜잭션 최소화

- 동시성 제어가 필요한 곳만 트랜잭션 사용
- `scheduled/not_arrived → checked_in` 전환에만 트랜잭션 적용

---

## 마이그레이션 및 백업

### 사용자 데이터 백업

`createUserDataBackup` 함수를 통해 사용자의 모든 컬렉션 데이터를 백업할 수 있습니다.

**백업 구조**:
```typescript
{
  userId: string,
  userProfile: User,
  collections: {
    students: Array<{ id: string, data: any }>,
    student_timetables: Array<{ id: string, data: any }>,
    // ... (모든 컬렉션)
  },
  createdAt: Timestamp,
  backupType: "full_backup"
}
```

### 스키마 마이그레이션

`modules/admin/dataMigration.ts`에 일회성 마이그레이션 함수 작성 후 실행, 완료 시 삭제합니다.

---

## 요약

이 Firestore 데이터베이스는 다음과 같은 특징을 가집니다:

✅ **사용자 기반 완전 격리**: `/users/{userId}/` 구조로 데이터 격리
✅ **슬롯 기반 출석 시스템**: 수업별 개별 출석 레코드 관리
✅ **2계층 시간표 구조**: 기본 일정(등/하원) + 상세 일정(수업별)
✅ **자동화 배치 작업**: 매일 레코드 생성, 30분마다 미등원 체크, 10분마다 결석 확정
✅ **PIN 기반 보안**: bcrypt 해싱, 자동 잠금, Rate Limiting
✅ **실시간 캐싱**: 시간표 변경 시 트리거로 자동 동기화
✅ **유연한 공유 시스템**: 시간표 공유 링크, 학생 편집 제안 관리

이 구조는 확장 가능하며, 향후 이벤트 기반 출석 시스템으로의 마이그레이션도 고려되고 있습니다.
