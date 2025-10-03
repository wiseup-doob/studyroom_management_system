# 공유 링크 편집 UI 개선 계획

## 📋 개요
현재 공유 링크 편집 방식(셀 직접 클릭)을 `StudentTimetablePanel.tsx`와 동일한 방식(전용 편집 버튼)으로 개선하여 사용성과 일관성을 향상시킵니다.

## 🎯 목표
- 셀 직접 클릭 편집 → 전용 편집 버튼 방식으로 변경
- 기존 `StudentTimetablePanel`과 동일한 UX 패턴 적용
- 모바일 친화적이고 실수 방지 가능한 인터페이스 구현

## 📊 현재 상태 분석

### 현재 공유 편집 방식
- **편집 방법**: 시간표 셀 직접 클릭
- **모달**: `TimeSlotEditDialog` (공유 전용)
- **문제점**:
  - 실수 클릭 가능성
  - 모바일에서 사용성 떨어짐
  - 셀 크기가 작아 정확한 클릭 어려움
  - 빈 셀과 수업 셀의 클릭 영역 불일치

### StudentTimetablePanel 방식
- **편집 방법**: 전용 "시간표 편집" 버튼
- **모달**: `TimeSlotEditModal` (재사용 가능)
- **장점**:
  - 명확한 편집 의도
  - 큰 클릭 영역
  - 모바일 친화적
  - 실수 클릭 방지

## 🔧 수정 계획

### Phase 1: 컴포넌트 구조 변경

#### 1.1 SharedEditHeader.tsx 수정
```typescript
// 추가할 기능
- 편집 버튼 추가
- 편집 모달 상태 관리
- 헤더 액션 버튼 그룹 구성
```

**수정 내용:**
- `handleEditTimetable` 함수 추가
- 편집 버튼 UI 추가
- 기존 제출 버튼과 함께 액션 그룹 구성

#### 1.2 SharedTimetableGrid.tsx 수정
```typescript
// 제거할 기능
- onSlotClick prop 제거
- 셀 클릭 이벤트 제거
- clickable 클래스 제거
- isClickable 로직 제거
```

**수정 내용:**
- 셀을 순수 표시용으로 변경
- 클릭 이벤트 핸들러 제거
- Props 인터페이스 단순화

#### 1.3 StudentTimetableSharedEdit.tsx 수정
```typescript
// 추가할 기능
- 편집 모달 상태 관리
- TimeSlotEditModal 컴포넌트 사용
- 편집 핸들러 함수들 추가
```

**수정 내용:**
- `isEditModalOpen` 상태 추가
- `TimeSlotEditModal` import 및 사용
- `handleEditTimetable`, `closeEditModal` 함수 추가
- `handleAddClass`, `handleDeleteClass` 함수 추가

### Phase 2: 모달 통합

#### 2.1 TimeSlotEditModal 재사용
- 기존 `TimeSlotEditModal` 컴포넌트를 공유 편집에서도 사용
- `TimeSlotEditDialog` 제거 또는 deprecated 처리
- Props 인터페이스 통일

#### 2.2 편집 로직 통합
- `StudentTimetablePanel`의 편집 로직을 공유 편집에 적용
- 백엔드 API 호출 방식 통일
- 에러 처리 로직 통합

### Phase 3: UI/UX 개선

#### 3.1 헤더 레이아웃 개선
```css
.ste-header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.ste-btn-edit {
  /* 편집 버튼 스타일 */
}

.ste-btn-submit {
  /* 제출 버튼 스타일 */
}
```

#### 3.2 시간표 그리드 개선
- 셀 클릭 효과 제거
- 호버 효과는 유지 (시각적 피드백용)
- 포커스 상태 제거

#### 3.3 반응형 디자인
- 모바일에서 버튼 크기 최적화
- 터치 친화적 인터페이스
- 접근성 개선

## 📁 수정할 파일 목록

### 프론트엔드 파일
1. **`frontend/src/pages/StudentTimetableSharedEdit/components/SharedEditHeader.tsx`**
   - 편집 버튼 추가
   - 헤더 액션 그룹 구성

2. **`frontend/src/pages/StudentTimetableSharedEdit/components/SharedTimetableGrid.tsx`**
   - 셀 클릭 이벤트 제거
   - Props 인터페이스 단순화

3. **`frontend/src/pages/StudentTimetableSharedEdit/StudentTimetableSharedEdit.tsx`**
   - 편집 모달 상태 추가
   - TimeSlotEditModal 사용
   - 편집 핸들러 함수들 추가

4. **`frontend/src/pages/StudentTimetableSharedEdit/components/SharedTimetableGrid.css`**
   - 클릭 관련 스타일 제거
   - 호버 효과만 유지

5. **`frontend/src/pages/StudentTimetableSharedEdit/StudentTimetableSharedEdit.css`**
   - 헤더 액션 버튼 스타일 추가

### 제거할 파일 (선택사항)
- **`frontend/src/pages/StudentTimetableSharedEdit/components/TimeSlotEditDialog.tsx`**
  - TimeSlotEditModal로 대체되므로 제거 가능

## 🔄 구현 순서

### Step 1: SharedEditHeader 수정
1. 편집 버튼 UI 추가
2. 편집 핸들러 함수 추가
3. 헤더 레이아웃 조정

### Step 2: SharedTimetableGrid 수정
1. 셀 클릭 이벤트 제거
2. Props 인터페이스 단순화
3. CSS 클래스 정리

### Step 3: StudentTimetableSharedEdit 수정
1. 편집 모달 상태 추가
2. TimeSlotEditModal import 및 사용
3. 편집 핸들러 함수들 구현

### Step 4: 스타일링 및 테스트
1. CSS 스타일 조정
2. 반응형 디자인 확인
3. 기능 테스트

## ✅ 검증 기준

### 기능 검증
- [ ] 편집 버튼 클릭 시 모달이 정상적으로 열림
- [ ] 시간표 셀 클릭 시 아무 동작하지 않음
- [ ] 수업 추가/수정/삭제 기능 정상 작동
- [ ] 자동 저장 기능 정상 작동
- [ ] 제출 기능 정상 작동

### UI/UX 검증
- [ ] 모바일에서 버튼 클릭이 편리함
- [ ] 헤더 레이아웃이 깔끔함
- [ ] 기존 StudentTimetablePanel과 일관된 느낌
- [ ] 실수 클릭이 방지됨

### 호환성 검증
- [ ] 기존 공유 링크가 정상 작동
- [ ] 백엔드 API 호출 정상
- [ ] 에러 처리 정상

## 🚀 예상 효과

### 사용성 개선
- 실수 클릭 방지
- 모바일 사용성 향상
- 명확한 편집 인터페이스

### 개발자 경험 개선
- 코드 일관성 향상
- 컴포넌트 재사용성 증대
- 유지보수성 향상

### 사용자 경험 개선
- 직관적인 편집 방식
- 일관된 UI 패턴
- 접근성 향상

## 📝 추가 고려사항

### 향후 개선 사항
- 키보드 단축키 지원 (Ctrl+E로 편집 모달 열기)
- 편집 히스토리 기능
- 실시간 협업 편집 기능

### 성능 최적화
- 불필요한 리렌더링 방지
- 모달 열기/닫기 애니메이션 최적화
- 메모리 사용량 최적화

---

**작성일**: 2024년 12월 19일  
**작성자**: AI Assistant  
**상태**: 계획 완료, 구현 대기
