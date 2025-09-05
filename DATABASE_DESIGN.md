물론입니다. 앞서 논의한 **컨테이너(절대 위치) 방식**에 완벽하게 대응할 수 있도록, **좌석 배치도(`seat_layouts`)** 정보를 저장하는 컬렉션을 추가하여 전체 데이터베이스 설계 문서를 업데이트했습니다.

핵심 변경 사항은 다음과 같습니다.

  * **`seat_layouts` 하위 컬렉션 추가**: 각 학원(`academy`) 아래에 좌석의 시각적 위치 정보(x, y 좌표)를 저장하는 컬렉션을 추가했습니다.
  * **최종 컬렉션 구조 업데이트**: 신규 컬렉션을 포함하여 총 11개의 컬렉션으로 구조를 확정했습니다.

아래는 컨테이너 방식을 적용한 최종 `.md` 문서입니다.

-----

# WiseUp 관리 시스템 - 데이터베이스 설계 (Multi-tenant)

## 📋 개요

WiseUp 관리 시스템은 Firebase Firestore를 기반으로 한 NoSQL 데이터베이스를 사용합니다. 이 시스템은 **여러 학원 지점(테넌트)이 하나의 애플리케이션을 공유**하되, 각 지점의 데이터는 완벽히 분리되는 **멀티테넌트(Multi-tenant) 아키텍처**로 설계되었습니다. 각 지점은 고유한 `academyId`를 통해 데이터를 격리하며, 학생 관리, 출석 관리, 시간표 관리, 좌석 관리 등의 기능을 제공합니다.

## 🎯 시스템 요구사항

### 주요 기능

  - 학생 관리 (학생 정보, 학부모 연락처 관리)
  - 출석 관리 (출석체크, 출석 기록, 통계)
  - 시간표 관리 (강의 카탈로그, 학생 수업, 개인 시간표)
  - 좌석 관리 (자율학습실 좌석 배정 및 배치도 편집)

### 사용자 역할

  - **학생 (Student)**: 특정 지점(`academyId`)에 소속되어 출석체크, 개인 시간표 조회.
  - **관리자 (Admin)**: 특정 지점(`academyId`)에 소속되어 해당 지점의 모든 기능 접근, 학생 관리, 통계 조회.
  - **슈퍼 관리자 (Super Admin)**: 시스템 전체를 관리하며 신규 지점(테넌트)을 생성하고 관리자를 임명하는 최상위 역할.

## 🗄️ 데이터베이스 구조

### 기본 구조

모든 지점의 데이터는 `academies` 컬렉션 아래에 각 지점의 `academyId`를 문서 ID로 하는 하위 컬렉션(Subcollection)으로 구성됩니다.

```
academies (컬렉션)
└── {academyId} (문서)
    ├── details (필드)
    ├── students (하위 컬렉션)
    ├── parents (하위 컬렉션)
    ├── attendance_records (하위 컬렉션)
    ├── class_sections (하위 컬렉션)
    ├── student_timetables (하위 컬렉션)
    ├── seats (하위 컬렉션)
    ├── seat_assignments (하위 컬렉션)
    ├── seat_layouts (하위 컬렉션)  <-- 추가됨
    ├── admins (하위 컬렉션)
    ├── academy_settings (하위 컬렉션)
    └── attendance_summaries (하위 컬렉션)
```

-----

### 1\. 학생 컬렉션 (students)

`academies/{academyId}/students`

```typescript
type Grade = '초1' | '초2' | '초3' | '초4' | '초5' | '초6' | '중1' | 
  '중2' | '중3' | '고1' | '고2' | '고3';

interface Student {
  authUid: string;                 // Firebase Auth UID (로그인 및 권한 확인용)
  name: string;                    // 학생 이름
  grade: Grade;                    // 학생 학년
  firstAttendanceDate?: FirestoreTimestamp;  // 첫 등원 날짜
  lastAttendanceDate?: FirestoreTimestamp;   // 마지막 등원 날짜
  parentsId?: string;               // `parents` 컬렉션의 ID
  status: 'active' | 'inactive';   // 학생 상태 (재원, 퇴원)
  contactInfo?: {                  // 연락처 정보
    phone?: string;
    email?: string;
    address?: string;
  };
  createdAt: FirestoreTimestamp;            // 생성일
  updatedAt: FirestoreTimestamp;            // 수정일
}
```

### 2\. 학부모 컬렉션 (parents)

`academies/{academyId}/parents`

```typescript
interface Parent {
  name: string;          // 부모 이름
  contactInfo: {         // 연락처 정보
    phone: string;
    email?: string;
  };
  childStudentIds: string[]; // 자녀(학생)들의 문서 ID 목록
  notes?: string;        // 기타 메모
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
```

### 3\. 출석 기록 컬렉션 (attendance\_records)

`academies/{academyId}/attendance_records`

```typescript
type AttendanceStatus = 'present' | 'dismissed' | 'unauthorized_absent' | 'authorized_absent' | 'not_enrolled';

interface AttendanceRecord {
  studentId: string;               // 학생 문서 ID
  studentName: string;             // 학생 이름 (비정규화)
  date: string;                    // 출석 날짜 "2024-03-15" 형태로 저장하여 날짜별 쿼리 최적화
  status: AttendanceStatus;        // 출석 상태
  checkInTime?: FirestoreTimestamp;    // 등원 시간
  checkOutTime?: FirestoreTimestamp;   // 하원 시간
  notes?: string;                  // 메모
  isLate?: boolean;                // 지각 여부
  createdAt: FirestoreTimestamp;   // 생성일
  updatedAt: FirestoreTimestamp;   // 수정일
}
```

