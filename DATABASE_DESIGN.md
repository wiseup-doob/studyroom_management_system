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
    ├── seat_layouts (하위 컬렉션)
    └── admins (하위 컬렉션)
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
  seatId?: string;                 // 좌석 문서 ID (좌석 배치표를 통한 출결 관리)
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
// 문서 ID: 자동 생성
type SeatStatus = 'vacant' | 'occupied' | 'unavailable';

interface Seat {
  seatNumber: string;              // 좌석 번호 (예: "A-15")
  status: SeatStatus;              // 좌석 상태
  isActive: boolean;               // 활성화 여부
  layoutName: string;              // 어떤 배치도에 속하는지 (예: "main_hall")
  position: {                      // 배치도 내 좌석 위치
    x: number;                     // 열 위치 (좌표)
    y: number;                     // 행 위치 (좌표)
  };
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
```

### 7\. 좌석 배정 컬렉션 (seat\_assignments)

`academies/{academyId}/seat_assignments`

```typescript
type AssignmentStatus = 'active' | 'released';

interface SeatAssignment {
  // 문서 ID: studentId (현재 배정된 좌석만 저장, 히스토리는 별도 관리)
  seatId: string;                    // `seats` 컬렉션의 문서 ID
  assignedAt: FirestoreTimestamp;    // 배정 시간
  status: AssignmentStatus;          // 배정 상태
  updatedAt: FirestoreTimestamp;
}
```

### 8\. 좌석 배치도 컬렉션 (seat\_layouts)

`academies/{academyId}/seat_layouts`

배치도별 메타데이터를 저장합니다. 실제 좌석 위치는 `seats` 컬렉션의 `position` 필드에서 관리됩니다.

```typescript
// 문서 ID: "main_hall" (예: 주 학습관)
interface SeatLayout {
  name: string;          // 배치도 이름 (예: "주 학습관")
  description?: string;  // 배치도 설명
  gridSize: {            // 배치도를 그릴 그리드의 크기
    rows: number;        // 총 행 수
    cols: number;        // 총 열 수
  };
  isActive: boolean;     // 활성화 여부
  createdAt: FirestoreTimestamp;
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
  email: string;                    // 이메일
  phone?: string;                   // 전화번호
  isActive: boolean;                // 활성 상태
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
```

### 10\. 관리자 정보 컬렉션 (admins)

`academies/{academyId}/admins`

```typescript
interface Admin {
  authUid: string;                  // Firebase Auth UID
  name: string;                     // 관리자 이름
  role: 'admin' | 'super_admin';    // 관리자 역할
  email: string;                    // 이메일
  phone?: string;                   // 전화번호
  isActive: boolean;                // 활성 상태
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
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

  - **`seat_layouts`**: "배치도 메타데이터" (그리드 크기, 이름 등)
  - **`seats`**: "좌석 상태 및 위치" (사용 가능성, 좌표)
  - **`seat_assignments`**: "현재 좌석 배정" (누가 어느 좌석에)
  - **`attendance_records`**: "출석 기록" (언제, 어느 좌석에서)

### 주요 개선 사항

1. **좌석-출결 연동**: `attendance_records`에 `seatId` 필드 추가로 좌석 배치표를 통한 출결 관리 지원
2. **데이터 구조 단순화**: 좌석 위치 정보를 `seats` 컬렉션에 통합하여 중복 제거
3. **배정 시스템 개선**: 문서 ID를 `studentId`로 단순화하여 현재 배정만 관리
4. **불필요한 컬렉션 제거**: `academy_settings`, `attendance_summaries` 제거로 복잡성 감소

### 🚀 최종 컬렉션 구조 (9개) - 개선됨

1.  **students** - 학생 정보
2.  **parents** - 학부모 정보
3.  **attendance\_records** - 출석 기록 (좌석 연동 기능 추가)
4.  **class\_sections** - 수업 섹션
5.  **student\_timetables** - 학생 개인 시간표
6.  **seats** - 좌석 정보 (위치 정보 통합)
7.  **seat\_assignments** - 좌석 배정 (단순화)
8.  **seat\_layouts** - 좌석 배치도 (메타데이터만)
9.  **admins** - 관리자 정보 (권한 시스템 단순화)

-----

**참고**: 이 설계는 실무 피드백과 요구사항 분석을 반영한 최적화된 버전이며, 실제 구현 과정에서 요구사항에 따라 추가 수정될 수 있습니다.

### 개선 요약
- 좌석-출결 연동 기능 추가
- 데이터 구조 단순화 및 중복 제거
- 불필요한 컬렉션 2개 제거 (11개 → 9개)
- 성능 및 유지보수성 향상