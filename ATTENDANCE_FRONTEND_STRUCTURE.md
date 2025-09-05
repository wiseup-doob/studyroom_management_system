# 출석 관리 프론트엔드 구조 문서

## 📋 개요
현재 구현된 출석 관리 시스템의 프론트엔드 구조와 컴포넌트, 상태 관리, 스타일링 등을 상세히 정리한 문서입니다.

## 🏗️ 전체 프로젝트 구조

```
frontend/
├── src/
│   ├── components/
│   │   └── domain/
│   │       └── Attendance/
│   │           ├── AttendanceContext.tsx    # 출석 상태 관리 Context
│   │           ├── ClassroomSelector.tsx    # 강의실 선택 컴포넌트
│   │           ├── ClassroomSelector.css
│   │           ├── Seat.tsx                 # 개별 좌석 컴포넌트
│   │           ├── Seat.css
│   │           ├── SeatingChart.tsx         # 좌석 배치도 컴포넌트
│   │           └── SeatingChart.css
│   ├── pages/
│   │   └── Attendance/
│   │       ├── AttendancePage.tsx           # 출석 관리 메인 페이지
│   │       └── AttendancePage.css
│   ├── types/
│   │   ├── attendance.ts                    # 출석 관련 타입 정의
│   │   └── mockData.ts                      # Mock 데이터
│   └── styles/
│       └── variables.css                    # CSS 변수 정의
```

## 🧩 컴포넌트 구조

### 1. AttendancePage (메인 페이지)
**위치**: `src/pages/Attendance/AttendancePage.tsx`

**역할**: 출석 관리의 최상위 컨테이너 컴포넌트

**주요 기능**:
- `AttendanceProvider`로 하위 컴포넌트들을 감싸서 Context 제공
- 강의실 선택, 학생 검색, 좌석 배치도 컴포넌트들을 조합
- 이벤트 핸들러를 통해 각 컴포넌트 간 상호작용 관리

**구조**:
```tsx
const AttendancePage = () => (
  <AttendanceProvider>
    <AttendancePageContent />
  </AttendanceProvider>
);
```

### 2. AttendanceContext (상태 관리)
**위치**: `src/components/domain/Attendance/AttendanceContext.tsx`

**역할**: 출석 관리 관련 상태를 중앙에서 관리

**상태 구조**:
```typescript
interface AttendanceState {
  selectedClassroom: Classroom | null;
  seats: AttendanceSeat[];
  students: AttendanceStudent[];
  selectedSeatId: string | null;
  searchQuery: string;
  loading: boolean;
  error: string | null;
}
```

**주요 액션**:
- `SELECT_CLASSROOM`: 강의실 선택
- `SELECT_SEAT`: 좌석 선택
- `UPDATE_SEAT_STATUS`: 좌석 상태 변경
- `SET_SEARCH_QUERY`: 검색 쿼리 설정
- `SET_LOADING`: 로딩 상태 설정
- `SET_ERROR`: 에러 상태 설정
- `CLEAR_SELECTION`: 선택 해제

### 3. ClassroomSelector (강의실 선택)
**위치**: `src/components/domain/Attendance/ClassroomSelector.tsx`

**역할**: 강의실 선택 및 관리 기능 제공

**주요 기능**:
- 드롭다운으로 강의실 선택
- 강의실 추가 버튼
- 좌석 편집 버튼
- 선택된 강의실 정보 표시

**Props**:
```typescript
interface ClassroomSelectorProps {
  classrooms: Classroom[];
  selectedClassroom: Classroom | null;
  onClassroomChange: (classroom: Classroom) => void;
  onAddClassroom: () => void;
  onEditSeats: () => void;
  loading?: boolean;
}
```

### 4. StudentSearch (학생 검색)
**위치**: `src/components/domain/Attendance/StudentSearch.tsx`

**역할**: 학생 검색 및 선택 기능 제공

**주요 기능**:
- 실시간 학생 검색
- 검색 결과 드롭다운 표시
- 학생 선택 시 해당 좌석 하이라이트

