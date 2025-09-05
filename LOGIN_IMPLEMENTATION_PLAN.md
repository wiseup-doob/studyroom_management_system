# WiseUp 관리 시스템 로그인 기능 구현 계획

## 📋 개요

DATABASE_DESIGN.md를 기반으로 멀티테넌트 아키텍처에 맞는 로그인 기능 구현 계획입니다.

**멀티테넌트 로그인 시스템**으로, 사용자가 로그인하면 자동으로 해당하는 학원(`academyId`)과 역할(`admin`, `student`)을 식별하여 적절한 대시보드로 리다이렉트하는 구조입니다.

## 🏗️ 아키텍처 설계

### 1. 사용자 역할 및 권한 구조

```
Firebase Auth (이메일/비밀번호)
├── 학생 (Student)
│   ├── academyId: "academy_001"
│   ├── role: "student"
│   └── 접근: 해당 학원의 학생 기능만
├── 관리자 (Admin)
│   ├── academyId: "academy_001" 
│   ├── role: "admin"
│   └── 접근: 해당 학원의 모든 기능
└── 슈퍼 관리자 (Super Admin)
    ├── academyId: "system"
    ├── role: "super_admin"
    └── 접근: 시스템 전체 관리
```

### 2. 데이터 흐름

```
1. 사용자 로그인 (이메일/비밀번호)
2. Firebase Auth 인증
3. 커스텀 클레임 확인 (academyId, role)
4. 사용자 정보 조회 (students 또는 admins 컬렉션)
5. 역할별 대시보드 리다이렉트
```

## 🚀 구현 단계별 계획

### Phase 1: 기본 인증 시스템 구축

#### 1.1 Firebase Auth 설정
- 이메일/비밀번호 인증 활성화
- 커스텀 클레임 설정을 위한 Admin SDK 구성
- 인증 상태 관리 (AuthContext)

#### 1.2 사용자 타입 정의
```typescript
// types/auth.ts
interface UserProfile {
  uid: string;
  email: string;
  academyId: string;
  role: 'student' | 'admin' | 'super_admin';
  name: string;
  isActive: boolean;
}

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  academyId: string | null;
  role: string | null;
}
```

#### 1.3 로그인 컴포넌트
- 이메일/비밀번호 입력 폼
- 로그인 상태 표시
- 에러 처리 및 유효성 검사

### Phase 2: 멀티테넌트 인증 로직

#### 2.1 커스텀 클레임 기반 인증
```typescript
// services/authService.ts
class AuthService {
  async login(email: string, password: string): Promise<UserProfile>
  async logout(): Promise<void>
  async getCurrentUser(): Promise<UserProfile | null>
  async getIdTokenClaims(): Promise<{academyId: string, role: string}>
  // checkUserRole은 제거 - 클레임에서 직접 읽기
}
```

#### 2.2 사용자 정보 조회
- ID 토큰에서 `academyId`와 `role` 클레임을 직접 읽기
- 읽어온 `academyId`로 `students` 또는 `admins` 컬렉션에서 사용자 정보 조회
- 활성 상태(`isActive`) 검증

#### 2.3 권한 기반 라우팅
```typescript
// components/ProtectedRoute.tsx
- 학생: /student/dashboard
- 관리자: /admin/dashboard  
- 슈퍼 관리자: /super-admin/dashboard
```

### Phase 3: 보안 및 데이터 접근 제어

#### 3.1 Firestore 보안 규칙 적용
- `academyId` 기반 데이터 격리
- 역할별 접근 권한 제어
- 실시간 보안 규칙 테스트

#### 3.2 API 서비스 계층
```typescript
// services/apiService.ts
class ApiService {
  private academyId: string;
  private role: string;
  
  // academyId 자동 주입
  async getStudents(): Promise<Student[]>
  async getAttendanceRecords(): Promise<AttendanceRecord[]>
  // ... 기타 API 메서드들
}
```

### Phase 4: UI/UX 구현

#### 4.1 로그인 페이지
- 반응형 디자인
- 로딩 상태 표시
- 에러 메시지 표시
- "비밀번호 찾기" 기능

#### 4.2 역할별 대시보드
- **학생 대시보드**: 출석체크, 시간표 조회
- **관리자 대시보드**: 학생 관리, 통계, 설정
- **슈퍼 관리자 대시보드**: 학원 관리, 관리자 임명

#### 4.3 네비게이션 및 레이아웃
- 역할별 메뉴 구성
- 학원 정보 표시
- 로그아웃 기능

## 🗂️ 파일 구조 계획

