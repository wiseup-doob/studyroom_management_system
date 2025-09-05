# 백엔드-프론트엔드 통합 계획서

## 📋 개요

현재 구현된 출석 관리 프론트엔드와 Firebase Firestore 백엔드 데이터베이스를 연결하기 위한 통합 계획서입니다. 프론트엔드의 UI 중심 데이터 구조와 백엔드의 정규화된 관계형 구조 간의 차이를 해결하기 위해 **어댑터(Adapter) 패턴**을 적용합니다.

## 🎯 통합 목표

### 주요 목표
- **데이터 일관성**: 백엔드 DB 구조를 유지하면서 프론트엔드 UI에 최적화된 데이터 제공
- **성능 최적화**: 효율적인 쿼리와 캐싱을 통한 빠른 응답 속도
- **유지보수성**: 각 계층의 책임 분리로 코드 관리 용이성 향상
- **확장성**: 향후 기능 추가에 유연하게 대응

### 기술적 목표
- **타입 안정성**: TypeScript를 활용한 컴파일 타임 에러 방지
- **에러 처리**: 네트워크 오류, 데이터 불일치 등 예외 상황 처리
- **로딩 상태**: 사용자 경험을 위한 적절한 로딩 및 에러 상태 관리

## 🏗️ 아키텍처 설계

### 전체 구조
```
Frontend (UI Layer)
    ↓
API Layer (Adapter Layer)
    ↓
Firebase Firestore (Backend)
```

### 데이터 흐름
```
Firestore Collections
├── seat_layouts (좌석 배치도)
├── seats (좌석 정보)
├── seat_assignments (좌석 배정)
├── attendance_records (출석 기록)
└── students (학생 정보)
    ↓ (Adapter Layer)
Frontend Data Structures
├── Classroom (강의실)
├── AttendanceSeat (출석 좌석)
└── AttendanceStudent (출석 학생)
```

## 📊 데이터 매핑 전략

### 1. 핵심 데이터 변환

#### 백엔드 → 프론트엔드 변환
| 백엔드 구조 | 프론트엔드 구조 | 변환 로직 |
|-------------|-----------------|-----------|
| `seat_layouts` | `Classroom` | 배치도 정보를 강의실 객체로 변환 |
| `seats` + `seat_assignments` + `attendance_records` | `AttendanceSeat` | 3개 컬렉션 데이터를 조합하여 좌석 객체 생성 |
| `students` | `AttendanceStudent` | 학생 정보를 출석 관리용 형태로 변환 |

#### 좌석 상태 매핑
| 백엔드 상태 | 프론트엔드 상태 | 조건 |
|-------------|-----------------|------|
| `vacant` + 학생 없음 | `empty` | 좌석이 비어있고 학생이 배정되지 않음 |
| `occupied` + 학생 있음 + 출석 기록 없음 | `not-enrolled` | 학생이 배정되었지만 출석하지 않음 |
| `occupied` + `present` | `present` | 학생이 등원함 |
| `occupied` + `dismissed` | `dismissed` | 학생이 사유결석함 |
| `occupied` + `unauthorized_absent` | `unauthorized` | 학생이 무단결석함 |
| `occupied` + `authorized_absent` | `authorized` | 학생이 하원함 |

## 🛠️ 구현 계획

### Phase 1: API 계층 구축 (1-2주)

#### 1.1 타입 정의 확장
**파일**: `src/types/backend.ts`

```typescript
// 백엔드 데이터 타입 정의
export interface BackendSeatLayout {
  id: string;
  name: string;
  gridSize: { rows: number; cols: number };
  elements: {
    x: number;
    y: number;
    seatId?: string;
    seatNumber?: string;
  }[];
  updatedAt: FirestoreTimestamp;
}

export interface BackendSeat {
  id: string;
  seatNumber: string;
  status: 'vacant' | 'occupied' | 'unavailable';
  isActive: boolean;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export interface BackendSeatAssignment {
  id: string;
  seatId: string;
  studentId: string;
  status: 'active' | 'released';
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export interface BackendAttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  status: 'present' | 'dismissed' | 'unauthorized_absent' | 'authorized_absent' | 'not_enrolled';
  checkInTime?: FirestoreTimestamp;
  checkOutTime?: FirestoreTimestamp;
  notes?: string;
  isLate?: boolean;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
```

