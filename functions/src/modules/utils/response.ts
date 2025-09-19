/**
 * 응답 생성 유틸리티 함수들
 */

import { ApiResponse } from "../../types";

/**
 * 성공 응답 생성
 */
export function createSuccessResponse<T>(data?: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    message,
    data
  };
}

/**
 * 에러 응답 생성
 */
export function createErrorResponse(message: string): ApiResponse {
  return {
    success: false,
    message
  };
}
