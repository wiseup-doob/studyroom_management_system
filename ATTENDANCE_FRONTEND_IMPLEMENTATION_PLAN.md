# 출석 관리 시스템 프론트엔드 구현 계획서

## 문서 개요

이 문서는 `ATTENDANCE_DATABASE_DESIGN.md`를 기반으로 한 출석 관리 시스템의 프론트엔드 구현 계획을 정의합니다.

**작성일**: 2025-01-04
**기반 문서**: `ATTENDANCE_DATABASE_DESIGN.md`
**백엔드 구현**: `functions/src/modules/personal/studentAttendanceManagement.ts` (완료)

---

## 목차

1. [현재 코드베이스 분석](#1-현재-코드베이스-분석)
2. [프론트엔드 아키텍처 설계](#2-프론트엔드-아키텍처-설계)
3. [타입 시스템 재설계](#3-타입-시스템-재설계)
4. [서비스 레이어 구현](#4-서비스-레이어-구현)
5. [컴포넌트 구조 설계](#5-컴포넌트-구조-설계)
6. [페이지 레이아웃 설계](#6-페이지-레이아웃-설계)
7. [구현 단계별 계획](#7-구현-단계별-계획)
8. [기술적 고려사항](#8-기술적-고려사항)

---

## 1. 현재 코드베이스 분석

### 1.1 기존 프로토타입 코드 상태

**위치**: `frontend/src/`

```
frontend/src/
├── pages/Attendance/
│   ├── Attendance.tsx           # ⚠️ 스켈레톤 (재구현 필요)
│   └── Attendance.css
├── types/attendance.ts          # ⚠️ 백엔드와 불일치 (재작성 필요)
└── components/domain/Attendance/
    ├── AttendanceContext.tsx    # ⚠️ 백엔드 구조 반영 필요
    ├── ClassroomSelector.tsx    # ⚠️ SeatLayout 기반으로 변경 필요
    ├── SeatingChart.tsx         # ✅ 재사용 가능 (수정 필요)
    ├── Seat.tsx                 # ✅ 재사용 가능 (수정 필요)
    └── StudentSearch.tsx        # ✅ 재사용 가능
```

**문제점**:
1. **타입 불일치**: `frontend/src/types/attendance.ts`의 타입이 백엔드(`studentAttendanceManagement.ts`)와 다름
   - Frontend: `Classroom`, `AttendanceSeat` 등 독자적 구조
   - Backend: `SeatLayout`, `SeatAssignment`, `StudentAttendanceRecord` 등
2. **데이터 구조 차이**: Frontend는 행×열 그리드 전제, Backend는 좌표 기반 + groups 구조
3. **상태 타입 불일치**: Frontend `SeatStatus`와 Backend `StudentAttendanceStatus` 다름

### 1.2 참고할 기존 구현 패턴

#### TimeTable 페이지 구조 (`frontend/src/pages/TimeTable/`)

**성공적인 구현 패턴**:
```typescript
// TimeTable.tsx - 메인 페이지 패턴
const TimeTable: React.FC = () => {
  // 1. 상태 관리
  const [students, setStudents] = useState<StudentWithTimetable[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithTimetable | null>(null);
  const [selectedTimetable, setSelectedTimetable] = useState<StudentTimetableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 2. 초기 데이터 로딩
  useEffect(() => {
    loadStudentsWithTimetables();
  }, []);

  // 3. 좌우 패널 레이아웃
  return (
    <div className="tt-main-page">
      <div className="tt-student-list-section">
        <StudentListPanel />
      </div>
      <div className="tt-timetable-section">
        <StudentTimetablePanel />
      </div>
      <CreateTimetableModal />
    </div>
  );
};
```

**재사용 가능한 패턴**:
- ✅ 좌우 패널 분할 레이아웃
- ✅ 목록 선택 → 상세 표시 흐름
- ✅ 모달 기반 생성/편집 UI
- ✅ Loading/Error 처리 컴포넌트
- ✅ 백엔드 서비스 호출 패턴

#### 백엔드 서비스 패턴 (`frontend/src/services/backendService.ts`)

```typescript
class BackendService {
  async call(functionName: string, data?: any): Promise<any> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('사용자가 로그인되어 있지 않습니다.');

    const idToken = await currentUser.getIdToken(true);
    const functionUrl = `https://${functionName}-...`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ data })
    });

    return await response.json();
  }
}
```

**적용 방안**:
- ✅ Firebase Functions 호출 래퍼 재사용
- ✅ 인증 토큰 자동 처리
- ✅ 에러 핸들링 표준화

---

## 2. 프론트엔드 아키텍처 설계

### 2.1 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Attendance Page (메인)                   │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │  SeatLayout      │  │   Attendance Management Panel   │ │
│  │  Selector Panel  │  │  ┌────────────────────────────┐ │ │
│  │                  │  │  │  SeatingChart (좌석 배치도) │ │ │
│  │  - 배치도 목록   │  │  │  - Group별 좌석 그리드     │ │ │
│  │  - 새 배치도     │  │  │  - 학생 할당 상태 표시     │ │ │
│  │    생성 버튼     │  │  │  - 출석 상태 색��� 표시     │ │ │
│  │  - 활성 링크     │  │  └────────────────────────────┘ │ │
│  │    관리          │  │  ┌────────────────────────────┐ │ │
│  └──────────────────┘  │  │  Student Assignment Panel │ │ │
│                        │  │  - 학생 검색/선택          │ │ │
│                        │  │  - 좌석 할당/해제          │ │ │
│                        │  │  - PIN 관리                │ │ │
│                        │  └────────────────────────────┘ │ │
│                        │  ┌────────────────────────────┐ │ │
│                        │  │  Attendance Records Panel │ │ │
│                        │  │  - 오늘 출석 현황          │ │ │
│                        │  │  - 출석 기록 조회          │ │ │
│                        │  │  - 상태 수동 변경          │ │ │
│                        │  └────────────────────────────┘ │ │
│                        └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Modals (모달 컴포넌트들)                   │
│  - CreateSeatLayoutModal     : 좌석 배치도 생성            │
│  - EditSeatLayoutModal       : 좌석 배치도 수정            │
│  - AssignSeatModal           : 학생 좌석 할당              │
│  - ManagePinModal            : 학생 PIN 관리               │
│  - AttendanceCheckLinkModal  : 출석 체크 링크 생성/관리    │
│  - AttendanceRecordDetailModal : 출석 기록 상세/수정       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 상태 관리 전략 (React Query + Zustand)

**⚠️ 중요: Context API 대신 React Query + Zustand 사용**

이전 계획에서 Context API로 모든 상태를 관리하려 했으나, 이는 다음과 같은 문제가 있습니다:
- 성능 저하: UI 상태 하나 변경 시 전체 컴포넌트 리렌더링
- 복잡성 증가: 모든 로직이 한 곳에 집중
- 중복 코드: 캐싱, 로딩/에러 상태를 직접 구현 필요

**해결 방안: 상태를 서버 상태와 클라이언트 상태로 분리**

#### 1) 서버 상태 (React Query)

모든 API 데이터는 React Query로 관리:

```typescript
// hooks/useAttendanceQueries.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceService } from '@/services/attendanceService';

// 좌석 배치도 목록 조회
export function useSeatLayouts() {
  return useQuery({
    queryKey: ['seatLayouts'],
    queryFn: () => attendanceService.getSeatLayouts(),
    staleTime: 5 * 60 * 1000, // 5분
  });
}

// 좌석 할당 목록 조회
export function useSeatAssignments(layoutId: string | null) {
  return useQuery({
    queryKey: ['seatAssignments', layoutId],
    queryFn: () => layoutId ? attendanceService.getSeatAssignments(layoutId) : Promise.resolve([]),
    enabled: !!layoutId,
    staleTime: 1 * 60 * 1000, // 1분
  });
}

// 오늘 출석 기록 조회
export function useTodayAttendanceRecords(layoutId: string | null) {
  return useQuery({
    queryKey: ['attendanceRecords', 'today', layoutId],
    queryFn: () => layoutId ? attendanceService.getTodayAttendanceRecords(layoutId) : Promise.resolve([]),
    enabled: !!layoutId,
    refetchInterval: 30000, // 30초마다 자동 갱신
  });
}

// 학생 목록 (시간표 포함)
export function useStudentsWithTimetables() {
  return useQuery({
    queryKey: ['studentsWithTimetables'],
    queryFn: () => backendService.getStudentsWithTimetables(),
    staleTime: 10 * 60 * 1000, // 10분
  });
}

// 출석 체크 링크 목록
export function useAttendanceCheckLinks() {
  return useQuery({
    queryKey: ['attendanceCheckLinks'],
    queryFn: () => attendanceService.getAttendanceCheckLinks(),
    staleTime: 5 * 60 * 1000,
  });
}

// Mutation: 좌석 배치도 생성
export function useCreateSeatLayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSeatLayoutData) => attendanceService.createSeatLayout(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seatLayouts'] });
    },
  });
}

// Mutation: 좌석 할당
export function useAssignSeat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AssignSeatData) => attendanceService.assignSeat(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['seatAssignments', variables.seatLayoutId] });
    },
  });
}

// Mutation: 출석 상태 변경
export function useUpdateAttendanceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateAttendanceStatusData) => attendanceService.updateAttendanceStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendanceRecords'] });
    },
  });
}

// ... 기타 mutations
```

#### 2) 클라이언트(UI) 상태 (Zustand)

순수한 UI 상태만 Zustand로 관리:

```typescript
// stores/useAttendanceUIStore.ts

import { create } from 'zustand';

interface AttendanceUIState {
  // 선택 상태
  selectedLayoutId: string | null;
  selectedSeatId: string | null;
  selectedStudentId: string | null;

  // 모달 상태
  isCreateLayoutModalOpen: boolean;
  isAssignSeatModalOpen: boolean;
  isManagePinModalOpen: boolean;
  isCheckLinkModalOpen: boolean;
  isRecordDetailModalOpen: boolean;

  // 액션
  setSelectedLayoutId: (id: string | null) => void;
  setSelectedSeatId: (id: string | null) => void;
  setSelectedStudentId: (id: string | null) => void;
  openCreateLayoutModal: () => void;
  closeCreateLayoutModal: () => void;
  openAssignSeatModal: () => void;
  closeAssignSeatModal: () => void;
  // ... 기타 모달 액션
}

export const useAttendanceUIStore = create<AttendanceUIState>((set) => ({
  // 초기 상태
  selectedLayoutId: null,
  selectedSeatId: null,
  selectedStudentId: null,
  isCreateLayoutModalOpen: false,
  isAssignSeatModalOpen: false,
  isManagePinModalOpen: false,
  isCheckLinkModalOpen: false,
  isRecordDetailModalOpen: false,

  // 액션 구현
  setSelectedLayoutId: (id) => set({ selectedLayoutId: id }),
  setSelectedSeatId: (id) => set({ selectedSeatId: id }),
  setSelectedStudentId: (id) => set({ selectedStudentId: id }),
  openCreateLayoutModal: () => set({ isCreateLayoutModalOpen: true }),
  closeCreateLayoutModal: () => set({ isCreateLayoutModalOpen: false }),
  openAssignSeatModal: () => set({ isAssignSeatModalOpen: true }),
  closeAssignSeatModal: () => set({ isAssignSeatModalOpen: false }),
  // ... 기타 모달 액션
}));
```

**이점**:
- ✅ **성능**: 서버 데이터와 UI 상태 분리로 불필요한 리렌더링 최소화
- ✅ **자동 캐싱**: React Query가 자동으로 데이터 캐싱 및 동기화
- ✅ **로딩/에러 자동 관리**: `isLoading`, `error` 자동 제공
- ✅ **실시간 동기화**: `refetchInterval`로 자동 갱신
- ✅ **간단한 구조**: 각 상태�� 독립적으로 관리됨

### 2.3 데이터 흐름

```
┌─────────────────┐
│  Firebase Auth  │
└────────┬────────┘
         │ (인증)
         ▼
┌─────────────────────────────────────────┐
│     AttendanceService (서비스 레이어)   │
│  - getSeatLayouts()                     │
│  - getSeatAssignments(layoutId)         │
│  - getStudentsWithTimetables()          │
│  - getTodayAttendanceRecords(layoutId)  │
│  - assignSeat(data)                     │
│  - createCheckLink(data)                │
│  - updateAttendanceStatus(data)         │
└────────┬────────────────────────────────┘
         │ (HTTP/Functions)
         ▼
