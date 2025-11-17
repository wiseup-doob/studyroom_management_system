# ATTENDANCE_IMPROVEMENT_PLAN.md 변경사항 요약

**작성일**: 2025-01-31
**버전**: v1.0 → v1.1 → v1.2

---

## 🔴 v1.2 변경사항 (2025-01-31)

### 1. Phase 1: 타임존 변환 안정성 개선

#### ❌ v1.1 권장 방안 - **불안정한 파싱**

```typescript
// ❌ v1.1: toLocaleString() 전체 문자열 파싱 (불안정)
export function getCurrentKoreaTime(): Date {
  const now = new Date();
  const koreaTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
  return new Date(koreaTimeStr); // "1/31/2025, 2:30:00 PM" → 환경에 따라 다르게 파싱됨
}
```

**문제점**:
- `toLocaleString()`은 "1/31/2025, 2:30:00 PM" 같은 문자열 반환
- `new Date(문자열)`은 브라우저/Node.js 버전에 따라 **파싱 결과가 다름**
- 로케일 설정에 따라 예측 불가능한 동작 발생 가능

#### ✅ v1.2 수정 방안 - **안정적인 파싱**

```typescript
// ✅ v1.2: 개별 요소 추출 (안정적)
export function getCurrentKoreaTime(): Date {
  const now = new Date();

  // 한국 시간 각 요소를 개별 추출
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
```

**장점**:
- ✅ 문자열 파싱 오류 위험 제거
- ✅ 크로스 플랫폼 호환성 보장
- ✅ Node.js 버전 독립적
- ✅ 프로덕션 환경에서 안정적 동작 보장

---

### 2. Phase 3: 실패 잠금 로직 - DoS 취약점 수정

#### ❌ v1.1 권장 방안 - **DoS 공격 취약**

```typescript
// ❌ v1.1: 링크 레벨 실패 카운트 (DoS 취약)
interface AttendanceCheckLink {
  failedAttempts: number;
  maxFailedAttempts: number; // 10
}

// PIN 실패 시
if (!matchedPin) {
  await linkDoc.ref.update({
    failedAttempts: increment(1)
  });

  if (failedCount >= 10) {
    // 링크 비활성화 → DoS 공격!
    await linkDoc.ref.update({ isActive: false });
  }
}
```

**취약점**:
- 공격자가 의도적으로 10번 틀린 PIN 입력
- → 링크 전체가 **영구 비활성화**
- → 모든 학생의 출석 체크 불가능 (서비스 거부 공격)

**실제 피해 시나리오**:
1. 악의적 학생이 QR 코드 링크 접속
2. 랜덤 PIN 10번 입력 (10초 소요)
3. 링크 비활성화
4. 모든 정상 학생이 출석 체크 불가능
5. 관리자 긴급 대응 필요 (새 링크 생성 + 재공유)

#### ✅ v1.2 수정 방안 - **시간 기반 Rate Limiting**

```typescript
// ✅ v1.2: 시간 기반 Rate Limiting (DoS 방어)
interface PinAttemptLog {
  linkToken: string;
  success: boolean;
  timestamp: Timestamp;
  expiresAt: Timestamp; // 24시간 후 자동 삭제
}

async function checkRateLimit(linkToken: string): Promise<void> {
  const fiveMinutesAgo = now - 5 * 60 * 1000;

  // 최근 5분간 실패 횟수 조회
  const recentFailures = await db
    .collection("pin_attempt_logs")
    .where("linkToken", "==", linkToken)
    .where("timestamp", ">", fiveMinutesAgo)
    .where("success", "==", false)
    .get();

  // 5분 내 20회 이상 실패 시 임시 차단
  if (recentFailures.size >= 20) {
    throw new HttpsError(
      "resource-exhausted",
      "너무 많은 실패 시도가 있었습니다. 5분 후 다시 시도하세요."
    );
  }
}
```

