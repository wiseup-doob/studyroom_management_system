/**
 * 시간 관련 유틸리티 함수 (타임존 처리 통일)
 *
 * 목적: 한국 시간대(UTC+9) 처리를 중앙화하여 일관성 확보
 */

/**
 * 현재 한국 시간 반환 (UTC+9)
 */
export function getCurrentKoreaTime(): Date {
  const now = new Date();
  return new Date(now.getTime() + (9 * 60 * 60 * 1000));
}

/**
 * 현재 한국 시간의 분 단위 값 (00:00부터 경과한 분)
 * 예: 14:30 → 870분
 */
export function getCurrentKoreaMinutes(): number {
  const koreaTime = getCurrentKoreaTime();
  return koreaTime.getHours() * 60 + koreaTime.getMinutes();
}

/**
 * 오늘 한국 날짜 문자열 (YYYY-MM-DD)
 */
export function getTodayInKorea(): string {
  const koreaTime = getCurrentKoreaTime();
  return koreaTime.toISOString().split("T")[0];
}

/**
 * 시간 문자열을 분 단위로 변환
 * @param timeString "HH:mm" 형식의 시간 (예: "09:30")
 * @returns 00:00부터 경과한 분 (예: 570분)
 */
export function parseTimeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time format: ${timeString}`);
  }
  return hours * 60 + minutes;
}

/**
 * 분 단위 값을 시간 문자열로 변환
 * @param minutes 00:00부터 경과한 분 (예: 570분)
 * @returns "HH:mm" 형식의 시간 (예: "09:30")
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * 현재 한국 요일 반환
 */
export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

/**
 * 현재 한국 시간의 요일 반환
 * @returns 현재 한국 시간 기준 요일
 */
export function getCurrentKoreaDayOfWeek(): DayOfWeek {
  const koreaTime = getCurrentKoreaTime();
  const days: DayOfWeek[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[koreaTime.getDay()];
}

/**
 * Date 객체에서 요일 추출
 */
export function getDayOfWeek(date: Date): DayOfWeek {
  const days: DayOfWeek[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[date.getDay()];
}
