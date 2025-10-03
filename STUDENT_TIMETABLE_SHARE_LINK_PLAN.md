# 학생 시간표 작성 링크 기능 구현 계획

## 개요

현재 구축된 시간표 페이지에서 학생에게 시간표 작성 링크를 보내면, 학생이 해당 링크를 통해 시간표를 작성/수정하고, 관리자(사용자)가 승인 후 실제 시간표에 반영하는 기능을 구현한다.

## 현재 시스템 분석

### 기존 구현 상태
1. **시간표 페이지**: 완전히 구현됨 (`TimeTable.tsx`, `StudentTimetablePanel.tsx`)
2. **학생별 시간표 CRUD**: Backend Functions 완료 (`studentTimetableManagement.ts`)
3. **시간표 공유 기능**: 기본 구조 구현됨 (`shareScheduleManagement.ts`)
4. **데이터 구조**: 학생, 시간표 타입 정의 완료 (`student.ts`)

### 기존 공유 기능 분석
- `createShareLink`: 공유 링크 생성
- `getSharedSchedule`: 공유된 시간표 조회
- `contributeSchedule`: 외부 사용자가 시간표에 일정 기여
- `processContribution`: 기여 데이터 승인/거부

## 구현 목표

1. **시간표 작성 링크 생성**: 특정 학생의 시간표 작성을 위한 고유 링크 생성
2. **학생용 시간표 편집 페이지**: 링크를 통해 접근하는 간단한 시간표 편집 UI
3. **실시간 알림 시스템**: 학생이 시간표를 제출하면 관리자에게 알림
4. **승인/거부 시스템**: 관리자가 제출된 시간표를 검토하고 승인/거부
5. **시간표 반영**: 승인된 내용을 실제 시간표 데이터에 적용

## 상세 구현 계획

### Phase 1: 학생 시간표 작성 링크 생성

#### 1.1 Backend Functions 확장

**새로운 Function: `createStudentTimetableEditLink`**
```typescript
// 기존 shareScheduleManagement.ts 확장
export const createStudentTimetableEditLink = functions.https.onCall(async (data, context) => {
  // 학생별 시간표 편집 링크 생성
  // shareToken + studentId + timetableId 조합
  // 특별한 권한: 편집 전용 (승인 대기 상태로 저장)
})
```

**링크 형태**: `https://domain.com/student-timetable-edit/{shareToken}`

#### 1.2 Frontend 시간표 페이지에 링크 생성 버튼 추가

**StudentTimetablePanel.tsx 수정 위치**:
- 헤더 액션 영역에 "학생 편집 링크 생성" 버튼 추가
- 링크 생성 후 공유할 수 있는 모달/팝업 제공

### Phase 2: 학생용 시간표 편집 페이지

#### 2.1 새로운 라우트 및 페이지 생성

**파일 구조**:
```
frontend/src/pages/StudentTimetableSharedEdit/
├── StudentTimetableSharedEdit.tsx          # 메인 페이지
├── StudentTimetableSharedEdit.css          # 스타일
├── components/
│   ├── SharedEditHeader.tsx               # 헤더 (학생명, 제출 상태)
│   ├── SimpleTimetableGrid.tsx            # 간소화된 시간표 그리드
│   ├── TimeSlotEditDialog.tsx             # 시간 슬롯 편집 다이얼로그
│   └── SubmissionConfirmModal.tsx         # 제출 확인 모달
```

#### 2.2 라우팅 설정
```typescript
// AppRoutes.tsx에 추가
<Route path="/student-timetable-edit/:shareToken" element={<StudentTimetableSharedEdit />} />
```

#### 2.3 학생용 시간표 편집 UI 특징
- **단순화된 인터페이스**: 복잡한 관리 기능 제거
- **시간 슬롯 편집**: 드래그 앤 드롭 또는 클릭으로 쉬운 편집
- **실시간 검증**: 시간 충돌, 필수 정보 확인
- **저장 방식**: 임시 저장 + 최종 제출 분리
- **임시 저장 기능**: localStorage를 활용한 자동 임시 저장 (페이지 새로고침 대비)
- **변경 전/후 비교**: 원본 시간표와 수정 중인 시간표 토글 비교 기능
- **진행 상태 표시**: 편집 진행률 및 필수 항목 완료 상태 시각화

### Phase 3: 기여 데이터 구조 확장

#### 3.1 기존 ScheduleContribution 타입 확장
```typescript
interface StudentTimetableContribution extends ScheduleContribution {
  contributionType: 'student_timetable_edit';
  studentId: string;
  originalTimetableId: string;
  originalVersion: string; // 동시성 제어를 위한 버전 관리
  proposedTimetable: {
    detailedSchedule: any;
    modifiedSlots: string[]; // 변경된 슬롯 ID들
    addedSlots: TimeSlot[];   // 새로 추가된 슬롯들
    deletedSlots: string[];   // 삭제된 슬롯 ID들
  };
  submissionNotes?: string;
  editStartedAt: Timestamp; // 편집 시작 시간
}
```

