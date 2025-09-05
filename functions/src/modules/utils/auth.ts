/**
 * 인증 관련 유틸리티 함수들
 */

import {HttpsError, CallableRequest} from "firebase-functions/v2/https";

/**
 * 슈퍼 관리자 권한 검증
 */
export function validateSuperAdmin(request: CallableRequest): void {
  if (!request.auth || !request.auth.token.super_admin) {
    throw new HttpsError("permission-denied", "슈퍼 관리자 권한이 필요합니다.");
  }
}

/**
 * 관리자 권한 검증 (슈퍼 관리자 또는 해당 학원 관리자)
 */
export function validateAdmin(request: CallableRequest, academyId?: string): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const token = request.auth.token;

  // 슈퍼 관리자는 모든 권한
  if (token.super_admin) {
    return;
  }

  // 일반 관리자는 자신의 학원만 접근 가능
  if (token.admin && token.academyId) {
    if (academyId && token.academyId !== academyId) {
      throw new HttpsError("permission-denied", "해당 학원에 대한 권한이 없습니다.");
    }
    return;
  }

  throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
}

/**
 * 학생 권한 검증
 */
export function validateStudent(request: CallableRequest, academyId?: string): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }

  const token = request.auth.token;

  // 슈퍼 관리자와 관리자는 학생 데이터에 접근 가능
  if (token.super_admin || token.admin) {
    return;
  }

  // 학생은 자신의 학원 데이터만 접근 가능
  if (token.student && token.academyId) {
    if (academyId && token.academyId !== academyId) {
      throw new HttpsError("permission-denied", "해당 학원에 대한 권한이 없습니다.");
    }
    return;
  }

  throw new HttpsError("permission-denied", "학생 권한이 필요합니다.");
}

/**
 * 커스텀 클레임 생성
 */
export function createCustomClaims(
  academyId: string,
  role: "student" | "admin" | "super_admin"
): any {
  const customClaims: any = {
    academyId,
    role,
    [role]: true,
  };

  // 슈퍼 관리자의 경우 추가 클레임 설정
  if (role === "super_admin") {
    customClaims.super_admin = true;
  }

  return customClaims;
}

/**
 * 현재 사용자의 학원 ID 가져오기
 */
export function getCurrentUserAcademyId(request: CallableRequest): string {
  if (!request.auth || !request.auth.token.academyId) {
    throw new HttpsError("unauthenticated", "사용자 정보를 찾을 수 없습니다.");
  }
  return request.auth.token.academyId as string;
}

/**
 * 현재 사용자의 역할 가져오기
 */
export function getCurrentUserRole(request: CallableRequest): string {
  if (!request.auth || !request.auth.token.role) {
    throw new HttpsError("unauthenticated", "사용자 정보를 찾을 수 없습니다.");
  }
  return request.auth.token.role as string;
}
