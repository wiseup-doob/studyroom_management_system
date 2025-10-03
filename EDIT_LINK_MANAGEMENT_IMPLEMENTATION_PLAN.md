# 편집 링크 관리 시스템 구현 계획

## 📋 개요

현재 구축된 시간표 공유 편집 시스템을 확장하여 편집 링크의 생성, 관리, 모니터링 기능을 추가하는 계획입니다.

## 🔍 현재 시스템 분석

### 기존 공유 편집 시스템 구조

#### 데이터베이스 구조
- `users/{userId}/shared_schedules` - 공유 링크 정보
- `users/{userId}/timetable_edit_states` - 편집 상태 관리  
- `users/{userId}/student_timetables` - 학생 시간표 데이터

#### 기존 API
- `createStudentTimetableEditLink` - 편집 링크 생성 (이미 구현됨)
- `getEditState` - 편집 상태 조회
- `updateEditState` - 편집 상태 업데이트

#### 프론트엔드
- `ShareLinkModal` - 링크 생성 UI (이미 구현됨)
- `StudentTimetableSharedEdit` - 학생용 편집 페이지 (이미 구현됨)
- `EditLinkManagementModal` - 링크 관리 UI (새로 구현됨)

### 현재 시스템의 한계점

1. **링크 관리 기능 부족**
   - 생성된 링크 목록 조회 불가
   - 링크 비활성화/삭제 기능 없음
   - 링크 사용 로그 없음
   - **중요**: 현재는 한 학생당 하나의 활성 링크만 허용 (새 링크 생성 시 기존 링크 자동 비활성화)

2. **권한 관리 단순함**
   - 고정된 편집 권한만 제공
   - 세밀한 권한 제어 불가

3. **모니터링 기능 없음**
   - 링크 사용 현황 파악 불가
   - 보안 이슈 추적 불가

4. **기존 시스템 제약사항**
   - `functions.https.onRequest` 방식 사용 (onCall 아님)
   - 기존 `linkSettings` 구조에 의존
   - `timetable_edit_states` 컬렉션과 연동 필요

## 🎯 구현 목표

1. **편집 링크 관리 기능**
   - 활성/비활성 링크 목록 조회
   - 링크 비활성화/재활성화/삭제
   - 링크별 상세 정보 표시

2. **사용 로그 시스템**
   - 링크 접근/편집 기록 추적
   - 사용자별 활동 로그
   - 보안 이벤트 기록

3. **권한 관리 강화**
   - 세밀한 편집 권한 제어
   - 접근 제한 설정
   - 보안 설정 관리

## 🚀 구현 계획

### Phase 1: 기존 시스템 확장 (1-2일)

#### 1.1 데이터베이스 스키마 확장

**기존 `shared_schedules` 컬렉션 확장 (현재 구조 기반)**
```typescript
interface SharedSchedule {
  // ... 기존 필드들 (유지)
  shareToken: string;
  timetableId: string;
  permissions: {
    canEdit: boolean;
    canView: boolean;
    canComment: boolean;
  };
  accessSettings: {
    requireName: boolean;
    requireEmail: boolean;
    maxContributions?: number;
  };
  linkSettings: {
    isActive: boolean;
    expiresAt?: FirebaseFirestore.Timestamp;
    createdAt: FirebaseFirestore.Timestamp;
    lastUsedAt?: FirebaseFirestore.Timestamp;
    usageCount: number;
    // 새로 추가할 필드들
    createdBy?: string;           // 생성자 ID
    deactivatedAt?: FirebaseFirestore.Timestamp; // 비활성화 시간
    ipAddresses?: string[];       // 접근 IP 목록
  };
  title?: string;
  description?: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}
```

**새 컬렉션: `edit_link_logs`**
```typescript
interface EditLinkLog {
  id: string;
  shareToken: string;
  action: 'created' | 'accessed' | 'edited' | 'deactivated' | 'expired';
  timestamp: Timestamp;
  details: string;
  userId?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
}
```

#### 1.2 백엔드 API 확장

**`functions/src/modules/personal/shareScheduleManagement.ts`에 추가**
*(기존 `functions.https.onRequest` 방식 유지)*

```typescript
// 1. 편집 링크 목록 조회
export const getStudentEditLinks = functions.https.onRequest(async (req, res) => {
  // 학생별 활성/비활성 링크 목록 반환
});

// 2. 편집 링크 비활성화
export const deactivateEditLink = functions.https.onRequest(async (req, res) => {
  // 링크 비활성화 + 로그 기록
});

// 3. 편집 링크 재활성화
export const activateEditLink = functions.https.onRequest(async (req, res) => {
  // 링크 재활성화 + 로그 기록
});

// 4. 편집 링크 삭제
export const deleteEditLink = functions.https.onRequest(async (req, res) => {
  // 링크 완전 삭제 + 관련 데이터 정리
});

// 5. 편집 링크 로그 조회
export const getEditLinkLogs = functions.https.onRequest(async (req, res) => {
  // 링크 사용 로그 반환
});

// 6. 편집 링크 사용 기록
export const recordEditLinkUsage = functions.https.onRequest(async (req, res) => {
  // 링크 접근/편집 시 로그 기록
});
```