```
frontend/src/
├── types/
│   ├── auth.ts          // 인증 관련 타입 정의
│   ├── student.ts       // 학생 관련 타입
│   └── admin.ts         // 관리자 관련 타입
├── services/
│   ├── authService.ts   // 인증 서비스
│   ├── apiService.ts    // API 서비스 (academyId 자동 주입)
│   └── firebase.ts      // Firebase 설정
├── context/
│   └── AuthContext.tsx  // 인증 상태 관리
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── ProtectedRoute.tsx
│   └── layout/
│       ├── StudentLayout.tsx
│       ├── AdminLayout.tsx
│       └── SuperAdminLayout.tsx
├── pages/
│   ├── auth/
│   │   └── Login.tsx
│   ├── student/
│   │   └── Dashboard.tsx
│   ├── admin/
│   │   └── Dashboard.tsx
│   └── super-admin/
│       └── Dashboard.tsx
└── hooks/
    └── useAuth.ts       // 인증 관련 커스텀 훅
```

## 🔐 보안 고려사항

### 1. 인증 보안
- Firebase Auth의 기본 보안 기능 활용
- 커스텀 클레임을 통한 역할 기반 접근 제어
- JWT 토큰 자동 갱신

### 2. 데이터 보안
- Firestore 보안 규칙으로 `academyId` 기반 데이터 격리
- 클라이언트에서 민감한 정보 노출 방지
- API 호출 시 자동으로 `academyId` 주입

### 3. 세션 관리
- 자동 로그아웃 (토큰 만료 시)
- 다중 세션 관리
- 보안 로그 기록
- **ID 토큰 변경 감지**: `onIdTokenChanged` 리스너 사용으로 실시간 권한 변경 감지

## 🚀 구현 우선순위

1. **1단계**: 기본 Firebase Auth 설정 및 로그인 폼
2. **2단계**: 커스텀 클레임 기반 인증 로직
3. **3단계**: 역할별 라우팅 및 대시보드
4. **4단계**: 보안 규칙 적용 및 테스트
5. **5단계**: UI/UX 개선 및 에러 처리

## 📊 성능 최적화 계획

- **캐싱**: 사용자 정보 및 학원 설정 캐싱
- **지연 로딩**: 역할별 컴포넌트 지연 로딩
- **상태 관리**: Context API를 통한 효율적인 상태 관리
- **API 최적화**: 필요한 데이터만 조회하는 쿼리 최적화

## 🎯 핵심 기능 상세

### *** 개선 제안: 역할 부여와 로그인을 명확히 분리 ***

#### 역할 부여 프로세스 (관리자 작업)

1. **슈퍼 관리자**가 관리자 페이지에서 특정 사용자에게 역할(예: 강남점 관리자)을 부여합니다.
2. `setCustomClaims` **Cloud Function**이 호출되어 해당 사용자의 커스텀 클레임을 **한 번만 설정**합니다. 예: `{ academyId: "wiseup_gangnam", role: "admin" }`

#### 로그인 프로세스 (사용자 작업)

1. **사용자 입력**
   - 이메일/비밀번호 입력 및 유효성 검사

2. **Firebase 인증**
   - `signInWithEmailAndPassword()` 호출
   - 성공 시 ID 토큰 획득

3. **커스텀 클레임 확인 (클라이언트)**
   - `user.getIdTokenResult()`를 호출하여 ID 토큰에서 `academyId`와 `role` **클레임을 읽습니다.**
   - Cloud Function 호출이 필요 없습니다.

4. **사용자 정보 조회**
   - 읽어온 `academyId`와 `auth.currentUser.uid`를 사용하여 `academies/{academyId}/students/{studentDocId}` 또는 `admins` 컬렉션에서 상세 정보(`name`, `isActive` 등)를 조회합니다.

5. **라우팅**
   - 클레임의 `role`에 따라 적절한 대시보드로 리다이렉트합니다.

### 코드 예시

#### AuthService 구현 (클레임 읽기)
```typescript
// services/authService.ts
import { auth } from './firebase';
import { signInWithEmailAndPassword, onIdTokenChanged } from 'firebase/auth';

class AuthService {
  async login(email: string, password: string): Promise<UserProfile> {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // ID 토큰에서 직접 클레임 정보를 가져옵니다.
    const idTokenResult = await user.getIdTokenResult(true); // true로 강제 갱신
    const claims = idTokenResult.claims;
    
    const academyId = claims.academyId as string;
    const role = claims.role as string;
    
    // 이제 이 academyId와 role을 사용하여 Firestore에서 추가 정보를 가져옵니다.
    const userProfile = await this.getUserProfile(academyId, role, user.uid);
    return userProfile;
  }

  async getUserProfile(academyId: string, role: string, uid: string): Promise<UserProfile> {
    // role에 따라 적절한 컬렉션에서 사용자 정보 조회
    if (role === 'student') {
      // students 컬렉션에서 조회
    } else if (role === 'admin' || role === 'super_admin') {
      // admins 컬렉션에서 조회
    }
    // ... 구현
  }
}
```

