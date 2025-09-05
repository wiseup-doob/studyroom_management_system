# 스터디룸 관리 시스템

Vite + React + TypeScript + Firebase를 사용한 스터디룸 관리 시스템입니다.

## 🚀 프로젝트 구조

```
studyroom_managment_system/
├── frontend/                    # React 프론트엔드
│   ├── src/
│   │   ├── components/          # 재사용 가능한 컴포넌트
│   │   ├── pages/               # 페이지 컴포넌트
│   │   ├── services/            # Firebase 서비스
│   │   ├── context/             # React Context
│   │   ├── types/               # TypeScript 타입 정의
│   │   └── utils/               # 유틸리티 함수
│   ├── .env.local               # 로컬 환경 변수
│   ├── .env.test                # 테스트 환경 변수
│   ├── .env.production          # 프로덕션 환경 변수
│   └── package.json
├── functions/                   # Firebase Cloud Functions
├── firebase.json                # Firebase 설정
├── firestore.rules              # Firestore 보안 규칙
└── deploy.sh                    # 배포 스크립트
```

## 🛠️ 기술 스택

- **Frontend**: Vite + React + TypeScript
- **Backend**: Firebase (Authentication, Firestore, Functions, Hosting)
- **Styling**: CSS Modules
- **Deployment**: Firebase CLI

## 📋 사전 요구사항

- Node.js 18+ 
- npm 또는 yarn
- Firebase CLI
- Firebase 프로젝트

## 🚀 설치 및 실행

### 1. 프로젝트 클론 및 의존성 설치

```bash
git clone <repository-url>
cd studyroom_managment_system

# 프론트엔드 의존성 설치
cd frontend
npm install
cd ..

# Firebase Functions 의존성 설치
cd functions
npm install
cd ..
```

### 2. Firebase 설정

1. Firebase Console에서 프로젝트 생성
2. Authentication, Firestore, Functions, Hosting 활성화
3. 환경 변수 파일 설정

### 3. 환경 변수 설정

각 환경별로 환경 변수 파일을 설정합니다:

#### `.env.local` (로컬 개발용)
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_APP_NAME=스터디룸 관리 시스템
VITE_APP_VERSION=1.0.0
VITE_BASE_URL=http://localhost:3000
```

#### `.env.test` (테스트 환경)
```env
VITE_FIREBASE_API_KEY=your_test_api_key
VITE_FIREBASE_AUTH_DOMAIN=studyroommanagementsystemtest.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=studyroommanagementsystemtest
VITE_FIREBASE_STORAGE_BUCKET=studyroommanagementsystemtest.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_test_sender_id
VITE_FIREBASE_APP_ID=your_test_app_id
VITE_APP_NAME=스터디룸 관리 시스템 (테스트)
VITE_APP_VERSION=1.0.0
VITE_BASE_URL=https://studyroommanagementsystemtest.web.app
```

#### `.env.production` (프로덕션 환경)
```env
VITE_FIREBASE_API_KEY=your_production_api_key
VITE_FIREBASE_AUTH_DOMAIN=studyroommanagementsyste-7a6c6.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=studyroommanagementsyste-7a6c6
VITE_FIREBASE_STORAGE_BUCKET=studyroommanagementsyste-7a6c6.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_production_sender_id
VITE_FIREBASE_APP_ID=your_production_app_id
VITE_APP_NAME=스터디룸 관리 시스템
VITE_APP_VERSION=1.0.0
VITE_BASE_URL=https://studyroommanagementsyste-7a6c6.web.app
```

### 4. 개발 서버 실행

```bash
# 프론트엔드 개발 서버
cd frontend
npm run dev

# Firebase 에뮬레이터 (별도 터미널)
firebase emulators:start
```

## 🚀 배포

### 자동 배포 스크립트 사용

```bash
./deploy.sh
```

배포 스크립트는 다음 단계를 거칩니다:

1. **환경 선택**: 테스트 또는 프로덕션 환경 선택
2. **빌드**: 선택된 환경의 설정으로 프론트엔드 빌드
3. **배포 옵션 선택**:
   - 전체 배포 (프론트엔드 + 백엔드)
   - 프론트엔드만 배포
   - 백엔드만 배포
   - 배포 취소

### 수동 배포

```bash
# 프론트엔드 빌드
cd frontend
npm run build
cd ..

# Firebase 프로젝트 선택
firebase use studyroommanagementsyste-7a6c6  # 프로덕션
# 또는
firebase use studyroommanagementsystemtest   # 테스트

# 배포
firebase deploy                    # 전체 배포
firebase deploy --only hosting    # 프론트엔드만
firebase deploy --only functions  # 백엔드만
```

## 🔧 개발 도구

### TypeScript

- 엄격한 타입 체크 활성화
- 경로 별칭 지원 (`@/*`)
- Firebase 타입 정의 포함

### ESLint

```bash
cd frontend
npm run lint
```

### 빌드

```bash
cd frontend
npm run build
npm run preview
```

## 📁 주요 디렉토리

- `frontend/src/components/`: 재사용 가능한 React 컴포넌트
- `frontend/src/pages/`: 페이지 컴포넌트
- `frontend/src/services/`: Firebase 서비스 로직
- `frontend/src/types/`: TypeScript 타입 정의
- `functions/src/`: Firebase Cloud Functions

## 🔐 보안

- Firestore 보안 규칙 설정
- 환경 변수를 통한 민감한 정보 관리
- Firebase Authentication을 통한 사용자 인증

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다.

## 🤝 기여

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
# studyroom_management_system
