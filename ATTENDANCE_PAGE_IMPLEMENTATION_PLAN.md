# 출결 관리 페이지 구현 계획

## 📋 개요
현재 단순한 텍스트만 표시하는 AttendancePage를 실제 출결 관리 기능이 있는 완전한 페이지로 구현합니다.

## 🎯 목표
- 강의실 선택 및 관리 기능
- 학생 검색 기능
- 7x7 좌석 배치도 구현
- 실시간 출결 상태 관리
- 색상 코딩을 통한 상태 표시

## 🏗️ 컴포넌트 구조

### 1. 메인 컴포넌트
```
AttendancePage/
├── AttendancePage.tsx          # 메인 컨테이너
└── AttendancePage.css          # 메인 스타일

# 도메인별 컴포넌트 (재사용성 고려)
components/domain/Attendance/
├── ClassroomSelector.tsx       # 강의실 선택
├── StudentSearch.tsx           # 학생 검색
├── SeatingChart.tsx            # 좌석 배치도
├── Seat.tsx                    # 개별 좌석
├── AttendanceControls.tsx      # 출결 관리 컨트롤
└── AttendanceContext.tsx       # 출결 상태 관리

# UI 컴포넌트 (재사용 가능)
components/ui/
├── Button.tsx                  # 공통 버튼
├── Input.tsx                   # 공통 입력
└── Dropdown.tsx                # 공통 드롭다운

# 타입 정의 (프로젝트 구조에 맞게)
types/
└── attendance.ts               # 출결 관련 타입 (기존 types/ 폴더에 추가)
```

## 📊 데이터 구조

### 1. 타입 정의
```typescript
// types/attendance.ts (기존 types/ 폴더에 추가)
export interface Classroom {
  id: string;
  name: string;
  rows: number;
  cols: number;
  seats: AttendanceSeat[];
}

export interface AttendanceSeat {
  id: string;
  number: number;
  row: number;
  col: number;
  studentId?: string;  // 기존 Student.id와 연결
  status: SeatStatus;
  // isSelected는 UI 상태이므로 데이터 구조에서 분리
}

// 기존 Student 타입 활용 (types/student.ts)
// export interface Student { ... } // 이미 정의됨

export type SeatStatus = 
  | 'empty'      // 빈 좌석 (회색)
  | 'assigned'   // 배정됨 (연한 회색)
  | 'present'    // 출석 (연한 녹색)
  | 'late'       // 지각 (노란색)
  | 'absent'     // 결석 (연한 빨간색)
  | 'selected'   // 선택됨 (검은 테두리)

// 출결 관리용 학생 타입 (기존 Student 타입 확장)
export interface AttendanceStudent {
  id: string;
  name: string;
  studentId: string;
  grade: string;
  // 기존 Student 타입의 다른 필드들도 필요시 추가
}
```

## 🎨 UI/UX 설계