**Props**:
```typescript
interface StudentSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  students: AttendanceStudent[];
  onStudentSelect: (student: AttendanceStudent) => void;
  loading?: boolean;
}
```

### 5. SeatingChart (좌석 배치도)
**위치**: `src/components/domain/Attendance/SeatingChart.tsx`

**역할**: 좌석 배치도 표시 및 통계 제공

**주요 기능**:
- 그리드 형태의 좌석 배치도 표시
- 좌석별 상태에 따른 색상 구분
- 출석 통계 표시 (전체, 등원, 사유결석, 무단결석, 하원, 미등원, 빈 좌석)
- 범례 표시
- 반응형 그리드 크기 조정

**Props**:
```typescript
interface SeatingChartProps {
  classroom: Classroom;
  students: AttendanceStudent[];
  selectedSeatId: string | null;
  onSeatClick: (seatId: string) => void;
}
```

### 6. Seat (개별 좌석)
**위치**: `src/components/domain/Attendance/Seat.tsx`

**역할**: 개별 좌석을 렌더링하는 최소 단위 컴포넌트

**주요 기능**:
- 좌석 번호 표시
- 학생 정보 표시 (빈 좌석이 아닌 경우만)
- 상태별 색상 구분
- 클릭 이벤트 처리
- 접근성 지원 (ARIA 라벨, 키보드 네비게이션)

**Props**:
```typescript
interface SeatProps {
  seat: AttendanceSeat;
  student?: AttendanceStudent;
  isSelected: boolean;
  onClick: (seatId: string) => void;
}
```

## 📊 데이터 구조

### 1. 타입 정의 (`attendance.ts`)

#### Classroom (강의실)
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
```

#### AttendanceSeat (출석 관리용 좌석)
```typescript
interface AttendanceSeat {
  id: string;
  number: number;
  row: number;
  col: number;
  studentId?: string;
  status: SeatStatus;
}
```

#### SeatStatus (좌석 상태)
```typescript
type SeatStatus = 
  | 'empty'         // 빈 좌석 (흰색)
  | 'not-enrolled'  // 미등원 (흰색)
  | 'dismissed'     // 사유결석 (연한 노란색)
  | 'present'       // 등원 (연한 초록색)
  | 'unauthorized'  // 무단결석 (연한 빨간색)
  | 'authorized'    // 하원 (연한 회색)