#### 1.2 어댑터 함수 구현
**파일**: `src/api/adapters/classroomAdapter.ts`

```typescript
import { BackendSeatLayout, BackendSeat, BackendSeatAssignment, BackendAttendanceRecord } from '../../types/backend';
import { Classroom, AttendanceSeat, SeatStatus } from '../../types/attendance';

export class ClassroomAdapter {
  static async adaptSeatLayoutToClassroom(
    layout: BackendSeatLayout,
    seats: BackendSeat[],
    assignments: BackendSeatAssignment[],
    attendanceRecords: BackendAttendanceRecord[],
    students: BackendStudent[]
  ): Promise<Classroom> {
    // 1. 좌석 데이터 조합
    const attendanceSeats = this.combineSeatData(layout, seats, assignments, attendanceRecords, students);
    
    // 2. Classroom 객체 생성
    return {
      id: layout.id,
      name: layout.name,
      rows: layout.gridSize.rows,
      cols: layout.gridSize.cols,
      seats: attendanceSeats,
      createdAt: layout.updatedAt,
      updatedAt: layout.updatedAt
    };
  }

  private static combineSeatData(
    layout: BackendSeatLayout,
    seats: BackendSeat[],
    assignments: BackendSeatAssignment[],
    attendanceRecords: BackendAttendanceRecord[],
    students: BackendStudent[]
  ): AttendanceSeat[] {
    return layout.elements
      .filter(element => element.seatId) // 좌석이 있는 요소만 필터링
      .map(element => {
        const seat = seats.find(s => s.id === element.seatId);
        const assignment = assignments.find(a => a.seatId === element.seatId && a.status === 'active');
        const student = assignment ? students.find(s => s.id === assignment.studentId) : null;
        const attendanceRecord = student ? attendanceRecords.find(ar => ar.studentId === student.id) : null;
        
        return {
          id: element.seatId!,
          number: parseInt(seat?.seatNumber || '0'),
          row: element.y + 1,
          col: element.x + 1,
          studentId: student?.id,
          status: this.mapSeatStatus(seat, assignment, attendanceRecord)
        };
      });
  }

  private static mapSeatStatus(
    seat: BackendSeat | undefined,
    assignment: BackendSeatAssignment | undefined,
    attendanceRecord: BackendAttendanceRecord | undefined
  ): SeatStatus {
    if (!seat || seat.status === 'unavailable') return 'empty';
    if (!assignment || !assignment.studentId) return 'empty';
    
    if (!attendanceRecord) return 'not-enrolled';
    
    switch (attendanceRecord.status) {
      case 'present': return 'present';
      case 'dismissed': return 'dismissed';
      case 'unauthorized_absent': return 'unauthorized';
      case 'authorized_absent': return 'authorized';
      case 'not_enrolled': return 'not-enrolled';
      default: return 'not-enrolled';
    }
  }
}
```

#### 1.3 API 서비스 구현
**파일**: `src/api/attendanceAPI.ts`