#### 3.2 Backend Function 수정
**기존 `contributeSchedule` 함수 확장**:
- 학생 시간표 편집 타입 지원
- 전체 시간표 데이터 저장 (기존은 부분 수정)
- 변경 사항 추적 정보 포함
- **동시성 제어**: 버전 확인 및 충돌 감지

#### 3.3 동시성 문제 해결 방안
**버전 기반 동시성 제어**:
```typescript
// 시간표 데이터에 버전 필드 추가
interface StudentTimetable {
  // ... 기존 필드들
  version: string; // UUID 또는 타임스탬프 기반
  lastUpdatedAt: Timestamp;
  lastUpdatedBy: 'admin' | 'student';
}

// 제출 시 버전 확인 로직
export const validateTimetableVersion = (originalVersion: string, currentVersion: string) => {
  if (originalVersion !== currentVersion) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      '시간표가 다른 사용자에 의해 수정되었습니다. 최신 버전을 확인 후 다시 제출해주세요.'
    );
  }
};
```

**편집 잠금 시스템**:
- 학생 편집 링크가 활성화된 동안 해당 시간표를 관리자 UI에서 읽기 전용으로 표시
- 편집 중 상태를 DB에 저장하여 다른 사용자에게 알림

### Phase 4: 실시간 알림 시스템

#### 4.1 Frontend 알림 컴포넌트

**파일**: `frontend/src/components/notifications/TimetableNotifications.tsx`
```typescript
// 실시간 기여 알림을 위한 Firestore 리스너 구현
useEffect(() => {
  const unsubscribe = onSnapshot(
    query(contributionsRef, where('status', '==', 'pending')),
    (snapshot) => {
      // 새로운 기여 알림 표시
    }
  );
  return unsubscribe;
}, []);
```

#### 4.2 알림 UI 통합
- **시간표 페이지에 알림 배지**: 새로운 제출이 있을 때 표시
- **알림 센터**: 모든 대기 중인 기여 목록
- **빠른 승인/거부**: 알림에서 직접 액션 가능

### Phase 5: 승인/거부 시스템 개선

#### 5.1 기여 검토 모달 개선

**새로운 컴포넌트**: `ContributionReviewModal.tsx`
```typescript
// 기존과 제안된 시간표 병렬 비교
// 변경사항 하이라이트
// 개별 슬롯 승인/거부 가능 (선택적)
// 전체 승인/거부
// 거부 사유 템플릿 선택 및 커스텀 입력
```

**거부 사유 템플릿 시스템**:
```typescript
const rejectionReasonTemplates = [
  { id: 'time_conflict', text: '시간 중복이 발생했습니다.' },
  { id: 'missing_required', text: '필수 과목이 누락되었습니다.' },
  { id: 'invalid_schedule', text: '시간표 구성이 부적절합니다.' },
  { id: 'policy_violation', text: '학습 정책에 위반됩니다.' },
  { id: 'custom', text: '직접 입력...' }
];
```

#### 5.2 승인 후 처리 로직 강화
- **자동 자습 시간 재계산**: 승인된 변경사항 적용 후
- **충돌 해결**: 기존 일정과의 시간 충돌 자동 처리
- **학생 알림**: 승인/거부 결과 알림 (선택사항)

### Phase 6: 사용자 경험 개선

#### 6.1 링크 관리 기능
- **링크 목록**: 생성된 모든 편집 링크 관리
- **링크 비활성화/삭제**: 필요 시 링크 비활성화
- **사용 현황**: 링크 클릭 수, 제출 현황 통계
- **만료 설정**: 링크 유효 기간 설정

#### 6.2 학생 피드백 시스템
- **제출 완료 페이지**: 제출 후 확인 페이지
- **상태 추적**: 제출한 내용의 승인 상태 확인 (선택적 기능)
- **재편집 기능**: 거부 시 다시 편집할 수 있는 기능
- **편집 가이드**: 첫 방문 시 간단한 사용법 안내
- **실시간 도움말**: 편집 중 상황별 팁 제공

## 기술적 구현 세부사항

### Database 구조 변경

#### 기존 구조 확장:
```typescript
users/{userId}/
├── student_timetables/{timetableId}     # 기존
├── shared_schedules/{shareId}           # 기존 - 링크 정보 확장
└── schedule_contributions/{contributionId} # 기존 - 타입 확장
```

#### 새로운 필드들:
```typescript
// shared_schedules에 추가
interface StudentTimetableShareLink extends SharedSchedule {
  linkType: 'student_timetable_edit';
  targetStudentId: string;
  originalTimetableId: string;
  editPermissions: {
    canAddSlots: boolean;
    canDeleteSlots: boolean;
    canModifySlots: boolean;
    restrictedTimeSlots?: string[]; // 편집 금지 시간대
  };
}
```

### API 인터페이스 설계

