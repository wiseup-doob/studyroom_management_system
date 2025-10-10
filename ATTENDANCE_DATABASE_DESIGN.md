# 출석 관리 시스템 데이터베이스 설계

## 프로젝트 개요

이 문서는 스터디룸 관리 시스템에 **출석 관리 페이지**를 추가하기 위한 데이터베이스 설계를 정의합니다.

### 핵심 원칙
- **기존 기능 유지 + 학생 할당 기능 확장**: 기존 좌석 시스템은 그대로 작동하며, 학생 할당 기능을 추가로 제공
- **사용자 기반 데이터 격리**: 모든 데이터는 `/users/{userId}` 하위에 저장
- **시간표 시스템 연동**: 학생별 시간표(`student_timetables`)의 `basicSchedule.dailySchedules` 데이터 활용
- **하위 호환성 유지**: 기존에 생성된 데이터도 계속 작동하도록 optional 필드 사용

---

## 1. 기존 데이터베이스 구조 분석

### 1.1 기존 컬렉션 구조

현재 시스템은 다음과 같은 사용자별 컬렉션 구조를 가지고 있습니다:

```
/users/{userId}/
├── students/                      # 학생 정보
├── student_timetables/            # 학생별 시간표 (등원/하원 시간 포함)
├── attendance_records/            # 기존: 관리자 자신의 체크인/아웃 기록
├── attendance_summaries/          # 출석 통계
├── seats/                         # ⭐ 좌석 정보 (출석 페이지에서 활용)
├── seat_assignments/              # ⭐ 좌석 배정 (출석 페이지에서 활용)
├── seat_layouts/                  # ⭐ 좌석 배치도 (출석 페이지에서 활용)
├── shared_schedules/              # 공유 스케줄
├── schedule_contributions/        # 스케줄 기여
├── class_sections/                # 반 정보
└── settings/                      # 사용자 설정
```

**중요 - 기존 시스템 수정**:
- 기존 `seats`, `seat_assignments`, `seat_layouts`를 **출석 관리 페이지용으로 수정**합니다.
- 이미 구현된 좌석 관리 Functions는 **출석 시스템용 필드 추가를 위해 수정** 필요합니다.
- 프론트엔드의 프로토타입 코드(`frontend/src/types/attendance.ts`)는 참고용이며, Backend 구조 기준으로 재구현 예정입니다.
- **실제 코드 확인 결과**: 현재 SeatLayout에 groups 필드 없음, SeatAssignment에 학생 관련 필드 없음

### 1.2 핵심 기존 데이터 구조

#### 1.2.1 Student (학생)
```typescript
interface Student {
  id: string;
  name: string;
  email: string;
  grade: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  address?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
}
```

#### 1.2.2 StudentTimetableData (학생 시간표)

**공통 타입 정의:**
```typescript
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
```

```typescript
interface StudentTimetableData {
  id: string;
  studentId: string;
  studentName: string;
  name: string;
  description?: string;

  // ⭐ 1차 레이어: 등원/하원 기본 틀 (출석 시스템에서 활용)
  basicSchedule: {
    dailySchedules: {
      [key in DayOfWeek]: {
        arrivalTime: string;      // 등원 시간 (예: "09:00")
        departureTime: string;    // 하원 시간 (예: "18:00")
        isActive: boolean;        // 해당 요일 활성화 여부
      };
    };
    timeSlotInterval: number;     // 시간 간격 (분)
  };

  // 2차 레이어: 구체적인 일정
  detailedSchedule: {
    [dayOfWeek: string]: {
      timeSlots: TimeSlot[];
    };
  };

  autoFillSettings: {
    enabled: boolean;
    defaultSubject: string;
    fillEmptySlots: boolean;
  };

  isActive: boolean;
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
}
```

**중요**: 출석 시스템은 `basicSchedule.dailySchedules`의 `arrivalTime`과 `departureTime`을 기준으로 학생의 예정 등/하원 시간을 파악합니다.

#### 1.2.3 기존 Seat & SeatLayout (출석 페이지에서 활용)