```typescript
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ClassroomAdapter } from './adapters/classroomAdapter';
import { Classroom } from '../types/attendance';

export class AttendanceAPI {
  private static academyId = 'default-academy'; // 실제로는 인증된 사용자의 academyId 사용

  static async getClassrooms(): Promise<Classroom[]> {
    try {
      // 1. 공통 데이터를 단 한 번만 병렬로 조회 (N+1 쿼리 문제 해결)
      const [layoutsSnapshot, seats, assignments, attendanceRecords, students] = await Promise.all([
        getDocs(collection(db, 'academies', this.academyId, 'seat_layouts')),
        this.getSeats(),
        this.getSeatAssignments(),
        this.getTodayAttendanceRecords(),
        this.getStudents()
      ]);
      
      // 2. 조회된 데이터를 사용하여 각 강의실 객체를 메모리에서 조립
      const classrooms = layoutsSnapshot.docs.map(layoutDoc => {
        const layout = { id: layoutDoc.id, ...layoutDoc.data() } as BackendSeatLayout;
        
        // 3. 어댑터를 통한 데이터 변환 (이제 DB 조회가 아닌 메모리 필터링)
        return ClassroomAdapter.adaptSeatLayoutToClassroom(
          layout, seats, assignments, attendanceRecords, students
        );
      });
      
      // 4. 모든 변환이 완료될 때까지 기다림
      return Promise.all(classrooms);
    } catch (error) {
      console.error('Error fetching classrooms:', error);
      throw new Error('강의실 정보를 불러오는데 실패했습니다.');
    }
  }

  private static async getSeats(): Promise<BackendSeat[]> {
    const snapshot = await getDocs(collection(db, 'academies', this.academyId, 'seats'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BackendSeat));
  }

  private static async getSeatAssignments(): Promise<BackendSeatAssignment[]> {
    const q = query(
      collection(db, 'academies', this.academyId, 'seat_assignments'),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BackendSeatAssignment));
  }

  private static async getTodayAttendanceRecords(): Promise<BackendAttendanceRecord[]> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
    const q = query(
      collection(db, 'academies', this.academyId, 'attendance_records'),
      where('date', '==', today)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BackendAttendanceRecord));
  }

  private static async getStudents(): Promise<BackendStudent[]> {
    const q = query(
      collection(db, 'academies', this.academyId, 'students'),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BackendStudent));
  }

  static async updateSeatStatus(seatId: string, status: SeatStatus): Promise<void> {
    // 좌석 상태 업데이트 로직 구현
    // 실제로는 attendance_records 컬렉션에 새 레코드 생성
  }
}
```

### Phase 2: React Query 도입 및 커스텀 훅 구현 (1주)

#### 2.1 React Query 설치 및 설정
**패키지 설치**:
```bash
npm install @tanstack/react-query
```

**파일**: `src/main.tsx`
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분 캐싱
      cacheTime: 10 * 60 * 1000, // 10분 캐시 유지
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});

// App 컴포넌트를 QueryClientProvider로 감싸기
```

#### 2.2 React Query 기반 데이터 페칭 훅
**파일**: `src/hooks/useAttendanceQueries.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AttendanceAPI } from '../api/attendanceAPI';
import { Classroom, AttendanceStudent, SeatStatus } from '../types/attendance';

// 강의실 목록 조회
export const useClassroomsQuery = () => {
  return useQuery({
    queryKey: ['classrooms', 'default-academy'],
    queryFn: () => AttendanceAPI.getClassrooms(),
    staleTime: 5 * 60 * 1000, // 5분 캐싱
  });
};

// 학생 목록 조회
export const useStudentsQuery = () => {
  return useQuery({
    queryKey: ['students', 'default-academy'],
    queryFn: () => AttendanceAPI.getStudents(),
    staleTime: 10 * 60 * 1000, // 10분 캐싱 (학생 정보는 자주 변경되지 않음)
  });
};

// 좌석 상태 업데이트 뮤테이션
export const useUpdateSeatStatusMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ seatId, status }: { seatId: string; status: SeatStatus }) =>
      AttendanceAPI.updateSeatStatus(seatId, status),
    onSuccess: () => {
      // 관련 쿼리 무효화하여 자동 새로고침
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
  });
};
```

#### 2.3 실시간 업데이트 훅
**파일**: `src/hooks/useRealtimeAttendance.ts`

```typescript
import { useEffect, useState } from 'react';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

