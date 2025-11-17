# 출석 시스템 로직 분석 (Attendance System Logic Analysis)

> 날짜: 2025-11-14
> 분석 대상: 스터디룸 관리 시스템의 출석 관리 로직
> 분석 방법: 실제 코드 직접 읽고 분석

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [아키텍처 구조](#2-아키텍처-구조)
3. [데이터 모델](#3-데이터-모델)
4. [핵심 프로세스](#4-핵심-프로세스)
5. [상태 전환 로직](#5-상태-전환-로직)
6. [보안 메커니즘](#6-보안-메커니즘)
7. [자동화 배치 작업](#7-자동화-배치-작업)
8. [프론트엔드 통합](#8-프론트엔드-통합)
9. [성능 최적화](#9-성능-최적화)
10. [제약사항 및 고려사항](#10-제약사항-및-고려사항)

---

## 1. 시스템 개요

### 1.1 시스템 목적
한국 스터디룸의 학생 출석 관리를 자동화하는 **슬롯 기반(Slot-Based) 출석 시스템**

### 1.2 핵심 특징
- **슬롯 기반 아키텍처**: 학생별 시간표의 각 수업/자습 시간 슬롯마다 개별 출석 레코드 생성
- **PIN 기반 셀프 체크인**: 학생이 4-6자리 PIN으로 자가 출석 체크 (관리자 개입 최소화)
- **자동화된 상태 관리**: 3개의 배치 작업으로 자동 출석 기록 생성 및 결석 처리
- **좌석 연동**: 좌석 배치도와 통합되어 시각적 출석 현황 관리
- **실시간 동기화**: Firestore 실시간 리스너로 출석 상태 즉시 반영

### 1.3 지원 기능
1. **관리자 기능**
   - 좌석 배치도 생성/관리
   - 학생-좌석 할당
   - PIN 생성/변경/잠금해제
   - 출석 체크 링크 생성/관리
   - 수동 체크인/아웃
   - 출석 상태 강제 변경
   - 결석 처리 (사유결석/무단결석)

2. **학생 기능**
   - QR 코드 또는 링크를 통한 PIN 입력 페이지 접근
   - PIN으로 체크인/체크아웃
   - 자동 지각/조퇴 판정

3. **자동화 기능**
   - 매일 새벽 2시: 오늘 출석 레코드 사전 생성
   - 30분 간격: 수업 시작 시간에 미등원 처리
   - 10분 간격: 유예 기간 초과 시 무단결석 확정

---

## 2. 아키텍처 구조

### 2.1 전체 구조도

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                       │
├─────────────────────────────────────────────────────────────┤
│  Pages:                                                      │
│  - /attendance (관리자 대시보드)                              │
│  - /attendance-check/:token (학생 PIN 입력)                  │
│  - /attendance-records (출석 기록 조회)                       │
├─────────────────────────────────────────────────────────────┤
│  Components: (37개)                                          │
│  - SeatingChart, Seat, SeatGroup                            │
│  - StudentDetailSidebar, AssignSeatModal                    │
│  - ManagePinModal, AttendanceCheckLinkModal                 │
│  - AttendanceStatsCard, etc.                                │
├─────────────────────────────────────────────────────────────┤
│  State Management:                                           │
│  - TanStack Query: 서버 상태 (출석 기록, 좌석 할당 등)        │
│  - Zustand: UI 상태 (모달, 선택 상태 등)                     │
│  - Real-time Hooks: Firestore onSnapshot 리스너             │
├─────────────────────────────────────────────────────────────┤
│  Services:                                                   │
│  - attendanceService.ts (588 LOC)                           │
│    → Cloud Functions 호출 래퍼                               │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│              Firebase Cloud Functions (Backend)              │
├─────────────────────────────────────────────────────────────┤
│  HTTP Functions: (studentAttendanceManagement.ts, 51 KB)    │
│  - generateStudentPin, updateStudentPin                     │
│  - createAttendanceCheckLink                                │
│  - checkAttendanceByPin ⭐ (핵심 로직)                       │
│  - manualCheckIn, manualCheckOut                            │
│  - updateAttendanceStatus                                   │
│  - getTodayAttendanceRecords                                │
│  - getStudentAttendanceRecords                              │
├─────────────────────────────────────────────────────────────┤
│  Scheduled Functions: (3개)                                 │
│  1. createDailyAttendanceRecords                            │
│     - 실행: 매일 02:00 Asia/Seoul                           │
│     - 역할: 오늘 출석 레코드 사전 생성                       │
│  2. markNotArrivedAtStartTime                               │
│     - 실행: 09:00-23:00 매 30분 (29회/일)                   │
│     - 역할: 수업 시작 시 scheduled → not_arrived            │
│  3. markAbsentUnexcused                                     │
│     - 실행: 매 10분                                          │
│     - 역할: 유예 기간 후 not_arrived → absent_unexcused     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Firestore Database                        │
├─────────────────────────────────────────────────────────────┤
│  /users/{userId}/                                           │
│  ├─ students/                                               │
│  ├─ student_timetables/          (시간표)                   │
│  ├─ seat_layouts/                 (좌석 배치도)              │
│  ├─ seat_assignments/             (좌석 할당)                │
│  ├─ student_attendance_records/   ⭐ (출석 기록)            │
│  ├─ attendance_check_links/       (출석 체크 링크)           │
│  ├─ attendance_student_pins/      (학생 PIN, bcrypt 해시)  │
│  └─ pin_attempt_logs/             (PIN 시도 로그, 24h TTL)  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 데이터 격리 (User-Based Isolation)
- **모든 데이터**: `/users/{userId}/` 하위에 저장
- **보안 규칙**: `request.auth.uid == userId` 검증
- **Cloud Functions**: 모든 함수에서 `request.auth.uid` 확인
- **장점**: 사용자 간 완전 격리, 복잡한 권한 시스템 불필요

---

## 3. 데이터 모델

### 3.1 출석 기록 (StudentAttendanceRecord)

**Collection**: `/users/{userId}/student_attendance_records`

```typescript
interface StudentAttendanceRecord {
  // 기본 식별 정보
  id: string;                    // {studentId}_{YYYYMMDD}_slot{N}_{timestamp}
  userId: string;
  studentId: string;
  studentName: string;

  // 좌석 정보
  seatLayoutId: string;
  seatId: string;
  seatNumber: string;

  // 날짜/시간 정보
  date: string;                  // YYYY-MM-DD
  dayOfWeek: DayOfWeek;          // 'monday' | 'tuesday' | ...

  // 시간표 슬롯 정보
  timetableId?: string;
  timeSlotId?: string;           // 'slot_0', 'slot_1', ...
  timeSlotSubject?: string;      // '수학', '자습', ...
  timeSlotType?: 'class' | 'self_study' | 'external';

  // 예상 시간
  expectedArrivalTime: string;   // 'HH:mm' (예: '09:00')
  expectedDepartureTime: string; // 'HH:mm' (예: '12:00')

  // 실제 시간
  actualArrivalTime?: Timestamp;
  actualDepartureTime?: Timestamp;

  // 배치 작업 로깅 시간
  notArrivedAt?: Timestamp;      // 미등원 확정 시간
  absentConfirmedAt?: Timestamp; // 결석 확정 시간 (유예 종료)
  absentMarkedAt?: Timestamp;    // 배치 처리 시간

  // 출석 상태 (6가지)
  status: StudentAttendanceStatus;

  // 결석 사유 (absent_excused인 경우)
  excusedReason?: string;
  excusedNote?: string;
  excusedBy?: string;           // userId

  // 지각/조퇴 판정
  isLate: boolean;
  isEarlyLeave: boolean;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;

  // 체크인/아웃 방법
  checkInMethod?: 'pin' | 'manual' | 'admin';
  checkOutMethod?: 'pin' | 'manual' | 'admin';

  // 기타
  notes?: string;
  sessionNumber: number;         // 당일 몇 번째 세션 (1, 2, 3, ...)
  isLatestSession: boolean;      // 가장 최신 세션 여부

  // 타임스탬프
  createdAt: Timestamp;
  updatedAt: Timestamp;
  recordTimestamp: Timestamp;
}
```

**ID 생성 규칙**:
```
{studentId}_{YYYYMMDD}_slot{N}_{timestamp}

예시:
student123_20250131_slot1_1706745600000
student123_20250131_slot2_1706745600000
```

### 3.2 출석 상태 (StudentAttendanceStatus)

6가지 상태로 슬롯 기반 출석 추적:

| 상태 | 설명 | 생성 방법 | 다음 상태 |
|------|------|-----------|-----------|
| `scheduled` | 예정 (배치로 사전 생성) | 배치: `createDailyAttendanceRecords` | `checked_in`, `not_arrived` |
| `checked_in` | 등원 완료 | PIN/수동 체크인 | `checked_out` |
| `checked_out` | 하원 완료 | PIN/수동 체크아웃 | `checked_in` (재입실) |
| `not_arrived` | 미등원 (수업 시작했지만 미출석) | 배치: `markNotArrivedAtStartTime` | `checked_in` (복구), `absent_unexcused` |
| `absent_excused` | 사유결석 | 관리자 수동 처리 | - |
| `absent_unexcused` | 무단결석 | 배치: `markAbsentUnexcused` | - |

### 3.3 학생 PIN (AttendanceStudentPin)

**Collection**: `/users/{userId}/attendance_student_pins`

```typescript
interface AttendanceStudentPin {
  id: string;                    // studentId와 동일
  userId: string;
  studentId: string;
  studentName: string;

  // 보안
  pinHash: string;               // bcrypt 해시 (saltRounds=10)
  actualPin: string;             // 실제 PIN (관리자 확인용)

  // 상태
  isActive: boolean;
  isLocked: boolean;             // 5회 실패 시 자동 잠금
  failedAttempts: number;
  lastFailedAt?: Timestamp;

  // 사용 이력
  lastChangedAt: Timestamp;
  lastUsedAt?: Timestamp;
  changeHistory?: {
    changedAt: Timestamp;
    changedBy: string;
  }[];

  // 타임스탬프
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**PIN 규칙**:
- 형식: 4-6자리 숫자 (`/^\d{4,6}$/`)
- 중복 검증: `actualPin` 필드로 쿼리 1회 (bcrypt 연산 불필요)
- 보안: bcrypt 해시 저장, Frontend에는 `pinHash` 반환 안함

### 3.4 출석 체크 링크 (AttendanceCheckLink)

**Collection**: `/users/{userId}/attendance_check_links`

```typescript
interface AttendanceCheckLink {
  id: string;
  userId: string;

  // 링크 정보
  linkToken: string;             // UUID v4
  linkUrl: string;               // {baseUrl}/attendance/check/{linkToken}

  // 연결 정보
  seatLayoutId: string;
  seatLayoutName: string;

  // 메타데이터
  title: string;
  description?: string;

  // 상태
  isActive: boolean;
  expiresAt?: Timestamp;

  // 통계
  usageCount: number;
  lastUsedAt?: Timestamp;

  // 타임스탬프
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 3.5 좌석 할당 (SeatAssignment)

**Collection**: `/users/{userId}/seat_assignments`

```typescript
interface SeatAssignment {
  id: string;
  seatId: string;
  seatLayoutId: string;

  // 학생 정보
  studentId?: string;
  studentName?: string;
  seatNumber?: string;
  timetableId?: string;

  // 예상 일정 (시간표에서 캐시)
  expectedSchedule?: {
    [dayOfWeek]: {
      arrivalTime: string;
      departureTime: string;
      isActive: boolean;
    }
  };

  // 할당 상태
  status: 'active' | 'expired' | 'cancelled';
  assignedAt: Date;
  expiresAt?: Date;
  updatedAt: Date;
}
```

### 3.6 PIN 시도 로그 (Rate Limiting용)

**Collection**: `/pin_attempt_logs` (루트 컬렉션)

```typescript
interface PinAttemptLog {
  linkToken: string;
  success: boolean;
  studentId?: string;            // 성공 시만 기록
  timestamp: Timestamp;
  expiresAt: Timestamp;          // 24시간 후 (TTL)
}
```

**Firestore 인덱스**:
```
linkToken (ASC) → success (ASC) → timestamp (DESC)
```

**Rate Limiting 규칙**:
- 5분 내 20회 이상 실패 → 임시 차단
- 24시간 후 자동 삭제 (Firestore TTL 정책)

---

## 4. 핵심 프로세스

### 4.1 출석 레코드 생성 프로세스

#### 4.1.1 배치 작업: createDailyAttendanceRecords

**실행**: 매일 02:00 Asia/Seoul

**프로세스**:
```
1. 모든 사용자 조회
   └─> users/ 컬렉션 스캔

2. 각 사용자별 활성 좌석 할당 조회
   └─> users/{userId}/seat_assignments (status == 'active')

3. 각 할당별 학생 시간표 조회
   └─> users/{userId}/student_timetables/{timetableId}

4. 오늘 요일의 basicSchedule 확인
   └─> basicSchedule.dailySchedules[dayOfWeek].isActive

5. detailedSchedule에서 출석 의무 슬롯 필터링
   └─> timeSlots.filter(slot => slot.type === 'class' || slot.type === 'self_study')
   └─> 'external' 슬롯은 제외

6. 각 슬롯별 출석 레코드 생성
   └─> status: 'scheduled'
   └─> expectedArrivalTime: slot.startTime
   └─> expectedDepartureTime: slot.endTime
   └─> sessionNumber: 1, 2, 3, ...
```

**예시**:
```javascript
// 학생 A의 오늘 시간표: 09:00-12:00 수학, 14:00-17:00 자습
// 생성되는 레코드:
{
  id: 'studentA_20250131_slot1_1706745600000',
  date: '2025-01-31',
  timeSlotSubject: '수학',
  expectedArrivalTime: '09:00',
  expectedDepartureTime: '12:00',
  status: 'scheduled',
  sessionNumber: 1,
  isLatestSession: false
}

{
  id: 'studentA_20250131_slot2_1706745600001',
  date: '2025-01-31',
  timeSlotSubject: '자습',
  expectedArrivalTime: '14:00',
  expectedDepartureTime: '17:00',
  status: 'scheduled',
  sessionNumber: 2,
  isLatestSession: true
}
```

### 4.2 PIN 체크인/아웃 프로세스

#### 4.2.1 함수: checkAttendanceByPin

**입력**:
```typescript
{
  linkToken: string,  // 출석 체크 링크 토큰
  pin: string         // 학생이 입력한 PIN
}
```

**프로세스 상세**:

```
┌─────────────────────────────────────────────────────────────┐
│ 0. Rate Limiting 체크                                        │
├─────────────────────────────────────────────────────────────┤
│ - pin_attempt_logs 조회 (최근 5분)                          │
│ - 실패 20회 이상 → resource-exhausted 에러                  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. 링크 토큰 검증                                            │
├─────────────────────────────────────────────────────────────┤
│ - collectionGroup('attendance_check_links')                 │
│   .where('linkToken', '==', linkToken)                      │
│   .where('isActive', '==', true)                            │
│ - 링크 만료 확인 (expiresAt < now)                          │
│ - userId, seatLayoutId 추출                                 │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. PIN 검증 (병렬 bcrypt 비교)                              │
├─────────────────────────────────────────────────────────────┤
│ - users/{userId}/attendance_student_pins (isActive=true)    │
│ - Promise.all()로 모든 PIN 병렬 검증                        │
│ - 매치된 PIN 찾기:                                           │
│   - isLocked = true → 에러 (관리자 문의)                    │
│   - 매치 없음 → 실패 로그 기록 + invalid-argument           │
│   - 매치 성공 → 성공 로그 기록 + failedAttempts 초기화      │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 좌석 할당 확인                                            │
├─────────────────────────────────────────────────────────────┤
│ - users/{userId}/seat_assignments                           │
│   .where('studentId', '==', studentId)                      │
│   .where('seatLayoutId', '==', seatLayoutId)                │
│   .where('status', '==', 'active')                          │
│ - 할당 없음 → not-found 에러                                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. 슬롯 기반 조회: 현재 시간 해당 슬롯 찾기                  │
├─────────────────────────────────────────────────────────────┤
│ - users/{userId}/student_attendance_records                 │
│   .where('studentId', '==', studentId)                      │
│   .where('date', '==', today)                               │
│   .where('status', 'in', ['scheduled', 'not_arrived',      │
│                            'checked_in', 'checked_out'])    │
│                                                              │
│ - 슬롯 없음 → not-found 에러                                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. 현재 시간과 가장 가까운 슬롯 선택 (±30분 이내)            │
├─────────────────────────────────────────────────────────────┤
│ currentMinutes = getCurrentKoreaMinutes()                   │
│ slotStartMinutes = parseTimeToMinutes(expectedArrivalTime)  │
│ slotEndMinutes = parseTimeToMinutes(expectedDepartureTime)  │
│                                                              │
│ for each record:                                             │
│   if currentMinutes >= slotStartMinutes - 30 &&            │
│      currentMinutes <= slotEndMinutes + 30:                │
│     timeDiff = abs(currentMinutes - slotStartMinutes)      │
│     if timeDiff < minTimeDiff:                             │
│       targetRecord = record                                 │
│                                                              │
│ - 해당 슬롯 없음 → failed-precondition 에러                 │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. 상태 전환 로직 (트랜잭션)                                 │
├─────────────────────────────────────────────────────────────┤
│ 6-1. scheduled/not_arrived → checked_in                     │
│      - 트랜잭션으로 최신 상태 재확인                         │
│      - absent_unexcused면 에러 (유예 종료)                 │
│      - actualArrivalTime = now                              │
│      - isLate = (currentMinutes > expectedMinutes + 10)    │
│      - lateMinutes 계산                                      │
│      - checkInMethod = 'pin'                                │
│                                                              │
│ 6-2. checked_in → checked_out                               │
│      - actualDepartureTime = now                            │
│      - isEarlyLeave = (currentMinutes < expected - 30)     │
│      - earlyLeaveMinutes 계산                               │
│      - checkOutMethod = 'pin'                               │
│                                                              │
│ 6-3. checked_out → checked_in (재입실)                      │
│      - status = 'checked_in'                                │
│      - notes += '재입실: HH:MM:SS'                          │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. 링크 사용 통계 업데이트                                   │
├─────────────────────────────────────────────────────────────┤
│ - usageCount++                                               │
│ - lastUsedAt = now                                           │
└─────────────────────────────────────────────────────────────┘
```

**지각 판정 로직**:
```typescript
const expectedMinutes = parseTimeToMinutes(expectedArrivalTime); // 예: 09:00 → 540
const currentMinutes = getCurrentKoreaMinutes();                 // 예: 09:15 → 555
const isLate = currentMinutes > expectedMinutes + 10;            // 10분 초과 시 지각
const lateMinutes = currentMinutes - expectedMinutes;            // 15분 지각
```

**조퇴 판정 로직**:
```typescript
const expectedMinutes = parseTimeToMinutes(expectedDepartureTime); // 예: 12:00 → 720
const currentMinutes = getCurrentKoreaMinutes();                   // 예: 11:00 → 660
const isEarlyLeave = currentMinutes < expectedMinutes - 30;        // 30분 이상 일찍 나감
const earlyLeaveMinutes = expectedMinutes - currentMinutes;        // 60분 조퇴
```

### 4.3 수동 체크인 프로세스 (관리자)

#### 4.3.1 함수: manualCheckIn

**입력**:
```typescript
{
  studentId: string,
  seatLayoutId: string,
  notes?: string
}
```

**프로세스**:
```
1. 슬롯 기반 조회
   └─> status: 'scheduled' 또는 'not_arrived'
   └─> 현재 시간 ±30분 이내 슬롯

2. 트랜잭션 체크인
   └─> 최신 상태 재확인
   └─> actualArrivalTime = now
   └─> checkInMethod = 'manual'
   └─> isLate 계산

3. not_arrived 복구 시
   └─> notes += '관리자 수동 복구: 유예 기간 내 체크인'
```

**checkAttendanceByPin과의 차이점**:
- PIN 검증 없음
- Rate Limiting 없음
- 인증된 관리자만 호출 가능 (`request.auth`)

---

## 5. 상태 전환 로직

### 5.1 상태 전환 다이어그램

```
                          배치: createDailyAttendanceRecords (02:00)
                                        ↓
                                  ┌──────────┐
                                  │scheduled │ ← 초기 상태 (예정)
                                  └──────────┘
                                   ↓         ↓
                    PIN/수동 체크인 ↓         ↓ 배치: markNotArrivedAtStartTime
                                   ↓         ↓ (수업 시작 시각)
                              ┌──────────┐  ↓
                              │checked_in│  ↓
                              └──────────┘  ↓
                                   ↓         ↓
              PIN/수동 체크아웃 ↓         ↓
                                   ↓         ↓
                             ┌───────────┐  ↓
                             │checked_out│  ↓
                             └───────────┘  ↓
                                   ↓         ↓
                  재입실 (PIN) ↓         ↓
                                   ↓         ↓
                              ┌──────────┐  ↓
                              │checked_in│  ↓
                              └──────────┘  ↓
                                             ↓
                                      ┌──────────────┐
                                      │not_arrived   │
                                      └──────────────┘
                                       ↓           ↓
                PIN (유예 내) ↓           ↓ 배치: markAbsentUnexcused
                                       ↓           ↓ (유예 초과)
                              ┌──────────┐         ↓
                              │checked_in│         ↓
                              └──────────┘         ↓
                              (복구, 지각)         ↓
                                                   ↓
                                          ┌──────────────────┐
                                          │absent_unexcused  │ ← 최종 상태
                                          └──────────────────┘

                          관리자 수동 처리
                                ↓
                        ┌──────────────┐
                        │absent_excused│ ← 최종 상태 (사유 입력)
                        └──────────────┘
```

### 5.2 상태 전환 규칙

#### 5.2.1 scheduled → checked_in
- **트리거**: PIN 체크인 또는 수동 체크인
- **조건**: 슬롯 시작 -30분 ~ 종료 +30분 이내
- **처리**:
  ```typescript
  {
    actualArrivalTime: Timestamp.now(),
    status: 'checked_in',
    isLate: currentMinutes > expectedMinutes + 10,
    lateMinutes: isLate ? (currentMinutes - expectedMinutes) : undefined,
    checkInMethod: 'pin' | 'manual',
    updatedAt: Timestamp.now()
  }
  ```

#### 5.2.2 scheduled → not_arrived
- **트리거**: 배치 작업 `markNotArrivedAtStartTime`
- **조건**: 수업 시작 시각 도달 (expectedArrivalTime)
- **처리**:
  ```typescript
  {
    status: 'not_arrived',
    notArrivedAt: Timestamp.now(),  // 수업 시작 시간
    updatedAt: Timestamp.now()
  }
  ```

#### 5.2.3 not_arrived → checked_in (복구)
- **트리거**: PIN 체크인 (유예 기간 내)
- **조건**:
  - 현재 시간 ≤ 수업 종료 + 30분 + 5분 (유예)
  - 트랜잭션으로 `absent_unexcused` 아님 확인
- **처리**:
  ```typescript
  {
    actualArrivalTime: Timestamp.now(),
    status: 'checked_in',
    isLate: true,  // 항상 지각
    lateMinutes: currentMinutes - expectedMinutes,
    checkInMethod: 'pin',
    notes: '자동 복구: 유예 기간 내 체크인',
    updatedAt: Timestamp.now()
  }
  ```

#### 5.2.4 not_arrived → absent_unexcused
- **트리거**: 배치 작업 `markAbsentUnexcused`
- **조건**: 현재 시간 > 수업 종료 + 30분 + 5분 (유예)
- **처리**:
  ```typescript
  {
    status: 'absent_unexcused',
    absentConfirmedAt: Timestamp(수업 종료 + 30 + 5),  // 유예 종료 시간
    absentMarkedAt: Timestamp.now(),                    // 배치 처리 시간
    updatedAt: Timestamp.now()
  }
  ```

#### 5.2.5 checked_in → checked_out
- **트리거**: PIN 체크아웃 또는 수동 체크아웃
- **조건**: 이미 체크인 상태
- **처리**:
  ```typescript
  {
    actualDepartureTime: Timestamp.now(),
    status: 'checked_out',
    isEarlyLeave: currentMinutes < expectedMinutes - 30,
    earlyLeaveMinutes: isEarlyLeave ? (expectedMinutes - currentMinutes) : undefined,
    checkOutMethod: 'pin' | 'manual',
    updatedAt: Timestamp.now()
  }
  ```

#### 5.2.6 checked_out → checked_in (재입실)
- **트리거**: PIN 체크인 (이미 체크아웃 상태)
- **조건**: 슬롯 시간 범위 내
- **처리**:
  ```typescript
  {
    status: 'checked_in',
    checkInMethod: 'pin',
    notes: notes + '\n재입실: HH:MM:SS',
    updatedAt: Timestamp.now()
  }
  ```

#### 5.2.7 관리자 강제 변경
- **트리거**: `updateAttendanceStatus` 함수 호출
- **조건**: 관리자 인증
- **가능한 변경**:
  - 모든 상태 → `absent_excused` (사유 입력 필수)
  - 모든 상태 → `absent_unexcused`
  - 모든 상태 → `checked_in`, `checked_out`, `not_arrived`

### 5.3 트랜잭션 사용

**사용 이유**: 동시성 문제 방지 (배치 작업과 PIN 체크인 충돌)

**예시 시나리오**:
```
1. 09:00 배치: scheduled → not_arrived 전환 시작
2. 09:00:05 학생: PIN 체크인 시도
3. 트랜잭션 없으면: 둘 다 성공 → 데이터 불일치
4. 트랜잭션 있으면: 하나만 성공, 다른 하나는 재시도 또는 에러
```

**구현**:
```typescript
const result = await db.runTransaction(async (transaction) => {
  // 1. 최신 상태 재확인
  const currentRecordDoc = await transaction.get(recordRef);
  const currentRecordData = currentRecordDoc.data();

  // 2. 상태 검증
  if (currentRecordData.status === 'absent_unexcused') {
    throw new HttpsError('failed-precondition', '유예 기간 종료');
  }

  if (currentRecordData.status !== 'scheduled' &&
      currentRecordData.status !== 'not_arrived') {
    throw new HttpsError('failed-precondition', '체크인 불가 상태');
  }

  // 3. 업데이트
  transaction.update(recordRef, updateData);

  return { success: true, data: { ...currentRecordData, ...updateData } };
});
```

---

## 6. 보안 메커니즘

### 6.1 PIN 보안

#### 6.1.1 bcrypt 해싱
```typescript
// 생성 시
const saltRounds = 10;
const pinHash = await bcrypt.hash(pin, saltRounds);

// 저장
{
  pinHash: '$2b$10$...',  // bcrypt 해시
  actualPin: '1234'       // 평문 (관리자 확인용)
}

// 검증 시
const isMatch = await bcrypt.compare(pin, pinHash);
```

#### 6.1.2 PIN 잠금 메커니즘
```typescript
// 실패 시
if (!matchedPin) {
  await pinRef.update({
    failedAttempts: FieldValue.increment(1),
    lastFailedAt: Timestamp.now()
  });

  // 5회 실패 시 자동 잠금
  if (failedAttempts >= 5) {
    await pinRef.update({ isLocked: true });
  }
}

// 성공 시
await pinRef.update({
  failedAttempts: 0,  // 초기화
  lastUsedAt: Timestamp.now()
});
```

#### 6.1.3 중복 검증 (최적화)
```typescript
// ❌ 비효율: 모든 PIN 가져와서 bcrypt 비교
const allPins = await db.collection('pins').get();
for (const pinDoc of allPins.docs) {
  const isMatch = await bcrypt.compare(newPin, pinDoc.data().pinHash);
  if (isMatch) throw new Error('중복');
}

// ✅ 효율: actualPin 필드로 쿼리 1회
const duplicateCheck = await db.collection('pins')
  .where('actualPin', '==', newPin)
  .where('isActive', '==', true)
  .limit(1)
  .get();

if (!duplicateCheck.empty && duplicateCheck.docs[0].id !== studentId) {
  throw new Error('중복');
}
```

### 6.2 Rate Limiting

#### 6.2.1 구현
```typescript
async function checkRateLimit(db: Firestore, linkToken: string): Promise<void> {
  const now = Timestamp.now();
  const fiveMinutesAgo = Timestamp.fromMillis(now.toMillis() - 5 * 60 * 1000);

  // Firestore 복합 인덱스 필요: linkToken (ASC) → success (ASC) → timestamp (DESC)
  const recentFailures = await db.collection('pin_attempt_logs')
    .where('linkToken', '==', linkToken)
    .where('success', '==', false)
    .where('timestamp', '>', fiveMinutesAgo)
    .get();

  if (recentFailures.size >= 20) {
    throw new HttpsError('resource-exhausted',
      '너무 많은 실패 시도가 있었습니다. 5분 후 다시 시도하세요.');
  }
}
```

#### 6.2.2 로그 기록
```typescript
async function logPinAttempt(
  db: Firestore,
  linkToken: string,
  success: boolean,
  studentId?: string
): Promise<void> {
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000);

  await db.collection('pin_attempt_logs').add({
    linkToken,
    success,
    studentId: studentId || null,
    timestamp: now,
    expiresAt  // Firestore TTL로 24시간 후 자동 삭제
  });
}
```

### 6.3 데이터 격리 (User-Based Isolation)

#### 6.3.1 Cloud Functions 검증
```typescript
export const someFunction = onCall({ cors: corsConfig }, async (request) => {
  // 1. 인증 확인
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '인증이 필요합니다.');
  }

  // 2. userId 추출
  const userId = request.auth.uid;

  // 3. 모든 데이터 접근 시 userId 검증
  const recordRef = db
    .collection('users')
    .doc(userId)  // ⭐ 반드시 요청자의 userId만 접근
    .collection('student_attendance_records')
    .doc(recordId);
});
```

#### 6.3.2 Firestore Security Rules
```javascript
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;

  match /student_attendance_records/{recordId} {
    allow read, write: if request.auth.uid == userId;
  }

  match /attendance_student_pins/{pinId} {
    allow read, write: if request.auth.uid == userId;
  }
}
```

### 6.4 CORS 설정

```typescript
const projectId = process.env.GCLOUD_PROJECT;
const corsConfig = projectId ? [
  `https://${projectId}.web.app`,
  `https://${projectId}.firebaseapp.com`
] : true;

export const someFunction = onCall({ cors: corsConfig }, async (request) => {
  // ...
});
```

---

## 7. 자동화 배치 작업

### 7.1 배치 1: createDailyAttendanceRecords

**스케줄**: `0 2 * * *` (매일 02:00 Asia/Seoul)

**설정**:
```typescript
onSchedule({
  schedule: '0 2 * * *',
  timeZone: 'Asia/Seoul',
  region: 'asia-northeast3',
  timeoutSeconds: 540,  // 9분 (대량 처리)
  memory: '1GiB'
})
```

**실행 플로우**:
```
1. 모든 사용자 조회
   ├─> users/ 컬렉션 전체 스캔
   └─> 예상: 100명 사용자

2. 각 사용자별 활성 좌석 할당 조회
   ├─> users/{userId}/seat_assignments
   │   .where('status', '==', 'active')
   └─> 예상: 사용자당 20개 할당

3. 각 할당별 시간표 조회
   ├─> users/{userId}/student_timetables/{timetableId}
   └─> 예상: 할당당 1개 시간표

4. 오늘 요일 활성 확인
   ├─> basicSchedule.dailySchedules[dayOfWeek].isActive
   └─> 비활성이면 SKIP

5. 출석 의무 슬롯 필터링
   ├─> detailedSchedule.timeSlots
   │   .filter(slot => slot.type === 'class' || slot.type === 'self_study')
   └─> 'external' 슬롯 제외

6. 배치 작업으로 레코드 생성
   ├─> batch.set(recordRef, recordData)
   └─> batch.commit()
```

**생성되는 데이터**:
```typescript
{
  id: '{studentId}_{YYYYMMDD}_slot{N}_{timestamp}',
  userId,
  studentId,
  studentName,
  seatLayoutId,
  seatId,
  seatNumber,
  date: '2025-01-31',  // getTodayInKorea()
  dayOfWeek: 'friday',  // getCurrentKoreaDayOfWeek()

  // 시간표 슬롯 정보
  timetableId,
  timeSlotId: 'slot_0' | 'slot_1' | ...,
  timeSlotSubject: '수학' | '자습' | ...,
  timeSlotType: 'class' | 'self_study',

  expectedArrivalTime: '09:00',
  expectedDepartureTime: '12:00',

  status: 'scheduled',  // ← 초기 상태
  isLate: false,
  isEarlyLeave: false,

  sessionNumber: 1,  // 슬롯 순서
  isLatestSession: false,

  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  recordTimestamp: Timestamp.now()
}
```

**로그 예시**:
```
[배치 시작] 2025-01-31 (friday) 출석 레코드 생성
[SKIP] userId=user1: 활성 좌석 배정 없음
[SKIP] userId=user2, studentId=student123: 오늘(friday) 비활성
[성공] userId=user3, studentId=student456: 3개 슬롯 생성
[배치 완료] 2025-01-31 - 생성: 1500개, 스킵: 300개
```

### 7.2 배치 2: markNotArrivedAtStartTime

**스케줄**: `0,30 9-23 * * *` (09:00-23:00 매 시 00분과 30분, 29회/일)

**설정**:
```typescript
onSchedule({
  schedule: '0,30 9-23 * * *',
  timeZone: 'Asia/Seoul',
  region: 'asia-northeast3',
  timeoutSeconds: 60,
  memory: '512MiB'
})
```

**최적화 전략**:
```
AS-IS (비효율):
- 모든 scheduled 레코드 조회 → 메모리에서 시간 필터링
- 실행: 매 10분 (144회/일)
- Firestore 읽기: 500개/실행 × 144회 = 72,000회/일

TO-BE (효율):
- WHERE expectedArrivalTime = '09:00' 정밀 쿼리
- 실행: 30분 간격 (29회/일)
- Firestore 읽기: ~5개/실행 × 29회 = 145회/일
- 개선: 99.8% 감소
```

**실행 플로우**:
```
1. 현재 시간 계산
   ├─> getCurrentKoreaTime()
   ├─> currentHour = 9, currentMinute = 0
   └─> timeString = '09:00'

2. 정밀 쿼리
   ├─> users/{userId}/student_attendance_records
   │   .where('date', '==', today)
   │   .where('status', '==', 'scheduled')
   │   .where('expectedArrivalTime', '==', '09:00')  ⭐
   └─> 정확히 이 시간에 시작하는 슬롯만 조회

3. 배치 업데이트
   ├─> batch.update(doc.ref, {
   │     status: 'not_arrived',
   │     notArrivedAt: Timestamp.now(),
   │     updatedAt: Timestamp.now()
   │   })
   └─> batch.commit()
```

**로그 예시**:
```
[미등원 전환 시작] 2025-01-31 09:00
[사용자 처리] userId=user1, 업데이트=3개
[사용자 처리] userId=user2, 업데이트=5개
[미등원 전환 완료] 2025-01-31 09:00 - 총 8개 업데이트
```

### 7.3 배치 3: markAbsentUnexcused

**스케줄**: `*/10 * * * *` (매 10분)

**설정**:
```typescript
onSchedule({
  schedule: '*/10 * * * *',
  timeZone: 'Asia/Seoul',
  region: 'asia-northeast3',
  timeoutSeconds: 120,
  memory: '512MiB'
})
```

**유예 기간 시스템**:
```
수업 종료 시간 + 30분 + 5분(유예) = 유예 종료 시간

예시:
- 수업 시간: 09:00 - 12:00
- 기본 대기: 12:00 + 30분 = 12:30
- 유예 기간: 12:30 + 5분 = 12:35
- 12:35 이전: PIN 입력 시 checked_in 복구 가능 (지각)
- 12:35 이후: absent_unexcused 확정
```

**실행 플로우**:
```
1. 현재 시간 계산
   ├─> currentMinutes = getCurrentKoreaMinutes()
   └─> 예: 745 (12:25)

2. not_arrived 레코드 조회
   ├─> users/{userId}/student_attendance_records
   │   .where('date', '==', today)
   │   .where('status', '==', 'not_arrived')
   └─> 모든 미등원 레코드

3. 각 레코드별 유예 종료 확인
   ├─> slotEndMinutes = parseTimeToMinutes('12:00') = 720
   ├─> graceEndMinutes = 720 + 30 + 5 = 755
   ├─> currentMinutes (745) > graceEndMinutes (755)? → NO
   └─> SKIP

4. 유예 초과 시 업데이트
   ├─> graceEndTime = Date(year, month, day, 12, 35)
   ├─> batch.update(doc.ref, {
   │     status: 'absent_unexcused',
   │     absentConfirmedAt: Timestamp(graceEndTime),  // 12:35
   │     absentMarkedAt: Timestamp.now(),              // 12:40 (실제 처리)
   │     updatedAt: Timestamp.now()
   │   })
   └─> batch.commit()
```

**로그 예시**:
```
[결석 확정 시작] 2025-01-31 12:40
[결석 확정] userId=user1, studentId=student123,
           slot=09:00-12:00, graceEnd=12:35
[결석 확정 완료] 2025-01-31 12:40 - 총 2건 확정
```

### 7.4 배치 작업 타임라인 예시

```
02:00  createDailyAttendanceRecords
       └─> student A: slot1(09:00-12:00), slot2(14:00-17:00) 생성
       └─> status: scheduled

09:00  markNotArrivedAtStartTime
       └─> student A slot1: scheduled → not_arrived

09:15  [학생 A PIN 입력]
       └─> student A slot1: not_arrived → checked_in (복구, 지각 15분)

12:30  [학생 A PIN 입력]
       └─> student A slot1: checked_in → checked_out

14:00  markNotArrivedAtStartTime
       └─> student A slot2: scheduled → not_arrived

14:40  markAbsentUnexcused (매 10분 실행)
       └─> currentMinutes = 880 (14:40)
       └─> graceEndMinutes = 1020 + 30 + 5 = 1055 (17:35)
       └─> 880 < 1055 → SKIP (아직 유예 기간)

17:40  markAbsentUnexcused
       └─> currentMinutes = 1060 (17:40)
       └─> graceEndMinutes = 1055 (17:35)
       └─> 1060 > 1055 → 결석 확정
       └─> student A slot2: not_arrived → absent_unexcused
```

---

## 8. 프론트엔드 통합

### 8.1 상태 관리 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                     3-Layer State Management                 │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: TanStack Query (React Query)                       │
│ - 역할: 서버 상태 관리, 캐싱, 자동 refetch                   │
│ - 데이터: 출석 기록, 좌석 할당, PIN 정보, 좌석 배치도        │
│ - staleTime: 10초 ~ 10분 (데이터 특성별)                    │
│ - refetchInterval: 30초 (출석 기록만)                       │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Zustand (useAttendanceUIStore)                    │
│ - 역할: 클라이언트 UI 상태                                   │
│ - 데이터: 선택된 배치도/좌석/학생, 모달 열림/닫힘           │
│ - 특징: 경량, 보일러플레이트 없음                            │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Real-time Hooks (Firestore onSnapshot)            │
│ - 역할: 실시간 동기화 (옵션)                                 │
│ - 데이터: 출석 기록, 좌석 할당                               │
│ - 특징: 즉시 반영, 다중 관리자 동시 작업 지원                │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 TanStack Query Hooks

#### 8.2.1 Query Keys 구조
```typescript
export const attendanceKeys = {
  all: ['attendance'],
  layouts: () => ['attendance', 'layouts'],
  layout: (id: string) => ['attendance', 'layouts', id],
  assignments: (layoutId: string | null) => ['attendance', 'assignments', layoutId],
  todayRecords: (layoutId: string | null) => ['attendance', 'todayRecords', layoutId],
  record: (recordId: string) => ['attendance', 'record', recordId],
  checkLinks: (layoutId: string | null) => ['attendance', 'checkLinks', layoutId],
  studentPin: (studentId: string | null) => ['attendance', 'pin', studentId],
};
```

#### 8.2.2 주요 Queries

**출석 기록 조회** (자동 갱신):
```typescript
export function useTodayAttendanceRecords(seatLayoutId: string | null) {
  return useQuery({
    queryKey: attendanceKeys.todayRecords(seatLayoutId),
    queryFn: () => seatLayoutId
      ? attendanceService.getTodayAttendanceRecords(seatLayoutId)
      : Promise.resolve([]),
    enabled: !!seatLayoutId,
    staleTime: 10 * 1000,        // 10초
    refetchInterval: 30 * 1000,  // 30초마다 자동 refetch ⭐
  });
}
```

**좌석 할당 조회**:
```typescript
export function useSeatAssignments(layoutId: string | null) {
  return useQuery({
    queryKey: attendanceKeys.assignments(layoutId),
    queryFn: () => layoutId
      ? attendanceService.getSeatAssignments(layoutId)
      : Promise.resolve([]),
    enabled: !!layoutId,
    staleTime: 1 * 60 * 1000,  // 1분
  });
}
```

#### 8.2.3 주요 Mutations

**수동 체크인**:
```typescript
export function useManualCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { studentId: string; seatLayoutId: string; notes?: string }) =>
      attendanceService.manualCheckIn(data),
    onSuccess: (_, variables) => {
      // 즉시 캐시 무효화 및 refetch
      queryClient.invalidateQueries({
        queryKey: attendanceKeys.todayRecords(variables.seatLayoutId)
      });
      queryClient.refetchQueries({
        queryKey: attendanceKeys.todayRecords(variables.seatLayoutId),
        type: 'active'
      });
    },
  });
}
```

**PIN 생성**:
```typescript
export function useGenerateStudentPin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GenerateStudentPinData) =>
      attendanceService.generateStudentPin(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: attendanceKeys.studentPin(variables.studentId)
      });
    },
  });
}
```

### 8.3 Zustand Store

```typescript
interface AttendanceUIState {
  // 선택 상태
  selectedLayoutId: string | null;
  selectedSeatId: string | null;
  selectedStudentId: string | null;
  selectedRecordId: string | null;

