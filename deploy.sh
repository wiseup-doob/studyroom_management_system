#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로고 출력
echo -e "${BLUE}"
echo "=========================================="
echo "  스터디룸 관리 시스템 배포 스크립트"
echo "=========================================="
echo -e "${NC}"

# 1단계: 환경 선택
echo -e "${YELLOW}1단계: 배포 환경을 선택하세요${NC}"
echo "1) 테스트 환경 (studyroommanagementsystemtest)"
echo "2) 프로덕션 환경 (studyroommanagementsyste-7a6c6)"
echo "3) 배포 취소"
echo ""

read -p "선택 (1-3): " env_choice

case $env_choice in
    1)
        ENV="test"
        PROJECT_ID="studyroommanagementsystemtest"
        ENV_FILE=".env.test"
        echo -e "${GREEN}테스트 환경을 선택했습니다.${NC}"
        ;;
    2)
        ENV="production"
        PROJECT_ID="studyroommanagementsyste-7a6c6"
        ENV_FILE=".env.production"
        echo -e "${GREEN}프로덕션 환경을 선택했습니다.${NC}"
        ;;
    3)
        echo -e "${RED}배포를 취소했습니다.${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}잘못된 선택입니다. 1-3 중에서 선택해주세요.${NC}"
        exit 1
        ;;
esac

# 환경 변수 파일 존재 확인
if [ ! -f "frontend/$ENV_FILE" ]; then
    echo -e "${RED}환경 변수 파일이 존재하지 않습니다: frontend/$ENV_FILE${NC}"
    echo -e "${YELLOW}환경 변수 파일을 생성하시겠습니까? (y/n)${NC}"
    read -p "선택: " create_env
    
    if [ "$create_env" = "y" ] || [ "$create_env" = "Y" ]; then
        echo -e "${YELLOW}환경 변수 파일을 생성합니다...${NC}"
        cp frontend/.env.local "frontend/$ENV_FILE"
        echo -e "${GREEN}환경 변수 파일이 생성되었습니다: frontend/$ENV_FILE${NC}"
        echo -e "${YELLOW}파일을 수정한 후 다시 실행해주세요.${NC}"
        exit 0
    else
        echo -e "${RED}환경 변수 파일이 필요합니다. 배포를 중단합니다.${NC}"
        exit 1
    fi
fi