#### 새로운 서비스 메서드:
```typescript
// studentTimetableService.ts에 추가
class StudentTimetableService {
  async createEditLink(studentId: string, timetableId: string, options: EditLinkOptions): Promise<string>
  async getEditableTimetable(shareToken: string): Promise<EditableTimetableData>
  async submitTimetableContribution(shareToken: string, contribution: TimetableContribution): Promise<void>
  async processTimetableContribution(contributionId: string, action: 'approve' | 'reject', notes?: string): Promise<void>
}
```

### 보안 고려사항

1. **토큰 보안**: UUID v4 기반 추측 불가능한 토큰
2. **권한 검증**: 각 API 호출 시 토큰 유효성 및 권한 확인
3. **데이터 검증**: 제출된 시간표 데이터의 무결성 검증
4. **Rate Limiting**: 링크 생성 및 제출 횟수 제한
5. **만료 처리**: 사용되지 않는 링크 자동 정리

### 사용자 플로우

#### 관리자 플로우:
1. 시간표 페이지에서 특정 학생 선택
2. "편집 링크 생성" 버튼 클릭
3. 링크 생성 옵션 설정 (권한, 만료일 등)
4. 생성된 링크를 학생에게 전달 (복사/공유)
5. 학생 제출 시 알림 수신
6. 제출 내용 검토 및 승인/거부
7. 승인 시 실제 시간표에 자동 반영

#### 학생 플로우:
1. 받은 링크 클릭하여 편집 페이지 접근
2. 현재 시간표 확인
3. 필요한 시간 슬롯 추가/수정/삭제
4. 실시간으로 변경사항 확인
5. 완료 후 "제출" 버튼 클릭
6. 제출 확인 및 완료 메시지 표시
7. 승인/거부 결과 확인 (선택사항)

## 개발 우선순위

### Phase 1 (핵심 기능)
1. 학생 편집 링크 생성 API
2. 학생용 시간표 편집 페이지 구현
3. 기본 제출/승인 시스템

### Phase 2 (사용성 개선)
1. 실시간 알림 시스템
2. 승인/거부 UI 개선
3. 변경사항 추적 및 비교 기능

### Phase 3 (관리 기능)
1. 링크 관리 시스템
2. 통계 및 모니터링
3. 고급 권한 설정

## 예상 개발 기간 (수정)

- **Phase 1**: 4-5일 (핵심 기능 + 동시성 제어)
- **Phase 2**: 3-4일 (사용성 개선 + UX 강화)
- **Phase 3**: 3-4일 (관리 기능 + 통계)
- **버퍼 기간**: 2일 (예상치 못한 버그 수정 및 UI/UX 개선)
- **총 예상 기간**: 12-15일

## 마일스톤 (수정)

1. **Day 1-2**: Backend API 구현 (동시성 제어 포함) 및 테스트
2. **Day 3-5**: 학생용 편집 페이지 구현 (임시 저장, 비교 기능 포함)
3. **Day 6-7**: 제출/승인 시스템 통합 (템플릿 시스템 포함)
4. **Day 8-9**: 알림 시스템 및 고급 UX 기능
5. **Day 10-11**: 링크 관리 및 관리자 기능 강화
6. **Day 12-13**: 통합 테스트 및 성능 최적화
7. **Day 14-15**: 버그 수정, 사용자 피드백 반영, 최종 완성

## 피드백 반영 요약

이번 개선에서는 다음과 같은 주요 피드백을 반영했습니다:

### 🔧 기술적 개선사항
1. **동시성 문제 해결**: 버전 기반 동시성 제어 및 편집 잠금 시스템 추가
2. **데이터 구조 강화**: 버전 관리 필드와 편집 추적 정보 추가
3. **충돌 감지 로직**: 학생과 관리자 동시 편집 상황 대비

### 🎨 사용자 경험 개선
1. **학생 측면**: localStorage 임시 저장, 변경 전/후 비교, 진행 상태 표시
2. **관리자 측면**: 거부 사유 템플릿 시스템, 빠른 승인/거부 기능
3. **편의 기능**: 편집 가이드, 실시간 도움말, 상황별 팁 제공

### 📅 현실적 일정 조정
- **기존**: 7-10일 → **수정**: 12-15일 (버퍼 2일 포함)
- 예상치 못한 버그 수정 및 UI/UX 개선 시간 고려
- 동시성 제어 및 고급 UX 기능 개발 시간 추가

### 💡 추가 고려사항
- 데이터 최적화: 승인/거부 후 불필요 데이터 정리 로직
- 확장성: 기존 시스템과의 원활한 통합
- 보안성: 토큰 보안 및 권한 검증 강화

이 수정된 계획은 기존에 구현된 시간표 시스템과 공유 기능을 최대한 활용하면서도, 실제 운영 환경에서 발생할 수 있는 다양한 시나리오를 고려하여 더욱 견고하고 사용자 친화적인 시스템을 구축할 수 있도록 설계되었습니다.