### 1. 레이아웃 구조
```
┌─────────────────────────────────────────────────────────┐
│                    출결 관리                            │
├─────────────────────────────────────────────────────────┤
│ 강의실 선택: [제1강의실 ▼] [강의실 추가] [좌석 편집]    │
├─────────────────────────────────────────────────────────┤
│ 🔍 [Q 원생을 검색하세요                    ]            │
├─────────────────────────────────────────────────────────┤
│ 자리배치도                    [🔄 새로고침]             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [1] [2] [3] [4] [5] [6] [7]                           │
│  [8] [9] [10][11][12][13][14]                          │
│  [15][16][17][18][19][20][21]                          │
│  [22][23][24][25][26][27][28]                          │
│  [29][30][31][32][33][34][35]                          │
│  [36][37][38][39][40][41][42]                          │
│  [43][44][45][46][47][48][49]                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2. 색상 코딩
- **연한 녹색**: 출석한 학생
- **연한 회색**: 배정된 좌석 (빈 자리)
- **노란색**: 지각한 학생
- **연한 빨간색**: 결석한 학생
- **검은 테두리**: 현재 선택된 좌석
- **어두운 회색**: 사용 불가능한 좌석

## 🔧 기능 구현

### 1. 강의실 관리
- **ClassroomSelector 컴포넌트**
  - 드롭다운으로 강의실 선택
  - 강의실 추가 버튼
  - 좌석 편집 버튼
  - 현재 선택된 강의실 표시

### 2. 학생 검색
- **StudentSearch 컴포넌트**
  - 실시간 검색 기능
  - 학생 이름, 이메일, 학번으로 검색
  - 검색 결과 하이라이트

### 3. 좌석 배치도
- **SeatingChart 컴포넌트**
  - 7x7 그리드 레이아웃
  - 반응형 디자인
  - 드래그 앤 드롭 지원

- **Seat 컴포넌트**
  - 좌석 번호 표시
  - 학생 이름 표시
  - 상태별 색상 표시
  - 클릭 이벤트 처리

### 4. 출결 관리
- **AttendanceControls 컴포넌트**
  - 출석 체크
  - 지각 처리
  - 결석 처리
  - 일괄 처리 기능

## 📱 반응형 디자인

### 1. 데스크톱 (1024px+)
- 7x7 그리드
- 사이드바와 함께 표시
- 마우스 호버 효과

### 2. 태블릿 (768px - 1023px)
- 5x5 그리드
- 터치 친화적 인터페이스
- 스와이프 제스처

### 3. 모바일 (767px 이하)
- 3x3 그리드
- 세로 스크롤
- 큰 터치 영역

## 🔄 상태 관리

### 1. Context API + useReducer (권장)
```typescript
// AttendanceContext.tsx
interface AttendanceState {
  selectedClassroom: Classroom | null;
  seats: Seat[];
  selectedSeatId: string | null;
  searchQuery: string;
  loading: boolean;
}

type AttendanceAction = 
  | { type: 'SELECT_CLASSROOM'; payload: Classroom }
  | { type: 'SELECT_SEAT'; payload: string }
  | { type: 'UPDATE_SEAT_STATUS'; payload: { seatId: string; status: SeatStatus } }
  | { type: 'SET_SEARCH_QUERY'; payload: string };

const attendanceReducer = (state: AttendanceState, action: AttendanceAction) => {
  // 상태 변경 로직
};

