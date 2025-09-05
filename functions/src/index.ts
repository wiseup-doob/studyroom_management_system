/**
 * WiseUp 관리 시스템 - Firebase Cloud Functions
 *
 * 멀티테넌트 아키텍처를 지원하는 백엔드 함수들
 * - 사용자 관리 (등록, 역할 부여)
 * - 학원 관리 (생성, 설정)
 * - 보안 및 권한 관리
 */

import * as admin from "firebase-admin";

// Firebase Admin SDK 초기화
admin.initializeApp();

// ==================== 사용자 관리 함수 ====================
export {
  setUserRoleFunction as setUserRole,
  createUserFunction as createUser,
  getUsersFunction as getUsers,
} from "./modules/user/userFunctions";

// ==================== 학원 관리 함수 ====================
export {
  createAcademyFunction as createAcademy,
  createTestDataFunction as createTestData,
} from "./modules/academy/academyFunctions";
