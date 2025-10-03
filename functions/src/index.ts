/**
 * WiseUp 관리 시스템 - Firebase Cloud Functions
 *
 * 사용자 기반 격리 아키텍처 (DATABASE_DESIGN.md 준수)
 * - Google 인증 기반 개인 데이터 관리
 * - 완전한 데이터 격리 (각 사용자별 독립 공간)
 * - 고급 시간표 관리 (2레이어 구조)
 * - 시간표 링크 공유 및 협업 기능
 */

import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";

// Firebase Admin SDK 초기화
admin.initializeApp();

// 전역 리전 설정
setGlobalOptions({
  region: "asia-northeast3"
});

// ==================== 개인 사용자 관리 함수 ====================

// 사용자 프로필 관리
export {
  createOrUpdateUserProfile,
  getUserProfile,
  deactivateUserProfile,
  deleteUserProfile,
  restoreUserProfile,
  getUserDataStats,
  createUserDataBackup,
} from "./modules/personal/userProfile";

// 출석 관리
export {
  checkIn,
  checkOut,
  getAttendanceRecords,
  updateAttendanceSummary,
} from "./modules/personal/attendanceManagement";

// 시간표 관리 (고급 2레이어 구조)
// 시간표 관리 기능은 studentTimetableManagement.ts에서 처리

// 시간표 공유 및 협업 기능
export {
  createShareLink,
  getSharedSchedule,
  contributeSchedule,
  processContribution,
  manageShareLink,
  // 학생 시간표 편집 링크 관련 함수들
  createStudentTimetableEditLink,
  getSharedTimetableData,
  getEditState,
  updateEditState,
  submitTimetableEdit,
  // 편집 잠금 관리 함수들
  createTimetableEditLock,
  releaseTimetableEditLock,
  getTimetableEditLock,
  updateEditLockActivity,
  // 편집 링크 관리 함수들
  getStudentEditLinks,
  deactivateEditLink,
  activateEditLink,
  deleteEditLink,
  getEditLinkLogs,
  recordEditLinkUsage,
} from "./modules/personal/shareScheduleManagement";

// 좌석 관리
export {
  createSeat,
  getSeats,
  assignSeat,
  unassignSeat,
  createSeatLayout,
  getSeatLayouts,
  getCurrentSeatAssignment,
} from "./modules/personal/seatManagement";

// 설정 관리
export {
  getSettings,
  updateSettings,
  updateNotificationSettings,
  updateTheme,
  updateLanguage,
  resetSettings,
} from "./modules/personal/settingsManagement";

// 학생 관리
export {
  createStudent,
  getStudents,
  getStudent,
  updateStudent,
  deleteStudent,
  searchStudents,
  getStudentsWithTimetables,
  getStudentWithTimetable,
} from "./modules/personal/studentManagement";

// 학생별 시간표 관리
export {
  createStudentTimetable,
  getStudentTimetables,
  updateStudentTimetable,
  deleteStudentTimetable,
  setActiveStudentTimetable,
  autoFillStudentTimetable,
} from "./modules/personal/studentTimetableManagement";
