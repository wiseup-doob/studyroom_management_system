# 공유 시간표 수정 시 'tuesday' 속성 오류 분석 및 해결 계획

## 문제 개요

외부에서 공유 링크를 통해 시간표를 수정한 후, 알림에서 해당 수정 사항을 승인하려고 할 때 다음과 같은 오류가 발생합니다:

```
기여 처리 오류: TypeError: Cannot read properties of undefined (reading 'tuesday')
    at recalculateAutoFillSlots (/workspace/lib/modules/personal/shareScheduleManagement.js:934:53)
    at /workspace/lib/modules/personal/shareScheduleManagement.js:1203:47
```

## 오류 발생 위치

### 파일 및 함수
- **파일**: `functions/src/modules/personal/shareScheduleManagement.ts`
- **함수**: `recalculateAutoFillSlots` (1105라인 시작)
- **오류 라인**: 1115라인

### 오류 발생 코드
```typescript
const daySchedule = basicSchedule.dailySchedules[dayOfWeek];
```

## 근본 원인 분석

### 1. 데이터 흐름 추적

#### 기여 생성 시점 (775-805라인)
```typescript
const contributionData = {
  contributionType: "student_timetable_edit",
  shareToken: shareToken,
  timetableId: editStateData.timetableId,
  studentId: userId,
  originalTimetableId: editStateData.timetableId,
  originalVersion: studentTimetableData.data()?.version || "1.0",
  proposedTimetable: {
    detailedSchedule: editStateData.currentTimetable.detailedSchedule || { ... },
    // ❌ basicSchedule가 누락됨
    // ❌ autoFillSettings가 누락됨
    modifiedSlots: changes.modifiedSlots || [],
    addedSlots: changes.addedSlots || [],
    deletedSlots: changes.deletedSlots || []
  },
  // ... 기타 필드들
};
```

#### 승인 처리 시점 (1445-1450라인)
```typescript
for (const day of daysOfWeek) {
  if (updatedSchedule[day]) {
    updatedSchedule = recalculateAutoFillSlots(
      updatedSchedule,
      currentTimetableData.basicSchedule,  // ⚠️ undefined일 수 있음
      currentTimetableData.autoFillSettings,  // ⚠️ undefined일 수 있음
      day
    );
  }
}
```

#### 오류 발생 지점 (1115라인)
```typescript
const daySchedule = basicSchedule.dailySchedules[dayOfWeek];
// basicSchedule가 undefined인 경우: undefined.dailySchedules -> 오류
// basicSchedule.dailySchedules가 undefined인 경우: undefined[dayOfWeek] -> 오류
```

### 2. 문제의 핵심

**데이터 구조 불완전성**: 외부에서 시간표를 수정할 때 생성되는 기여 데이터에서 `basicSchedule`와 `autoFillSettings` 구조가 누락되어, 나중에 자동 자습 시간 재계산 시 필요한 데이터에 접근할 수 없음.

### 3. 발생 시나리오

1. 외부 사용자가 공유 링크를 통해 시간표 수정
2. 수정 사항이 기여(contribution)로 저장됨 (이때 `basicSchedule` 누락)
3. 시간표 소유자가 알림에서 수정 사항 승인 시도
4. `recalculateAutoFillSlots` 함수에서 `basicSchedule.dailySchedules` 접근 시 오류 발생

## 해결 계획

### 1. 근본적 해결 방법 (권장)

#### A. 기여 생성 시 완전한 시간표 구조 보존

**수정 위치**: `shareScheduleManagement.ts` 775-805라인

**수정 내용 (개선된 방식)**:
```typescript
const contributionData = {
  contributionType: "student_timetable_edit",
  shareToken: shareToken,
  timetableId: editStateData.timetableId,
  studentId: userId,
  originalTimetableId: editStateData.timetableId,
  originalVersion: studentTimetableData.data()?.version || "1.0",
  proposedTimetable: {
    // ✅ 원본 시간표의 모든 속성을 그대로 복사 (가장 안전한 방식)
    ...studentTimetableData.data(),

    // ✅ 그 중에서 detailedSchedule만 학생이 편집한 버전으로 덮어쓰기
    detailedSchedule: editStateData.currentTimetable.detailedSchedule || {
      monday: { timeSlots: [] },
      tuesday: { timeSlots: [] },
      wednesday: { timeSlots: [] },
      thursday: { timeSlots: [] },
      friday: { timeSlots: [] },
      saturday: { timeSlots: [] },
      sunday: { timeSlots: [] }
    },

    // ✅ 변경사항 추적 필드 추가
    modifiedSlots: changes.modifiedSlots || [],
    addedSlots: changes.addedSlots || [],
    deletedSlots: changes.deletedSlots || []
  },
  // ... 기타 필드들
};
```

