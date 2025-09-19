/**
 * 개인 사용자 기반 데이터 관리 모듈
 *
 * DATABASE_DESIGN.md에 따른 사용자 기반 격리 아키텍처
 * - 각 사용자는 자신의 데이터에만 접근 가능
 * - Google 인증 기반 권한 관리
 * - 완전한 데이터 격리
 */

export * from "./userProfile";
export * from "./attendanceManagement";
export * from "./timetableManagement";
export * from "./shareScheduleManagement";
export * from "./seatManagement";
export * from "./settingsManagement";
export * from "./studentManagement";