# BASE_URL 읽기
BASE_URL=$(grep "^VITE_BASE_URL=" "frontend/$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
if [ -z "$BASE_URL" ]; then
    echo -e "${YELLOW}BASE_URL이 설정되지 않았습니다. 기본값을 사용합니다.${NC}"
    BASE_URL="https://$PROJECT_ID.web.app"
fi

echo -e "${GREEN}BASE_URL: $BASE_URL${NC}"

# 2단계: 빌드
echo -e "${YELLOW}2단계: 프론트엔드 빌드를 시작합니다...${NC}"
echo -e "${BLUE}환경: $ENV${NC}"
echo -e "${BLUE}프로젝트: $PROJECT_ID${NC}"
echo -e "${BLUE}BASE_URL: $BASE_URL${NC}"
echo ""

# 환경 변수 파일을 .env.local로 복사
cp "frontend/$ENV_FILE" "frontend/.env.local"

# 프론트엔드 디렉토리로 이동
cd frontend

# 의존성 설치
echo -e "${YELLOW}의존성을 설치합니다...${NC}"
npm install

# 빌드 실행 (환경 변수 명시적 지정)
echo -e "${YELLOW}빌드를 실행합니다...${NC}"
echo -e "${BLUE}환경 변수 파일: $ENV_FILE${NC}"

# 환경 변수를 명시적으로 로드하여 빌드
if [ "$ENV" = "test" ]; then
    echo -e "${BLUE}테스트 환경 변수로 빌드합니다...${NC}"
    VITE_FIREBASE_API_KEY=$(grep "^VITE_FIREBASE_API_KEY=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    VITE_FIREBASE_AUTH_DOMAIN=$(grep "^VITE_FIREBASE_AUTH_DOMAIN=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    VITE_FIREBASE_PROJECT_ID=$(grep "^VITE_FIREBASE_PROJECT_ID=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    VITE_FIREBASE_STORAGE_BUCKET=$(grep "^VITE_FIREBASE_STORAGE_BUCKET=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    VITE_FIREBASE_MESSAGING_SENDER_ID=$(grep "^VITE_FIREBASE_MESSAGING_SENDER_ID=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    VITE_FIREBASE_APP_ID=$(grep "^VITE_FIREBASE_APP_ID=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    VITE_BASE_URL=$(grep "^VITE_BASE_URL=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    
    echo -e "${BLUE}API Key: ${VITE_FIREBASE_API_KEY:0:20}...${NC}"
    echo -e "${BLUE}Project ID: $VITE_FIREBASE_PROJECT_ID${NC}"
    
    VITE_FIREBASE_API_KEY="$VITE_FIREBASE_API_KEY" \
    VITE_FIREBASE_AUTH_DOMAIN="$VITE_FIREBASE_AUTH_DOMAIN" \
    VITE_FIREBASE_PROJECT_ID="$VITE_FIREBASE_PROJECT_ID" \
    VITE_FIREBASE_STORAGE_BUCKET="$VITE_FIREBASE_STORAGE_BUCKET" \
    VITE_FIREBASE_MESSAGING_SENDER_ID="$VITE_FIREBASE_MESSAGING_SENDER_ID" \
    VITE_FIREBASE_APP_ID="$VITE_FIREBASE_APP_ID" \
    VITE_BASE_URL="$VITE_BASE_URL" \
    npm run build
else
    echo -e "${BLUE}프로덕션 환경 변수로 빌드합니다...${NC}"
    VITE_FIREBASE_API_KEY=$(grep "^VITE_FIREBASE_API_KEY=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    VITE_FIREBASE_AUTH_DOMAIN=$(grep "^VITE_FIREBASE_AUTH_DOMAIN=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    VITE_FIREBASE_PROJECT_ID=$(grep "^VITE_FIREBASE_PROJECT_ID=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    VITE_FIREBASE_STORAGE_BUCKET=$(grep "^VITE_FIREBASE_STORAGE_BUCKET=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    VITE_FIREBASE_MESSAGING_SENDER_ID=$(grep "^VITE_FIREBASE_MESSAGING_SENDER_ID=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    VITE_FIREBASE_APP_ID=$(grep "^VITE_FIREBASE_APP_ID=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    VITE_BASE_URL=$(grep "^VITE_BASE_URL=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    
    echo -e "${BLUE}API Key: ${VITE_FIREBASE_API_KEY:0:20}...${NC}"
    echo -e "${BLUE}Project ID: $VITE_FIREBASE_PROJECT_ID${NC}"
    
    VITE_FIREBASE_API_KEY="$VITE_FIREBASE_API_KEY" \
    VITE_FIREBASE_AUTH_DOMAIN="$VITE_FIREBASE_AUTH_DOMAIN" \
    VITE_FIREBASE_PROJECT_ID="$VITE_FIREBASE_PROJECT_ID" \
    VITE_FIREBASE_STORAGE_BUCKET="$VITE_FIREBASE_STORAGE_BUCKET" \
    VITE_FIREBASE_MESSAGING_SENDER_ID="$VITE_FIREBASE_MESSAGING_SENDER_ID" \
    VITE_FIREBASE_APP_ID="$VITE_FIREBASE_APP_ID" \
    VITE_BASE_URL="$VITE_BASE_URL" \
    npm run build
fi

# 빌드 성공 확인
if [ $? -eq 0 ]; then
    echo -e "${GREEN}빌드가 성공적으로 완료되었습니다!${NC}"
else
    echo -e "${RED}빌드에 실패했습니다.${NC}"
    exit 1
fi

# 루트 디렉토리로 돌아가기
cd ..

# 배포 함수들
deploy_full() {
    echo -e "${YELLOW}Firebase 프로젝트를 $PROJECT_ID 로 변경합니다...${NC}"
    firebase use $PROJECT_ID
    
    echo -e "${YELLOW}전체 배포를 시작합니다...${NC}"
    firebase deploy
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}전체 배포가 성공적으로 완료되었습니다!${NC}"
        echo -e "${BLUE}배포 URL: https://$PROJECT_ID.web.app${NC}"
    else
        echo -e "${RED}배포에 실패했습니다.${NC}"
        exit 1
    fi
}

deploy_frontend() {
    echo -e "${YELLOW}Firebase 프로젝트를 $PROJECT_ID 로 변경합니다...${NC}"
    firebase use $PROJECT_ID
    
    echo -e "${YELLOW}프론트엔드 배포를 시작합니다...${NC}"
    firebase deploy --only hosting
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}프론트엔드 배포가 성공적으로 완료되었습니다!${NC}"
        echo -e "${BLUE}배포 URL: https://$PROJECT_ID.web.app${NC}"
    else
        echo -e "${RED}배포에 실패했습니다.${NC}"
        exit 1
    fi
}

deploy_backend() {
    echo -e "${YELLOW}Firebase 프로젝트를 $PROJECT_ID 로 변경합니다...${NC}"
    firebase use $PROJECT_ID
    
    echo -e "${YELLOW}백엔드 배포를 시작합니다...${NC}"
    firebase deploy --only functions,firestore
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}백엔드 배포가 성공적으로 완료되었습니다!${NC}"
    else
        echo -e "${RED}배포에 실패했습니다.${NC}"
        exit 1
    fi
}

# 3단계: 배포 선택
echo ""
echo -e "${YELLOW}3단계: 배포 옵션을 선택하세요${NC}"
echo "1) 전체 배포 (프론트엔드 + 백엔드)"
echo "2) 프론트엔드만 배포"
echo "3) 백엔드만 배포"
echo "4) 배포 취소"
echo ""

read -p "선택 (1-4): " deploy_choice

case $deploy_choice in
    1)
        echo -e "${GREEN}전체 배포를 시작합니다...${NC}"
        deploy_full
        ;;
    2)
        echo -e "${GREEN}프론트엔드만 배포를 시작합니다...${NC}"
        deploy_frontend
        ;;
    3)
        echo -e "${GREEN}백엔드만 배포를 시작합니다...${NC}"
        deploy_backend
        ;;
    4)
        echo -e "${RED}배포를 취소했습니다.${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}잘못된 선택입니다. 1-4 중에서 선택해주세요.${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}배포 스크립트가 완료되었습니다!${NC}"