export const useRealtimeAttendance = (academyId: string) => {
  const [attendanceUpdates, setAttendanceUpdates] = useState<any[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'academies', academyId, 'attendance_records'),
      where('date', '==', today)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updates = snapshot.docChanges().map(change => ({
        type: change.type,
        doc: change.doc.data(),
        docId: change.doc.id
      }));
      setAttendanceUpdates(updates);
    });

    return () => unsubscribe();
  }, [academyId]);

  return attendanceUpdates;
};
```

### Phase 3: Context 통합 (1주)

#### 3.1 AttendanceContext 업데이트 (React Query 통합)
**파일**: `src/components/domain/Attendance/AttendanceContext.tsx`

```typescript
import { useClassroomsQuery, useStudentsQuery, useUpdateSeatStatusMutation } from '../../hooks/useAttendanceQueries';
import { useRealtimeAttendance } from '../../hooks/useRealtimeAttendance';

// 기존 Context에 React Query 연동 추가
export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(attendanceReducer, initialState);
  
  // React Query를 통한 데이터 페칭
  const { data: classrooms, isLoading: classroomsLoading, error: classroomsError } = useClassroomsQuery();
  const { data: students, isLoading: studentsLoading, error: studentsError } = useStudentsQuery();
  const updateSeatStatusMutation = useUpdateSeatStatusMutation();

  // 실시간 업데이트 처리
  const attendanceUpdates = useRealtimeAttendance('default-academy');

  // 데이터가 로드되면 Context 상태에 반영
  useEffect(() => {
    if (classrooms) {
      dispatch(attendanceActions.setClassrooms(classrooms));
    }
  }, [classrooms]);

  useEffect(() => {
    if (students) {
      dispatch(attendanceActions.setStudents(students));
    }
  }, [students]);

  useEffect(() => {
    const isLoading = classroomsLoading || studentsLoading;
    dispatch(attendanceActions.setLoading(isLoading));
  }, [classroomsLoading, studentsLoading]);

  useEffect(() => {
    const error = classroomsError || studentsError;
    if (error) {
      dispatch(attendanceActions.setError(error.message));
    }
  }, [classroomsError, studentsError]);

  // 실시간 업데이트를 상태에 반영 (구체적인 로직)
  useEffect(() => {
    attendanceUpdates.forEach(update => {
      if (update.type === 'added' || update.type === 'modified') {
        const { studentId, status } = update.doc;
        dispatch(attendanceActions.applyRealtimeUpdate({ studentId, newStatus: status }));
      }
    });
  }, [attendanceUpdates]);

  // 좌석 상태 업데이트 함수
  const updateSeatStatus = (seatId: string, status: SeatStatus) => {
    updateSeatStatusMutation.mutate({ seatId, status });
  };

  return (
    <AttendanceContext.Provider value={{ state, dispatch, updateSeatStatus }}>
      {children}
    </AttendanceContext.Provider>
  );
};
```

#### 3.2 실시간 업데이트 액션 추가
**파일**: `src/components/domain/Attendance/AttendanceContext.tsx`

```typescript
// AttendanceAction 타입에 실시간 업데이트 액션 추가
export type AttendanceAction = 
  | { type: 'SELECT_CLASSROOM'; payload: Classroom }
  | { type: 'SELECT_SEAT'; payload: string }
  | { type: 'UPDATE_SEAT_STATUS'; payload: { seatId: string; status: SeatStatus } }
  | { type: 'APPLY_REALTIME_UPDATE'; payload: { studentId: string; newStatus: SeatStatus } } // 추가
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_SELECTION' };

