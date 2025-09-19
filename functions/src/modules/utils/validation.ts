/**
 * 유효성 검사 유틸리티 함수들 - 개인 데이터용
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
 * 시간 형식 검증 (HH:mm)
 */
export function validateTimeFormat(time: string): void {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(time)) {
    throw new HttpsError("invalid-argument", "유효하지 않은 시간 형식입니다. (HH:mm 형식 사용)");
  }
}

/**
 * 날짜 형식 검증 (YYYY-MM-DD)
 */
export function validateDateFormat(date: string): void {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new HttpsError("invalid-argument", "유효하지 않은 날짜 형식입니다. (YYYY-MM-DD 형식 사용)");
  }
}

/**
 * 좌석 번호 형식 검증
 */
export function validateSeatNumber(seatNumber: string): void {
  if (!seatNumber || seatNumber.trim().length === 0) {
    throw new HttpsError("invalid-argument", "좌석 번호가 필요합니다.");
  }

  const seatRegex = /^[A-Za-z0-9-_]+$/;
  if (!seatRegex.test(seatNumber)) {
    throw new HttpsError("invalid-argument", "유효하지 않은 좌석 번호 형식입니다.");
  }
}