**Backend 타입** (`functions/src/modules/personal/seatManagement.ts`):
```typescript
interface Seat {
  seatNumber: string;
  location: { x: number; y: number };
  status: "available" | "occupied" | "maintenance";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface SeatAssignment {
  seatId: string;
  assignedAt: Timestamp;
  expiresAt?: Timestamp;
  status: "active" | "expired" | "cancelled";
  updatedAt: Timestamp;
}

interface SeatLayout {
  name: string;
  layout: {
    seats: {
      id: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
    }[];
    dimensions: { width: number; height: number };
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**⚠️ 참고: Frontend 프로토타입 코드**

`frontend/src/types/attendance.ts`와 `frontend/src/components/domain/Attendance/`에 프로토타입 코드가 존재하나, **현재 실제 사용되지 않는 스켈레톤 코드**입니다.

출석 시스템 구현 시:
- Backend 타입(`SeatLayout`, `Seat`, `SeatAssignment`)을 기준으로 Frontend 타입 재작성 필요
- 기존 프로토타입 컴포넌트는 참고용으로만 활용
- 상태 타입은 `StudentAttendanceStatus`로 통일 예정

---

## 2. 출석 관리 시스템 데이터베이스 설계

### 2.1 신규/확장 컬렉션 개요

출석 관리 페이지를 위해 다음을 추가/확장합니다:

```
/users/{userId}/
├── seat_layouts/                  # ✅ 기존 활용: 좌석 배치도 (행x열 그룹 구조 확장)
├── seats/                         # ✅ 기존 활용: 좌석 정보
├── seat_assignments/              # ✅ 기존 확장: 학생 좌석 할당 (studentId 추가)
├── student_attendance_records/    # 🆕 신규: 학생 출결 기록
├── attendance_check_links/        # 🆕 신규: 출결 체크 링크 (숫자 패드)
└── attendance_student_pins/       # 🆕 신규: 학생별 출석 PIN 번호
```

**기존 시스템 수정 전략**:
1. **`seat_layouts`**: 기존 구조에 `groups` 필드 추가 (optional, 하위 호환성 유지)
   - 기존: `layout.seats`만 존재
   - 수정: `layout.groups` 추가, `layout.seats`에 groupId/row/col 추가
2. **`seats`**: 기존 그대로 사용 (수정 없음)
3. **`seat_assignments`**: 기존 구조에 출석용 필드 추가 (optional)
   - 추가 필드: `studentId`, `studentName`, `seatNumber`, `timetableId`, `seatLayoutId`, `expectedSchedule`
4. **신규 컬렉션**: 학생 출석 기록, PIN, 체크 링크만 새로 생성
5. **기존 Functions 수정**: `createSeatLayout`, `assignSeat` 로직 변경 필요

**중요**:
- 좌석 배치는 Backend의 `SeatLayout` 구조(좌표 기반)를 따릅니다. Frontend는 이를 기반으로 시각화합니다.
- **현재 assignSeat은 "사용자당 1좌석" 제한**이 있어, "학생별 좌석 할당"으로 로직 변경 필요

---

## 3. 상세 컬렉션 설계

### 3.1 seat_layouts (좌석 배치도) - 기존 수정

**📌 현재 Backend 구조** (`functions/src/modules/personal/seatManagement.ts:23-38`)

```typescript
interface SeatLayout {
  name: string;
  layout: {
    seats: {
      id: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
    }[];
    dimensions: { width: number; height: number };
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**🔴 출석 시스템을 위한 수정 (하위 호환성 유지)**

출석 관리 시스템에서는 좌석을 그룹별로 관리하기 위해 groups 필드를 **optional**로 추가합니다:

```typescript
interface SeatLayout {
  name: string;
  layout: {
    groups?: {                   // ⭐ Optional (하위 호환성)
      id: string;
      name: string;
      rows: number;
      cols: number;
      position: { x: number; y: number };
    }[];
    seats: {
      id: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
      groupId?: string;          // ⭐ Optional - 어느 그룹에 속하는지
      row?: number;              // ⭐ Optional - 그룹 내 행 번호
      col?: number;              // ⭐ Optional - 그룹 내 열 번호
      label?: string;            // 선택 - 좌석 라벨 (예: "A-1")
    }[];
    dimensions: { width: number; height: number };
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**하위 호환성 전략**:
- 기존 데이터에는 `groups` 필드가 없으므로 optional로 처리
- 새로 만드는 출석용 SeatLayout만 groups 필드 포함
- Frontend는 groups 존재 여부를 확인 후 다르게 렌더링

**Groups 사용 예시**:
```json
{
  "name": "1층 자습실",
  "layout": {
    "groups": [
      {
        "id": "group_a",
        "name": "A구역",
        "rows": 3,
        "cols": 3,
        "position": { "x": 50, "y": 50 }
      },
      {
        "id": "group_b",
        "name": "B구역",
        "rows": 2,
        "cols": 4,
        "position": { "x": 400, "y": 50 }
      }
    ],
    "seats": [
      {
        "id": "seat_a1",
        "position": { "x": 50, "y": 50 },
        "size": { "width": 60, "height": 60 },
        "groupId": "group_a",
        "row": 0,
        "col": 0,
        "label": "A-1"
      },
      {
        "id": "seat_a2",
        "position": { "x": 120, "y": 50 },
        "size": { "width": 60, "height": 60 },
        "groupId": "group_a",
        "row": 0,
        "col": 1,
        "label": "A-2"
      },
      {
        "id": "seat_b1",
        "position": { "x": 400, "y": 50 },
        "size": { "width": 60, "height": 60 },
        "groupId": "group_b",
        "row": 0,
        "col": 0,
        "label": "B-1"
      }
    ],
    "dimensions": { "width": 800, "height": 600 }
  }
}
```

좌석 정보(`seats` 컬렉션)의 `seatNumber` 필드와 `SeatLayout`의 `label` 필드를 조합하여 좌석을 표시합니다.

---

### 3.2 seat_assignments (학생 좌석 할당) - 기존 수정 ⚠️ 구현 필수

**📌 현재 Backend 구조** (`functions/src/modules/personal/seatManagement.ts:15-21`)

```typescript
interface SeatAssignment {
  seatId: string;
  assignedAt: Timestamp;
  expiresAt?: Timestamp;
  status: "active" | "expired" | "cancelled";
  updatedAt: Timestamp;
}
```

**🔴 출석 시스템을 위한 수정 (하위 호환성 유지)**

현재 `SeatAssignment` 인터페이스에 **다음 필드들을 optional로 추가**합니다:

```typescript
interface SeatAssignment {
  // ✅ 기존 필드 (이미 구현됨)
  seatId: string;
  assignedAt: Timestamp;
  expiresAt?: Timestamp;
  status: "active" | "expired" | "cancelled";
  updatedAt: Timestamp;

  // 🔴 출석 시스템용 필수 추가 필드 (구현 필요)
  studentId?: string;            // 학생 ID (students 컬렉션)
  studentName?: string;          // 학생 이름 (캐싱)
  seatNumber?: string;           // 좌석 번호 (seats.seatNumber, 캐싱)
  timetableId?: string;          // 시간표 ID (student_timetables 컬렉션)
  seatLayoutId?: string;         // 좌석 배치도 ID (seat_layouts 컬렉션)

  // 🔴 예정 등/하원 시간 캐싱 (구현 필요)
  expectedSchedule?: {
    [key in DayOfWeek]?: {
      arrivalTime: string;
      departureTime: string;
      isActive: boolean;
    };
  };
}
```

**구현 방법**:
1. `functions/src/modules/personal/seatManagement.ts`의 `SeatAssignment` 인터페이스 수정
2. `assignSeat` Function 수정 ([126-205줄](functions/src/modules/personal/seatManagement.ts:126-205)):
   - 현재: `{ seatId, expiresInHours }` 파라미터만 받음
   - 수정: `{ seatId, studentId, timetableId, seatLayoutId }` 파라미터 추가
   - **중요**: 현재 "사용자당 1좌석" 제한 로직을 "학생별 좌석" 로직으로 변경 (155-165줄)
3. 학생 시간표 조회 → `expectedSchedule` 캐싱 로직 구현

**현재 assignSeat 로직 문제점** ([155-165줄](functions/src/modules/personal/seatManagement.ts:155-165)):
```typescript
// 현재: 사용자당 1개 좌석만 허용
const activeAssignmentQuery = await db
  .collection("users").doc(userId).collection("seat_assignments")
  .where("status", "==", "active")
  .limit(1).get();

if (!activeAssignmentQuery.empty) {
  throw new HttpsError("failed-precondition", "이미 배정된 좌석이 있습니다.");
}
```

**수정 필요**:
```typescript
// 수정: 학생별로 1개 좌석만 허용
if (studentId) {  // 학생 할당인 경우만
  const studentAssignmentQuery = await db
    .collection("users").doc(userId).collection("seat_assignments")
    .where("studentId", "==", studentId)
    .where("seatLayoutId", "==", seatLayoutId)
    .where("status", "==", "active")
    .limit(1).get();

  if (!studentAssignmentQuery.empty) {
    throw new HttpsError("failed-precondition", "해당 학생은 이미 이 배치도에서 좌석이 배정되어 있습니다.");
  }
}
```

**중요 규칙**:
- 학생 할당 시 해당 학생의 **활성 시간표(`isActive: true`)**를 조회
- 시간표의 `basicSchedule.dailySchedules`에 **최소 1개 이상의 활성 요일**이 있어야 할당 가능
- 시간표가 없거나 모든 요일이 비활성인 경우 할당 불가
- **한 학생은 하나의 seatLayoutId 내에서 1개 좌석만** 가질 수 있음

---

### 3.3 student_attendance_records (학생 출결 기록) - 신규

학생들의 출결 정보를 상세하게 기록하는 신규 컬렉션입니다.

**기존 `attendance_records`와의 차이점**:
- 기존: 관리자(사용자) 본인의 체크인/아웃 기록
- 신규: 학생들의 등원/하원 출결 기록
- 완전히 별도 컬렉션으로 관리하여 혼동 방지

```typescript
type StudentAttendanceStatus =
  | "checked_in"      // 등원 (실제 등원 완료)
  | "checked_out"     // 하원 (실제 하원 완료)
  | "not_arrived"     // 미등원 (예정 시간 지났지만 미출석)
  | "absent_excused"  // 사유결석
  | "absent_unexcused"; // 무단결석

interface StudentAttendanceRecord {
  id: string;                    // 문서 ID: {studentId}_{date} 형식
  userId: string;                // 소유자 사용자 ID

  // 학생 정보
  studentId: string;             // 학생 ID
  studentName: string;           // 학생 이름 (캐싱)

  // 좌석 정보
  seatLayoutId: string;          // 좌석 배치도 ID (seat_layouts 컬렉션)
  seatId: string;                // 좌석 ID (seats 컬렉션)
  seatNumber: string;            // 좌석 번호 (seats.seatNumber)

  // 날짜 정보
  date: string;                  // 출석 날짜 (YYYY-MM-DD)
  dayOfWeek: DayOfWeek;          // 요일

  // 예정 시간 (시간표 기반)
  expectedArrivalTime: string;   // 예정 등원 시간 (예: "09:00")
  expectedDepartureTime: string; // 예정 하원 시간 (예: "18:00")

  // 실제 시간
  actualArrivalTime?: Timestamp; // 실제 등원 시간 (PIN 입력 시각)
  actualDepartureTime?: Timestamp; // 실제 하원 시간 (PIN 재입력 시각)

  // 출결 상태
  status: StudentAttendanceStatus;

  // 사유결석 정보
  excusedReason?: string;        // 사유결석 사유
  excusedNote?: string;          // 추가 메모
  excusedBy?: string;            // 사유 입력자 (관리자 이름)

  // 지각/조퇴 판정
  isLate: boolean;               // 지각 여부
  isEarlyLeave: boolean;         // 조퇴 여부
  lateMinutes?: number;          // 지각 분수
  earlyLeaveMinutes?: number;    // 조퇴 분수

  // 메타 정보
  checkInMethod?: "pin" | "manual" | "admin"; // 체크인 방법
  checkOutMethod?: "pin" | "manual" | "admin"; // 체크아웃 방법
  notes?: string;                // 추가 메모

  createdAt: Timestamp;          // 최초 생성 시간
  updatedAt: Timestamp;          // 마지막 업데이트 시간
  recordTimestamp: Timestamp;    // 기록 타임스탬프 (정렬용)
}
```

**문서 ID 규칙**: `{studentId}_{YYYYMMDD}`
- 예: `student_abc_20250115`
- 하루에 한 학생당 하나의 기록만 존재

**상태 전이 규칙**:
```
1. 등원 전: status = "not_arrived"
2. PIN 입력 (1차): status = "checked_in", actualArrivalTime 기록
3. PIN 재입력 (2차): status = "checked_out", actualDepartureTime 기록
4. 관리자가 사유결석 처리: status = "absent_excused"
5. 자동/수동 무단결석 처리: status = "absent_unexcused"
```

---

### 3.4 attendance_check_links (출석 체크 링크)

학생들이 접속하여 PIN을 입력할 수 있는 공유 링크 정보입니다.

```typescript
interface AttendanceCheckLink {
  id: string;                    // 문서 ID (Firestore 자동 생성)
  userId: string;                // 소유자 사용자 ID

  // 링크 정보
  linkToken: string;             // 고유 링크 토큰 (UUID)
  linkUrl: string;               // 전체 URL (예: https://앱주소/attendance/check/{linkToken})

  // 연결 정보
  seatLayoutId: string;          // 연결된 좌석 배치도 ID (seat_layouts 컬렉션)
  seatLayoutName: string;        // 좌석 배치도 이름 (캐싱)

  // 링크 설정
  title: string;                 // 링크 제목 (예: "1층 자습실 출석체크")
  description?: string;          // 설명

  // 활성화 상태
  isActive: boolean;             // 링크 활성화 여부
  expiresAt?: Timestamp;         // 만료 시간 (선택)

  // 사용 통계
  usageCount: number;            // 총 사용 횟수
  lastUsedAt?: Timestamp;        // 마지막 사용 시간

  // 보안 설정
  requireConfirmation: boolean;  // PIN 입력 후 확인 메시지 표시 여부
  allowedDaysOfWeek?: DayOfWeek[]; // 허용 요일 (선택, 비어있으면 모든 요일 허용)
  allowedTimeRange?: {           // 허용 시간대 (선택)
    startTime: string;           // 예: "08:00"
    endTime: string;             // 예: "20:00"
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 3.5 attendance_student_pins (학생 PIN 번호)

각 학생에게 할당된 출석 PIN 번호입니다.

```typescript
interface AttendanceStudentPin {
  id: string;                    // 문서 ID: studentId와 동일
  userId: string;                // 소유자 사용자 ID

  // 학생 정보
  studentId: string;             // students 컬렉션의 ID
  studentName: string;           // 학생 이름 (캐싱)

  // PIN 정보 (보안: 해싱 필수)
  pinHash: string;               // PIN 해시값 (bcrypt) - 평문 pin 필드는 저장하지 않음!

  // PIN 상태
  isActive: boolean;             // PIN 활성화 여부
  isLocked: boolean;             // PIN 잠김 여부 (오입력 시)
  failedAttempts: number;        // 실패 시도 횟수
  lastFailedAt?: Timestamp;      // 마지막 실패 시간

  // PIN 변경 이력
  lastChangedAt: Timestamp;      // 마지막 PIN 변경 시간
  changeHistory?: {              // PIN 변경 이력 (최근 3개)
    changedAt: Timestamp;
    changedBy: string;           // 변경자 (관리자 ID)
  }[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**PIN 규칙**:
- 4-6자리 숫자로 구성
- 학생 생성 시 자동 생성 또는 관리자가 수동 설정
- 중복 PIN은 같은 사용자 내에서 허용 안 됨
- 5회 이상 오입력 시 PIN 잠김 (`isLocked: true`)

---

## 4. 데이터 흐름 및 연동 로직

### 4.1 학생 자리 할당 프로세스

```
1. 관리자가 좌석 배치도 생성/수정 (seat_layouts)
   - 기존 createSeatLayout Function 활용
   - groups 필드 추가하여 여러 그룹(2x3, 3x3 등) 구성
   - 각 좌석에 groupId, row, col, label 설정
2. 학생 선택
3. 학생의 활성 시간표 조회 (student_timetables where studentId & isActive)
4. 시간표의 basicSchedule.dailySchedules 검증
   - 최소 1개 요일이 isActive: true 이어야 함
   - 각 활성 요일은 arrivalTime, departureTime 필수
5. 검증 통과 시 좌석 할당 (seat_assignments)
   - 기존 assignSeat Function 활용
   - studentId, studentName, timetableId, expectedSchedule 필드 추가
   - 시간표 데이터 캐싱
```

### 4.2 출석 체크 프로세스 (PIN 입력)

```
1. 학생이 출석 체크 링크 접속
2. 숫자 패드로 PIN 입력
3. 서버에서 PIN 검증 (attendance_student_pins)
4. 검증 성공 시:
   a. 오늘 날짜 출석 기록 조회 (student_attendance_records)
   b. 기록 없음 → 신규 생성 (status: "checked_in")
   c. 기록 있음 & status: "checked_in" → 업데이트 (status: "checked_out")
   d. actualArrivalTime 또는 actualDepartureTime 기록
   e. 지각/조퇴 여부 자동 계산
5. 검증 실패 시:
   - failedAttempts 증가
   - 5회 이상 시 isLocked: true
```

### 4.3 출석 상태 자동 업데이트

```
[일일 배치 작업 또는 실시간 체크]

1. 예정 등원 시간 + 유예시간(예: 30분) 경과 후에도 체크인 없음
   → status: "not_arrived"

2. 예정 하원 시간까지 체크아웃 없음
   → status: "checked_in" 유지 (조퇴 아님)

3. 관리자가 수동으로 상태 변경 가능:
   - "absent_excused" (사유결석)
   - "absent_unexcused" (무단결석)
```

---

## 5. Firestore 보안 규칙 추가

**📌 현재 firestore.rules 상태** ([firestore.rules:73-77](firestore.rules:73-77))

현재 와일드카드 규칙이 존재하여 신규 컬렉션은 **자동으로 보호**됩니다:
```javascript
// 기타 하위 컬렉션 - 기본 권한 적용
match /{subCollection}/{docId} {
  allow read, write: if request.auth != null &&
    request.auth.uid == userId;
}
```

**🔴 권장사항: 명시적 규칙 추가**

보안 명확성을 위해 신규 컬렉션 규칙을 **명시적으로 추가**하는 것을 권장합니다:

```javascript
// firestore.rules 파일에 추가 (와일드카드 규칙 위에)
match /users/{userId} {
  allow read, write: if request.auth != null &&
    request.auth.uid == userId;

  // 🆕 학생 출석 기록 (기존 attendance_records와 별도)
  match /student_attendance_records/{recordId} {
    allow read, write: if request.auth != null &&
      request.auth.uid == userId;
  }

  // 🆕 출석 체크 링크
  match /attendance_check_links/{linkId} {
    allow read, write: if request.auth != null &&
      request.auth.uid == userId;
  }

  // 🆕 학생 PIN 번호
  match /attendance_student_pins/{pinId} {
    allow read, write: if request.auth != null &&
      request.auth.uid == userId;
  }

  // 기존 규칙들 (seat_layouts, seat_assignments 등은 이미 정의됨)
  // 와일드카드 규칙은 맨 마지막에 위치
}
```

**참고**: 와일드카드 규칙이 있어도 작동하지만, 명시적 규칙이 더 안전합니다.

---

## 6. Cloud Functions API 설계

### 6.1 필요한 Functions 목록

```typescript
// ==================== 좌석 배치 관리 (기존 수정) ====================
// functions/src/modules/personal/seatManagement.ts 수정
export const createSeatLayout                 // 🔴 수정: groups 필드 optional 검증 추가 (283-321줄)
export const getSeatLayouts                   // ✅ 유지: 그대로 사용 (326-355줄)
export const createSeat                       // ✅ 유지: 그대로 사용 (43-82줄)
export const getSeats                         // ✅ 유지: 그대로 사용 (87-121줄)

// ==================== 좌석 할당 (기존 수정) ====================
export const assignSeat                       // 🔴 수정: studentId 등 파라미터 추가, 검증 로직 변경 (126-205줄)
export const unassignSeat                     // ✅ 유지: 그대로 사용 (210-278줄)
export const getCurrentSeatAssignment         // ✅ 유지: 그대로 사용 (360-410줄)
export const validateStudentTimetableForSeat  // 🆕 신규: 시간표 검증

// ==================== 출석 체크 ====================
export const createAttendanceCheckLink        // 출석 체크 링크 생성
export const checkAttendanceByPin             // PIN으로 출석/하원 체크
export const getStudentAttendanceRecords      // 학생 출석 기록 조회
export const updateAttendanceStatus           // 출석 상태 수동 변경 (관리자)

// ==================== PIN 관리 ====================
export const generateStudentPin               // 학생 PIN 생성
export const updateStudentPin                 // PIN 변경
export const validateStudentPin               // PIN 검증
export const unlockStudentPin                 // PIN 잠금 해제

// ==================== 출석 통계 ====================
export const getDailyAttendanceStats          // 일일 출석 통계
export const getStudentAttendanceHistory      // 학생 출석 이력
export const exportAttendanceReport           // 출석 보고서 내보내기
```

### 6.2 핵심 Function 예시

**⚠️ 주의**: 아래 예시 코드는 `SeatAssignment` 인터페이스가 수정된 후 사용 가능합니다. [3.2 seat_assignments](#32-seat_assignments-학생-좌석-할당---기존-수정--구현-필수) 섹션의 필수 필드를 먼저 구현하세요.

#### 6.2.1 좌석 배치도 생성 (Groups 검증)

**🔴 현재 코드**: `functions/src/modules/personal/seatManagement.ts:283-321`

현재 `createSeatLayout`은 groups 검증이 없습니다. 출석용 SeatLayout 생성 시 groups 검증 추가:

```typescript
export const createSeatLayout = onCall({
  cors: true
}, async (request) => {
  const { auth, data } = request;
  if (!auth) throw new HttpsError("unauthenticated", "인증 필요");

  const { name, layout } = data;
  const userId = auth.uid;
  const db = getFirestore();

  // 1. groups 검증 (optional, 출석용 SeatLayout인 경우만 필수)
  if (layout.groups) {  // groups가 제공된 경우만 검증
    if (!Array.isArray(layout.groups) || layout.groups.length === 0) {
      throw new HttpsError("invalid-argument", "groups는 배열이어야 하며 최소 1개 이상의 그룹이 필요합니다.");
    }
  }

  // 2. groups 필드 검증 (groups가 제공된 경우만)
  if (layout.groups) {
    for (const group of layout.groups) {
      if (!group.id || !group.name || !group.rows || !group.cols || !group.position) {
        throw new HttpsError("invalid-argument", "그룹 정보가 불완전합니다.");
      }
    }
  }

  // 3. seats 검증
  if (!layout.seats || !Array.isArray(layout.seats) || layout.seats.length === 0) {
    throw new HttpsError("invalid-argument", "최소 1개 이상의 좌석이 필요합니다.");
  }

  // 4. 각 좌석의 필수 필드 검증
  for (const seat of layout.seats) {
    if (!seat.id || !seat.position || !seat.size) {
      throw new HttpsError("invalid-argument", "좌석 정보가 불완전합니다.");
    }

    // groups가 있을 때만 groupId, row, col 검증 (하위 호환성 유지)
    if (layout.groups && layout.groups.length > 0) {
      if (!seat.groupId || seat.row === undefined || seat.col === undefined) {
        throw new HttpsError(
          "invalid-argument",
          `좌석 ${seat.id}에 groupId, row, col이 필요합니다.`
        );
      }

      // groupId 유효성 검증
      const groupExists = layout.groups.some(g => g.id === seat.groupId);
      if (!groupExists) {
        throw new HttpsError(
          "invalid-argument",
          `좌석 ${seat.id}의 유효하지 않은 groupId: ${seat.groupId}`
        );
      }

      // row, col 범위 검증
      const group = layout.groups.find(g => g.id === seat.groupId);
      if (seat.row < 0 || seat.row >= group.rows) {
        throw new HttpsError(
          "invalid-argument",
          `좌석 ${seat.id}의 row(${seat.row})가 그룹 범위(0-${group.rows - 1})를 벗어났습니다.`
        );
      }
      if (seat.col < 0 || seat.col >= group.cols) {
        throw new HttpsError(
          "invalid-argument",
          `좌석 ${seat.id}의 col(${seat.col})가 그룹 범위(0-${group.cols - 1})를 벗어났습니다.`
        );
      }
    }
  }

  // 5. 좌석 배치도 생성
  const layoutRef = db.collection("users").doc(userId).collection("seat_layouts").doc();
  await layoutRef.set({
    name,
    layout,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return {
    success: true,
    message: "좌석 배치도가 생성되었습니다.",
    data: { layoutId: layoutRef.id }
  };
});
```

#### 6.2.2 학생 좌석 할당 검증

**🔴 사전 요구사항**: `SeatAssignment`에 `studentId`, `timetableId`, `expectedSchedule` 필드 추가 필요

```typescript
export const validateStudentTimetableForSeat = onCall({
  cors: true
}, async (request) => {
  const { auth, data } = request;
  if (!auth) throw new HttpsError("unauthenticated", "인증 필요");

  const { studentId } = data;
  const userId = auth.uid;
  const db = getFirestore();

  // 1. 학생의 활성 시간표 조회
  const timetablesSnapshot = await db
    .collection("users")
    .doc(userId)
    .collection("student_timetables")
    .where("studentId", "==", studentId)
    .where("isActive", "==", true)
    .limit(1)
    .get();

  if (timetablesSnapshot.empty) {
    return {
      success: false,
      message: "활성 시간표가 없습니다. 먼저 시간표를 생성하세요."
    };
  }

  const timetable = timetablesSnapshot.docs[0].data();
  const { basicSchedule } = timetable;

  // 2. dailySchedules 검증
  const activeDays = Object.entries(basicSchedule.dailySchedules)
    .filter(([_, schedule]) => schedule.isActive);

  if (activeDays.length === 0) {
    return {
      success: false,
      message: "시간표에 활성화된 요일이 없습니다."
    };
  }

  // 3. 각 활성 요일의 등/하원 시간 확인
  for (const [day, schedule] of activeDays) {
    if (!schedule.arrivalTime || !schedule.departureTime) {
      return {
        success: false,
        message: `${day} 요일의 등원 또는 하원 시간이 설정되지 않았습니다.`
      };
    }
  }

  // 4. 검증 통과
  return {
    success: true,
    data: {
      timetableId: timetablesSnapshot.docs[0].id,
      activeDays: activeDays.map(([day, schedule]) => ({
        day,
        arrivalTime: schedule.arrivalTime,
        departureTime: schedule.departureTime
      }))
    }
  };
});
```

#### 6.2.3 PIN으로 출석/하원 체크

**🔴 사전 요구사항**: `SeatAssignment`에 `studentId`, `studentName`, `seatNumber`, `seatLayoutId`, `expectedSchedule` 필드 추가 필요

```typescript
export const checkAttendanceByPin = onCall({
  cors: true
}, async (request) => {
  const { data } = request;
  const { linkToken, pin } = data;
  const db = getFirestore();

  // 1. 링크 토큰으로 교실 정보 조회
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
  const linkData = linkDoc.data();
  const userId = linkData.userId;
  const seatLayoutId = linkData.seatLayoutId;

  // 2. PIN 검증
  const pinSnapshot = await db
    .collection("users")
    .doc(userId)
    .collection("attendance_student_pins")
    .where("pin", "==", pin)
    .where("isActive", "==", true)
    .where("isLocked", "==", false)
    .limit(1)
    .get();

  if (pinSnapshot.empty) {
    // PIN 실패 처리 로직...
    throw new HttpsError("invalid-argument", "잘못된 PIN입니다.");
  }

  const pinDoc = pinSnapshot.docs[0];
  const studentId = pinDoc.data().studentId;
  const studentName = pinDoc.data().studentName;

  // 3. 좌석 할당 확인
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
  const today = new Date().toISOString().split("T")[0];
  const dayOfWeek = getDayOfWeek(new Date()); // 요일 계산 함수
  const recordId = `${studentId}_${today.replace(/-/g, "")}`;

  // 3-1. seatNumber Fallback 로직 (캐싱 누락 방어)
  let seatNumber = assignment.seatNumber;
  if (!seatNumber) {
    const seatDoc = await db
      .collection("users")
      .doc(userId)
      .collection("seats")
      .doc(assignment.seatId)
      .get();

    if (seatDoc.exists) {
      seatNumber = seatDoc.data().seatNumber;
    } else {
      throw new HttpsError("not-found", "좌석 정보를 찾을 수 없습니다.");
    }
  }

  // 4. 오늘 출석 기록 조회/생성
  const recordRef = db
    .collection("users")
    .doc(userId)
    .collection("student_attendance_records")
    .doc(recordId);

  const recordDoc = await recordRef.get();
  const now = FieldValue.serverTimestamp();

  if (!recordDoc.exists) {
    // 첫 체크인 (등원)
    await recordRef.set({
      id: recordId,
      userId,
      studentId,
      studentName,
      seatLayoutId: assignment.seatLayoutId,
      seatId: assignment.seatId,
      seatNumber: seatNumber,  // Fallback 로직으로 보장된 값
      date: today,
      dayOfWeek,
      expectedArrivalTime: assignment.expectedSchedule[dayOfWeek]?.arrivalTime,
      expectedDepartureTime: assignment.expectedSchedule[dayOfWeek]?.departureTime,
      actualArrivalTime: now,
      status: "checked_in",
      isLate: false, // 지각 계산 로직 필요
      checkInMethod: "pin",
      createdAt: now,
      updatedAt: now,
      recordTimestamp: now
    });

    return {
      success: true,
      message: `${studentName}님, 등원이 완료되었습니다.`,
      action: "checked_in"
    };
  } else {
    // 두 번째 체크 (하원)
    const recordData = recordDoc.data();
    if (recordData.status === "checked_in") {
      await recordRef.update({
        actualDepartureTime: now,
        status: "checked_out",
        isEarlyLeave: false, // 조퇴 계산 로직 필요
        checkOutMethod: "pin",
        updatedAt: now
      });

      return {
        success: true,
        message: `${studentName}님, 하원이 완료되었습니다.`,
        action: "checked_out"
      };
    } else {
      throw new HttpsError("failed-precondition", "이미 하원 처리되었습니다.");
    }
  }
});
```

---

## 7. 기존 시스템과의 호환성 체크리스트 (실제 코드 기반)

✅ **기존 데이터 구조 최소 수정**
- `students`, `student_timetables` 등 기존 컬렉션은 그대로 유지
- `seat_layouts`, `seat_assignments`는 **optional 필드 추가**로 하위 호환성 유지
- 기존 `attendance_records` ([attendanceManagement.ts](functions/src/modules/personal/attendanceManagement.ts))는 관리자용으로 유지
- 신규 `student_attendance_records`는 학생 출석용으로 완전 분리

✅ **시간표 시스템 연동 (실제 코드 확인 완료)**
- `student_timetables`의 `basicSchedule.dailySchedules` 구조 정확히 일치 ([studentTimetableManagement.ts:32-40](functions/src/modules/personal/studentTimetableManagement.ts:32-40))
- arrivalTime, departureTime, isActive 필드 존재 확인
- 등원/하원 시간을 시간표에서 자동으로 가져옴

✅ **사용자 데이터 격리**
- 모든 출석 관련 컬렉션은 `/users/{userId}` 하위에 저장
- Firestore 보안 규칙 ([firestore.rules:73-77](firestore.rules:73-77)) 와일드카드로 자동 커버
- 명시적 규칙 추가 권장하지만 필수는 아님

⚠️ **기존 좌석 시스템 수정 필요**
- `SeatLayout` 인터페이스: groups 필드 **optional 추가** ([seatManagement.ts:23-38](functions/src/modules/personal/seatManagement.ts:23-38))
- `SeatAssignment` 인터페이스: 학생 정보 필드 **optional 추가** ([seatManagement.ts:15-21](functions/src/modules/personal/seatManagement.ts:15-21))
- `assignSeat` Function: "사용자당 1좌석" 로직을 "학생별 좌석"으로 변경 ([seatManagement.ts:155-165](functions/src/modules/personal/seatManagement.ts:155-165))
- `createSeatLayout` Function: groups 검증 로직 추가 ([seatManagement.ts:283-321](functions/src/modules/personal/seatManagement.ts:283-321))

✅ **스마트한 확장 전략**
- 기존 컬렉션에 **optional 필드 추가**로 확장
- `student_attendance_records`: 학생 출석 기록 (기존 attendance_records와 구분)
- 신규 컬렉션은 최소화 (PIN, 체크 링크만)
- 혼동 가능성 완전 제거

✅ **확장 가능한 설계**
- 향후 QR 코드, NFC, 생체인식 등 다른 체크인 방법 추가 가능
- 출석 통계, 보고서, 알림 기능 확장 가능
- 기존 시스템에 영향 없이 독립적 발전 가능

---

## 8. 구현 우선순위

### Phase 1: 기본 구조 수정 (필수)

**📌 현재 코드 확인 완료**: `functions/src/modules/personal/seatManagement.ts`

**1. `SeatLayout` 인터페이스 수정** ([23-38줄](functions/src/modules/personal/seatManagement.ts:23-38))
- **현재**: groups 필드 없음
- **수정**: `layout.groups?` 필드 추가 (optional, 하위 호환성)
- **수정**: `layout.seats[].groupId?`, `row?`, `col?`, `label?` 추가 (optional)

**2. `createSeatLayout` Function 수정** ([283-321줄](functions/src/modules/personal/seatManagement.ts:283-321))
- **현재**: groups 검증 없음
- **수정**: groups가 제공된 경우에만 검증 추가
  - groups 배열 검증
  - 각 group 필드 검증 (id, name, rows, cols, position)
  - seats의 groupId 유효성 검증
  - row, col 범위 검증

**3. `SeatAssignment` 인터페이스 수정** ([15-21줄](functions/src/modules/personal/seatManagement.ts:15-21))
- **현재**: seatId, assignedAt, expiresAt, status, updatedAt만 존재
- **수정**: 다음 필드 추가 (모두 optional)
  - `studentId?`, `studentName?`, `seatNumber?`
  - `timetableId?`, `seatLayoutId?`
  - `expectedSchedule?` (요일별 등/하원 시간)

**4. `assignSeat` Function 수정** ([126-205줄](functions/src/modules/personal/seatManagement.ts:126-205))
- **현재**: `{ seatId, expiresInHours }` 파라미터만 받음
- **수정**:
  - 파라미터 추가: `studentId`, `timetableId`, `seatLayoutId`
  - "사용자당 1좌석" 로직 → "학생별 좌석" 로직 변경 ([155-165줄](functions/src/modules/personal/seatManagement.ts:155-165))
  - 학생 시간표 조회 및 expectedSchedule 생성 로직 추가
  - **출석용 SeatLayout 검증 추가** (studentId가 있을 때):
    ```typescript
    // studentId가 제공된 경우, 해당 seatLayoutId의 groups 존재 여부 확인
    if (studentId && seatLayoutId) {
      const layoutDoc = await db
        .collection("users").doc(userId)
        .collection("seat_layouts").doc(seatLayoutId)
        .get();

      if (!layoutDoc.exists) {
        throw new HttpsError("not-found", "좌석 배치도를 찾을 수 없습니다.");
      }

      const layoutData = layoutDoc.data();
      if (!layoutData.layout.groups || layoutData.layout.groups.length === 0) {
        throw new HttpsError(
          "invalid-argument",
          "출석 관리용 좌석 배치도는 groups 정보가 필요합니다. 출석용 배치도를 새로 생성해주세요."
        );
      }
    }
    ```

**5. 신규 Functions 구현**
- `validateStudentTimetableForSeat`: 시간표 검증
- `generateStudentPin`, `validateStudentPin`, `updateStudentPin`, `unlockStudentPin`: PIN 관리

### Phase 2: 출석 체크 (핵심)
1. `attendance_check_links` 컬렉션 및 링크 생성 Functions
2. `student_attendance_records` 생성 및 PIN 체크 Function (`checkAttendanceByPin`)
3. 출석/하원 상태 전이 로직
4. 지각/조퇴 자동 계산

### Phase 3: 관리 및 통계 (고급)
1. 출석 기록 조회 및 필터링
2. 일일/주간/월간 출석 통계
3. 사유결석/무단결석 수동 처리
4. 출석 보고서 내보내기

---

## 9. 참고 사항

### 9.1 시간대 처리 ⚠️ 중요

**현재 코드 문제점**: `new Date().toISOString().split("T")[0]` 사용 ([attendanceManagement.ts:27](functions/src/modules/personal/attendanceManagement.ts:27))
- Cloud Functions는 UTC 시간대 사용
- 한국 자정(0시) 근처에 실행 시 날짜가 하루 밀리는 문제 발생 가능

**해결 방안 1 - 간단한 방법** (추가 라이브러리 불필요):
```typescript
// UTC+9 시간대 적용하여 날짜 계산
function getTodayInKorea(): string {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  return koreaTime.toISOString().split("T")[0];
}

const today = getTodayInKorea(); // YYYY-MM-DD
```

**해결 방안 2 - 라이브러리 사용** (더 정확하지만 의존성 추가):
```typescript
// date-fns-tz 설치: npm install date-fns date-fns-tz
import { formatInTimeZone } from 'date-fns-tz';

const today = formatInTimeZone(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
```

**권장**: 해결 방안 1 (현재 프로젝트에 date-fns 의존성 없음)

### 9.2 PIN 보안 🔐

**해싱(Hashing) 사용 필수** (암호화가 아님):
- PIN은 **bcrypt 해싱** 후 저장 (복호화 불가능한 단방향 변환)
- 평문 저장 시 DB 유출 시 모든 학생 PIN 노출

**구현 방법**:
```typescript
// 1. bcrypt 설치 (functions/package.json에 추가 필요)
// npm install bcrypt @types/bcrypt

import * as bcrypt from 'bcrypt';

// PIN 생성/변경 시
const saltRounds = 10;
const pinHash = await bcrypt.hash(pin, saltRounds);

// attendance_student_pins 문서에 저장
await pinRef.set({
  studentId,
  pinHash,        // 평문 pin 대신 해시값 저장
  // pin 필드는 저장하지 않음!
  isActive: true,
  isLocked: false,
  // ...
});

// PIN 검증 시
const isValid = await bcrypt.compare(submittedPin, storedPinHash);
if (!isValid) {
  // PIN 실패 처리...
}
```

**참고**:
- 잠금 해제는 관리자만 가능
- PIN 변경 이력 최소 3개 보관 권장

### 9.3 성능 최적화
- 자주 조회되는 데이터는 캐싱 (예: studentName, seatNumber)
- **캐싱 누락 방어**: 출석 체크 시 캐싱된 필드(seatNumber 등)가 없으면 원본 컬렉션에서 조회하는 Fallback 로직 필수
- 복합 인덱스 생성 필요:
  - `student_attendance_records`: `(userId, date, studentId)`
  - `seat_assignments`: `(userId, seatLayoutId, status)`, `(userId, studentId, seatLayoutId, status)`
  - `attendance_student_pins`: `(userId, pin, isActive, isLocked)`

### 9.4 에러 처리

**현재 코드 패턴** ([studentManagement.ts](functions/src/modules/personal/studentManagement.ts), [seatManagement.ts](functions/src/modules/personal/seatManagement.ts)):
```typescript
throw new HttpsError("not-found", "학생을 찾을 수 없습니다.");
```

**개선 제안 - 구조화된 에러 코드 추가** (선택사항):
```typescript
// Frontend에서 errorCode로 특정 처리 가능
throw new HttpsError(
  "not-found",
  "해당 학생은 이 좌석 배치도에 배정된 좌석이 없습니다.",
  { errorCode: "SEAT_ASSIGNMENT_NOT_FOUND_FOR_STUDENT" }
);
```

**장점**:
- Frontend에서 errorCode 기반 UI 분기 처리 가능
- 다국어 처리 용이
- 에러 추적 및 모니터링 강화

**현재 패턴으로도 충분하므로 선택적 적용 권장**

**필수 사항**:
- 모든 Functions에서 `HttpsError` 사용
- 사용자 친화적인 한글 메시지 제공
- 로깅을 통한 디버깅 지원

---

## 10. 마이그레이션 계획

**하위 호환성 유지를 위한 전략**:

### 10.1 기존 데이터 처리
- 기존 `seat_layouts` 데이터: groups 필드가 없어도 **정상 작동**
- 기존 `seat_assignments` 데이터: 학생 정보 필드가 없어도 **정상 작동**
- optional 필드 추가로 **마이그레이션 불필요**

### 10.2 신규 기능 사용 절차
1. 기존 학생 데이터 그대로 사용
2. **출석용 SeatLayout 새로 생성** (groups 필드 포함 필수)
   - Frontend UI에서 "출석 관리용 배치도" 옵션 제공 권장
   - groups가 없는 배치도에 학생 할당 시도 시 명확한 에러 메시지
3. 학생 좌석 할당 (studentId, seatLayoutId와 함께)
   - assignSeat에서 출석용 배치도인지 자동 검증
4. 학생 PIN 생성 (일괄 또는 개별)
5. 출석 체크 링크 생성 및 공유

### 10.3 기존 기능 영향 없음
- 기존 좌석 시스템 사용자는 계속 사용 가능
- groups 필드 없는 SeatLayout도 계속 작동 (출석 기능만 사용 불가)
- studentId 없는 SeatAssignment도 계속 작동

---

## 요약

본 설계는 기존 스터디룸 관리 시스템과 **100% 호환**되며, **완전히 독립적인 출석 관리 시스템**을 추가합니다.

### 핵심 특징
- ✅ **완벽한 시간표 연동**: `student_timetables`의 `basicSchedule.dailySchedules` 활용
- ✅ **명확한 분리**: `student_attendance_records` (학생 출석) ≠ `attendance_records` (관리자)
- ✅ **기존 시스템 재사용**: `seats`, `seat_layouts`, `seat_assignments` 활용
- ✅ **하위 호환성 유지**: optional 필드 추가로 기존 기능 영향 없음
- ✅ **PIN 기반 자가 체크인**: 학생이 직접 등원/하원 기록
- ✅ **5가지 출결 상태**: 정확한 출석 관리
- ✅ **유연한 좌석 배치**: 여러 그룹, 커스텀 행×열 지원
- ✅ **효율적 구현**: 이미 있는 컴포넌트와 Functions 최대 활용

### 호환성 보장
- ✅ 기존 컬렉션 **확장** (수정 아님, 선택적 필드 추가)
- ✅ 기존 Functions **재사용** (필요시 확장)
- ✅ Backend 타입 기준으로 Frontend 구현
- ✅ 하위 호환성 **완벽 유지**
- ✅ 새로운 페이지로 추가

기존 시스템을 최대한 활용하면서 강력한 출석 관리 기능을 추가할 수 있습니다! 🎉

### 개발 효율성
- 🚀 **중복 개발 제거**: 좌석 시스템을 새로 만들 필요 없음
- 🚀 **검증된 코드 활용**: 이미 작동하는 Functions와 컴포넌트 사용
- 🚀 **빠른 구현**: 출석 로직과 PIN 시스템에만 집중
- 🚀 **유지보수 간편**: 하나의 좌석 시스템으로 통합 관리
