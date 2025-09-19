/**
 * 인증 관련 유틸리티 함수들 - 사용자 기반 격리
 */

import {HttpsError, CallableRequest} from "firebase-functions/v2/https";

/**
 * 사용자 인증 검증 (인증된 사용자만 허용)
 */
export function validateUser(request: CallableRequest): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }
}

/**
 * 현재 사용자의 UID 가져오기
 */
export function getCurrentUserId(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  }
  return request.auth.uid;
}