// reducer에 실시간 업데이트 케이스 추가
const attendanceReducer = (state: AttendanceState, action: AttendanceAction): AttendanceState => {
  switch (action.type) {
    case 'APPLY_REALTIME_UPDATE':
      return {
        ...state,
        // 전체 classrooms 배열을 순회하며 해당 studentId를 가진 seat의 status만 변경
        classrooms: state.classrooms.map(classroom => ({
          ...classroom,
          seats: classroom.seats.map(seat => 
            seat.studentId === action.payload.studentId 
              ? { ...seat, status: action.payload.newStatus } 
              : seat
          )
        }))
      };
    // ... 기존 케이스들
  }
};
```

### Phase 4: 에러 처리 및 최적화 (1주)

#### 4.1 에러 처리 개선
**파일**: `src/api/errorHandler.ts`

```typescript
export class APIErrorHandler {
  static handleFirestoreError(error: any): string {
    switch (error.code) {
      case 'permission-denied':
        return '접근 권한이 없습니다.';
      case 'not-found':
        return '요청한 데이터를 찾을 수 없습니다.';
      case 'unavailable':
        return '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
      default:
        return '알 수 없는 오류가 발생했습니다.';
    }
  }
}
```

#### 4.2 React Query 캐싱 전략 (CacheManager 대체)
**React Query가 제공하는 고급 캐싱 기능 활용**:

```typescript
// src/hooks/useAttendanceQueries.ts - 캐싱 설정 예시
export const useClassroomsQuery = () => {
  return useQuery({
    queryKey: ['classrooms', 'default-academy'],
    queryFn: () => AttendanceAPI.getClassrooms(),
    staleTime: 5 * 60 * 1000, // 5분간 fresh 상태 유지
    cacheTime: 10 * 60 * 1000, // 10분간 캐시 유지
    refetchOnWindowFocus: false, // 윈도우 포커스 시 자동 새로고침 비활성화
    refetchOnMount: false, // 컴포넌트 마운트 시 자동 새로고침 비활성화
    retry: 3, // 실패 시 3번 재시도
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // 지수 백오프
  });
};