┌─────────────────────────────────────────┐
│    React Query (서버 상태 관리)         │
│  - useQuery: 데이터 조회 & 캐싱         │
│  - useMutation: 데이터 변경             │
│  - queryClient.invalidateQueries()      │
└────────┬────────────────────────────────┘
         │ (서버 데이터)
         ▼
┌─────────────────────────────────────────┐
│   Zustand (클라이언트 UI 상태 관리)     │
│  - selectedLayoutId                     │
│  - selectedSeatId                       │
│  - modal open/close 상태                │
└────────┬────────────────────────────────┘
         │ (UI 상태)
         ▼
┌─────────────────────────────────────────┐
│   Attendance Components (UI)            │
│  - SeatLayoutSelector                   │
│  - SeatingChart                         │
│  - StudentAssignmentPanel               │
│  - AttendanceRecordsPanel               │
└─────────────────────────────────────────┘
```

---

## 3. 타입 시스템 재설계

### 3.1 새로운 타입 정의

**위치**: `frontend/src/types/attendance.ts` (완전 재작성)

```typescript
// ==================== 백엔드 타입과 일치 ====================

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type StudentAttendanceStatus =
  | 'checked_in'      // 등원
  | 'checked_out'     // 하원
  | 'not_arrived'     // 미등원
  | 'absent_excused'  // 사유결석
  | 'absent_unexcused'; // 무단결석

// ==================== SeatLayout (백엔드와 동일) ====================

export interface SeatLayoutGroup {
  id: string;
  name: string;
  rows: number;
  cols: number;
  position: { x: number; y: number };
}

export interface SeatLayoutSeat {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  groupId?: string;
  row?: number;
  col?: number;
  label?: string;
}

export interface SeatLayout {
  id: string;
  name: string;
  layout: {
    groups?: SeatLayoutGroup[];
    seats: SeatLayoutSeat[];
    dimensions: { width: number; height: number };
  };
  createdAt: Date;
  updatedAt: Date;
}

// ==================== SeatAssignment (백엔드와 동일) ====================

export interface SeatAssignment {
  id: string;
  seatId: string;
  assignedAt: Date;
  expiresAt?: Date;
  status: 'active' | 'expired' | 'cancelled';
  updatedAt: Date;

  // 출석 시스템용 필드
  studentId?: string;
  studentName?: string;
  seatNumber?: string;
  timetableId?: string;
  seatLayoutId?: string;
  expectedSchedule?: {
    [key in DayOfWeek]?: {
      arrivalTime: string;
      departureTime: string;
      isActive: boolean;
    };
  };
}

// ==================== StudentAttendanceRecord (백엔드와 동일) ====================

export interface StudentAttendanceRecord {
  id: string;
  userId: string;
  studentId: string;
  studentName: string;
  seatLayoutId: string;
  seatId: string;
  seatNumber: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: DayOfWeek;
  expectedArrivalTime: string;
  expectedDepartureTime: string;
  actualArrivalTime?: Date;
  actualDepartureTime?: Date;
  status: StudentAttendanceStatus;
  excusedReason?: string;
  excusedNote?: string;
  excusedBy?: string;
  isLate: boolean;
  isEarlyLeave: boolean;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  checkInMethod?: 'pin' | 'manual' | 'admin';
  checkOutMethod?: 'pin' | 'manual' | 'admin';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  recordTimestamp: Date;
}

// ==================== AttendanceCheckLink (백엔드와 동일) ====================

export interface AttendanceCheckLink {
  id: string;
  userId: string;
  linkToken: string;
  linkUrl: string;
  seatLayoutId: string;
  seatLayoutName: string;
  title: string;
  description?: string;
  isActive: boolean;
  expiresAt?: Date;
  usageCount: number;
  lastUsedAt?: Date;
  requireConfirmation: boolean;
  allowedDaysOfWeek?: DayOfWeek[];
  allowedTimeRange?: {
    startTime: string;
    endTime: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ==================== AttendanceStudentPin (백엔드와 동일) ====================

export interface AttendanceStudentPin {
  id: string;
  userId: string;
  studentId: string;
  studentName: string;
  pinHash: string; // Frontend에서는 표시하지 않음
  isActive: boolean;
  isLocked: boolean;
  failedAttempts: number;
  lastFailedAt?: Date;
  lastChangedAt: Date;
  changeHistory?: {
    changedAt: Date;
    changedBy: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// ==================== UI 전용 타입 ====================

// 좌석 배치도 시각화용 타입
export interface SeatingChartSeat {
  seatLayoutSeat: SeatLayoutSeat; // 좌석 배치 정보
  assignment?: SeatAssignment; // 할당 정보
  attendanceRecord?: StudentAttendanceRecord; // 오늘 출석 기록
  student?: Student; // 학생 정보
}

// 그룹별 좌석 그리드
export interface GroupSeatingGrid {
  group: SeatLayoutGroup;
  grid: (SeatingChartSeat | null)[][]; // row x col 2차원 배열
}

// 좌석 할당 요청 데이터
export interface AssignSeatData {
  seatId: string;
  studentId: string;
  timetableId: string;
  seatLayoutId: string;
}

// 좌석 배치도 생성 요청 데이터
export interface CreateSeatLayoutData {
  name: string;
  groups: {
    name: string;
    rows: number;
    cols: number;
    position: { x: number; y: number };
  }[];
}

// 출석 체크 링크 생성 요청 데이터
export interface CreateAttendanceCheckLinkData {
  seatLayoutId: string;
  title: string;
  description?: string;
  expiresInDays?: number;
}

// 출석 상태 변경 요청 데이터
export interface UpdateAttendanceStatusData {
  recordId: string;
  status: StudentAttendanceStatus;
  excusedReason?: string;
  excusedNote?: string;
}
```

### 3.2 타입 변환 유틸리티

**위치**: `frontend/src/utils/attendanceTypeConverters.ts`

```typescript
import { Timestamp } from 'firebase/firestore';
import {
  SeatLayout,
  SeatAssignment,
  StudentAttendanceRecord,
  AttendanceCheckLink,
  AttendanceStudentPin
} from '../types/attendance';

/**
 * Firestore Timestamp를 Date로 변환
 */
export function convertTimestampToDate(timestamp: any): Date {
  if (timestamp instanceof Date) return timestamp;
  if (timestamp?.toDate) return timestamp.toDate();
  if (timestamp?.seconds) return new Date(timestamp.seconds * 1000);
  return new Date(timestamp);
}

/**
 * Firestore 문서를 SeatLayout 타입으로 변환
 */
export function convertToSeatLayout(doc: any): SeatLayout {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id || data.id,
    name: data.name,
    layout: data.layout,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt)
  };
}

/**
 * Firestore 문서를 SeatAssignment 타입으로 변환
 */
export function convertToSeatAssignment(doc: any): SeatAssignment {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id || data.id,
    seatId: data.seatId,
    assignedAt: convertTimestampToDate(data.assignedAt),
    expiresAt: data.expiresAt ? convertTimestampToDate(data.expiresAt) : undefined,
    status: data.status,
    updatedAt: convertTimestampToDate(data.updatedAt),
    studentId: data.studentId,
    studentName: data.studentName,
    seatNumber: data.seatNumber,
    timetableId: data.timetableId,
    seatLayoutId: data.seatLayoutId,
    expectedSchedule: data.expectedSchedule
  };
}

/**
 * Firestore 문서를 StudentAttendanceRecord 타입으로 변환
 */
export function convertToStudentAttendanceRecord(doc: any): StudentAttendanceRecord {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id || data.id,
    userId: data.userId,
    studentId: data.studentId,
    studentName: data.studentName,
    seatLayoutId: data.seatLayoutId,
    seatId: data.seatId,
    seatNumber: data.seatNumber,
    date: data.date,
    dayOfWeek: data.dayOfWeek,
    expectedArrivalTime: data.expectedArrivalTime,
    expectedDepartureTime: data.expectedDepartureTime,
    actualArrivalTime: data.actualArrivalTime ? convertTimestampToDate(data.actualArrivalTime) : undefined,
    actualDepartureTime: data.actualDepartureTime ? convertTimestampToDate(data.actualDepartureTime) : undefined,
    status: data.status,
    excusedReason: data.excusedReason,
    excusedNote: data.excusedNote,
    excusedBy: data.excusedBy,
    isLate: data.isLate,
    isEarlyLeave: data.isEarlyLeave,
    lateMinutes: data.lateMinutes,
    earlyLeaveMinutes: data.earlyLeaveMinutes,
    checkInMethod: data.checkInMethod,
    checkOutMethod: data.checkOutMethod,
    notes: data.notes,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt),
    recordTimestamp: convertTimestampToDate(data.recordTimestamp)
  };
}

/**
 * Firestore 문서를 AttendanceCheckLink 타입으로 변환
 */
export function convertToAttendanceCheckLink(doc: any): AttendanceCheckLink {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id || data.id,
    userId: data.userId,
    linkToken: data.linkToken,
    linkUrl: data.linkUrl,
    seatLayoutId: data.seatLayoutId,
    seatLayoutName: data.seatLayoutName,
    title: data.title,
    description: data.description,
    isActive: data.isActive,
    expiresAt: data.expiresAt ? convertTimestampToDate(data.expiresAt) : undefined,
    usageCount: data.usageCount,
    lastUsedAt: data.lastUsedAt ? convertTimestampToDate(data.lastUsedAt) : undefined,
    requireConfirmation: data.requireConfirmation,
    allowedDaysOfWeek: data.allowedDaysOfWeek,
    allowedTimeRange: data.allowedTimeRange,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt)
  };
}

/**
 * SeatingChartSeat 배열을 GroupSeatingGrid로 변환
 */
