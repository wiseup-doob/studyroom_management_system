// 라우트 경로 상수 정의
export const ROUTES = {
  // 공통 경로
  ROOT: '/',
  LOGIN: '/login',
  PENDING_PERMISSION: '/pending-permission',
  
  // 메인 레이아웃 경로
  MAIN: '/main',
  HOME: '/main',
  ATTENDANCE: '/main/attendance',
  STUDENTS: '/main/students',
  ADMIN_DASHBOARD: '/main/admin/dashboard',
} as const;

// 라우트 메타데이터
export const ROUTE_META = {
  [ROUTES.LOGIN]: {
    title: '로그인',
    requiresAuth: false,
  },
  [ROUTES.PENDING_PERMISSION]: {
    title: '권한 대기',
    requiresAuth: true,
  },
  [ROUTES.HOME]: {
    title: '홈',
    requiresAuth: true,
  },
  [ROUTES.ATTENDANCE]: {
    title: '출석 관리',
    requiresAuth: true,
  },
  [ROUTES.STUDENTS]: {
    title: '학생 관리',
    requiresAuth: true,
  },
  [ROUTES.ADMIN_DASHBOARD]: {
    title: '관리자 대시보드',
    requiresAuth: true,
    requiresAdmin: true,
  },
} as const;

// 사이드바 메뉴 아이템
export const SIDEBAR_MENU_ITEMS = [
  {
    id: 'home',
    label: '홈',
    path: ROUTES.HOME,
    icon: '🏠'
  },
  {
    id: 'attendance',
    label: '출결 관리',
    path: ROUTES.ATTENDANCE,
    icon: '📋'
  },
  {
    id: 'students',
    label: '원생 관리',
    path: ROUTES.STUDENTS,
    icon: '👥'
  },
  {
    id: 'admin',
    label: '관리자 대시보드',
    path: ROUTES.ADMIN_DASHBOARD,
    icon: '⚙️'
  }
] as const;
