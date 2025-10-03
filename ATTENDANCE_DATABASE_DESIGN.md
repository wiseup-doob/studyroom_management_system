# 출석 관리 시스템 데이터베이스 설계

## 프로젝트 개요

이 문서는 스터디룸 관리 시스템에 **출석 관리 페이지**를 추가하기 위한 데이터베이스 설계를 정의합니다.

### 핵심 원칙
- **기존 시스템과의 완전한 호환성**: 기존 데이터 구조를 수정하지 않고 확장만 진행
- **사용자 기반 데이터 격리**: 모든 데이터는 `/users/{userId}` 하위에 저장
- **시간표 시스템 연동**: 학생별 시간표(`student_timetables`)의 `dailySchedules` 데이터 활용

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
├── timetables/                    # 기본 시간표
├── shared_schedules/              # 공유 스케줄
├── schedule_contributions/        # 스케줄 기여
├── class_sections/                # 반 정보
└── settings/                      # 사용자 설정
```

**중요 - 기존 시스템 활용**:
- 기존 `seats`, `seat_assignments`, `seat_layouts`는 **출석 관리 페이지에서 활용**됩니다.
- 이미 구현된 좌석 관리 Functions와 타입을 그대로 사용합니다.
- 프론트엔드에도 `Classroom`, `AttendanceSeat` 타입과 컴포넌트가 이미 존재합니다.

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

**Frontend 타입** (`frontend/src/types/attendance.ts`):
```typescript
interface Classroom {
  id: string;
  name: string;
  rows: number;
  cols: number;
  seats: AttendanceSeat[];
  createdAt: Date;
  updatedAt: Date;
}

interface AttendanceSeat {
  id: string;
  number: number;
  row: number;
  col: number;
  studentId?: string;
  status: SeatStatus;
}

type SeatStatus =
  | 'empty'         // 빈 좌석
  | 'not-enrolled'  // 미등원
  | 'dismissed'     // 사유결석
  | 'present'       // 등원
  | 'unauthorized'  // 무단결석
  | 'authorized'    // 하원
```

**이미 구현된 컴포넌트**:
- `SeatingChart.tsx`: 좌석 배치도 표시
- `ClassroomSelector.tsx`: 교실 선택
- `Seat.tsx`: 개별 좌석 컴포넌트
- `AttendanceContext.tsx`: 출석 상태 관리

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

**기존 시스템 활용 전략**:
1. **`seat_layouts`**: 기존 구조 확장하여 여러 그룹(2x3, 3x3 등) 지원
2. **`seats`**: 기존 그대로 사용
3. **`seat_assignments`**: 기존 구조에 `studentId`, `timetableId` 필드 추가
4. **신규 컬렉션**: 학생 출석 기록, PIN, 체크 링크만 새로 생성

---

## 3. 상세 컬렉션 설계

### 3.1 seat_layouts (좌석 배치도) - 기존 확장

**기존 구조를 확장**하여 여러 그룹 지원 및 출석 페이지 요구사항 반영

```typescript
interface SeatLayoutExtended {
  // 기존 필드
  name: string;                  // 교실 이름 (예: "1층 자습실")