```

#### AttendanceStudent (출석 관리용 학생)
```typescript
interface AttendanceStudent {
  id: string;
  name: string;
  studentId: string;
  grade: string;
}
```

### 2. Mock 데이터 (`mockData.ts`)

**학생 데이터**: 10명의 Mock 학생 정보
**강의실 데이터**: 3개의 Mock 강의실 (7×7, 5×6, 6×8)
**좌석 생성**: 랜덤한 상태와 학생 배정으로 좌석 생성

## 🎨 스타일링 구조

### 1. CSS 변수 (`variables.css`)

#### 좌석 상태별 배경색
```css
:root {
  --color-seat-empty-bg: #FFFFFF;           /* 빈 좌석 */
  --color-seat-not-enrolled-bg: #FFFFFF;    /* 미등원 */
  --color-seat-dismissed-bg: #F7F9CE;       /* 사유결석 */
  --color-seat-present-bg: #CCF7E4;         /* 등원 */
  --color-seat-unauthorized-bg: #FFE3E1;    /* 무단결석 */
  --color-seat-authorized-bg: #E7ECEE;      /* 하원 */
  --color-seat-selected-bg: #F5F5F5;        /* 선택 */
}
```

#### 기타 공통 변수
- 폰트 관련 변수 (크기, 굵기, 라인 높이)
- 색상 관련 변수 (텍스트, 배경, 테두리)
- 간격 관련 변수 (spacing)
- 테두리 반경, 그림자, 전환 효과 등

### 2. 컴포넌트별 CSS

#### Seat.css
- 좌석 기본 스타일
- 상태별 배경색 및 호버 효과
- 반응형 크기 조정
- 선택된 좌석 스타일

#### SeatingChart.css
- 그리드 레이아웃
- 통계 표시 스타일
- 범례 스타일
- 반응형 그리드 크기 조정

#### ClassroomSelector.css
- 단일 행 레이아웃
- 드롭다운 및 버튼 스타일
- 반응형 조정

#### AttendancePage.css
- 페이지 전체 레이아웃
- 에러 메시지 스타일
- 반응형 패딩 조정

## 🔄 상태 관리 흐름

### 1. 초기화
1. `AttendancePage`가 `AttendanceProvider`로 감싸짐
2. Mock 데이터로 강의실과 학생 정보 로드
3. 첫 번째 강의실이 자동으로 선택됨

### 2. 강의실 선택
1. 사용자가 `ClassroomSelector`에서 강의실 선택
2. `SELECT_CLASSROOM` 액션으로 상태 업데이트
3. `SeatingChart`가 새로운 강의실의 좌석 배치도 표시

### 3. 좌석 선택
1. 사용자가 `Seat` 컴포넌트 클릭
2. `SELECT_SEAT` 액션으로 선택된 좌석 ID 업데이트
3. 선택된 좌석이 시각적으로 하이라이트됨

### 4. 학생 검색
1. 사용자가 `StudentSearch`에서 검색어 입력
2. `SET_SEARCH_QUERY` 액션으로 검색어 업데이트
3. 검색 결과가 드롭다운으로 표시
4. 학생 선택 시 해당 좌석이 자동으로 선택됨

## 📱 반응형 디자인

### 1. 그리드 크기 조정
- **1400px+**: 12px 간격 (대형 화면)
- **1200px+**: 10px 간격
- **1024px+**: 8px 간격
- **768px+**: 6px 간격
- **480px+**: 4px 간격
- **480px-**: 3px 간격 (모바일)

### 2. 컴포넌트별 반응형
- **Seat**: 화면 크기에 따라 최소 크기 조정
- **SeatingChart**: 그리드 간격 및 패딩 조정
- **ClassroomSelector**: 모바일에서 세로 배치로 변경
- **AttendancePage**: 패딩 크기 조정

## 🚀 성능 최적화

### 1. Context API + useReducer
- 복잡한 상태 로직을 reducer로 중앙화
- 불필요한 리렌더링 방지

### 2. CSS 변수 활용
- 일관된 색상 관리
- 유지보수성 향상

### 3. 컴포넌트 분리
- 단일 책임 원칙 적용
- 재사용성 및 테스트 용이성 향상

## 🔧 개발 환경

### 1. 기술 스택
- **React 18**: 함수형 컴포넌트, Hooks
- **TypeScript**: 타입 안정성
- **Vite**: 빌드 도구
- **CSS3**: 스타일링

### 2. 빌드 명령어
```bash
npm run build    # 프로덕션 빌드
npm run dev      # 개발 서버 실행
```

## 📝 향후 개선 사항

### 1. 기능 추가
- 좌석 상태 변경 기능
- 드래그 앤 드롭으로 학생 배정
- 출석 데이터 내보내기
- 실시간 업데이트

### 2. 성능 최적화
- React.memo 적용
- useCallback, useMemo 활용
- 가상화 (react-window) 적용

### 3. 접근성 개선
- 키보드 네비게이션 강화
- 스크린 리더 지원 개선
- 고대비 모드 지원

## 🎯 현재 구현 상태

### ✅ 완료된 기능
- [x] 기본 컴포넌트 구조
- [x] Context API 상태 관리
- [x] 좌석 배치도 표시
- [x] 강의실 선택
- [x] 학생 검색
- [x] 반응형 디자인
- [x] CSS 변수 시스템
- [x] Mock 데이터

### 🔄 진행 중인 기능
- [ ] 좌석 상태 변경 기능
- [ ] 실제 API 연동

### 📋 예정된 기능
- [ ] 드래그 앤 드롭
- [ ] 출석 데이터 관리
- [ ] 실시간 업데이트
- [ ] 성능 최적화

---

**문서 작성일**: 2024년 12월 19일  
**프로젝트 버전**: Phase 3 완료  
**다음 단계**: Phase 4 (고급 기능 구현)