**장점**:
- ✅ **DoS 공격 방지**: 링크는 영구 차단되지 않음
- ✅ **자동 복구**: 5분 후 자동으로 사용 가능
- ✅ **정상 사용자 보호**: 한 명의 실수가 전체에 영향 없음
- ✅ **로그 기록**: 의심스러운 활동 패턴 분석 가능

---

## 📊 v1.1 → v1.2 변경 비교표

| 항목 | v1.1 | v1.2 | 변경 이유 |
|------|------|------|----------|
| **Phase 1: 타임존 변환** | toLocaleString() 전체 파싱 | 개별 요소 추출 | 크로스 플랫폼 안정성 |
| **Phase 3: 실패 제한** | 링크 레벨 카운트 (10회 → 차단) | 시간 기반 Rate Limiting (5분/20회) | DoS 공격 방지 |
| **마이그레이션** | failedAttempts 필드 추가 | 마이그레이션 불필요 | 새 컬렉션 사용 |
| **Phase 3 예상 시간** | 4시간 | 4.5시간 | Rate Limiting 복잡도 증가 |
| **총 소요 시간** | 21시간 | 21.5시간 | - |

---

## 🔴 v1.1 변경사항 (2025-01-31)

### Phase 1: 타임존 계산 오류 수정 - 해결책 변경

#### ❌ 기존 권장 방안 (v1.0) - **잘못된 접근**

```typescript
// ❌ 옵션 1: 시스템 시간 직접 사용 (권장) - 삭제됨
export function getCurrentKoreaTime(): Date {
  return new Date(); // Cloud Functions는 UTC 환경!
}
```

**문제점**:
- Cloud Functions는 **기본적으로 UTC 환경**에서 실행됨
- `timeZone: "Asia/Seoul"` 설정은 **스케줄 실행 시간**에만 영향
- 함수 내부 `new Date()`는 여전히 **UTC 반환**
- 로컬(한국)에서는 정상 작동하지만 프로덕션에서 **9시간 차이 발생**

---

#### ✅ 수정된 권장 방안 (v1.1) - **올바른 접근**

```typescript
// ✅ 옵션 1: 명시적 타임존 변환 (권장)
export function getCurrentKoreaTime(): Date {
  const now = new Date();
  const koreaTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
  return new Date(koreaTimeStr);
}
```

**장점**:
- ✅ 환경에 독립적 (UTC 환경에서 정확히 작동)
- ✅ 명시적 타임존 지정으로 의도가 명확
- ✅ 로컬 개발 환경과 Cloud Functions 환경 모두 동일하게 동작
- ✅ 추가 의존성 불필요

---

## 📊 변경 비교표

| 항목 | v1.0 | v1.1 | 변경 이유 |
|------|------|------|----------|
| **권장 방안** | 옵션 1: 시스템 시간 직접 사용 | 옵션 1: 명시적 타임존 변환 | Cloud Functions UTC 환경 대응 |
| **옵션 개수** | 3개 (옵션 1, 2, 3) | 2개 (옵션 1, 2) | 잘못된 옵션 제거 |
| **테스트 코드** | 로컬 환경 기준 | UTC 환경 시뮬레이션 | 프로덕션 환경 대응 |
| **예상 소요 시간** | 2.5시간 | 3.5시간 | UTC 대응 복잡도 증가 |
| **총 소요 시간** | 20시간 | 21시간 | Phase 1 시간 증가 |

---

## 🧪 테스트 케이스 변경

### v1.0 테스트 (로컬 환경)

```typescript
// ❌ 로컬 환경 기준 (한국 시간대)
jest.setSystemTime(new Date('2025-01-31T14:30:00+09:00'));

test('getCurrentKoreaTime returns correct Korea time', () => {
  const koreaTime = getCurrentKoreaTime();
  expect(koreaTime.getHours()).toBe(14); // 로컬에서만 통과
});
```

### v1.1 테스트 (UTC 환경)

