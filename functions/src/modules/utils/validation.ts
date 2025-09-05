/**
 * 유효성 검사 유틸리티 함수들
 */

import {HttpsError} from "firebase-functions/v2/https";

/**
 * 필수 필드 검증
 */
export function validateRequiredFields(data: any, requiredFields: string[]): void {
  for (const field of requiredFields) {
    if (!data[field]) {
      throw new HttpsError("invalid-argument", `필수 파라미터 '${field}'가 누락되었습니다.`);
    }
  }
}

/**
 * 이메일 형식 검증
 */
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new HttpsError("invalid-argument", "유효하지 않은 이메일 형식입니다.");
  }
}

/**
 * 비밀번호 강도 검증
 */
export function validatePassword(password: string): void {
  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "비밀번호는 최소 6자 이상이어야 합니다.");
  }
}

/**
 * 역할 검증
 */
export function validateRole(role: string): void {
  const validRoles = ["student", "admin", "super_admin"];
  if (!validRoles.includes(role)) {
    throw new HttpsError("invalid-argument", "유효하지 않은 역할입니다.");
  }
}

/**
 * 학원 ID 형식 검증
 */
export function validateAcademyId(academyId: string): void {
  if (!academyId || academyId.trim().length === 0) {
    throw new HttpsError("invalid-argument", "학원 ID가 필요합니다.");
  }

  // 학원 ID는 영문, 숫자, 언더스코어, 하이픈만 허용
  const academyIdRegex = /^[a-zA-Z0-9_-]+$/;
  if (!academyIdRegex.test(academyId)) {
    throw new HttpsError("invalid-argument", "학원 ID는 영문, 숫자, 언더스코어, 하이픈만 사용할 수 있습니다.");
  }
}

/**
 * 전화번호 형식 검증
 */
export function validatePhone(phone: string): void {
  const phoneRegex = /^[0-9-+\s()]+$/;
  if (!phoneRegex.test(phone)) {
    throw new HttpsError("invalid-argument", "유효하지 않은 전화번호 형식입니다.");
  }
}
