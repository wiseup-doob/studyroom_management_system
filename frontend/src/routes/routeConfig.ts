// 라우트 경로 상수 정의
export const ROUTES = {
  // 공통 경로
  ROOT: '/',
  LOGIN: '/login',
  HOME: '/home',
  STUDENT: '/student',
  TIMETABLE: '/timetable',
  ATTENDANCE: '/attendance',
} as const;

// 라우트 메타데이터
export const ROUTE_META = {
  [ROUTES.LOGIN]: {
    title: '로그인',
    requiresAuth: false,
  },
  [ROUTES.HOME]: {
    title: '홈',
    requiresAuth: true,
  },
  [ROUTES.STUDENT]: {
    title: '학생 관리',
    requiresAuth: true,
  },
  [ROUTES.TIMETABLE]: {
    title: '시간표',
    requiresAuth: true,
  },
} as const;