**이 방식의 장점**:
- 원본 시간표의 모든 구조(`basicSchedule`, `autoFillSettings`, 기타 속성들)가 자동으로 보존됨
- 향후 시간표에 새로운 속성이 추가되어도 자동으로 포함됨
- 코드가 더 간결하고 유지보수하기 쉬움
- 기본값을 일일이 정의할 필요 없음

#### B. 승인 처리 시 proposedTimetable의 구조 사용

**수정 위치**: `shareScheduleManagement.ts` 1445-1450라인

**수정 내용**:
```typescript
// ✅ proposedTimetable에 이미 완전한 구조가 포함되어 있으므로 직접 사용
const timetableBasicSchedule = contributionData.proposedTimetable.basicSchedule ||
                               currentTimetableData.basicSchedule;
const timetableAutoFillSettings = contributionData.proposedTimetable.autoFillSettings ||
                                  currentTimetableData.autoFillSettings;

for (const day of daysOfWeek) {
  if (updatedSchedule[day]) {
    updatedSchedule = recalculateAutoFillSlots(
      updatedSchedule,
      timetableBasicSchedule,  // ✅ 이제 항상 존재하는 구조
      timetableAutoFillSettings,  // ✅ 이제 항상 존재하는 구조
      day
    );
  }
}
```

**참고**: 위의 A 방식으로 수정하면 `proposedTimetable`에 항상 완전한 구조가 포함되므로, 실제로는 fallback(`||`)이 거의 필요 없어집니다.

### 2. 방어적 해결 방법 (추가 보완)

#### A. recalculateAutoFillSlots 함수 개선

**수정 위치**: `shareScheduleManagement.ts` 1105-1118라인

**수정 내용**:
```typescript
const recalculateAutoFillSlots = (
  detailedSchedule: any,
  basicSchedule: any,
  autoFillSettings: any,
  dayOfWeek: string
) => {
  // ✅ 방어 코드 추가
  if (!basicSchedule || !basicSchedule.dailySchedules) {
    console.warn(`기본 스케줄 구조가 없음: ${dayOfWeek}`);
    return detailedSchedule;
  }

  if (!autoFillSettings || !autoFillSettings.enabled || !autoFillSettings.fillEmptySlots) {
    return detailedSchedule;
  }

  const daySchedule = basicSchedule.dailySchedules[dayOfWeek];
  if (!daySchedule || !daySchedule.isActive) {
    return detailedSchedule;
  }

  // ... 나머지 로직
};
```

## 구현 우선순위

### Phase 1: 즉시 수정 (Critical)
1. **방어 코드 추가**: `recalculateAutoFillSlots` 함수에 null 체크 로직 추가
2. **오류 로깅 개선**: 어떤 데이터가 누락되었는지 명확히 기록

### Phase 2: 근본 해결 (High Priority)
1. **기여 생성 로직 수정**: `proposedTimetable`에 완전한 구조 포함
2. **승인 처리 로직 개선**: 더 안전한 데이터 접근 방식 적용

### Phase 3: 검증 및 테스트 (Medium Priority)
1. **단위 테스트 추가**: 각 시나리오별 테스트 케이스 작성
2. **통합 테스트**: 전체 공유-수정-승인 플로우 테스트

## 예상 영향도

### 긍정적 영향
- 공유 시간표 수정 승인 시 오류 제거
- 시스템 안정성 향상
- 사용자 경험 개선
- **향후 확장성**: 새로운 시간표 속성이 추가되어도 자동으로 처리됨

### 주의사항
- 기존 기여 데이터와의 호환성 고려 필요
- 데이터 크기 약간 증가 (하지만 전체 객체 복사로 오히려 예측 가능해짐)
- 기존 pending 상태 기여들에 대한 마이그레이션 필요할 수 있음

### 개선된 접근법의 추가 장점
- **코드 간소화**: 기본값을 일일이 정의할 필요 없음
- **유지보수성**: 시간표 구조 변경 시 이 코드는 수정할 필요 없음
- **안전성**: 원본 데이터의 모든 속성이 자동으로 보존됨

## 관련 파일

- `functions/src/modules/personal/shareScheduleManagement.ts`: 주요 수정 대상
- `functions/src/types/index.ts`: 타입 정의 확인/수정 필요할 수 있음
- `frontend/src/services/studentTimetableService.ts`: 프론트엔드 연동 확인

## 검증 방법

1. **개발 환경 테스트**:
   - 공유 링크 생성 → 외부 수정 → 승인 플로우 전체 테스트
   - 다양한 시간표 구조에서 테스트

2. **로그 모니터링**:
   - 오류 발생 빈도 추적
   - 데이터 구조 누락 케이스 분석

3. **사용자 피드백**:
   - 공유 기능 사용자들의 경험 모니터링

---

**작성일**: 2025-09-26
**작성자**: Claude Code Analysis
**우선순위**: Critical
**예상 작업 시간**: 4-6시간 (Phase 1-2)