```typescript
// ✅ UTC 환경 시뮬레이션 (프로덕션 환경)
jest.setSystemTime(new Date('2025-01-31T23:30:00Z')); // UTC

test('getTodayInKorea returns correct date (next day in Korea)', () => {
  const today = getTodayInKorea();
  expect(today).toBe('2025-02-01'); // 한국은 다음날
});

test('getKoreaHoursAndMinutes returns correct time', () => {
  const { hours, minutes } = getKoreaHoursAndMinutes();
  expect(hours).toBe(8); // 한국 시간 08시 (UTC+9)
  expect(minutes).toBe(30);
});
```

---

## 📝 주요 추가 함수

### v1.1에서 추가된 유틸리티 함수

```typescript
/**
 * 한국 시간 기준 시/분 추출 (더 정확한 방법)
 * v1.1에서 새로 추가
 */
export function getKoreaHoursAndMinutes(): { hours: number; minutes: number } {
  const now = new Date();

  const hour = parseInt(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hour12: false
    })
  );

  const minute = parseInt(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Seoul",
      minute: "2-digit"
    })
  );

  return { hours: hour, minutes: minute };
}
```

---

## ⚠️ 주의사항

### Cloud Functions 환경 이해

| 항목 | 설명 |
|------|------|
| **기본 타임존** | UTC (협정 세계시) |
| **timeZone 설정** | `schedule` 실행 시간에만 영향 |
| **new Date()** | 항상 UTC 시간 반환 |
| **타임존 변환** | 명시적으로 toLocaleString 사용 필요 |

### 대한민국 전용 사용 시에도 변환 필요

- 로컬 개발: 한국 시간대 (KST, UTC+9)
- Cloud Functions: UTC 타임존
- **환경 차이로 인해 로컬에서 정상이어도 프로덕션에서 오류 발생 가능**
- 따라서 **명시적 타임존 변환 필수**

---

## 🚀 배포 시 주의사항

### v1.0 코드로 배포 시 (❌ 위험)

```
로컬 테스트: ✅ 통과 (한국 시간대)
Cloud Functions: ❌ 실패 (UTC 환경에서 9시간 오차)
```

### v1.1 코드로 배포 시 (✅ 안전)

```
로컬 테스트: ✅ 통과 (명시적 변환)
Cloud Functions: ✅ 통과 (명시적 변환)
```

---

## 📌 체크리스트

Phase 1 구현 시 반드시 확인:

- [ ] `getCurrentKoreaTime()` 함수에서 명시적 타임존 변환 사용
- [ ] `getTodayInKorea()` 함수에서 toLocaleString으로 날짜 추출
- [ ] `getCurrentKoreaMinutes()` 함수에서 getKoreaHoursAndMinutes() 사용
- [ ] UTC 환경 시뮬레이션 테스트 작성
- [ ] 날짜 경계(midnight) 테스트 포함
- [ ] Emulator에서 scheduled function 수동 트리거 테스트
- [ ] 배포 후 실제 로그에서 시간 확인

---

## 📚 참고 자료

### Cloud Functions v2 타임존 동작

- [Firebase 공식 문서 - Scheduled Functions](https://firebase.google.com/docs/functions/schedule-functions)
- `timeZone` 설정은 cron schedule 해석에만 영향
- 함수 실행 환경 자체의 타임존은 변경하지 않음
- Node.js 런타임은 기본적으로 UTC 사용

### JavaScript 타임존 처리

- `Date` 객체는 항상 UTC 기준으로 저장
- `toLocaleString({ timeZone })` 으로 특정 타임존 변환
- Intl API를 사용하면 더 정확한 제어 가능

---

**요약**: v1.0의 타임존 해결책은 로컬 환경에서만 동작하는 잘못된 접근이었습니다. v1.1에서 Cloud Functions의 UTC 환경을 고려한 명시적 타임존 변환으로 수정되었습니다. 🎯
