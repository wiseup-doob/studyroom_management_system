/**
 * 시간 관련 유틸리티 함수 (타임존 처리 통일)
 *
 * ⚠️ 중요: Cloud Functions는 UTC 환경에서 실행됩니다.
 * timeZone: "Asia/Seoul" 설정은 스케줄 실행 시간에만 영향을 주며,
 * 함수 내부 new Date()는 여전히 UTC를 반환합니다.
 * 따라서 명시적으로 한국 시간으로 변환해야 합니다.
 *
 * 목적: 한국 시간대(UTC+9) 처리를 중앙화하여 일관성 확보
 */

/**
 * 현재 한국 시간 반환 (UTC+9)
 *
 * Cloud Functions는 UTC 환경에서 실행되므로 명시적 타임존 변환 필요
 * 개별 요소를 추출하여 안정적인 Date 객체 생성 (크로스 플랫폼 호환)
 *
 * @returns 현재 한국 시간 (Date 객체)
 */
export function getCurrentKoreaTime(): Date {
  const now = new Date();

  // 한국 시간 각 요소를 개별 추출 (안정적인 파싱)
  const year = parseInt(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul", year: "numeric" })
  );
  const month = parseInt(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul", month: "numeric" })
  ) - 1; // JavaScript는 0-based month
  const day = parseInt(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul", day: "numeric" })
  );
  const hour = parseInt(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      hour12: false
    })
  );
  const minute = parseInt(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul", minute: "numeric" })
  );
  const second = parseInt(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul", second: "numeric" })
  );

  // 로컬 타임존으로 Date 객체 생성
  return new Date(year, month, day, hour, minute, second);
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
 *
 * 명시적으로 한국 시간대 기준 날짜 추출
 *
 * @returns YYYY-MM-DD 형식의 날짜 문자열
 */
export function getTodayInKorea(): string {
  const now = new Date();

  const year = now.toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric"
  });

  const month = now.toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    month: "2-digit"
  });

  const day = now.toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    day: "2-digit"
  });

  // en-US 형식은 MM/DD/YYYY이므로 재조립
  return `${year}-${month}-${day}`;
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
 *
 * 명시적으로 한국 시간대 기준 요일 추출
 *
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