#### 1.3 프론트엔드 서비스 확장

**`frontend/src/services/editLinkService.ts` 생성**
```typescript
class EditLinkService {
  async getStudentEditLinks(studentId: string): Promise<EditLink[]>
  async deactivateEditLink(shareToken: string): Promise<void>
  async activateEditLink(shareToken: string): Promise<void>
  async deleteEditLink(shareToken: string): Promise<void>
  async getEditLinkLogs(studentId: string): Promise<EditLinkLog[]>
  async recordUsage(shareToken: string, action: string): Promise<void>
}
```

### Phase 2: UI 통합 (1일)

#### 2.1 기존 ShareLinkModal 확장
- 링크 생성 시 추가 옵션 제공
- 생성된 링크에 대한 기본 정보 표시

#### 2.2 EditLinkManagementModal 실제 API 연동
- 임시 데이터를 실제 API 호출로 교체
- 에러 처리 및 로딩 상태 개선

#### 2.3 기존 시스템과 연동
- `StudentTimetableSharedEdit`에서 사용 기록 자동 생성
- 링크 접근 시 유효성 검증 강화

### Phase 3: 고급 기능 (1-2일)

#### 3.1 보안 기능 강화
```typescript
// IP 제한 기능
interface SecuritySettings {
  allowedIPs?: string[];
  blockedIPs?: string[];
  maxConcurrentSessions: number;
  sessionTimeout: number; // 분 단위
}

// 접근 제한 기능
interface AccessLimits {
  maxUsesPerDay: number;
  maxUsesTotal: number;
  allowedTimeSlots: string[]; // 특정 시간대만 접근 허용
}
```

#### 3.2 모니터링 대시보드
- 실시간 링크 사용 현황
- 의심스러운 활동 감지
- 링크 성능 통계

## 📁 파일 구조

### 백엔드 (Functions)
```
functions/src/modules/personal/
├── shareScheduleManagement.ts     # 기존 파일 확장
└── editLinkManagement.ts          # 새 파일 (선택사항)
```

### 프론트엔드
```
frontend/src/
├── services/
│   └── editLinkService.ts         # 새 파일
├── pages/TimeTable/components/
│   ├── EditLinkManagementModal.tsx    # 이미 구현됨
│   ├── ShareLinkModal.tsx            # 기존 파일 확장
│   └── StudentTimetablePanel.tsx     # 기존 파일 수정
└── pages/StudentTimetableSharedEdit/
    └── StudentTimetableSharedEdit.tsx # 기존 파일 수정
```

## 🔧 구현 우선순위

### 즉시 구현 (Phase 1)
1. ✅ **EditLinkManagementModal** - 이미 구현됨
2. 🔄 **백엔드 API 확장** - 기존 `shareScheduleManagement.ts`에 함수 추가
3. 🔄 **프론트엔드 서비스** - `editLinkService.ts` 생성
4. 🔄 **실제 API 연동** - 모달의 임시 데이터를 실제 API로 교체

### 다음 단계 (Phase 2)
1. 기존 `ShareLinkModal` 개선
2. 로그 시스템 구현
3. 에러 처리 강화

### 향후 고려 (Phase 3)
1. 고급 보안 기능
2. 모니터링 대시보드
3. 성능 최적화

## 💡 이 프로젝트에 최적화된 접근법

1. **기존 구조 활용**: 새로운 컬렉션 대신 기존 `shared_schedules` 확장
2. **점진적 개선**: 기존 기능을 깨뜨리지 않고 점진적으로 확장
3. **실용적 우선**: 복잡한 기능보다는 실제 필요한 관리 기능에 집중
4. **기존 UI 활용**: `ShareLinkModal`과 `EditLinkManagementModal` 연동
5. **기존 API 패턴 준수**: `functions.https.onRequest` 방식 유지
6. **현재 제약사항 고려**: 한 학생당 하나의 활성 링크 제한을 활용한 단순한 관리 시스템 구축

## 📊 예상 개발 시간

- **Phase 1**: 1-2일
- **Phase 2**: 1일
- **Phase 3**: 1-2일
- **총 예상 시간**: 3-5일

## 🎯 성공 기준

1. **기능적 요구사항**
   - [ ] 학생별 편집 링크 목록 조회 가능
   - [ ] 링크 비활성화/재활성화/삭제 가능
   - [ ] 링크 사용 로그 확인 가능
   - [ ] 기존 편집 기능과 완전 호환

2. **비기능적 요구사항**
   - [ ] 기존 시스템 안정성 유지
   - [ ] 사용자 친화적 UI/UX
   - [ ] 적절한 에러 처리
   - [ ] 보안 고려사항 반영

## 🔄 다음 단계

1. **백엔드 API 구현** - `shareScheduleManagement.ts`에 관리 함수 추가
2. **프론트엔드 서비스 구현** - `editLinkService.ts` 생성
3. **UI 연동** - `EditLinkManagementModal`에 실제 API 연결
4. **테스트 및 검증** - 전체 시스템 통합 테스트

---

*이 계획은 현재 프로젝트의 구조와 요구사항을 기반으로 작성되었으며, 실제 구현 과정에서 세부사항이 조정될 수 있습니다.*