export const AttendanceProvider = ({ children }) => {
  const [state, dispatch] = useReducer(attendanceReducer, initialState);
  return (
    <AttendanceContext.Provider value={{ state, dispatch }}>
      {children}
    </AttendanceContext.Provider>
  );
};
```

### 2. UI 상태 분리
```typescript
// UI 전용 상태 (데이터와 분리)
const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
const [isDragging, setIsDragging] = useState<boolean>(false);
```

### 3. 전역 상태 (필요시)
- Firebase Firestore와 연동
- 실시간 동기화
- 오프라인 지원

## 🎯 구현 단계

### Phase 1: 기본 구조 (1-2일)
1. 컴포넌트 폴더 구조 생성
2. 타입 정의 작성
3. 기본 레이아웃 구현
4. 정적 좌석 배치도 표시

### Phase 2: 상호작용 (2-3일)
1. 좌석 클릭 이벤트
2. 학생 검색 기능
3. 강의실 선택 기능
4. 기본 출결 상태 변경

### Phase 3: 고급 기능 (3-4일)
1. 드래그 앤 드롭
2. 일괄 처리 기능
3. 실시간 업데이트
4. 데이터 저장/로드

### Phase 4: 최적화 (1-2일)
1. **성능 최적화**
   - `React.memo`를 이용한 Seat 컴포넌트 렌더링 최적화
   - `useCallback`, `useMemo`를 통한 불필요한 리렌더링 방지
   - 가상화(Virtualization) 고려 (필요시)
2. 반응형 디자인 완성
3. 접근성 개선
4. 테스트 작성

## 🛠️ 기술 스택

### 1. React
- 함수형 컴포넌트
- Hooks (useState, useEffect, useCallback)
- Context API (필요시)

### 2. TypeScript
- 강타입 지원
- 인터페이스 정의
- 타입 안전성

### 3. CSS
- CSS Grid/Flexbox
- CSS Variables
- 반응형 미디어 쿼리

### 4. API 계층 (중요)
- **attendanceAPI.ts**: 출결 관련 Firebase API 추상화
- **classroomAPI.ts**: 강의실 관련 Firebase API 추상화
- **studentAPI.ts**: 학생 관련 Firebase API 추상화
- **장점**: 
  - 컴포넌트와 데이터베이스 분리
  - 테스트 시 Mock 함수로 대체 가능
  - 데이터베이스 변경 시 API 계층만 수정

### 5. 라이브러리
- **dnd-kit**: 드래그 앤 드롭 기능 (접근성 우수, React Hooks 기반)
- **react-window**: 대용량 리스트 가상화 (필요시)

### 6. Firebase (선택사항)
- Firestore (데이터 저장)
- 실시간 리스너
- 오프라인 지원

## 📋 체크리스트

### 기본 기능
- [ ] 좌석 배치도 렌더링
- [ ] 좌석 클릭 이벤트
- [ ] 학생 정보 표시
- [ ] 상태별 색상 표시

### 상호작용
- [ ] 학생 검색
- [ ] 강의실 선택
- [ ] 출결 상태 변경
- [ ] 좌석 선택/해제

### 고급 기능
- [ ] 드래그 앤 드롭
- [ ] 일괄 처리
- [ ] 실시간 업데이트
- [ ] 데이터 저장

### API 계층
- [ ] attendanceAPI.ts 구현
- [ ] classroomAPI.ts 구현
- [ ] studentAPI.ts 구현
- [ ] API 함수 테스트 작성

### UI/UX
- [ ] 반응형 디자인
- [ ] 접근성
- [ ] 로딩 상태
- [ ] 에러 처리

### 성능 최적화
- [ ] React.memo 적용
- [ ] useCallback, useMemo 최적화
- [ ] 불필요한 리렌더링 방지
- [ ] 메모리 누수 방지

## 🚀 시작하기

1. **컴포넌트 폴더 생성**
   ```bash
   mkdir -p src/components/domain/Attendance
   mkdir -p src/components/ui
   ```

2. **타입 정의 파일 생성**
   ```typescript
   // src/types/attendance.ts (기존 types/ 폴더에 추가)
   export interface Classroom { ... }
   export interface AttendanceSeat { ... }
   export interface AttendanceStudent { ... }
   // ...
   ```

3. **API 계층 파일 생성**
   ```typescript
   // src/api/attendanceAPI.ts
   export const updateSeatStatusAPI = (seatId: string, newStatus: SeatStatus) => {
     const seatRef = doc(db, "seats", seatId);
     return updateDoc(seatRef, { status: newStatus });
   };

   // src/api/classroomAPI.ts
   export const fetchClassroomsAPI = () => { ... };

   // src/api/studentAPI.ts
   export const searchStudentsAPI = (query: string) => { ... };
   ```

4. **기본 컴포넌트 생성**
   ```typescript
   // src/components/domain/Attendance/SeatingChart.tsx
   // src/components/domain/Attendance/Seat.tsx
   // src/components/domain/Attendance/AttendanceContext.tsx
   // src/components/ui/Button.tsx
   // ...
   ```

5. **타입 import 경로 확인**
   ```typescript
   // 컴포넌트에서 타입 import
   import { Classroom, AttendanceSeat, SeatStatus } from '../../types/attendance';
   import { Student } from '../../types/student';
   ```

6. **메인 페이지 업데이트**
   ```typescript
   // src/pages/Attendance/AttendancePage.tsx
   // 컴포넌트들을 조합하여 완전한 페이지 구현
   ```

## 📝 참고사항

- 기존 프로젝트의 디자인 시스템 활용
- Firebase 연동 시 보안 규칙 고려
- **성능 최적화**: `React.memo`, `useCallback`, `useMemo` 적극 활용
- **상태 관리**: Context API + useReducer로 Prop Drilling 방지
- **컴포넌트 분리**: UI 상태와 데이터 상태 명확히 분리
- 접근성을 위한 키보드 네비게이션 지원
- 모바일 사용성을 위한 터치 제스처 구현
- **라이브러리 활용**: dnd-kit 등 검증된 라이브러리 적극 사용
- **API 계층 분리**: 컴포넌트와 데이터베이스 분리로 유지보수성 향상

---

이 계획을 바탕으로 단계별로 구현하면 완전한 출결 관리 페이지를 만들 수 있습니다.
