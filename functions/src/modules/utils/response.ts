/**
 * 응답 유틸리티 함수들
 */

import {ApiResponse, UserResponse, UsersListResponse, AcademyResponse, TestDataResponse} from "../../types";

/**
 * 성공 응답 생성
 */
export function createSuccessResponse<T>(data?: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
  };
}

/**
 * 사용자 생성 성공 응답
 */
export function createUserResponse(
  uid: string,
  email: string,
  customClaims: any,
  message = "사용자가 성공적으로 생성되었습니다."
): UserResponse {
  return {
    success: true,
    uid,
    email,
    customClaims,
    message,
  };
}

/**
 * 사용자 목록 응답
 */
export function createUsersListResponse(users: any[]): UsersListResponse {
  return {
    success: true,
    users,
    count: users.length,
  };
}

/**
 * 학원 생성 성공 응답
 */
export function createAcademyResponse(
  academyId: string,
  message = "학원이 성공적으로 생성되었습니다."
): AcademyResponse {
  return {
    success: true,
    academyId,
    message,
  };
}

/**
 * 테스트 데이터 생성 성공 응답
 */
export function createTestDataResponse(
  studentsCount: number,
  adminsCount: number,
  message = "테스트 데이터가 생성되었습니다."
): TestDataResponse {
  return {
    success: true,
    message,
    studentsCount,
    adminsCount,
  };
}