### 4\. 수업 섹션 컬렉션 (class\_sections)

`academies/{academyId}/class_sections`

```typescript
type DayOfWeek = | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface ClassSection {
  name: string;                      // 수업명 (예: "고등 수학 I - A반")
  schedule: {
    dayOfWeek: DayOfWeek;            // 요일
    startTime: string;               // 시작 시간 (HH:MM)
    endTime: string;                 // 종료 시간 (HH:MM)
  }[];
  description?: string;              // 수업 설명
  createdAt: FirestoreTimestamp;    // 생성일
  updatedAt: FirestoreTimestamp;    // 수정일
}
```

### 5\. 학생 개인 시간표 컬렉션 (student\_timetables)

`academies/{academyId}/student_timetables`

```typescript
// 문서 ID: 학생 ID(studentId)와 동일하게 사용
interface StudentTimetable {
  studentId: string;
  classSectionIds: string[]; // 이 학생에게 배정된 모든 `class_sections`의 문서 ID 목록
  updatedAt: FirestoreTimestamp; // 시간표가 마지막으로 수정된 시간
}
```

### 6\. 좌석 컬렉션 (seats)

`academies/{academyId}/seats`

```typescript
// 문서 ID: 자동 생성 (이 ID가 seat_layouts의 seatId와 연결됩니다)
type SeatStatus = 'vacant' | 'occupied' | 'unavailable';

interface Seat {
  seatNumber: string;              // 좌석 번호 (예: "A-15")
  status: SeatStatus;              // 좌석 상태
  isActive: boolean;               // 활성화 여부
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
```

### 7\. 좌석 배정 컬렉션 (seat\_assignments)

`academies/{academyId}/seat_assignments`

```typescript
type AssignmentStatus = 'active' | 'released';

interface SeatAssignment {
  // 문서 ID: "studentId_seatId_YYYYMMDD" 형태로 구성하여 중복 방지
  seatId: string;                    // `seats` 컬렉션의 문서 ID
  studentId: string;                 // `students` 컬렉션의 문서 ID
  status: AssignmentStatus;          // 배정 상태
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
```

### 8\. 좌석 배치도 컬렉션 (seat\_layouts) - 신규

`academies/{academyId}/seat_layouts`

이 컬렉션은 **컨테이너(절대 위치) 방식**의 UI 구현을 위해 좌석의 시각적, 공간적 정보를 저장합니다.

```typescript
// 문서 ID: "main_hall" (예: 주 학습관)
interface SeatLayout {
  name: string;          // 배치도 이름 (예: "주 학습관")
  gridSize: {            // 배치도를 그릴 그리드의 크기
    rows: number;        // 총 행 수
    cols: number;        // 총 열 수
  };
  // 배치도에 포함된 모든 요소의 배열
  elements: {
    x: number;           // 열 위치 (좌표)
    y: number;           // 행 위치 (좌표)
    seatId?: string;     // `seats` 컬렉션의 문서 ID
    seatNumber?: string; // 좌석 번호 (UI 표시용)
  }[];
  updatedAt: FirestoreTimestamp;
}
```

### 9\. 관리자 정보 컬렉션 (admins)

`academies/{academyId}/admins`

```typescript
interface Admin {
  authUid: string;                  // Firebase Auth UID
  name: string;                     // 관리자 이름
  role: 'admin' | 'super_admin';    // 관리자 역할
  permissions: string[];            // 세부 권한 목록
  email: string;                    // 이메일
  phone?: string;                   // 전화번호
  isActive: boolean;                // 활성 상태
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
```

### 10\. 학원 설정 컬렉션 (academy\_settings)

`academies/{academyId}/academy_settings`

```typescript
// 문서 ID: "main" (고정)
interface AcademySettings {
  // ... (이전과 동일)
}
```

### 11\. 출석 통계 컬렉션 (attendance\_summaries)

`academies/{academyId}/attendance_summaries`

```typescript
// 문서 ID: "YYYY-MM" 형태 (예: "2024-03")
interface AttendanceSummary {
  // ... (이전과 동일)
}
```

-----

## 🏢 신규 지점(테넌트) 추가

(이전과 동일)

-----

## 🔐 보안 규칙 (Firestore Rules)

(이전과 동일 - `seat_layouts` 컬렉션은 일반 하위 컬렉션 규칙에 따라 관리자만 접근 가능)

-----

## 📊 인덱스 설계

(이전과 동일)

-----

## 📝 추가 고려사항

### 데이터 관계 및 역할 분리

  - **`seat_layouts`**: "어떤 좌석이 어디에 있는가?" (공간, 위치 정보)
  - **`seats`**: "그 좌석은 사용 가능한가?" (상태 정보)
  - **`seat_assignments`**: "그 좌석에 누가 앉아 있는가?" (배정 정보)

(이하 이전과 동일)

### 🚀 최종 컬렉션 구조 (11개)

1.  **students** - 학생 정보
2.  **parents** - 학부모 정보
3.  **attendance\_records** - 출석 기록
4.  **class\_sections** - 수업 섹션
5.  **student\_timetables** - 학생 개인 시간표
6.  **seats** - 좌석 정보
7.  **seat\_assignments** - 좌석 배정
8.  **seat\_layouts** - **좌석 배치도 (신규)**
9.  **admins** - 관리자 정보
10. **academy\_settings** - 학원 설정
11. **attendance\_summaries** - 출석 통계

-----

**참고**: 이 설계는 실무 피드백을 반영한 개선된 버전이며, 실제 구현 과정에서 요구사항에 따라 추가 수정될 수 있습니다.