  // 확장: 여러 그룹 지원
  layout: {
    // 기존 구조 유지하면서 그룹 개념 추가
    groups?: {                   // 선택적 필드 (하위 호환성)
      id: string;                // 그룹 ID (UUID)
      name: string;              // 그룹 이름 (예: "앞쪽", "뒤쪽")
      rows: number;              // 행 개수
      cols: number;              // 열 개수
      position: { x: number; y: number; };
    }[];

    // 기존 필드 유지
    seats: {
      id: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
      groupId?: string;          // 🆕 어느 그룹에 속하는지
      row?: number;              // 🆕 그룹 내 행 위치
      col?: number;              // 🆕 그룹 내 열 위치
      label?: string;            // 🆕 좌석 라벨 (예: "A-1")
    }[];

    dimensions: {
      width: number;
      height: number;
    };
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**하위 호환성 유지**:
- 기존 `seats` 배열 구조 그대로 유지
- `groups`, `groupId`, `row`, `col`, `label` 필드는 **선택적(optional)**
- 기존 좌석 레이아웃도 정상 작동

**예시 - 출석 페이지용 확장 데이터**:
```json
{
  "name": "1층 자습실",
  "layout": {
    "groups": [
      { "id": "group_001", "name": "앞쪽", "rows": 2, "cols": 3, "position": { "x": 0, "y": 0 } },
      { "id": "group_002", "name": "뒤쪽", "rows": 3, "cols": 3, "position": { "x": 0, "y": 250 } }
    ],
    "seats": [
      { "id": "seat_001", "position": { "x": 0, "y": 0 }, "size": { "width": 60, "height": 60 },
        "groupId": "group_001", "row": 0, "col": 0, "label": "A-1" },
      { "id": "seat_002", "position": { "x": 70, "y": 0 }, "size": { "width": 60, "height": 60 },
        "groupId": "group_001", "row": 0, "col": 1, "label": "A-2" }
      // ... 나머지 좌석
    ],
    "dimensions": { "width": 800, "height": 600 }
  }
}
```

---

### 3.2 seat_assignments (학생 좌석 할당) - 기존 확장

**기존 구조에 학생 출석 관련 필드를 추가**합니다.

```typescript
interface SeatAssignmentExtended {
  // 🆕 기존 필드
  seatId: string;                // seats 컬렉션의 ID
  assignedAt: Timestamp;
  expiresAt?: Timestamp;
  status: "active" | "expired" | "cancelled";
  updatedAt: Timestamp;

  // 🆕 출석 페이지용 추가 필드 (선택적)
  studentId?: string;            // 학생 ID (students 컬렉션)
  studentName?: string;          // 학생 이름 (캐싱)
  timetableId?: string;          // 시간표 ID (student_timetables 컬렉션)

  // 🆕 예정 등/하원 시간 캐싱
  expectedSchedule?: {
    monday?: { arrivalTime: string; departureTime: string; isActive: boolean; };
    tuesday?: { arrivalTime: string; departureTime: string; isActive: boolean; };
    wednesday?: { arrivalTime: string; departureTime: string; isActive: boolean; };
    thursday?: { arrivalTime: string; departureTime: string; isActive: boolean; };
    friday?: { arrivalTime: string; departureTime: string; isActive: boolean; };
    saturday?: { arrivalTime: string; departureTime: string; isActive: boolean; };
    sunday?: { arrivalTime: string; departureTime: string; isActive: boolean; };
  };

  // 🆕 좌석 메타 정보 (캐싱)
  seatLayoutId?: string;         // seat_layouts의 ID
  seatLabel?: string;            // 좌석 라벨 (예: "A-1")
  groupId?: string;              // 그룹 ID
}
```

**하위 호환성**:
- 기존 필드는 그대로 유지
- 출석 페이지 관련 필드는 모두 **선택적(optional)**
- 기존 좌석 배정 시스템도 정상 작동

**중요 규칙**:
- 학생 할당 시 해당 학생의 **활성 시간표(`isActive: true`)**를 조회
- 시간표의 `basicSchedule.dailySchedules`에 **최소 1개 이상의 활성 요일**이 있어야 할당 가능
- 시간표가 없거나 모든 요일이 비활성인 경우 할당 불가

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

  // 교실/좌석 정보
  classroomId: string;           // 교실 ID
  seatId: string;                // 좌석 ID
  seatLabel: string;             // 좌석 라벨

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
  classroomId: string;           // 연결된 교실 ID
  classroomName: string;         // 교실 이름 (캐싱)

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

  // PIN 정보
  pin: string;                   // 4-6자리 숫자 PIN (암호화 권장)
  pinHash?: string;              // PIN 해시값 (보안 강화 시)

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

기존 `firestore.rules` 파일에 다음 규칙을 추가합니다:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null &&
        request.auth.uid == userId;

      // 🆕 출석 관리 교실
      match /attendance_classrooms/{classroomId} {
        allow read, write: if request.auth != null &&
          request.auth.uid == userId;
      }

      // 🆕 학생 좌석 할당
      match /attendance_seat_assignments/{assignmentId} {
        allow read, write: if request.auth != null &&
          request.auth.uid == userId;
      }

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

      // 기존 규칙들...
    }
  }
}
```

---

## 6. Cloud Functions API 설계

### 6.1 필요한 Functions 목록

```typescript
// ==================== 좌석 배치 관리 (기존 활용) ====================
// 기존 seatManagement.ts의 Functions 활용
export const createSeatLayout                 // ✅ 기존 - groups 필드 확장
export const getSeatLayouts                   // ✅ 기존
export const createSeat                       // ✅ 기존
export const getSeats                         // ✅ 기존

// ==================== 좌석 할당 (기존 확장) ====================
export const assignSeat                       // ✅ 기존 - studentId 등 필드 추가
export const unassignSeat                     // ✅ 기존
export const getCurrentSeatAssignment         // ✅ 기존
export const validateStudentTimetableForSeat  // 🆕 신규 - 시간표 검증

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

