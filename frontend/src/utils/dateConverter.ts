/**
 * Firestore Timestamp와 Date 간 변환 유틸리티
 *
 * Firestore에서 반환되는 Timestamp 객체를 JavaScript Date 객체로 변환
 * 중첩된 객체와 배열도 재귀적으로 처리
 */

/**
 * Firestore Timestamp를 Date로 변환
 *
 * @param obj - 변환할 객체 (Timestamp, 객체, 배열 등)
 * @returns 변환된 객체 (Timestamp는 Date로 변환됨)
 *
 * @example
 * // Timestamp 객체 변환
 * const date = convertTimestampToDate({ _seconds: 1234567890, _nanoseconds: 0 });
 *
 * @example
 * // 중첩 객체 변환
 * const student = convertTimestampToDate({
 *   name: "홍길동",
 *   enrollmentDate: { _seconds: 1234567890, _nanoseconds: 0 },
 *   createdAt: { seconds: 1234567890, nanoseconds: 0 }
 * });
 *
 * @example
 * // 배열 변환
 * const students = convertTimestampToDate([
 *   { name: "홍길동", createdAt: { _seconds: 1234567890 } },
 *   { name: "김철수", createdAt: { _seconds: 1234567891 } }
 * ]);
 */
export function convertTimestampToDate(obj: any): any {
  if (!obj) return obj;

  if (obj && typeof obj === 'object') {
    // Firestore Timestamp 객체 감지
    // Firebase SDK에서 반환되는 형식: { _seconds, _nanoseconds } 또는 { seconds, nanoseconds }
    if (obj._seconds !== undefined || obj.seconds !== undefined) {
      const seconds = obj._seconds || obj.seconds;
      const nanoseconds = obj._nanoseconds || obj.nanoseconds || 0;
      return new Date(seconds * 1000 + nanoseconds / 1000000);
    }

    // toDate() 메서드가 있는 경우 (Firestore SDK의 Timestamp 클래스)
    if (typeof obj.toDate === 'function') {
      return obj.toDate();
    }

    // 배열 처리
    if (Array.isArray(obj)) {
      return obj.map(item => convertTimestampToDate(item));
    }

    // 객체 재귀 처리
    const converted: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        converted[key] = convertTimestampToDate(obj[key]);
      }
    }
    return converted;
  }

  return obj;
}

/**
 * Date를 Firestore Timestamp 형식으로 변환
 *
 * @param date - 변환할 Date 객체
 * @returns Firestore Timestamp 형식 객체 { seconds, nanoseconds }
 *
 * @example
 * const timestamp = convertDateToTimestamp(new Date());
 * // { seconds: 1234567890, nanoseconds: 123456000 }
 */
export function convertDateToTimestamp(date: Date): { seconds: number; nanoseconds: number } {
  const milliseconds = date.getTime();
  const seconds = Math.floor(milliseconds / 1000);
  const nanoseconds = (milliseconds % 1000) * 1000000;

  return { seconds, nanoseconds };
}

/**
 * ISO 8601 날짜 문자열을 Date로 안전하게 변환
 *
 * @param dateString - ISO 8601 형식 날짜 문자열
 * @returns Date 객체 또는 null (유효하지 않은 경우)
 *
 * @example
 * const date = parseDateString("2024-01-15T10:30:00Z");
 */
export function parseDateString(dateString: string): Date | null {
  if (!dateString) return null;

  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Date 객체가 유효한지 확인
 *
 * @param date - 확인할 Date 객체
 * @returns 유효한 Date이면 true
 *
 * @example
 * isValidDate(new Date()); // true
 * isValidDate(new Date("invalid")); // false
 */
export function isValidDate(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}
