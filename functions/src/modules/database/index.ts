/**
 * 데이터베이스 모듈 - 통합 익스포트
 * 
 * DATABASE_DESIGN.md를 기반으로 구현된 모듈식 데이터베이스 서비스들
 * 멀티테넌트 아키텍처를 지원하며, academyId별로 완전히 격리된 데이터 접근 제공
 */

// === 핵심 서비스 ===
export { DatabaseService } from './core/DatabaseService';
export { DatabaseManager, createDatabaseManager, validateAcademyId } from './DatabaseManager';

// === 개별 컬렉션 서비스들 ===
export { StudentService } from './services/StudentService';
export { AttendanceService } from './services/AttendanceService';
export { SeatService, SeatLayoutService, SeatAssignmentService } from './services/SeatService';
export { ClassService, StudentTimetableService } from './services/ClassService';
export { ParentService } from './services/ParentService';

// === 타입 정의 ===
export * from '../../types/database';

// === 유틸리티 함수들 ===

/**
 * 현재 날짜를 YYYY-MM-DD 형태로 반환
 */
export function getCurrentDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 날짜 범위 생성 (출석 통계 등에 사용)
 */
export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  
  return dates;
}

/**
 * 요일 한국어 변환
 */
export function getDayOfWeekKorean(dayOfWeek: string): string {
  const dayMap: Record<string, string> = {
    'monday': '월',
    'tuesday': '화',
    'wednesday': '수',
    'thursday': '목',
    'friday': '금',
    'saturday': '토',
    'sunday': '일'
  };
  return dayMap[dayOfWeek] || dayOfWeek;
}

/**
 * 시간 형식 검증 (HH:MM)
 */
export function validateTimeFormat(time: string): boolean {
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

/**
 * 좌석 번호 형식 검증 (예: A-15, B-01)
 */
export function validateSeatNumber(seatNumber: string): boolean {
  return /^[A-Z]{1,2}-\d{1,3}$/.test(seatNumber);
}

/**
 * 학년 리스트 반환
 */
export function getGradeList(): string[] {
  return ['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
}

/**
 * 전화번호 형식 검증
 */
export function validatePhoneNumber(phone: string): boolean {
  return /^01[0-9]-?\d{3,4}-?\d{4}$/.test(phone);
}

/**
 * 이메일 형식 검증
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// === 상수 정의 ===

/**
 * 데이터베이스 컬렉션 이름들
 */
export const COLLECTION_NAMES = {
  STUDENTS: 'students',
  PARENTS: 'parents',
  ATTENDANCE_RECORDS: 'attendance_records',
  CLASS_SECTIONS: 'class_sections',
  STUDENT_TIMETABLES: 'student_timetables',
  SEATS: 'seats',
  SEAT_ASSIGNMENTS: 'seat_assignments',
  SEAT_LAYOUTS: 'seat_layouts',
  ADMINS: 'admins'
} as const;

/**
 * 출석 상태 리스트
 */
export const ATTENDANCE_STATUSES = {
  PRESENT: 'present',
  DISMISSED: 'dismissed',
  UNAUTHORIZED_ABSENT: 'unauthorized_absent',
  AUTHORIZED_ABSENT: 'authorized_absent',
  NOT_ENROLLED: 'not_enrolled'
} as const;

/**
 * 좌석 상태 리스트
 */
export const SEAT_STATUSES = {
  VACANT: 'vacant',
  OCCUPIED: 'occupied',
  UNAVAILABLE: 'unavailable'
} as const;

/**
 * 요일 리스트
 */
export const DAYS_OF_WEEK = {
  MONDAY: 'monday',
  TUESDAY: 'tuesday',
  WEDNESDAY: 'wednesday',
  THURSDAY: 'thursday',
  FRIDAY: 'friday',
  SATURDAY: 'saturday',
  SUNDAY: 'sunday'
} as const;

/**
 * 기본 페이지네이션 설정
 */
export const DEFAULT_PAGINATION = {
  LIMIT: 50,
  MAX_LIMIT: 500
} as const;