#### 6.2.1 학생 좌석 할당 검증

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

#### 6.2.2 PIN으로 출석/하원 체크

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
  const classroomId = linkData.classroomId;

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
    .collection("attendance_seat_assignments")
    .where("studentId", "==", studentId)
    .where("classroomId", "==", classroomId)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (assignmentSnapshot.empty) {
    throw new HttpsError("not-found", "해당 교실에 좌석이 할당되지 않았습니다.");
  }

  const assignment = assignmentSnapshot.docs[0].data();
  const today = new Date().toISOString().split("T")[0];
  const dayOfWeek = getDayOfWeek(new Date()); // 요일 계산 함수
  const recordId = `${studentId}_${today.replace(/-/g, "")}`;

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
      classroomId: assignment.classroomId,
      seatId: assignment.seatId,
      seatLabel: assignment.seatLabel,
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

## 7. 기존 시스템과의 호환성 체크리스트

✅ **기존 데이터 구조 수정 없음**
- `students`, `student_timetables` 등 기존 컬렉션은 그대로 유지
- 새로운 컬렉션만 추가
- 기존 `attendance_records` (관리자 체크인/아웃용)와 신규 `student_attendance_records` (학생 출석용) 완전 분리

✅ **시간표 시스템 연동**
- `student_timetables`의 `basicSchedule.dailySchedules` 데이터 활용
- 등원/하원 시간을 시간표에서 자동으로 가져옴
- 실제 코드의 인터페이스와 100% 일치

✅ **사용자 데이터 격리**
- 모든 출석 관련 컬렉션은 `/users/{userId}` 하위에 저장
- Firestore 보안 규칙에서 `userId` 검증
- 기존 와일드카드 규칙으로 자동 커버됨

✅ **기존 좌석 시스템 최대 활용**
- `seats`, `seat_assignments`, `seat_layouts`: **출석 페이지에서 활용**
- 기존 구조에 **선택적 필드 추가**로 하위 호환성 유지
- 이미 구현된 Functions와 컴포넌트 재사용
- 중복 개발 없이 효율적 구현

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

### Phase 1: 기본 구조 (필수)
1. `seat_layouts` 확장 - groups 필드 추가 지원
2. `seat_assignments` 확장 - studentId, timetableId, expectedSchedule 필드 추가
3. `attendance_student_pins` 컬렉션 및 PIN 생성 Functions
4. 시간표 검증 로직 (`validateStudentTimetableForSeat`)

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

### 9.1 시간대 처리
- 모든 시간은 한국 표준시(KST, UTC+9) 기준
- `Timestamp` 타입은 UTC로 저장되므로, 클라이언트에서 변환 필요

### 9.2 PIN 보안
- PIN은 평문 저장보다 해시값 저장 권장 (bcrypt, argon2 등)
- 잠금 해제는 관리자만 가능
- PIN 변경 이력 최소 3개 보관

### 9.3 성능 최적화
- 자주 조회되는 데이터는 캐싱 (예: studentName, seatLabel)
- 복합 인덱스 생성 필요:
  - `student_attendance_records`: `(userId, date, studentId)`
  - `attendance_seat_assignments`: `(userId, classroomId, status)`
  - `attendance_student_pins`: `(userId, pin, isActive, isLocked)`

### 9.4 에러 처리
- 모든 Functions에서 `HttpsError` 사용
- 사용자에게 친화적인 에러 메시지 제공
- 로깅을 통한 디버깅 지원

---

## 10. 마이그레이션 계획

기존 시스템을 건드리지 않으므로 별도 마이그레이션 불필요. 신규 기능 추가 후:

1. 기존 학생 데이터 그대로 사용
2. 관리자가 교실 생성 및 좌석 할당
3. 학생 PIN 생성 (일괄 또는 개별)
4. 출석 체크 링크 생성 및 공유

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
- ✅ 기존 컴포넌트 **활용** (Classroom, Seat 등)
- ✅ 하위 호환성 **완벽 유지**
- ✅ 새로운 페이지로 추가

기존 시스템을 최대한 활용하면서 강력한 출석 관리 기능을 추가할 수 있습니다! 🎉

### 개발 효율성
- 🚀 **중복 개발 제거**: 좌석 시스템을 새로 만들 필요 없음
- 🚀 **검증된 코드 활용**: 이미 작동하는 Functions와 컴포넌트 사용
- 🚀 **빠른 구현**: 출석 로직과 PIN 시스템에만 집중
- 🚀 **유지보수 간편**: 하나의 좌석 시스템으로 통합 관리