// 수동 캐시 무효화
export const useInvalidateQueries = () => {
  const queryClient = useQueryClient();
  
  return {
    invalidateClassrooms: () => queryClient.invalidateQueries({ queryKey: ['classrooms'] }),
    invalidateStudents: () => queryClient.invalidateQueries({ queryKey: ['students'] }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
};
```

**기존 CacheManager는 React Query로 완전 대체되므로 제거합니다.**

## 🧪 테스트 계획

### 1. 단위 테스트
- **어댑터 함수 테스트**: 데이터 변환 로직 검증
- **API 서비스 테스트**: Firestore 쿼리 및 에러 처리 검증
- **커스텀 훅 테스트**: 상태 관리 및 사이드 이펙트 검증

### 2. 통합 테스트
- **전체 데이터 흐름 테스트**: 백엔드 → 어댑터 → 프론트엔드
- **실시간 업데이트 테스트**: Firestore 리스너 동작 검증
- **에러 시나리오 테스트**: 네트워크 오류, 권한 오류 등

### 3. 성능 테스트
- **로딩 시간 측정**: 대용량 데이터 처리 성능
- **메모리 사용량 측정**: 캐싱 및 상태 관리 최적화
- **네트워크 요청 최적화**: 불필요한 쿼리 방지

## 📈 성능 최적화 전략

### 1. 쿼리 최적화
- **인덱스 활용**: Firestore 복합 인덱스 생성
- **필드 선택**: 필요한 필드만 조회
- **페이지네이션**: 대용량 데이터 처리

### 2. React Query 캐싱 전략
- **자동 캐싱**: React Query의 내장 캐싱 시스템 활용
- **Stale-While-Revalidate**: 백그라운드에서 데이터 갱신
- **지능적 무효화**: 관련 데이터만 선택적 갱신
- **오프라인 지원**: 캐시된 데이터로 오프라인 동작

### 3. 렌더링 최적화
- **React.memo**: 불필요한 리렌더링 방지
- **useCallback/useMemo**: 함수 및 값 메모이제이션
- **가상화**: 대량의 좌석 데이터 처리
- **React Query 최적화**: 자동 리렌더링 최적화

## 🔒 보안 고려사항

### 1. 데이터 접근 제어
- **Firestore Rules**: 학원별 데이터 격리
- **인증 확인**: 사용자 권한 검증
- **입력 검증**: 클라이언트 사이드 데이터 검증

### 2. 민감 정보 보호
- **학생 정보 암호화**: 개인정보 보호
- **API 키 관리**: 환경 변수 활용
- **HTTPS 통신**: 모든 데이터 전송 암호화

## 📅 개발 일정

| Phase | 기간 | 주요 작업 | 완료 기준 |
|-------|------|-----------|-----------|
| **Phase 1** | 1-2주 | API 계층 구축 | 어댑터 함수 및 API 서비스 구현 완료 (N+1 쿼리 해결) |
| **Phase 2** | 1주 | React Query 도입 | React Query 설정 및 커스텀 훅 구현 완료 |
| **Phase 3** | 1주 | Context 통합 | 기존 Context에 React Query 연동 및 실시간 업데이트 완료 |
| **Phase 4** | 1주 | 에러 처리 및 최적화 | 에러 처리, React Query 캐싱, 성능 최적화 완료 |
| **테스트** | 1주 | 통합 테스트 | 모든 기능 동작 검증 완료 |

**총 개발 기간**: 5-6주

## 🎯 성공 지표

### 기능적 지표
- ✅ **데이터 정확성**: 백엔드 데이터와 프론트엔드 표시 일치
- ✅ **실시간 동기화**: 출석 상태 변경 시 즉시 반영
- ✅ **에러 처리**: 모든 예외 상황에 대한 적절한 처리

### 성능 지표
- ✅ **로딩 시간**: 초기 데이터 로딩 2초 이내 (N+1 쿼리 해결로 개선)
- ✅ **응답 시간**: 사용자 액션에 대한 응답 1초 이내
- ✅ **메모리 사용량**: 100MB 이내 유지
- ✅ **Firestore 읽기 횟수**: 강의실당 5회 → 전체 5회로 최적화
- ✅ **캐시 히트율**: React Query 캐싱으로 80% 이상

### 사용자 경험 지표
- ✅ **직관적 UI**: 기존 Mock 데이터와 동일한 사용자 경험
- ✅ **안정성**: 크래시 없는 안정적인 동작
- ✅ **접근성**: 키보드 네비게이션 및 스크린 리더 지원

---

## 🔄 피드백 반영 사항

### 주요 개선사항 (2024.12.19 업데이트)

#### 1. **N+1 쿼리 문제 해결** ⚡
- **문제**: 강의실마다 4번씩 중복 쿼리 발생
- **해결**: 공통 데이터를 루프 밖에서 한 번만 조회
- **효과**: Firestore 읽기 횟수를 `(강의실 수 × 4) + 1`에서 `5`회로 최적화

#### 2. **React Query 도입** 🚀
- **기존**: 커스텀 `useAttendanceData` 훅과 `CacheManager`
- **개선**: React Query로 서버 상태 관리 표준화
- **장점**: 자동 캐싱, 에러 처리, 재시도, 백그라운드 갱신 등

#### 3. **실시간 업데이트 로직 구체화** 🔄
- **기존**: 주석으로만 표시된 "좌석 상태 업데이트 로직"
- **개선**: `APPLY_REALTIME_UPDATE` 액션과 구체적인 reducer 로직 구현
- **효과**: 변경된 데이터만 선택적으로 상태 업데이트

#### 4. **성능 지표 개선** 📈
- **로딩 시간**: 3초 → 2초 이내
- **Firestore 비용**: 대폭 절감 (N+1 쿼리 해결)
- **캐시 효율성**: React Query로 80% 이상 히트율 달성

---

**문서 작성일**: 2024년 12월 19일  
**최종 업데이트**: 2024년 12월 19일 (피드백 반영)  
**프로젝트 버전**: Phase 3 완료 → Phase 4 (백엔드 연동)  
**다음 단계**: Phase 1 (API 계층 구축) 시작