#### AuthContext 구현 (ID 토큰 변경 감지)
```typescript
// context/AuthContext.tsx
import { onIdTokenChanged } from 'firebase/auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChanged 대신 onIdTokenChanged 사용
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (user) {
        const idTokenResult = await user.getIdTokenResult();
        const claims = idTokenResult.claims;
        
        // 클레임과 Firestore 정보를 조합하여 UserProfile 생성
        const academyId = claims.academyId as string;
        const role = claims.role as string;
        
        const userProfile = await authService.getUserProfile(academyId, role, user.uid);
        setUserProfile(userProfile);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ... 나머지 구현
};
```

### 에러 처리

- **인증 실패**: 잘못된 이메일/비밀번호
- **계정 비활성화**: `isActive: false` 상태
- **권한 없음**: 해당 학원에 속하지 않는 사용자
- **네트워크 오류**: 연결 실패 시 재시도 옵션

### 로그아웃 프로세스

1. Firebase Auth 로그아웃
2. 커스텀 클레임 초기화
3. 로컬 상태 초기화
4. 로그인 페이지로 리다이렉트

## 📝 구현 체크리스트

### Phase 1 체크리스트
- [ ] Firebase Auth 설정
- [ ] 기본 타입 정의
- [ ] AuthContext 구현
- [ ] 로그인 폼 컴포넌트
- [ ] 기본 라우팅 설정

### Phase 2 체크리스트
- [ ] AuthService 구현
- [ ] 사용자 정보 조회 로직
- [ ] 커스텀 클레임 설정
- [ ] ProtectedRoute 컴포넌트
- [ ] 역할별 라우팅

### Phase 3 체크리스트
- [ ] Firestore 보안 규칙 적용
- [ ] ApiService 구현
- [ ] 데이터 격리 테스트
- [ ] 권한 검증 로직

### Phase 4 체크리스트
- [ ] 역할별 대시보드
- [ ] 네비게이션 메뉴
- [ ] 반응형 디자인
- [ ] 에러 처리 개선
- [ ] 로딩 상태 관리

## 🔄 테스트 계획

### 단위 테스트
- AuthService 메서드 테스트
- 유효성 검사 로직 테스트
- 에러 처리 테스트

### 통합 테스트
- 로그인 플로우 테스트
- 역할별 접근 권한 테스트
- 데이터 격리 테스트

### E2E 테스트
- 전체 사용자 시나리오 테스트
- 다양한 역할의 사용자 테스트
- 에러 시나리오 테스트

## 🎯 전문가 피드백 반영 및 개선사항

이 구현 계획서는 실무 전문가의 피드백을 반영하여 다음과 같이 개선되었습니다:

### ✅ 주요 개선사항

1. **로그인 프로세스 최적화**
   - **기존**: 로그인 시마다 Cloud Function 호출하여 커스텀 클레임 설정
   - **개선**: ID 토큰에서 직접 클레임 읽기로 성능 및 비용 최적화

2. **역할 부여와 로그인 분리**
   - **역할 부여**: 관리자가 특별한 경우에만 Cloud Function으로 클레임 설정
   - **로그인**: 사용자는 이미 설정된 클레임을 읽기만 수행

3. **인증 상태 동기화 개선**
   - **기존**: `onAuthStateChanged` 사용
   - **개선**: `onIdTokenChanged` 사용으로 실시간 권한 변경 감지

4. **보안 강화**
   - 커스텀 클레임 설정을 관리자 권한으로 제한
   - 클라이언트에서 직접 클레임 읽기로 보안 위험 감소

### 🚀 성능 및 비용 개선 효과

- **성능 향상**: 로그인 시 Cloud Function 호출 제거로 응답 시간 단축
- **비용 절감**: 빈번한 로그인 작업에서 불필요한 Function 호출 제거
- **보안 강화**: 민감한 클레임 설정 작업을 관리자 권한으로 격리
- **실시간 동기화**: ID 토큰 변경 시 즉시 권한 상태 반영

### 💡 핵심 아키텍처 원칙

1. **역할 부여는 관리자 작업**: 커스텀 클레임 설정은 특별한 경우에만
2. **로그인은 클레임 읽기**: 사용자는 이미 설정된 클레임을 읽기만
3. **실시간 권한 감지**: `onIdTokenChanged`로 토큰 변경 시 즉시 반영
4. **성능 우선**: 불필요한 서버 호출 최소화

---

**참고**: 이 계획은 DATABASE_DESIGN.md의 멀티테넌트 아키텍처를 기반으로 하며, 실무 전문가의 피드백을 반영한 개선된 버전입니다. 실제 구현 과정에서 요구사항에 따라 추가 수정될 수 있습니다.