  // 모달 상태
  isCreateLayoutModalOpen: boolean;
  isAssignSeatModalOpen: boolean;
  isManagePinModalOpen: boolean;
  isCheckLinkModalOpen: boolean;
  isRecordDetailModalOpen: boolean;

  // Actions (생략)
}

export const useAttendanceUIStore = create<AttendanceUIState>((set) => ({
  // ... 구현
}));
```

**사용 예시**:
```typescript
// 컴포넌트에서
const { selectedLayoutId, setSelectedLayoutId } = useAttendanceUIStore();
const { data: assignments } = useSeatAssignments(selectedLayoutId);
```

### 8.4 Real-time Hooks (옵션)

```typescript
export function useRealtimeAttendanceRecords(
  seatLayoutId: string | null,
  enabled: boolean = true
) {
  const [records, setRecords] = useState<StudentAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !seatLayoutId) return;

    const user = auth.currentUser;
    if (!user) return;

    const today = getTodayInKorea();
    const q = query(
      collection(db, `users/${user.uid}/student_attendance_records`),
      where('seatLayoutId', '==', seatLayoutId),
      where('date', '==', today)
    );

    // 실시간 리스너
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updatedRecords = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecords(updatedRecords);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [seatLayoutId, enabled]);

  return { records, loading, error };
}
```

**TanStack Query vs Real-time Hooks**:
- TanStack Query: 30초 간격 polling, 네트워크 효율적
- Real-time Hooks: 즉시 반영, 다중 관리자 동시 작업 시 유용
- 선택: 사용 사례에 따라 선택 또는 병용

### 8.5 Services Layer

**attendanceService.ts** (588 LOC):
```typescript
class AttendanceService {
  private callFunction<T>(functionName: string, data: any): Promise<T> {
    const user = auth.currentUser;
    const token = await user.getIdToken();
    const functionUrl = `https://asia-northeast3-${projectId}.cloudfunctions.net/${functionName}`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ data })
    });

    const responseData = await response.json();
    return responseData.result || responseData;
  }

  // 좌석 배치도 관리
  async getSeatLayouts(): Promise<SeatLayout[]> { /* ... */ }
  async createSeatLayout(data: CreateSeatLayoutData): Promise<{ layoutId: string }> { /* ... */ }
  async deleteSeatLayout(seatLayoutId: string): Promise<void> { /* ... */ }

  // 좌석 할당
  async getSeatAssignments(seatLayoutId: string): Promise<SeatAssignment[]> { /* ... */ }
  async assignSeat(data: AssignSeatData): Promise<{ assignmentId: string }> { /* ... */ }
  async unassignSeat(assignmentId: string): Promise<void> { /* ... */ }

  // 출석 기록
  async getTodayAttendanceRecords(seatLayoutId: string): Promise<StudentAttendanceRecord[]> { /* ... */ }
  async manualCheckIn(data): Promise<{ action: string; record: StudentAttendanceRecord }> { /* ... */ }
  async manualCheckOut(data): Promise<{ action: string; record: StudentAttendanceRecord }> { /* ... */ }
  async updateAttendanceStatus(data: UpdateAttendanceStatusData): Promise<void> { /* ... */ }

  // PIN 관리
  async getStudentPin(studentId: string): Promise<AttendanceStudentPin | null> { /* ... */ }
  async generateStudentPin(data: GenerateStudentPinData): Promise<{ pin: string }> { /* ... */ }
  async updateStudentPin(data: UpdateStudentPinData): Promise<void> { /* ... */ }
  async unlockStudentPin(studentId: string): Promise<void> { /* ... */ }

  // 출석 체크 링크
  async createAttendanceCheckLink(data): Promise<{ linkId, linkToken, linkUrl }> { /* ... */ }
  async getAttendanceCheckLinks(): Promise<AttendanceCheckLink[]> { /* ... */ }
  async checkAttendanceByPin(data: { linkToken: string; pin: string }): Promise<{ action, message, record }> { /* ... */ }
}