export function convertToGroupSeatingGrid(
  group: SeatLayoutGroup,
  seats: SeatingChartSeat[]
): (SeatingChartSeat | null)[][] {
  // rows x cols 크기의 2차원 배열 초기화
  const grid: (SeatingChartSeat | null)[][] = Array.from(
    { length: group.rows },
    () => Array(group.cols).fill(null)
  );

  // 그룹에 속한 좌석들을 그리드에 배치
  seats.forEach(seat => {
    const { row, col } = seat.seatLayoutSeat;
    if (row !== undefined && col !== undefined && row < group.rows && col < group.cols) {
      grid[row][col] = seat;
    }
  });

  return grid;
}
```

---

## 4. 서비스 레이어 구현

### 4.1 AttendanceService 클래스

**⚠️ 중요: 서비스 레이어는 순수하게 백엔드 통신만 담당**

이전 계획에서 서비스 레이어에 `generateSeatsFromGroups`, `calculateDimensions` 같은 비즈니스 로직이 포함되어 있었습니다. 이는 잘못된 설계입니다:

**문제점**:
- 좌석 생성 로직이 프론트엔드에 있으면 다른 클라이언트(모바일 등)에서 동일 로직을 재구현해야 함
- 데이터 정합성: 좌석 생성 규칙이 클라이언트마다 다를 수 있음
- 역할 불일치: 서비스 레이어는 HTTP 통신 담당, 비즈니스 로직은 백엔드 담당

**해결 방안**:
- 프론트엔드는 사용자 입력(`name`, `groups`)만 백엔드로 전송
- 백엔드가 `seats`, `dimensions` 등 모든 데이터 생성
- 프론트엔드는 생성된 데이터를 받아서 표시만

**위치**: `frontend/src/services/attendanceService.ts`

```typescript
import { auth, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import {
  SeatLayout,
  SeatAssignment,
  StudentAttendanceRecord,
  AttendanceCheckLink,
  AttendanceStudentPin,
  AssignSeatData,
  CreateSeatLayoutData,
  CreateAttendanceCheckLinkData,
  UpdateAttendanceStatusData
} from '../types/attendance';
import {
  convertToSeatLayout,
  convertToSeatAssignment,
  convertToStudentAttendanceRecord,
  convertToAttendanceCheckLink
} from '../utils/attendanceTypeConverters';

class AttendanceService {
  // ==================== SeatLayout 관리 ====================

  /**
   * 좌석 배치도 목록 조회
   */
  async getSeatLayouts(): Promise<SeatLayout[]> {
    try {
      const getSeatLayoutsFunc = httpsCallable(functions, 'getSeatLayouts');
      const result = await getSeatLayoutsFunc({});

      const data = result.data as any;
      if (!data.success) {
        throw new Error(data.message || '좌석 배치도 조회 실패');
      }

      return data.data.map(convertToSeatLayout);
    } catch (error) {
      console.error('좌석 배치도 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 좌석 배치도 생성
   *
   * ⚠️ 백엔드가 seats 배열과 dimensions를 자동 생성해야 함
   * 프론트엔드는 name과 groups 정보만 전송
   */
  async createSeatLayout(layoutData: CreateSeatLayoutData): Promise<SeatLayout> {
    try {
      const createSeatLayoutFunc = httpsCallable(functions, 'createSeatLayout');

      // 프론트엔드는 사용자 입력만 전송
      const result = await createSeatLayoutFunc({
        name: layoutData.name,
        groups: layoutData.groups
      });

      const data = result.data as any;
      if (!data.success) {
        throw new Error(data.message || '좌석 배치도 생성 실패');
      }

      // 백엔드가 생성한 완전한 SeatLayout 객체 반환
      return convertToSeatLayout(data.data.layout);
    } catch (error) {
      console.error('좌석 배치도 생성 오류:', error);
      throw error;
    }
  }

  // ==================== SeatAssignment 관리 ====================

  /**
   * 특정 배치도의 좌석 할당 목록 조회
   */
  async getSeatAssignments(layoutId: string): Promise<SeatAssignment[]> {
    try {
      const getCurrentSeatAssignmentFunc = httpsCallable(functions, 'getCurrentSeatAssignment');
      const result = await getCurrentSeatAssignmentFunc({ seatLayoutId: layoutId });

      const data = result.data as any;
      if (!data.success) {
        throw new Error(data.message || '좌석 할당 조회 실패');
      }

      // 배열로 반환 (여러 학생의 할당 정보)
      return Array.isArray(data.data)
        ? data.data.map(convertToSeatAssignment)
        : [convertToSeatAssignment(data.data)];
    } catch (error) {
      console.error('좌석 할당 조회 오류:', error);
      return []; // 에러 시 빈 배열 반환
    }
  }

  /**
   * 학생 좌석 할당
   */
  async assignSeat(assignmentData: AssignSeatData): Promise<void> {
    try {
      // 1. 시간표 검증
      const validateFunc = httpsCallable(functions, 'validateStudentTimetableForSeat');
      const validateResult = await validateFunc({ studentId: assignmentData.studentId });

      const validateData = validateResult.data as any;
      if (!validateData.success) {
        throw new Error(validateData.message || '시간표 검증 실패');
      }

      // 2. 좌석 할당
      const assignSeatFunc = httpsCallable(functions, 'assignSeat');
      const result = await assignSeatFunc(assignmentData);

      const data = result.data as any;
      if (!data.success) {
        throw new Error(data.message || '좌석 할당 실패');
      }
    } catch (error) {
      console.error('좌석 할당 오류:', error);
      throw error;
    }
  }

  /**
   * 좌석 할당 해제
   */
  async unassignSeat(assignmentId: string): Promise<void> {
    try {
      const unassignSeatFunc = httpsCallable(functions, 'unassignSeat');
      const result = await unassignSeatFunc({ assignmentId });

      const data = result.data as any;
      if (!data.success) {
        throw new Error(data.message || '좌석 할당 해제 실패');
      }
    } catch (error) {
      console.error('좌석 할당 해제 오류:', error);
      throw error;
    }
  }

  // ==================== PIN 관리 ====================

  /**
   * 학생 PIN 생성
   */
  async generateStudentPin(studentId: string, pin: string): Promise<void> {
    try {
      const generatePinFunc = httpsCallable(functions, 'generateStudentPin');
      const result = await generatePinFunc({ studentId, pin });

      const data = result.data as any;
      if (!data.success) {
        throw new Error(data.message || 'PIN 생성 실패');
      }
    } catch (error) {
      console.error('PIN 생성 오류:', error);
      throw error;
    }
  }

  /**
   * 학생 PIN 변경
   */
  async updateStudentPin(studentId: string, newPin: string): Promise<void> {
    try {
      const updatePinFunc = httpsCallable(functions, 'updateStudentPin');
      const result = await updatePinFunc({ studentId, newPin });

      const data = result.data as any;
      if (!data.success) {
        throw new Error(data.message || 'PIN 변경 실패');
      }
    } catch (error) {
      console.error('PIN 변경 오류:', error);
      throw error;
    }
  }

  /**
   * PIN 잠금 해제
   */
  async unlockStudentPin(studentId: string): Promise<void> {
    try {
      const unlockPinFunc = httpsCallable(functions, 'unlockStudentPin');
      const result = await unlockPinFunc({ studentId });

      const data = result.data as any;
      if (!data.success) {
        throw new Error(data.message || 'PIN 잠금 해제 실패');
      }
    } catch (error) {
      console.error('PIN 잠금 해제 오류:', error);
      throw error;
    }
  }

  // ==================== 출석 체크 링크 관리 ====================

  /**
   * 출석 체크 링크 생성
   */
  async createAttendanceCheckLink(linkData: CreateAttendanceCheckLinkData): Promise<AttendanceCheckLink> {
    try {
      const createLinkFunc = httpsCallable(functions, 'createAttendanceCheckLink');
      const result = await createLinkFunc(linkData);

      const data = result.data as any;
      if (!data.success) {
        throw new Error(data.message || '출석 체크 링크 생성 실패');
      }

      // 생성된 링크 정보 반환
      return convertToAttendanceCheckLink({
        id: data.data.linkId,
        ...linkData,
        linkToken: data.data.linkToken,
        linkUrl: data.data.linkUrl,
        isActive: true,
        usageCount: 0,
        requireConfirmation: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('출석 체크 링크 생성 오류:', error);
      throw error;
    }
  }

  /**
   * 출석 체크 링크 목록 조회
   */
  async getAttendanceCheckLinks(): Promise<AttendanceCheckLink[]> {
    try {
      const getLinksFunc = httpsCallable(functions, 'getAttendanceCheckLinks');
      const result = await getLinksFunc({});

      const data = result.data as any;
      if (!data.success) {
        throw new Error(data.message || '출석 체크 링크 조회 실패');
      }

      return data.data.map(convertToAttendanceCheckLink);
    } catch (error) {
      console.error('출석 체크 링크 조회 오류:', error);
      throw error;
    }
  }

  // ==================== 출석 기록 관리 ====================

  /**
   * 오늘 출석 기록 조회 (특정 배치도)
   */
  async getTodayAttendanceRecords(layoutId: string): Promise<StudentAttendanceRecord[]> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const getRecordsFunc = httpsCallable(functions, 'getStudentAttendanceRecords');
      const result = await getRecordsFunc({
        startDate: today,
        endDate: today,
        seatLayoutId: layoutId
      });

      const data = result.data as any;
      if (!data.success) {
        throw new Error(data.message || '출석 기록 조회 실패');
      }

      return data.data.map(convertToStudentAttendanceRecord);
    } catch (error) {
      console.error('출석 기록 조회 오류:', error);
      return [];
    }
  }

  /**
   * 출석 상태 수동 변경
   */
  async updateAttendanceStatus(statusData: UpdateAttendanceStatusData): Promise<void> {
    try {
      const updateStatusFunc = httpsCallable(functions, 'updateAttendanceStatus');
      const result = await updateStatusFunc(statusData);

      const data = result.data as any;
      if (!data.success) {
        throw new Error(data.message || '출석 상태 변경 실패');
      }
    } catch (error) {
      console.error('출석 상태 변경 오류:', error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스 export
export const attendanceService = new AttendanceService();
```

### 4.2 서비스 사용 방법

**⚠️ 중요: backendService 통합 불필요**

이전 계획에서 `backendService`에 `attendanceService`를 통합하려 했으나, 이는 불필요한 복잡성을 추가합니다.

**간단한 방법**: 각 컴포넌트/훅에서 직접 import

```typescript
// ✅ 권장 방법
import { attendanceService } from '@/services/attendanceService';

// React Query 훅에서 사용
export function useSeatLayouts() {
  return useQuery({
    queryKey: ['seatLayouts'],
    queryFn: () => attendanceService.getSeatLayouts(),
  });
}

// 또는 컴포넌트에서 직접 사용 (권장하지 않음, 대신 React Query 훅 사용)
const CreateSeatLayoutModal = () => {
  const handleCreate = async (data: CreateSeatLayoutData) => {
    await attendanceService.createSeatLayout(data);
  };
};
```

**위치**: `frontend/src/services/attendanceService.ts`

```typescript
// 마지막에 싱글톤 인스턴스 export
export const attendanceService = new AttendanceService();
```

### 4.3 백엔드 API 수정 요청사항

**⚠️ 필수: 백엔드 개발자와 협의 필요**

현재 프론트엔드 계획에 따라 백엔드 API를 다음과 같이 수정/확장해야 합니다.

#### 4.3.1 createSeatLayout Function 수정

**현재 구현** (`functions/src/modules/personal/seatManagement.ts:283-321`):
- groups 검증 없음
- 프론트엔드에서 전체 layout 구조를 생성하여 전송 필요

**수정 요청**:

```typescript
export const createSeatLayout = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { name, groups } = data; // ⬅️ groups 배열만 받음

  // 1. groups 검증
  if (!groups || !Array.isArray(groups) || groups.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "groups가 필요합니다.");
  }

  for (const group of groups) {
    if (!group.name || !group.rows || !group.cols || !group.position) {
      throw new functions.https.HttpsError("invalid-argument", "그룹 정보가 불완전합니다.");
    }
  }

  // 2. ⭐ 백엔드에서 seats 배열 자동 생성
  const generatedGroups = groups.map((group: any, index: number) => ({
    id: `group_${Date.now()}_${index}`,
    name: group.name,
    rows: group.rows,
    cols: group.cols,
    position: group.position
  }));

  const generatedSeats = generateSeatsFromGroups(generatedGroups);
  const dimensions = calculateDimensions(generatedGroups);

  // 3. layout 객체 생성
  const layout = {
    groups: generatedGroups,
    seats: generatedSeats,
    dimensions
  };

  const layoutRef = db.collection("users").doc(userId).collection("seat_layouts").doc();
  await layoutRef.set({
    name,
    layout,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 4. ⭐ 생성된 완전한 SeatLayout 객체 반환
  const createdLayout = await layoutRef.get();
  return {
    success: true,
    message: "좌석 배치도가 생성되었습니다.",
    data: {
      layoutId: layoutRef.id,
      layout: {
        id: layoutRef.id,
        ...createdLayout.data()
      }
    }
  };
});

// ⭐ 백엔드에 추가해야 할 헬퍼 함수
function generateSeatsFromGroups(groups: any[]): any[] {
  const seats: any[] = [];
  const seatWidth = 60;
  const seatHeight = 60;
  const seatGap = 10;

  groups.forEach((group) => {
    for (let row = 0; row < group.rows; row++) {
      for (let col = 0; col < group.cols; col++) {
        const seatNumber = row * group.cols + col + 1;
        const seatId = `${group.id}_seat_${row}_${col}`;

        seats.push({
          id: seatId,
          position: {
            x: group.position.x + col * (seatWidth + seatGap),
            y: group.position.y + row * (seatHeight + seatGap)
          },
          size: { width: seatWidth, height: seatHeight },
          groupId: group.id,
          row,
          col,
          label: `${group.name}-${seatNumber}`
        });
      }
    }
  });

  return seats;
}

function calculateDimensions(groups: any[]): { width: number; height: number } {
  let maxWidth = 0;
  let maxHeight = 0;

  groups.forEach(group => {
    const groupWidth = group.position.x + (group.cols * 70);
    const groupHeight = group.position.y + (group.rows * 70);

    maxWidth = Math.max(maxWidth, groupWidth);
    maxHeight = Math.max(maxHeight, groupHeight);
  });

  return {
    width: maxWidth + 50,
    height: maxHeight + 50
  };
}
```

**변경 사항 요약**:
- ✅ `groups` 배열만 받음 (`name`, `rows`, `cols`, `position`)
- ✅ 백엔드에서 `seats` 배열 자동 생성
- ✅ 백엔드에서 `dimensions` 자동 계산
- ✅ 생성된 완전한 `SeatLayout` 객체 반환

#### 4.3.2 assignSeat Function 수정 확인

**현재 구현** (`functions/src/modules/personal/seatManagement.ts:126-205`):

현재 이미 `studentId`, `timetableId`, `seatLayoutId`, `expectedSchedule` 필드를 지원하므로 **추가 수정 불필요**.

다만, 프론트엔드에서 호출 시 다음 파라미터 전달 확인:

```typescript
// 프론트엔드에서 호출
await assignSeatFunc({
  seatId: string,
  studentId: string,
  timetableId: string,
  seatLayoutId: string
});
```

백엔드가 자동으로 `expectedSchedule`을 생성하는지 확인 필요.

#### 4.3.3 getSeatAssignments 추가 (현재 없음)

**현재**: `getCurrentSeatAssignment`만 존재 (단일 할당 조회)

**추가 요청**: 특정 배치도의 모든 할당 조회

```typescript
export const getSeatAssignments = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const userId = context.auth.uid;
  const { seatLayoutId } = data;

  if (!seatLayoutId) {
    throw new functions.https.HttpsError("invalid-argument", "seatLayoutId가 필요합니다.");
  }

  const db = admin.firestore();
  const assignmentsSnapshot = await db
    .collection("users")
    .doc(userId)
    .collection("seat_assignments")
    .where("seatLayoutId", "==", seatLayoutId)
    .where("status", "==", "active")
    .get();

  const assignments = assignmentsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  return {
    success: true,
    data: assignments
  };
});
```

---

## 5. 컴포넌트 구조 설계

### 5.1 컴포넌트 디렉토리 구조

```
frontend/src/components/domain/Attendance/
├── SeatingChart/
│   ├── SeatingChart.tsx              # 메인 좌석 배치도 컴포넌트
│   ├── SeatingChart.css
│   ├── SeatGroup.tsx                 # 그룹별 좌석 표시
│   ├── SeatGroup.css
│   ├── Seat.tsx                      # 개별 좌석 컴포넌트 (재사용)
│   └── Seat.css
├── SeatLayoutSelector/
│   ├── SeatLayoutSelector.tsx        # 좌석 배치도 선택기
│   ├── SeatLayoutSelector.css
│   └── SeatLayoutCard.tsx            # 배치도 카드
├── StudentAssignment/
│   ├── StudentAssignmentPanel.tsx    # 학생 할당 패널
│   ├── StudentAssignmentPanel.css
│   ├── StudentSearch.tsx             # 학생 검색 (재사용)
│   ├── StudentSearch.css
│   └── AssignedStudentsList.tsx      # 할당된 학생 목록
├── AttendanceRecords/
│   ├── AttendanceRecordsPanel.tsx    # 출석 기록 패널
│   ├── AttendanceRecordsPanel.css
│   ├── AttendanceStatsCard.tsx       # 출석 통계 카드
│   └── AttendanceRecordsList.tsx     # 출석 기록 목록
├── Modals/
│   ├── CreateSeatLayoutModal.tsx     # 배치도 생성 모달
│   ├── CreateSeatLayoutModal.css
│   ├── AssignSeatModal.tsx           # 좌석 할당 모달
│   ├── AssignSeatModal.css
│   ├── ManagePinModal.tsx            # PIN 관리 모달
│   ├── ManagePinModal.css
│   ├── AttendanceCheckLinkModal.tsx  # 출석 링크 모달
│   ├── AttendanceCheckLinkModal.css
│   ├── AttendanceRecordDetailModal.tsx # 출석 기록 상세 모달
│   └── AttendanceRecordDetailModal.css
└── AttendanceContext.tsx             # Context Provider

frontend/src/pages/Attendance/
├── Attendance.tsx                    # 메인 페이지
└── Attendance.css
```

### 5.2 핵심 컴포넌트 설계

#### 5.2.1 SeatingChart (좌석 배치도 시각화)

**역할**: SeatLayout의 groups 구조를 시각적으로 렌더링

```typescript
interface SeatingChartProps {
  layout: SeatLayout;
  assignments: SeatAssignment[];
  attendanceRecords: StudentAttendanceRecord[];
  students: Student[];
  selectedSeatId: string | null;
  onSeatClick: (seatId: string) => void;
}

const SeatingChart: React.FC<SeatingChartProps> = ({
  layout,
  assignments,
  attendanceRecords,
  students,
  selectedSeatId,
  onSeatClick
}) => {
  // 1. SeatingChartSeat 배열 생성
  const seatingChartSeats: SeatingChartSeat[] = layout.layout.seats.map(seat => {
    const assignment = assignments.find(a => a.seatId === seat.id);
    const record = attendanceRecords.find(r => r.seatId === seat.id);
    const student = assignment?.studentId
      ? students.find(s => s.id === assignment.studentId)
      : undefined;

    return {
      seatLayoutSeat: seat,
      assignment,
      attendanceRecord: record,
      student
    };
  });

  // 2. 그룹별로 분류
  const groupedSeats = layout.layout.groups?.map(group => {
    const groupSeats = seatingChartSeats.filter(
      s => s.seatLayoutSeat.groupId === group.id
    );
    return {
      group,
      seats: groupSeats
    };
  }) || [];

  return (
    <div className="seating-chart">
      <div className="seating-chart__header">
        <h3>{layout.name}</h3>
        <AttendanceStatsCard records={attendanceRecords} />
      </div>

      <div className="seating-chart__groups">
        {groupedSeats.map(({ group, seats }) => (
          <SeatGroup
            key={group.id}
            group={group}
            seats={seats}
            selectedSeatId={selectedSeatId}
            onSeatClick={onSeatClick}
          />
        ))}
      </div>

      <div className="seating-chart__legend">
        <LegendItem color="#4CAF50" label="등원" />
        <LegendItem color="#9E9E9E" label="하원" />
        <LegendItem color="#FFC107" label="사유결석" />
        <LegendItem color="#F44336" label="무단결석" />
        <LegendItem color="#FFFFFF" label="미등원" />
      </div>
    </div>
  );
};
```

#### 5.2.2 SeatGroup (그룹별 좌석 그리드)

```typescript
interface SeatGroupProps {
  group: SeatLayoutGroup;
  seats: SeatingChartSeat[];
  selectedSeatId: string | null;
  onSeatClick: (seatId: string) => void;
}

const SeatGroup: React.FC<SeatGroupProps> = ({
  group,
  seats,
  selectedSeatId,
  onSeatClick
}) => {
  // 좌석을 row x col 그리드로 변환
  const grid = convertToGroupSeatingGrid(group, seats);

  return (
    <div className="seat-group">
      <div className="seat-group__header">
        <h4>{group.name}</h4>
        <span className="seat-group__size">{group.rows}×{group.cols}</span>
      </div>

      <div
        className="seat-group__grid"
        style={{
          gridTemplateColumns: `repeat(${group.cols}, 1fr)`,
          gridTemplateRows: `repeat(${group.rows}, 1fr)`
        }}
      >
        {grid.map((row, rowIndex) =>
          row.map((seat, colIndex) => (
            <Seat
              key={seat ? seat.seatLayoutSeat.id : `empty-${rowIndex}-${colIndex}`}
              seat={seat}
              isSelected={seat?.seatLayoutSeat.id === selectedSeatId}
              onClick={() => seat && onSeatClick(seat.seatLayoutSeat.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};
```

#### 5.2.3 Seat (개별 좌석)

```typescript
interface SeatProps {
  seat: SeatingChartSeat | null;
  isSelected: boolean;
  onClick: () => void;
}

const Seat: React.FC<SeatProps> = ({ seat, isSelected, onClick }) => {
  if (!seat) {
    return <div className="seat seat--empty" />;
  }

  // 출석 상태에 따른 색상 결정
  const getStatusColor = (): string => {
    if (!seat.attendanceRecord) return '#FFFFFF'; // 미등원 (빈 좌석)

    switch (seat.attendanceRecord.status) {
      case 'checked_in': return '#4CAF50'; // 등원 (초록)
      case 'checked_out': return '#9E9E9E'; // 하원 (회색)
      case 'absent_excused': return '#FFC107'; // 사유결석 (노랑)
      case 'absent_unexcused': return '#F44336'; // 무단결석 (빨강)
      case 'not_arrived': return '#FFFFFF'; // 미등원 (흰색)
      default: return '#FFFFFF';
    }
  };

  const statusColor = getStatusColor();

  return (
    <div
      className={`seat ${isSelected ? 'seat--selected' : ''}`}
      style={{ backgroundColor: statusColor }}
      onClick={onClick}
    >
      <div className="seat__label">{seat.seatLayoutSeat.label}</div>
      {seat.student && (
        <div className="seat__student-name">{seat.student.name}</div>
      )}
      {seat.attendanceRecord?.isLate && (
        <div className="seat__badge seat__badge--late">지각</div>
      )}
      {seat.attendanceRecord?.isEarlyLeave && (
        <div className="seat__badge seat__badge--early">조퇴</div>
      )}
    </div>
  );
};
```

#### 5.2.4 CreateSeatLayoutModal (배치도 생성 모달)

```typescript
interface CreateSeatLayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (layoutData: CreateSeatLayoutData) => Promise<void>;
}

const CreateSeatLayoutModal: React.FC<CreateSeatLayoutModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [name, setName] = useState('');
  const [groups, setGroups] = useState<CreateSeatLayoutData['groups']>([
    { name: '1구역', rows: 3, cols: 3, position: { x: 50, y: 50 } }
  ]);
  const [saving, setSaving] = useState(false);

  const handleAddGroup = () => {
    const lastGroup = groups[groups.length - 1];
    const newPosition = {
      x: lastGroup.position.x + 300,
      y: lastGroup.position.y
    };

    setGroups([
      ...groups,
      {
        name: `${groups.length + 1}구역`,
        rows: 3,
        cols: 3,
        position: newPosition
      }
    ]);
  };

  const handleRemoveGroup = (index: number) => {
    setGroups(groups.filter((_, i) => i !== index));
  };

  const handleGroupChange = (index: number, field: string, value: any) => {
    setGroups(groups.map((group, i) =>
      i === index ? { ...group, [field]: value } : group
    ));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('배치도 이름을 입력해주세요.');
      return;
    }

    if (groups.length === 0) {
      alert('최소 1개 이상의 그룹이 필요합니다.');
      return;
    }

    try {
      setSaving(true);
      await onSave({ name, groups });
      onClose();
    } catch (error) {
      console.error('배치도 생성 오류:', error);
      alert('배치도 생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-content--large">
        <div className="modal-header">
          <h2>좌석 배치도 생성</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>배치도 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 1층 자습실"
            />
          </div>

          <div className="form-group">
            <div className="form-group__header">
              <label>좌석 그룹</label>
              <button
                className="btn btn--secondary btn--small"
                onClick={handleAddGroup}
              >
                + 그룹 추가
              </button>
            </div>

            {groups.map((group, index) => (
              <div key={index} className="group-config">
                <div className="group-config__header">
                  <h4>그룹 {index + 1}</h4>
                  {groups.length > 1 && (
                    <button
                      className="btn btn--danger btn--small"
                      onClick={() => handleRemoveGroup(index)}
                    >
                      삭제
                    </button>
                  )}
                </div>

                <div className="group-config__fields">
                  <div className="form-field">
                    <label>그룹 이름</label>
                    <input
                      type="text"
                      value={group.name}
                      onChange={(e) => handleGroupChange(index, 'name', e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label>행 (rows)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={group.rows}
                      onChange={(e) => handleGroupChange(index, 'rows', parseInt(e.target.value))}
                    />
                  </div>

                  <div className="form-field">
                    <label>열 (cols)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={group.cols}
                      onChange={(e) => handleGroupChange(index, 'cols', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="group-config__preview">
                  <div className="preview-label">미리보기: {group.rows}×{group.cols} = {group.rows * group.cols}개 좌석</div>
                </div>
              </div>
            ))}
          </div>

          <div className="form-summary">
            <p>총 그룹: {groups.length}개</p>
            <p>총 좌석: {groups.reduce((sum, g) => sum + g.rows * g.cols, 0)}개</p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onClose}>
            취소
          </button>
          <button
            className="btn btn--primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '생성 중...' : '생성'}
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## 6. 페이지 레이아웃 설계

### 6.1 Attendance.tsx (메인 페이지) - React Query + Zustand 버전

```typescript
import React from 'react';
import { useAttendanceUIStore } from '@/stores/useAttendanceUIStore';
import {
  useSeatLayouts,
  useSeatAssignments,
  useTodayAttendanceRecords,
  useStudentsWithTimetables
} from '@/hooks/useAttendanceQueries';
import SeatLayoutSelector from '@/components/domain/Attendance/SeatLayoutSelector/SeatLayoutSelector';
import SeatingChart from '@/components/domain/Attendance/SeatingChart/SeatingChart';
import StudentAssignmentPanel from '@/components/domain/Attendance/StudentAssignment/StudentAssignmentPanel';
import AttendanceRecordsPanel from '@/components/domain/Attendance/AttendanceRecords/AttendanceRecordsPanel';
import './Attendance.css';

const Attendance: React.FC = () => {
  // ==================== Zustand UI 상태 ====================
  const {
    selectedLayoutId,
    selectedSeatId,
    setSelectedSeatId
  } = useAttendanceUIStore();

  // ==================== React Query 서버 상태 ====================
  const { data: layouts, isLoading: layoutsLoading } = useSeatLayouts();
  const { data: assignments = [], isLoading: assignmentsLoading } = useSeatAssignments(selectedLayoutId);
  const { data: attendanceRecords = [], isLoading: recordsLoading } = useTodayAttendanceRecords(selectedLayoutId);
  const { data: students = [], isLoading: studentsLoading } = useStudentsWithTimetables();

  // ==================== 파생 상태 ====================
  const selectedLayout = layouts?.find(l => l.id === selectedLayoutId);
  const isLoading = layoutsLoading || assignmentsLoading || recordsLoading || studentsLoading;

  // ==================== 렌더링 ====================
  if (isLoading) {
    return (
      <div className="attendance-loading">
        <div className="spinner"></div>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="attendance-main-page">
      {/* 왼쪽: 좌석 배치도 선택기 */}
      <div className="attendance-sidebar">
        <SeatLayoutSelector />
      </div>

      {/* 오른쪽: 메인 컨텐츠 */}
      <div className="attendance-main-content">
        {selectedLayout ? (
          <>
            {/* 좌석 배치도 */}
            <div className="attendance-section attendance-section--seating">
              <SeatingChart
                layout={selectedLayout}
                assignments={assignments}
                attendanceRecords={attendanceRecords}
                students={students}
                selectedSeatId={selectedSeatId}
                onSeatClick={setSelectedSeatId}
              />
            </div>

            {/* 하단 패널들 */}
            <div className="attendance-bottom-panels">
              {/* 학생 할당 패널 */}
              <div className="attendance-section attendance-section--assignment">
                <StudentAssignmentPanel />
              </div>

              {/* 출석 기록 패널 */}
              <div className="attendance-section attendance-section--records">
                <AttendanceRecordsPanel />
              </div>
            </div>
          </>
        ) : (
          <div className="attendance-empty-state">
            <h3>좌석 배치도를 선택해주세요</h3>
            <p>왼쪽에서 배치도를 선택하거나 새로 생성하세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Attendance;
```

**주요 변경사항**:
- ✅ `AttendanceContext` 제거 → React Query + Zustand 사용
- ✅ 각 데이터별 독립적인 `useQuery` 훅 사용
- ✅ 로딩 상태 자동 관리 (`isLoading`)
- ✅ 에러 처리는 각 훅에서 개별적으로 (`isError`, `error`)
- ✅ 데이터 자동 캐싱 및 갱신
- ✅ 불필요한 리렌더링 최소화

### 6.2 CSS 레이아웃 (Attendance.css)

```css
/* 메인 레이아웃 */
.attendance-main-page {
  display: flex;
  height: 100vh;
  background-color: #f5f5f5;
  overflow: hidden;
}

/* 왼쪽 사이드바 (좌석 배치도 선택기) */
.attendance-sidebar {
  width: 300px;
  background-color: #ffffff;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

/* 오른쪽 메인 컨텐츠 */
.attendance-main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px;
  gap: 20px;
}

/* 좌석 배치도 섹션 */
.attendance-section--seating {
  flex: 1;
  background-color: #ffffff;
  border-radius: 8px;
  padding: 20px;
  overflow: auto;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 하단 패널들 (학생 할당 + 출석 기록) */
.attendance-bottom-panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  height: 300px;
}

.attendance-section--assignment,
.attendance-section--records {
  background-color: #ffffff;
  border-radius: 8px;
  padding: 20px;
  overflow: auto;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 빈 상태 */
.attendance-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9e9e9e;
}

/* 로딩/에러 */
.attendance-loading,
.attendance-error {
  padding: 20px;
  text-align: center;
}

.attendance-error {
  background-color: #ffebee;
  color: #c62828;
  border-radius: 4px;
  margin: 20px;
}

/* 반응형 (작은 화면) */
@media (max-width: 1024px) {
  .attendance-bottom-panels {
    grid-template-columns: 1fr;
    height: auto;
  }

  .attendance-sidebar {
    width: 250px;
  }
}

@media (max-width: 768px) {
  .attendance-main-page {
    flex-direction: column;
  }

  .attendance-sidebar {
    width: 100%;
    height: auto;
    border-right: none;
    border-bottom: 1px solid #e0e0e0;
  }

  .attendance-bottom-panels {
    height: auto;
  }
}
```

---

## 7. 구현 단계별 계획

### Phase 1: 타입 & 서비스 레이어 & 백엔드 협의 (2-3일)

**목표**: 백엔드와 완전히 일치하는 타입 시스템과 순수한 서비스 레이어 구축

**작업 항목**:
1. ✅ **백엔드 개발자와 API 수정 협의** (필수)
   - `createSeatLayout` Function 수정 요청
   - `getSeatAssignments` Function 추가 요청
   - 백엔드에 `generateSeatsFromGroups`, `calculateDimensions` 헬퍼 함수 추가
2. ✅ `types/attendance.ts` 완전 재작성
   - 백엔드 타입 그대로 복사
   - UI 전용 타입 추가 (`SeatingChartSeat`, `GroupSeatingGrid` 등)
3. ✅ `utils/attendanceTypeConverters.ts` 작성
   - Firestore Timestamp → Date 변환
   - 문서 → 타입 변환 함수들
   - `convertToGroupSeatingGrid` 헬퍼
4. ✅ `services/attendanceService.ts` 작성
   - **순수한** Firebase Functions 호출만 (비즈니스 로직 제거)
   - 에러 핸들링
   - ❌ `generateSeatsFromGroups` 제거 (백엔드로 이관)
   - ❌ `calculateDimensions` 제거 (백엔드로 이관)
5. ✅ `hooks/useAttendanceQueries.ts` 작성
   - React Query 훅들 (`useQuery`, `useMutation`)
   - 자동 캐싱 및 동기화 설정
6. ✅ `stores/useAttendanceUIStore.ts` 작성
   - Zustand UI 상태 관리
   - 선택 상태, 모달 상태 등

**검증 방법**:
- TypeScript 컴파일 에러 없음
- 백엔드 API 수정 완료 확인
- React Query 개발자 도구에서 캐싱 동작 확인

### Phase 2: 기본 컴포넌트 구현 (2-3일)

**목표**: React Query + Zustand 기반 컴포넌트 구현

**작업 항목**:
1. ✅ `Seat.tsx` 수정
   - `SeatingChartSeat` 타입 사용
   - 출석 상태별 색상 표시
   - `React.memo` 최적화
2. ✅ `SeatGroup.tsx` 신규 작성
   - 그룹별 그리드 렌더링
   - `convertToGroupSeatingGrid` 활용
3. ✅ `SeatingChart.tsx` 재작성
   - SeatLayout groups 구조 지원
   - `useMemo`로 데이터 변환 최적화
   - 통계 표시
4. ✅ `Attendance.tsx` 메인 페이지
   - React Query 훅 사용
   - Zustand UI 상태 사용
   - ❌ `AttendanceContext` 사용 안 함

**검증 방법**:
- React Query 개발자 도구에서 데이터 갱신 확인
- 좌석 색상 변경 동작 확인
- 성능 프로파일러로 리렌더링 최소화 확인

### Phase 3: 좌석 배치도 관리 (2-3일)

**목표**: 좌석 배치도 생성/선택 기능 구현

**작업 항목**:
1. ✅ `SeatLayoutSelector.tsx` 작성
   - 배치도 목록 표시
   - 선택 기능
2. ✅ `CreateSeatLayoutModal.tsx` 작성
   - 그룹 추가/삭제
   - 행×열 설정
   - 미리보기
3. ✅ `AttendanceStatsCard.tsx` 작성
   - 출석 통계 표시

**검증 방법**:
- 배치도 생성 → 백엔드 저장 확인
- 배치도 선택 → 좌석 표시 확인

### Phase 4: 학생 할당 기능 (2-3일)

**목표**: 학생 좌석 할당 및 PIN 관리

**작업 항목**:
1. ✅ `StudentAssignmentPanel.tsx` 작성
   - 학생 검색 (재사용)
   - 할당된 학생 목록
2. ✅ `AssignSeatModal.tsx` 작성
   - 학생 선택
   - 시간표 검증
   - 좌석 선택
3. ✅ `ManagePinModal.tsx` 작성
   - PIN 생성/변경
   - PIN 잠금 해제

**검증 방법**:
- 학생 할당 → 좌석에 학생 이름 표시
- PIN 생성 → 백엔드 확인
- 시간표 없는 학생 할당 시 에러 확인

### Phase 5: 출석 기록 관리 (2-3일)

**목표**: 출석 기록 조회 및 상태 변경

**작업 항목**:
1. ✅ `AttendanceRecordsPanel.tsx` 작성
   - 오늘 출석 현황
   - 출석 기록 목록
2. ✅ `AttendanceRecordDetailModal.tsx` 작성
   - 상세 정보 표시
   - 상태 수동 변경
   - 사유 입력
3. ✅ 실시간 업데이트 (선택 사항)
   - Firestore onSnapshot 사용

**검증 방법**:
- 출석 상태 변경 → 좌석 색상 변경
- 사유결석 처리 → 백엔드 확인

### Phase 6: 출석 체크 링크 (1-2일)

**목표**: 출석 체크 링크 생성 및 관리

**작업 항목**:
1. ✅ `AttendanceCheckLinkModal.tsx` 작성
   - 링크 생성 폼
   - 링크 목록
   - 링크 활성화/비활성화
2. ✅ QR 코드 생성 (선택 사항)
   - `qrcode.react` 라이브러리 사용

**검증 방법**:
- 링크 생성 → URL 복사 → 접속 확인
- 링크 비활성화 → 접속 불가 확인

### Phase 7: UI 개선 & 최적화 (1-2일)

**목표**: 사용성 개선 및 성능 최적화

**작업 항목**:
1. ✅ CSS 스타일링 개선
   - 반응형 디자인
   - 색상 시스템 통일
2. ✅ 로딩/에러 상태 개선
   - 스켈레톤 UI
   - 에러 메시지 개선
3. ✅ 성능 최적화
   - React.memo 적용
   - useMemo/useCallback 사용

**검증 방법**:
- 모바일 화면 테스트
- 큰 배치도 (10×10) 렌더링 성능 확인

### Phase 8: 테스트 & 디버깅 (1-2일)

**목표**: 전체 기능 통합 테스트

**작업 항목**:
1. ✅ 시나리오 기반 테스트
   - 배치도 생성 → 학생 할당 → 출석 체크 → 기록 확인
2. ✅ 에지 케이스 테스트
   - 시간표 없는 학생 할당 시도
   - 중복 PIN 생성 시도
   - 만료된 링크 접속 시도
3. ✅ 버그 수정

**검증 방법**:
- 모든 시나리오 통과
- 에러 없이 정상 동작

---

## 8. 기술적 고려사항

### 8.1 상태 동기화 전략

**문제**: 출석 상태가 실시간으로 변경되는 경우 (학생이 PIN 입력)

**해결 방안**:

1. **폴링 방식** (간단, 권장):
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    if (selectedLayout) {
      actions.refreshAttendanceRecords(selectedLayout.id);
    }
  }, 30000); // 30초마다 갱신

  return () => clearInterval(interval);
}, [selectedLayout]);
```

2. **Firestore 실시간 리스너** (복잡, 고급):
```typescript
useEffect(() => {
  if (!selectedLayout) return;

  const unsubscribe = db
    .collection('users')
    .doc(userId)
    .collection('student_attendance_records')
    .where('seatLayoutId', '==', selectedLayout.id)
    .where('date', '==', today)
    .onSnapshot(snapshot => {
      const records = snapshot.docs.map(convertToStudentAttendanceRecord);
      setTodayAttendanceRecords(records);
    });

  return () => unsubscribe();
}, [selectedLayout]);
```

**권장**: Phase 5에서는 폴링, Phase 7에서 실시간 리스너로 업그레이드

### 8.2 성능 최적화

**대량 좌석 렌더링 최적화**:

```typescript
// Seat 컴포넌트 메모이제이션
const Seat = React.memo<SeatProps>(({ seat, isSelected, onClick }) => {
  // ...
}, (prevProps, nextProps) => {
  // 좌석 상태가 변경되지 않으면 리렌더링 방지
  return (
    prevProps.seat?.attendanceRecord?.status === nextProps.seat?.attendanceRecord?.status &&
    prevProps.isSelected === nextProps.isSelected
  );
});
```

**SeatingChart 최적화**:

```typescript
const SeatingChart: React.FC<SeatingChartProps> = ({ ... }) => {
  // 좌석 데이터 메모이제이션
  const seatingChartSeats = useMemo(() => {
    return layout.layout.seats.map(seat => {
      // ...
    });
  }, [layout, assignments, attendanceRecords, students]);

  // ...
};
```

### 8.3 에러 처리 전략

**서비스 레이어 에러 처리**:

```typescript
class AttendanceService {
  async assignSeat(assignmentData: AssignSeatData): Promise<void> {
    try {
      // 1. 시간표 검증
      const validateFunc = httpsCallable(functions, 'validateStudentTimetableForSeat');
      const validateResult = await validateFunc({ studentId: assignmentData.studentId });

      const validateData = validateResult.data as any;
      if (!validateData.success) {
        throw new AttendanceError(
          validateData.message || '시간표 검증 실패',
          'TIMETABLE_VALIDATION_FAILED'
        );
      }

      // 2. 좌석 할당
      const assignSeatFunc = httpsCallable(functions, 'assignSeat');
      const result = await assignSeatFunc(assignmentData);

      const data = result.data as any;
      if (!data.success) {
        throw new AttendanceError(
          data.message || '좌석 할당 실패',
          'SEAT_ASSIGNMENT_FAILED'
        );
      }
    } catch (error) {
      console.error('좌석 할당 오류:', error);

      // 커스텀 에러 다시 던지기
      if (error instanceof AttendanceError) {
        throw error;
      }

      // 네트워크 에러 등
      throw new AttendanceError(
        '좌석 할당 중 오류가 발생했습니다.',
        'UNKNOWN_ERROR',
        error
      );
    }
  }
}

// 커스텀 에러 클래스
class AttendanceError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'AttendanceError';
  }
}
```

**컴포넌트 레벨 에러 처리**:

```typescript
const AssignSeatModal: React.FC<AssignSeatModalProps> = ({ ... }) => {
  const [error, setError] = useState<string | null>(null);

  const handleAssign = async () => {
    try {
      setError(null);
      await attendanceService.assignSeat(assignmentData);
      onClose();
    } catch (error) {
      if (error instanceof AttendanceError) {
        // 사용자 친화적 메시지 표시
        switch (error.code) {
          case 'TIMETABLE_VALIDATION_FAILED':
            setError('학생의 활성 시간표를 찾을 수 없습니다. 먼저 시간표를 생성해주세요.');
            break;
          case 'SEAT_ASSIGNMENT_FAILED':
            setError('이미 할당된 좌석입니다. 다른 좌석을 선택해주세요.');
            break;
          default:
            setError('좌석 할당에 실패했습니다. 다시 시도해주세요.');
        }
      } else {
        setError('알 수 없는 오류가 발생했습니다.');
      }
    }
  };

  return (
    // ... JSX에서 {error && <div className="error">{error}</div>} 표시
  );
};
```

### 8.4 접근성 (Accessibility)

**키보드 네비게이션**:

```typescript
const Seat: React.FC<SeatProps> = ({ seat, isSelected, onClick }) => {
  return (
    <button
      className={`seat ${isSelected ? 'seat--selected' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
      aria-label={`좌석 ${seat?.seatLayoutSeat.label}, ${seat?.student?.name || '빈 좌석'}`}
      aria-pressed={isSelected}
      tabIndex={0}
    >
      {/* ... */}
    </button>
  );
};
```

**스크린 리더 지원**:

```typescript
<div
  className="seating-chart__grid"
  role="grid"
  aria-label={`${layout.name} 좌석 배치도`}
>
  {/* ... */}
</div>
```

### 8.5 모바일 최적화

**터치 이벤트 지원**:

```typescript
const Seat: React.FC<SeatProps> = ({ seat, isSelected, onClick }) => {
  const [touchStartTime, setTouchStartTime] = useState(0);

  const handleTouchStart = () => {
    setTouchStartTime(Date.now());
  };

  const handleTouchEnd = () => {
    const touchDuration = Date.now() - touchStartTime;
    if (touchDuration < 500) { // 짧은 터치 = 클릭
      onClick();
    }
  };

  return (
    <div
      className="seat"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ... */}
    </div>
  );
};
```

**반응형 그리드**:

```css
@media (max-width: 768px) {
  .seat-group__grid {
    gap: 4px; /* 모바일에서 간격 축소 */
  }

  .seat {
    font-size: 10px; /* 글자 크기 축소 */
    min-width: 40px; /* 최소 크기 축소 */
    min-height: 40px;
  }
}
```

---

## 요약

이 구현 계획서는 다음을 보장합니다:

### ✅ 핵심 개선 사항 (피드백 반영)

1. **상태 관리 아키텍처 개선**
   - ❌ 단일 Context API (성능 문제, 복잡성)
   - ✅ **React Query (서버 상태) + Zustand (UI 상태)**
   - 자동 캐싱, 로딩/에러 관리, 최적화된 리렌더링

2. **서비스 레이어 단순화**
   - ❌ 비즈니스 로직 포함 (좌석 생성 로직)
   - ✅ **순수한 HTTP 통신만** (백엔드로 로직 이관)
   - 데이터 정합성 보장, 다른 클라이언트와 일관성

3. **백엔드 협업 명확화**
   - ✅ **API 수정 요청사항 명확히 문서화**
   - `createSeatLayout`, `getSeatAssignments` 수정/추가
   - 백엔드에서 `seats`, `dimensions` 자동 생성

### ✅ 기존 강점 유지

4. ✅ **백엔드 완전 일치**: `ATTENDANCE_DATABASE_DESIGN.md` 및 `studentAttendanceManagement.ts` 기반
5. ✅ **타입 안정성**: TypeScript 타입 시스템으로 런타임 에러 방지
6. ✅ **사용성**: 직관적인 UI와 명확한 에러 메시지
7. ✅ **성능**: React.memo, useMemo, useCallback 최적화
8. ✅ **접근성**: 키보드 네비게이션 및 스크린 리더 지원
9. ✅ **반응형**: 데스크톱, 태블릿, 모바일 모두 지원

**총 예상 작업 기간**: 13-19일 (Phase 1-8, 백엔드 협의 시간 포함)

**우선순위**:
- **최우선**: Phase 1 (백엔드 API 수정 협의 및 타입/서비스 레이어)
- **필수**: Phase 2-5 (컴포넌트, 배치도, 학생 할당, 출석 기록)
- **선택**: Phase 6-7 (출석 링크, UI 개선)
- **최적화**: Phase 8 (테스트, 디버깅)

### 🚨 중요 전제 조건

이 계획서 실행 전 **반드시 백엔드 개발자와 협의**하여 다음 API를 수정/추가해야 합니다:
1. `createSeatLayout` - groups만 받아서 전체 layout 생성
2. `getSeatAssignments` - 특정 배치도의 모든 할당 조회

백엔드 수정 없이 프론트엔드만 진행하면 프로젝트 실패 위험이 큽니다.

---

## 부록: UI/UX 고급 개선 사항 (선택 사항)

현재 계획서의 UI/UX는 이미 검증된 모범 사례를 따르고 있습니다. 하지만 **사용자 편의성을 한 단계 더 높일 수 있는** 고급 기능들을 아래에 정리했습니다. 이들은 필수가 아닌 선택 사항이며, Phase 7-8에서 시간 여유가 있을 때 구현을 고려할 수 있습니다.

### A.1 좌석 배치도 생성: 하이브리드 접근법 (빠른 생성 + 상세 편집)

**현재 계획**: 그룹 위치를 좌표(`x`, `y`) 숫자로 직접 입력

**문제점**:
- 사용자가 머릿속으로 캔버스를 상상해서 좌표 계산 필요
- 여러 그룹 배치 시 겹침 방지가 번거로움
- 시행착오 과정에서 불편함

**개선 방안**: 2단계 하이브리드 생성 방식

대부분의 스터디룸은 규칙적인 격자 형태입니다. 따라서 **90% 사용 사례를 위한 빠른 생성 방식**과 **복잡한 레이아웃을 위한 상세 편집 방식**을 모두 제공합니다.

#### A.1.1 1단계: 빠른 생성 (기본 방식)

**대상**: 단일 그룹의 규칙적인 격자 배치 (대부분의 사용 사례)

모달이 열리면 가장 먼저 간단한 폼을 보여줍니다:

- **배치도 이름**: (예: 1층 자습실)
- **그룹 이름**: (예: A구역)
- **행(Rows) 개수**: [ 10 ]
- **열(Cols) 개수**: [ 8 ]

사용자가 이 정보만 입력하고 '생성' 버튼을 누르면, 백엔드는 이 정보를 바탕으로 단일 그룹을 가진 직사각형 `SeatLayout`을 즉시 생성합니다.

**장점**:
- ✅ **압도적인 편의성**: 복잡한 좌표 없이 행/열 개수만 입력
- ✅ **신속함**: 3~4개 필드 입력으로 즉시 완료
- ✅ **구현 단순**: 드래그 앤 드롭 UI 불필요

#### A.1.2 2단계: 상세 편집 (선택 사항)

**대상**: 복잡한 레이아웃 (L자형, 기둥 제외, 여러 그룹)

1단계 화면에 **'상세 편집 모드로 전환'** 또는 **'그룹 추가'** 버튼을 제공합니다. 클릭 시:

1. 현재 입력된 기본 그룹이 캔버스에 시각화됨
2. 추가 그룹을 생성하고 드래그 앤 드롭으로 배치 가능
3. 기존 그룹 위치도 드래그로 조정 가능

이렇게 하면 복잡한 레이아웃이 필요한 **10% 사용자만 상세 편집 모드를 사용**하게 됩니다.

#### A.1.3 구현 예시: 하이브리드 모달

```typescript
// CreateSeatLayoutModal.tsx - 하이브리드 버전

import { DndContext, DragEndEvent, useDraggable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

const CreateSeatLayoutModal: React.FC<CreateSeatLayoutModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [mode, setMode] = useState<'quick' | 'advanced'>('quick');

  // 1단계: 빠른 생성 상태
  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('A구역');
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(8);

  // 2단계: 상세 편집 상태 (mode === 'advanced'일 때만 사용)
  const [groups, setGroups] = useState<GroupConfig[]>([]);

  // 빠른 생성 → 상세 편집 모드 전환
  const switchToAdvancedMode = () => {
    // 현재 입력된 기본 그룹을 groups 배열에 추가
    setGroups([{
      id: generateId(),
      name: groupName,
      rows,
      cols,
      position: { x: 50, y: 50 }
    }]);
    setMode('advanced');
  };

  // 빠른 생성 모드 저장
  const handleQuickSave = async () => {
    await onSave({
      name,
      groups: [{
        name: groupName,
        rows,
        cols,
        x: 0,  // 백엔드가 자동 계산
        y: 0   // 백엔드가 자동 계산
      }]
    });
  };

  // 상세 편집 모드 저장
  const handleAdvancedSave = async () => {
    await onSave({
      name,
      groups: groups.map(g => ({
        name: g.name,
        rows: g.rows,
        cols: g.cols,
        x: g.position.x,
        y: g.position.y
      }))
    });
  };

  return (
    <div className="modal-overlay">
      <div className={`modal-content ${mode === 'advanced' ? 'modal-content--xlarge' : 'modal-content--medium'}`}>
        <div className="modal-header">
          <h2>좌석 배치도 생성</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {mode === 'quick' ? (
            // ⭐ 1단계: 빠른 생성 UI
            <div className="layout-creator__quick">
              <div className="form-group">
                <label>배치도 이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 1층 자습실"
                />
              </div>

              <div className="form-group">
                <label>그룹 이름</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="예: A구역"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>행(Rows) 개수</label>
                  <input
                    type="number"
                    value={rows}
                    onChange={(e) => setRows(parseInt(e.target.value))}
                    min={1}
                    max={50}
                  />
                </div>

                <div className="form-group">
                  <label>열(Cols) 개수</label>
                  <input
                    type="number"
                    value={cols}
                    onChange={(e) => setCols(parseInt(e.target.value))}
                    min={1}
                    max={50}
                  />
                </div>
              </div>

              <div className="form-summary">
                <p className="summary-highlight">
                  총 {rows} × {cols} = <strong>{rows * cols}��</strong> 좌석이 생성됩니다
                </p>
              </div>

              <div className="form-actions">
                <button
                  className="btn btn--secondary btn--block"
                  onClick={switchToAdvancedMode}
                >
                  🔧 상세 편집 모드로 전환 (복잡한 레이아웃용)
                </button>
              </div>
            </div>
          ) : (
            // ⭐ 2단계: 상세 편집 UI (기존 드래그 앤 드롭 코드)
            <div className="modal-body--split">
              {/* 왼쪽: 그룹 설정 */}
              <div className="layout-creator__settings">
                <div className="form-group">
                  <label>배치도 이름</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 1층 자습실"
                  />
                </div>

                {/* 그룹 목록 */}
                <div className="form-group">
                  <div className="form-group__header">
                    <label>좌석 그룹</label>
                    <button
                      className="btn btn--secondary btn--small"
                      onClick={handleAddGroup}
                    >
                      + 그룹 추가
                    </button>
                  </div>

                  {groups.map((group, index) => (
                    <GroupConfigCard
                      key={group.id}
                      group={group}
                      index={index}
                      onUpdate={(updatedGroup) => handleGroupUpdate(index, updatedGroup)}
                      onRemove={() => handleRemoveGroup(index)}
                      canRemove={groups.length > 1}
                    />
                  ))}
                </div>

                <div className="form-summary">
                  <p>총 그룹: {groups.length}개</p>
                  <p>총 좌석: {groups.reduce((sum, g) => sum + g.rows * g.cols, 0)}개</p>
                </div>

                <div className="form-actions">
                  <button
                    className="btn btn--secondary btn--small btn--block"
                    onClick={() => setMode('quick')}
                  >
                    ← 빠른 생성 모드로 돌아가기
                  </button>
                </div>
              </div>

              {/* 오른쪽: 드래그 앤 드롭 캔버스 */}
              <div className="layout-creator__canvas">
                <div className="canvas-header">
                  <h3>배치 미리보기</h3>
                  <p className="canvas-hint">
                    💡 그룹을 드래그하여 위치를 조정하세요
                  </p>
                </div>

                <DraggableCanvas
                  groups={groups}
                  onGroupMove={handleGroupDrag}
                />

                <div className="canvas-legend">
                  <div className="legend-item">
                    <div className="legend-color legend-color--group"></div>
                    <span>좌석 그룹</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-color legend-color--seat"></div>
                    <span>개별 좌석</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onClose}>
            취소
          </button>
          <button
            className="btn btn--primary"
            onClick={mode === 'quick' ? handleQuickSave : handleAdvancedSave}
            disabled={saving || !name.trim()}
          >
            {saving ? '생성 중...' : '생성'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ⭐ 드래그 가능한 캔버스 컴포넌트
const DraggableCanvas: React.FC<{
  groups: GroupConfig[];
  onGroupMove: (groupId: string, delta: { x: number; y: number }) => void;
}> = ({ groups, onGroupMove }) => {
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    onGroupMove(active.id as string, delta);
  };

  return (
    <div className="draggable-canvas">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {groups.map(group => (
          <DraggableGroupPreview key={group.id} group={group} />
        ))}
      </DndContext>
    </div>
  );
};

// 개별 그룹 프리뷰 (드래그 가능)
const DraggableGroupPreview: React.FC<{ group: GroupConfig }> = ({ group }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: group.id
  });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    left: group.position.x,
    top: group.position.y
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group-preview"
      {...listeners}
      {...attributes}
    >
      <div className="group-preview__header">
        <span className="group-preview__name">{group.name}</span>
        <span className="group-preview__size">
          {group.rows}×{group.cols}
        </span>
      </div>

      <div className="group-preview__grid">
        {Array.from({ length: group.rows }, (_, row) => (
          <div key={row} className="group-preview__row">
            {Array.from({ length: group.cols }, (_, col) => (
              <div key={col} className="group-preview__seat">
                {row * group.cols + col + 1}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="group-preview__footer">
        총 {group.rows * group.cols}석
      </div>
    </div>
  );
};
```

**CSS 예시**:

```css
/* 모달 크기 확장 */
.modal-content--xlarge {
  width: 90vw;
  max-width: 1400px;
  height: 90vh;
}

.modal-body--split {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 30px;
  height: 100%;
  overflow: hidden;
}

/* 캔버스 */
.draggable-canvas {
  position: relative;
  width: 100%;
  height: 600px;
  background: #f5f5f5;
  border: 2px dashed #ccc;
  border-radius: 8px;
  overflow: auto;
}

/* 그룹 프리뷰 */
.group-preview {
  position: absolute;
  background: white;
  border: 2px solid #2196F3;
  border-radius: 8px;
  padding: 10px;
  cursor: move;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: box-shadow 0.2s;
}

.group-preview:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
}

.group-preview__grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 10px 0;
}

.group-preview__row {
  display: flex;
  gap: 4px;
}

.group-preview__seat {
  width: 30px;
  height: 30px;
  background: #E3F2FD;
  border: 1px solid #2196F3;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #1976D2;
}
```

**구현 우선순위**: Phase 7 (UI 개선 단계)

**필요한 라이브러리**: `@dnd-kit/core` (10KB gzipped)

---

### A.2 학생 할당: 드래그 앤 드롭 할당

**현재 계획**: 좌석 클릭 → 패널 이동 → 학생 검색 → 할당 버튼 클릭

**문제점**:
- 사용자 시선이 여러 패널을 오가야 함
- 여러 학생을 연속으로 할당할 때 반복 작업이 번거로움

**개선 방안 A**: Context Menu (간단한 방법)

좌석 클릭 시 바로 옆에 작은 메뉴가 나타나게 하는 방식입니다.

```typescript
// Seat.tsx - Context Menu 추가

const Seat: React.FC<SeatProps> = ({ seat, isSelected, onClick }) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const handleClick = (e: React.MouseEvent) => {
    if (!seat?.assignment) {
      // 빈 좌석 클릭 시 Context Menu 표시
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuPosition({
        x: rect.right + 10,
        y: rect.top
      });
      setShowContextMenu(true);
    }
    onClick();
  };

  return (
    <>
      <div
        className={`seat ${isSelected ? 'seat--selected' : ''}`}
        onClick={handleClick}
        style={{ backgroundColor: getStatusColor() }}
      >
        {/* ... 기존 좌석 내용 ... */}
      </div>

      {/* ⭐ Context Menu */}
      {showContextMenu && (
        <SeatContextMenu
          position={menuPosition}
          seat={seat!}
          onClose={() => setShowContextMenu(false)}
          onAssign={(student) => {
            handleAssignStudent(seat!, student);
            setShowContextMenu(false);
          }}
        />
      )}
    </>
  );
};

const SeatContextMenu: React.FC<{
  position: { x: number; y: number };
  seat: SeatingChartSeat;
  onClose: () => void;
  onAssign: (student: StudentWithTimetable) => void;
}> = ({ position, seat, onClose, onAssign }) => {
  const { data: students = [] } = useStudentsWithTimetables();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStudents = students.filter(s =>
    s.name.includes(searchQuery) && s.activeTimetable
  );

  useEffect(() => {
    const handleClickOutside = () => onClose();
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div
      className="seat-context-menu"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="context-menu__header">
        <h4>{seat.seatLayoutSeat.label} 좌석</h4>
        <button onClick={onClose}>✕</button>
      </div>

      <input
        type="text"
        className="context-menu__search"
        placeholder="학생 검색..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        autoFocus
      />

      <div className="context-menu__students">
        {filteredStudents.map(student => (
          <div
            key={student.id}
            className="context-menu__student"
            onClick={() => onAssign(student)}
          >
            <div className="student-name">{student.name}</div>
            <div className="student-grade">{student.grade}</div>
          </div>
        ))}

        {filteredStudents.length === 0 && (
          <div className="context-menu__empty">
            활성 시간표가 있는 학생이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};
```

**개선 방안 B**: 드래그 앤 드롭 (직관적인 방법)

학생을 좌석으로 직접 드래그 앤 드롭하는 방식입니다.

```typescript
// StudentAssignmentPanel.tsx - 드래그 소스

const StudentAssignmentPanel: React.FC = () => {
  const { data: students = [] } = useStudentsWithTimetables();
  const { selectedLayoutId } = useAttendanceUIStore();
  const { data: assignments = [] } = useSeatAssignments(selectedLayoutId);

  // 미할당 학생만 필터링
  const unassignedStudents = students.filter(
    student => !assignments.some(a => a.studentId === student.id)
  );

  return (
    <div className="student-assignment-panel">
      <div className="panel-header">
        <h3>학생 목록</h3>
        <div className="panel-hint">
          💡 학생을 좌석으로 드래그하세요
        </div>
      </div>

      <div className="students-list">
        {unassignedStudents.map(student => (
          <DraggableStudentCard
            key={student.id}
            student={student}
          />
        ))}

        {unassignedStudents.length === 0 && (
          <div className="empty-state">
            모든 학생이 할당되었습니다.
          </div>
        )}
      </div>
    </div>
  );
};

// ⭐ 드래그 가능한 학생 카드
const DraggableStudentCard: React.FC<{ student: StudentWithTimetable }> = ({ student }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `student-${student.id}`,
    data: { student }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`student-card ${isDragging ? 'student-card--dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      <div className="student-card__avatar">
        {student.name.charAt(0)}
      </div>
      <div className="student-card__info">
        <div className="student-card__name">{student.name}</div>
        <div className="student-card__grade">{student.grade}</div>
      </div>
      {student.activeTimetable && (
        <div className="student-card__badge">
          📅 {student.activeTimetable.name}
        </div>
      )}
    </div>
  );
};

// SeatingChart.tsx - 드롭 타겟

const Seat: React.FC<SeatProps> = ({ seat, isSelected, onClick }) => {
  const { selectedLayoutId } = useAttendanceUIStore();
  const assignSeatMutation = useAssignSeat();

  // ⭐ 드롭 타겟 설정
  const { setNodeRef, isOver } = useDroppable({
    id: `seat-${seat?.seatLayoutSeat.id}`,
    data: { seat }
  });

  if (!seat) {
    return <div className="seat seat--empty" />;
  }

  // 이미 할당된 좌석은 드롭 불가
  const canDrop = !seat.assignment;

  return (
    <div
      ref={setNodeRef}
      className={`
        seat 
        ${isSelected ? 'seat--selected' : ''} 
        ${isOver && canDrop ? 'seat--drop-target' : ''}
        ${isOver && !canDrop ? 'seat--drop-invalid' : ''}
      `}
      onClick={onClick}
      style={{ backgroundColor: getStatusColor() }}
    >
      <div className="seat__label">{seat.seatLayoutSeat.label}</div>

      {seat.student && (
        <div className="seat__student-name">{seat.student.name}</div>
      )}

      {isOver && canDrop && (
        <div className="seat__drop-hint">여기에 놓기</div>
      )}

      {isOver && !canDrop && (
        <div className="seat__drop-invalid">이미 할당됨</div>
      )}
    </div>
  );
};

// Attendance.tsx - DndContext 설정

const Attendance: React.FC = () => {
  const { selectedLayoutId } = useAttendanceUIStore();
  const assignSeatMutation = useAssignSeat();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 이동 후 ���래그 시작
      },
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const student = active.data.current?.student as StudentWithTimetable;
    const targetSeat = over.data.current?.seat as SeatingChartSeat;

    if (!student || !targetSeat || targetSeat.assignment) {
      return;
    }

    // 시간표 확인
    if (!student.activeTimetable) {
      toast.error('활성 시간표가 없는 학생입니다.');
      return;
    }

    // 좌석 할당
    try {
      await assignSeatMutation.mutateAsync({
        seatId: targetSeat.seatLayoutSeat.id,
        studentId: student.id,
        timetableId: student.activeTimetable.id,
        seatLayoutId: selectedLayoutId!
      });

      toast.success(
        `${student.name} → ${targetSeat.seatLayoutSeat.label} 할당 완료`
      );
    } catch (error: any) {
      toast.error(error.message || '좌석 할당에 실패했습니다.');
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="attendance-main-page">
        {/* ... 기존 레이아웃 ... */}
      </div>
    </DndContext>
  );
};
```

**구현 우선순위**:
- Context Menu: Phase 6 (비교적 간단)
- 드래그 앤 드롭: Phase 7 (라이브러리 필요)

**필요한 라이브러리**: `@dnd-kit/core` (드래그 앤 드롭 방식)

---

### A.3 정보 시각화: 사용자 제어 가능한 뷰 옵션

**현재 계획**: 모든 정보가 항상 고정적으로 표시

**문제점**:
- 관리자가 특정 정보에 집중하고 싶을 때 시각적 노이즈
- 많은 좌석이 있을 때 정보 과부하

**개선 방안**: 뷰 옵션 및 필터 추가

```typescript
// stores/useAttendanceUIStore.ts - 뷰 옵션 상태 추가

interface ViewOptions {
  colorMode: 'attendance' | 'assignment' | 'timetable';
  showStudentName: boolean;
  showScheduleTime: boolean;
  showBadges: boolean;
  highlightLate: boolean;
  highlightEarlyLeave: boolean;
}

interface AttendanceUIState {
  // ... 기존 상태 ...

  // 뷰 옵션
  viewOptions: ViewOptions;
  setViewOption: <K extends keyof ViewOptions>(key: K, value: ViewOptions[K]) => void;
}

export const useAttendanceUIStore = create<AttendanceUIState>((set) => ({
  // ... 기존 상태 ...

  viewOptions: {
    colorMode: 'attendance',
    showStudentName: true,
    showScheduleTime: false,
    showBadges: true,
    highlightLate: true,
    highlightEarlyLeave: true
  },

  setViewOption: (key, value) =>
    set((state) => ({
      viewOptions: { ...state.viewOptions, [key]: value }
    }))
}));

// SeatingChart.tsx - 뷰 옵션 컨트롤 추가

const SeatingChart: React.FC<SeatingChartProps> = ({ ... }) => {
  const { viewOptions, setViewOption } = useAttendanceUIStore();

  return (
    <div className="seating-chart">
      {/* ⭐ 뷰 옵션 툴바 */}
      <div className="seating-chart__toolbar">
        <div className="toolbar-section">
          <label className="toolbar-label">색상 모드:</label>
          <select
            className="toolbar-select"
            value={viewOptions.colorMode}
            onChange={(e) => setViewOption('colorMode', e.target.value as any)}
          >
            <option value="attendance">출석 상태별</option>
            <option value="assignment">할당 상태별</option>
            <option value="timetable">시간표별</option>
          </select>
        </div>

        <div className="toolbar-section">
          <label className="toolbar-checkbox">
            <input
              type="checkbox"
              checked={viewOptions.showStudentName}
              onChange={(e) => setViewOption('showStudentName', e.target.checked)}
            />
            <span>학생 이름</span>
          </label>

          <label className="toolbar-checkbox">
            <input
              type="checkbox"
              checked={viewOptions.showScheduleTime}
              onChange={(e) => setViewOption('showScheduleTime', e.target.checked)}
            />
            <span>예정 시간</span>
          </label>

          <label className="toolbar-checkbox">
            <input
              type="checkbox"
              checked={viewOptions.highlightLate}
              onChange={(e) => setViewOption('highlightLate', e.target.checked)}
            />
            <span>지각 강조</span>
          </label>
        </div>

        <div className="toolbar-section">
          <button
            className="btn btn--secondary btn--small"
            onClick={() => {
              // 기본값으로 리셋
              set({ viewOptions: { /* 기본값 */ } });
            }}
          >
            기본 보기로 리셋
          </button>
        </div>
      </div>

      {/* 좌석 그리드 */}
      <div className="seating-chart__groups">
        {groupedSeats.map(({ group, seats }) => (
          <SeatGroup
            key={group.id}
            group={group}
            seats={seats}
            viewOptions={viewOptions} // ⭐ 뷰 옵션 전달
            selectedSeatId={selectedSeatId}
            onSeatClick={onSeatClick}
          />
        ))}
      </div>
    </div>
  );
};

// Seat.tsx - 뷰 옵션 반영

const Seat: React.FC<SeatProps & { viewOptions: ViewOptions }> = ({
  seat,
  viewOptions,
  isSelected,
  onClick
}) => {
  // 색상 모드에 따라 색상 결정
  const getColor = (): string => {
    if (!seat) return '#FFFFFF';

    switch (viewOptions.colorMode) {
      case 'attendance':
        // 출석 상태별 색상
        if (!seat.attendanceRecord) return '#FFFFFF';
        switch (seat.attendanceRecord.status) {
          case 'checked_in': return '#4CAF50';
          case 'checked_out': return '#9E9E9E';
          case 'absent_excused': return '#FFC107';
          case 'absent_unexcused': return '#F44336';
          default: return '#FFFFFF';
        }

      case 'assignment':
        // 할당 상태별 색상
        return seat.assignment ? '#E3F2FD' : '#FFFFFF';

      case 'timetable':
        // 시간표의 시간대별 색상 (오전반 vs 오후반)
        const arrivalTime = seat.assignment?.expectedSchedule?.[getTodayDayOfWeek()]?.arrivalTime;
        if (!arrivalTime) return '#FFFFFF';
        const hour = parseInt(arrivalTime.split(':')[0]);
        return hour < 12 ? '#FFF9C4' : '#F3E5F5';

      default:
        return '#FFFFFF';
    }
  };

  return (
    <div
      className={`seat ${isSelected ? 'seat--selected' : ''}`}
      style={{ backgroundColor: getColor() }}
      onClick={onClick}
    >
      <div className="seat__label">{seat?.seatLayoutSeat.label}</div>

      {/* ⭐ 조건부 렌더링 */}
      {viewOptions.showStudentName && seat?.student && (
        <div className="seat__student-name">{seat.student.name}</div>
      )}

      {viewOptions.showScheduleTime && seat?.attendanceRecord && (
        <div className="seat__schedule">
          {seat.attendanceRecord.expectedArrivalTime} - {seat.attendanceRecord.expectedDepartureTime}
        </div>
      )}

      {viewOptions.showBadges && (
        <>
          {viewOptions.highlightLate && seat?.attendanceRecord?.isLate && (
            <div className="seat__badge seat__badge--late">
              지각 {seat.attendanceRecord.lateMinutes}분
            </div>
          )}
          {viewOptions.highlightEarlyLeave && seat?.attendanceRecord?.isEarlyLeave && (
            <div className="seat__badge seat__badge--early">
              조퇴 {seat.attendanceRecord.earlyLeaveMinutes}분
            </div>
          )}
        </>
      )}
    </div>
  );
};
```

**추가 필터 기능** (StudentAssignmentPanel.tsx):

```typescript
const StudentAssignmentPanel: React.FC = () => {
  const { data: students = [] } = useStudentsWithTimetables();
  const { selectedLayoutId } = useAttendanceUIStore();
  const { data: assignments = [] } = useSeatAssignments(selectedLayoutId);

  const [filter, setFilter] = useState({
    showUnassignedOnly: true,
    gradeFilter: 'all',
    searchQuery: ''
  });

  // 필터링 로직
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // 미할당 필터
      if (filter.showUnassignedOnly && assignments.some(a => a.studentId === student.id)) {
        return false;
      }

      // 학년 필터
      if (filter.gradeFilter !== 'all' && student.grade !== filter.gradeFilter) {
        return false;
      }

      // 검색어 필터
      if (filter.searchQuery && !student.name.includes(filter.searchQuery)) {
        return false;
      }

      return true;
    });
  }, [students, assignments, filter]);

  return (
    <div className="student-assignment-panel">
      <div className="panel-header">
        <h3>학생 목록</h3>
        <span className="panel-count">
          {filteredStudents.length} / {students.length}명
        </span>
      </div>

      {/* ⭐ 필터 컨트롤 */}
      <div className="panel-filters">
        <input
          type="text"
          className="filter-search"
          placeholder="🔍 학생 이름 검색..."
          value={filter.searchQuery}
          onChange={(e) => setFilter({ ...filter, searchQuery: e.target.value })}
        />

        <div className="filter-row">
          <select
            className="filter-select"
            value={filter.gradeFilter}
            onChange={(e) => setFilter({ ...filter, gradeFilter: e.target.value })}
          >
            <option value="all">전체 학년</option>
            <option value="1학년">1학년</option>
            <option value="2학년">2학년</option>
            <option value="3학년">3학년</option>
          </select>

          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={filter.showUnassignedOnly}
              onChange={(e) => setFilter({ ...filter, showUnassignedOnly: e.target.checked })}
            />
            <span>미배정만 보기</span>
          </label>
        </div>
      </div>

      <div className="students-list">
        {filteredStudents.map(student => (
          <StudentCard key={student.id} student={student} />
        ))}

        {filteredStudents.length === 0 && (
          <div className="empty-state">
            {filter.searchQuery
              ? `"${filter.searchQuery}"에 해당하는 학생이 없습니다.`
              : '조건에 맞는 학생이 없습니다.'}
          </div>
        )}
      </div>
    </div>
  );
};
```

**구현 우선순위**: Phase 7 (UI 개선 단계)

**필요한 라이브러리**: 없음 (순수 React 상태 관리)

---

## 부록 요약

| 기능 | 현재 계획 (Good) | 고급 개선 (Exceptional) | 우선순위 | 필요 라이브러리 |
|------|------------------|------------------------|----------|----------------|
| **배치도 생성** | 좌표 숫자 입력 | **하이브리드**: 빠른 생성(행/열 입력) + 상세 편집(드래그 앤 드롭) | Phase 6-7 | `@dnd-kit/core` (상세 편집만) |
| **학생 할당** | 클릭 → 패널 → 할당 | Context Menu 또는 드래그 앤 드롭 | Phase 6-7 | `@dnd-kit/core` (드래그 시) |
| **정보 표시** | 고정 표시 | 뷰 옵션 + 필터 | Phase 7 | - |

### 권장 라이브러리: @dnd-kit

드래그 앤 드롭 기능 구현 시 `@dnd-kit/core` 사용을 권장합니다.

**장점**:
- ✅ 경량 (10KB gzipped)
- ✅ TypeScript 완벽 지원
- ✅ 접근성 내장 (키보드 네비게이션)
- ✅ React 19 호환
- ✅ 모바일 터치 지원

**설치**:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**대안**: `react-draggable` (더 간단하지만 기능 제한적)

### 구현 권장사항

#### 권장 순서 (점진적 개선)

1. **Phase 6 (기본)**:
   - ✅ **빠른 생성 모드**(행/열 입력) - 라이브러리 불필요, 즉시 구현 가능
   - ✅ Context Menu 방식 학생 할당

2. **Phase 7 (선택)**:
   - 🔧 **상세 편집 모드**(드래그 앤 드롭) - `@dnd-kit/core` 필요
   - 🎨 뷰 옵션 + 필터 (라이브러리 불필요)

3. **Phase 8 (피드백 기반)**:
   - 📊 사용자 피드백 수집 후 추가 개선
   - 📱 모바일 반응형 최적화

#### 핵심 원칙

- **90/10 규칙**: 90% 사용자를 위한 간단한 기본 기능 우선
- **점진적 복잡도**: 필요한 사용자만 고급 기능 사용
- **사용자 검증**: 실제 테스트 후 고급 기능 구현 여부 결정

이러한 고급 기능들은 **핵심 기능 구현 완료 후** 시간 여유가 있을 때 단계적으로 추가하는 것을 권장합니다. 특히 **하이브리드 접근법**은 개발 부담을 최소화하면서도 모든 사용 사례를 커버할 수 있습니다.
