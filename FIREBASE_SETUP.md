# Firebase 설정 가이드

## 🔧 실제 Firebase 설정 값 가져오기

### 1. Firebase Console 접속
- [Firebase Console](https://console.firebase.google.com/)에 접속
- `StudyroomManagementSystem` 프로젝트 선택

### 2. 웹 앱 등록 (아직 등록되지 않은 경우)

#### 프로덕션 프로젝트 (studyroommanagementsyste-7a6c6)
1. 프로젝트 개요에서 웹 아이콘(</>) 클릭
2. 앱 닉네임: `studyroom-frontend-prod`
3. "Firebase Hosting도 설정" 체크
4. "앱 등록" 클릭

#### 테스트 프로젝트 (studyroommanagementsystemtest)
1. 프로젝트 전환: `firebase use studyroommanagementsystemtest`
2. 프로젝트 개요에서 웹 아이콘(</>) 클릭
3. 앱 닉네임: `studyroom-frontend-test`
4. "Firebase Hosting도 설정" 체크
5. "앱 등록" 클릭

### 3. Firebase 설정 값 복사

앱 등록 후 나타나는 설정 값을 복사합니다:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyB...", // 실제 API 키
  authDomain: "studyroommanagementsyste-7a6c6.firebaseapp.com",
  projectId: "studyroommanagementsyste-7a6c6",
  storageBucket: "studyroommanagementsyste-7a6c6.appspot.com",
  messagingSenderId: "760316157374",
  appId: "1:760316157374:web:abc123..." // 실제 앱 ID
};
```

### 4. 환경 변수 파일 업데이트

#### 프로덕션 환경 (.env.production)
```env
VITE_FIREBASE_API_KEY=실제_API_키
VITE_FIREBASE_AUTH_DOMAIN=studyroommanagementsyste-7a6c6.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=studyroommanagementsyste-7a6c6
VITE_FIREBASE_STORAGE_BUCKET=studyroommanagementsyste-7a6c6.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=760316157374
VITE_FIREBASE_APP_ID=실제_앱_ID
```

#### 테스트 환경 (.env.test)
```env
VITE_FIREBASE_API_KEY=테스트_실제_API_키
VITE_FIREBASE_AUTH_DOMAIN=studyroommanagementsystemtest.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=studyroommanagementsystemtest
VITE_FIREBASE_STORAGE_BUCKET=studyroommanagementsystemtest.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=330690280180
VITE_FIREBASE_APP_ID=테스트_실제_앱_ID
```

### 5. 서비스 활성화

#### Authentication 설정
1. 좌측 메뉴에서 "Authentication" 클릭
2. "시작하기" 클릭
3. "Sign-in method" 탭에서 "이메일/비밀번호" 활성화

#### Firestore Database 설정
1. 좌측 메뉴에서 "Firestore Database" 클릭
2. "데이터베이스 만들기" 클릭
3. 보안 규칙: "테스트 모드에서 시작" 선택
4. 위치: `asia-northeast3` (서울) 선택

#### Storage 설정 (선택사항)
1. 좌측 메뉴에서 "Storage" 클릭
2. "시작하기" 클릭
3. 보안 규칙: "테스트 모드에서 시작" 선택

### 6. 설정 확인

```bash
# 개발 서버 실행하여 연결 테스트
cd frontend
npm run dev
```

브라우저에서 `http://localhost:3000`에 접속하여 Firebase 연결이 정상적으로 작동하는지 확인합니다.

## ⚠️ 주의사항

1. **API 키 보안**: API 키는 공개되어도 상대적으로 안전하지만, 민감한 정보는 환경 변수로 관리
2. **보안 규칙**: 프로덕션 배포 전에 Firestore 보안 규칙을 적절히 설정
3. **환경 분리**: 테스트와 프로덕션 환경을 명확히 분리하여 사용

## 🔗 유용한 링크

- [Firebase Console](https://console.firebase.google.com/)
- [Firebase 문서](https://firebase.google.com/docs)
- [Firebase 보안 규칙](https://firebase.google.com/docs/firestore/security/get-started)