export default new AttendanceService();
```

### 8.6 UI 컴포넌트 구조 (37개)

```
pages/Attendance/
└─ Attendance.tsx (메인 페이지)

components/domain/Attendance/
├─ SeatingChart.tsx          (좌석 배치도 렌더링)
├─ Seat.tsx                  (개별 좌석 컴포넌트)
├─ SeatGroup.tsx             (좌석 그룹)
├─ SeatLayoutSelector.tsx    (배치도 선택)
├─ CreateSeatLayoutModal.tsx (배치도 생성 모달)
├─ ManageGroupsModal.tsx     (그룹 관리)
│
├─ StudentDetailSidebar.tsx  (학생 상세 사이드바)
├─ StudentAssignmentPanel.tsx (학생 할당 패널)
├─ AssignSeatModal.tsx       (좌석 할당 모달)
├─ StudentSearch.tsx         (학생 검색)
│
├─ ManagePinModal.tsx        (PIN 관리 모달)
├─ AttendanceCheckLinkModal.tsx (체크 링크 모달)
├─ AttendanceCheckResultModal.tsx (체크 결과 모달)
│
├─ AttendanceRecordsPanel.tsx (출석 기록 패널)
├─ AttendanceRecordDetailModal.tsx (기록 상세 모달)
├─ AttendanceStatsCard.tsx   (통계 카드)
│
└─ AttendanceContext.tsx     (Context Provider)
```

**주요 컴포넌트 역할**:

1. **SeatingChart**: 좌석 배치도 시각화, 그룹별 좌석 렌더링
2. **Seat**: 개별 좌석, 상태별 색상 표시 (scheduled, checked_in, checked_out, not_arrived, absent)
3. **StudentDetailSidebar**: 좌석 클릭 시 학생 정보, 출석 기록, 체크인/아웃 버튼
4. **AssignSeatModal**: 학생 검색, 시간표 검증, 좌석 할당
5. **ManagePinModal**: PIN 생성/변경/잠금해제
6. **AttendanceCheckLinkModal**: QR 코드 생성, 링크 공유
7. **AttendanceStatsCard**: 실시간 통계 (총 좌석, 출석, 결석 등)

---

## 9. 성능 최적화

### 9.1 Firestore 쿼리 최적화

#### 9.1.1 복합 인덱스

**필수 인덱스**:
```javascript
// firestore.indexes.json
{
  "indexes": [
    // 1. 출석 기록 조회 (오늘 + 좌석 배치도)
    {
      "collectionGroup": "student_attendance_records",
      "fields": [
        { "fieldPath": "seatLayoutId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "ASCENDING" },
        { "fieldPath": "recordTimestamp", "order": "DESCENDING" }
      ]
    },

    // 2. PIN 시도 로그 (Rate Limiting)
    {
      "collectionGroup": "pin_attempt_logs",
      "fields": [
        { "fieldPath": "linkToken", "order": "ASCENDING" },
        { "fieldPath": "success", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },

    // 3. 미등원 전환 (배치 작업)
    {
      "collectionGroup": "student_attendance_records",
      "fields": [
        { "fieldPath": "date", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "expectedArrivalTime", "order": "ASCENDING" }
      ]
    },

    // 4. 결석 확정 (배치 작업)
    {
      "collectionGroup": "student_attendance_records",
      "fields": [
        { "fieldPath": "date", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

#### 9.1.2 배치 작업 최적화

**markNotArrivedAtStartTime 최적화**:
```
AS-IS:
- 모든 scheduled 레코드 조회 → 메모리 필터링
- Firestore 읽기: 500개/실행 × 144회/일 = 72,000회/일

TO-BE:
- WHERE expectedArrivalTime = '09:00' 정밀 쿼리
- Firestore 읽기: ~5개/실행 × 29회/일 = 145회/일
- 개선: 99.8% 감소
```

#### 9.1.3 PIN 중복 검증 최적화

```typescript
// ❌ 비효율: 모든 PIN bcrypt 비교 (O(N))
const allPins = await db.collection('pins').get();  // 100개 읽기
for (const pinDoc of allPins.docs) {
  const isMatch = await bcrypt.compare(newPin, pinDoc.data().pinHash);  // 100회 bcrypt
}

// ✅ 효율: actualPin 필드 쿼리 (O(1))
const duplicateCheck = await db.collection('pins')
  .where('actualPin', '==', newPin)  // 1개 읽기
  .limit(1)
  .get();
```

### 9.2 프론트엔드 최적화

#### 9.2.1 TanStack Query 캐싱 전략

```typescript
// 출석 기록: 빠른 갱신 (10초 stale, 30초 refetch)
useTodayAttendanceRecords: {
  staleTime: 10 * 1000,
  refetchInterval: 30 * 1000
}

// 좌석 할당: 중간 갱신 (1분 stale)
useSeatAssignments: {
  staleTime: 1 * 60 * 1000
}

// 좌석 배치도: 느린 갱신 (5분 stale)
useSeatLayouts: {
  staleTime: 5 * 60 * 1000
}

// PIN 정보: 매우 느린 갱신 (10분 stale)
useStudentPin: {
  staleTime: 10 * 60 * 1000
}
```

#### 9.2.2 Zustand 선택적 구독

```typescript
// ❌ 전체 store 구독 (불필요한 리렌더링)
const store = useAttendanceUIStore();

// ✅ 필요한 필드만 구독
const selectedLayoutId = useAttendanceUIStore(state => state.selectedLayoutId);
const setSelectedLayoutId = useAttendanceUIStore(state => state.setSelectedLayoutId);
```

#### 9.2.3 React.memo + useMemo

```typescript
// 개별 좌석 컴포넌트 메모이제이션
export const Seat = React.memo(({
  seat,
  assignment,
  attendanceRecord,
  onClick
}: SeatProps) => {
  // 좌석 상태 계산
  const seatStatus = useMemo(() => {
    if (!assignment) return 'empty';
    if (!attendanceRecord) return 'scheduled';
    return attendanceRecord.status;
  }, [assignment, attendanceRecord]);

  return <div className={`seat seat-${seatStatus}`} onClick={onClick}>
    {seat.label}
  </div>;
});
```

### 9.3 병렬 처리

#### 9.3.1 PIN 검증 병렬화

```typescript
// ❌ 순차 검증 (느림)
for (const pinDoc of pinsSnapshot.docs) {
  const isMatch = await bcrypt.compare(pin, pinData.pinHash);
  if (isMatch) return pinData;
}

// ✅ 병렬 검증 (빠름)
const pinChecks = pinsSnapshot.docs.map(async (doc) => {
  const pinData = doc.data();
  const isMatch = await bcrypt.compare(pin, pinData.pinHash);
  return { doc, pinData, isMatch };
});

const results = await Promise.all(pinChecks);
const matchedPin = results.find(r => r.isMatch)?.pinData;
```

#### 9.3.2 배치 작업 병렬 커밋

```typescript
// Firestore Batch는 최대 500개 작업
const BATCH_SIZE = 500;

for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = db.batch();
  const chunk = records.slice(i, i + BATCH_SIZE);

  chunk.forEach(record => {
    batch.set(recordRef, recordData);
  });

  await batch.commit();
}
```

---

## 10. 제약사항 및 고려사항

### 10.1 현재 제약사항

#### 10.1.1 슬롯 기반 아키텍처의 한계

**문제**:
- 하나의 슬롯 = 하나의 출석 레코드 (단순 매핑)
- 부분 출석 지원 불가 (예: 09:00-14:00 결석, 14:00-20:00 출석)
- 외부 활동 중 복귀 처리 복잡

**예시**:
```
슬롯: 09:00-17:00 자습
현재 시스템:
- 09:00 not_arrived → 전체 결석 처리
- 부분 출석 기록 불가능

이상적:
- 09:00-14:00: 외부 활동
- 14:00-17:00: 출석
```

**대안** (계획됨):
- 이벤트 기반 아키텍처로 마이그레이션
- `EVENT_BASE_ATTENDANCE_PLAN.md` 참조
- 이벤트 타입: CHECK_IN, CHECK_OUT, MARK_ABSENT, START_EXTERNAL, END_EXTERNAL

#### 10.1.2 시간 정밀도

**제약**:
- `expectedArrivalTime`: 'HH:mm' 문자열 (예: '09:00', '14:30')
- 배치 작업: 30분 단위 (09:00, 09:30, 10:00, ...)
- 30분 단위가 아닌 시작 시간 (예: 09:15) 지원 안됨

**해결책**:
- 시간표 생성 시 30분 단위로 제한
- 또는 배치 작업을 10분 단위로 변경 (비용 증가)

#### 10.1.3 동시성 문제

**시나리오**:
```
1. 09:00:00 배치: scheduled → not_arrived 시작
2. 09:00:05 학생: PIN 체크인 시도
3. 경합 조건: 둘 다 같은 레코드 업데이트
```

**해결**:
- 트랜잭션 사용 (`db.runTransaction`)
- 최신 상태 재확인 후 업데이트

#### 10.1.4 Firestore 비용

**배치 작업 비용** (예상):
```
- createDailyAttendanceRecords:
  - 100명 사용자 × 20개 할당 × 2개 슬롯 = 4,000개 레코드 생성/일
  - Firestore 쓰기: 4,000회/일 = 120,000회/월

- markNotArrivedAtStartTime:
  - 29회/일 × ~10개 레코드 = 290회 읽기/일 = 8,700회/월
  - 업데이트: ~10개/일 = 300회/월

- markAbsentUnexcused:
  - 144회/일 × ~5개 레코드 = 720회 읽기/일 = 21,600회/월
  - 업데이트: ~5개/일 = 150회/월
```

**총 예상 비용** (한국 리전):
- 읽기: 30,300회/월 ≈ $0 (무료 할당량 내)
- 쓰기: 120,450회/월 ≈ $0.36
- 저장: 1GB ≈ $0.18
- **월 총 비용**: ~$0.54

### 10.2 확장성 고려사항

#### 10.2.1 대규모 사용자

**현재 한계**:
- 배치 작업 타임아웃: 9분 (createDailyAttendanceRecords)
- 단일 함수로 모든 사용자 처리

**해결책** (1,000명 이상 시):
1. **Pub/Sub 기반 분산 처리**:
   ```
   Master Function:
   - 사용자 목록 조회
   - Pub/Sub 메시지 발행 (사용자 100명씩)

   Worker Functions:
   - Pub/Sub 구독
   - 할당된 사용자만 처리
   ```

2. **Cloud Tasks 사용**:
   ```
   - 사용자별 Task 생성
   - 병렬 처리
   - 재시도 정책
   ```

#### 10.2.2 실시간 성능

**현재**:
- TanStack Query: 30초 polling
- Real-time Hooks: Firestore onSnapshot (옵션)

**개선** (대규모 시):
- Firebase Realtime Database 병용 (좌석 상태만)
- Redis 캐싱 (Cloud Memorystore)
- GraphQL Subscriptions

### 10.3 보안 고려사항

#### 10.3.1 PIN 보안 강화

**현재**:
- bcrypt 해시 (saltRounds=10)
- 5회 실패 시 잠금
- Rate Limiting (5분 내 20회)

**추가 강화** (필요 시):
- 2FA (학생 이메일/SMS 인증)
- 생체 인증 (지문, Face ID)
- IP 기반 차단
- CAPTCHA

#### 10.3.2 데이터 백업

**현재**:
- Firestore 자동 백업 없음 (기본)

**권장**:
- Firestore 백업 스케줄 설정 (Firebase Console)
- Cloud Storage 내보내기 (매주)
- 중요 컬렉션: `student_attendance_records`, `attendance_student_pins`

### 10.4 미래 개선 계획

#### 10.4.1 이벤트 기반 마이그레이션

**목표**: 슬롯 기반 → 이벤트 기반

**새로운 컬렉션**:
```typescript
/users/{userId}/attendance_events
{
  id: string,
  studentId: string,
  date: string,
  eventType: 'CHECK_IN' | 'CHECK_OUT' | 'MARK_ABSENT' | 'START_EXTERNAL' | 'END_EXTERNAL',
  timestamp: Timestamp,
  metadata: {
    method: 'pin' | 'manual' | 'admin',
    reason?: string,
    notes?: string
  }
}
```

**장점**:
- 부분 출석 지원
- 복잡한 시나리오 처리
- 이벤트 소싱 패턴

**단점**:
- 쿼리 복잡도 증가 (이벤트 → 상태 계산)
- 마이그레이션 비용

#### 10.4.2 통계 및 분석

**현재**:
- 실시간 통계만 (오늘)

**추가 기능**:
- 주간/월간 출석률
- 학생별 출석 패턴 분석
- 지각/조퇴 트렌드
- 예측 알고리즘 (결석 위험 학생 알림)

**구현**:
- BigQuery 연동 (Firestore → BigQuery 스트리밍)
- Cloud Functions 집계 작업
- Data Studio 대시보드

---

## 요약

### 시스템 핵심 특징
1. **슬롯 기반**: 시간표의 각 슬롯마다 개별 출석 레코드 생성
2. **PIN 기반**: 학생 셀프 체크인/아웃 (bcrypt 해시, Rate Limiting)
3. **자동화**: 3개 배치 작업으로 레코드 생성, 미등원, 결석 처리
4. **실시간**: TanStack Query 30초 polling + Firestore onSnapshot 옵션
5. **보안**: User-based isolation, 트랜잭션, PIN 잠금, 데이터 격리

### 주요 프로세스
1. **02:00** - 오늘 출석 레코드 사전 생성 (scheduled)
2. **09:00-23:00 (30분 간격)** - 수업 시작 시 미등원 처리 (not_arrived)
3. **매 10분** - 유예 기간 초과 시 무단결석 확정 (absent_unexcused)
4. **실시간** - 학생 PIN 체크인/아웃, 관리자 수동 처리

### 데이터 흐름
```
시간표 → 좌석 할당 → 출석 레코드 생성 → 상태 전환 → 통계/분석
```

### 성능 최적화
- Firestore 복합 인덱스
- 배치 작업 쿼리 최적화 (99.8% 읽기 감소)
- PIN 병렬 검증
- TanStack Query 캐싱
- React.memo + useMemo

### 제약사항
- 슬롯 기반 (부분 출석 미지원)
- 30분 단위 시작 시간
- 이벤트 기반 마이그레이션 계획 중

---

이 문서는 실제 코드를 직접 읽고 분석하여 작성되었습니다.
