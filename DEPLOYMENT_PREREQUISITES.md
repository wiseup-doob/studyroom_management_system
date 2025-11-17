# 배포 전 필수 작업 체크리스트

## ✅ 완료된 작업

### 1. Firestore Composite Indexes 배포 완료
- **Index 1**: `attendance_student_pins` (actualPin + isActive)
- **Index 2**: `pin_attempt_logs` (linkToken + timestamp + success)
- **배포 상태**: ✅ 배포 완료 (studyroommanagementsystemtest)
- **배포 날짜**: 2025-11-07

```bash
✔  firestore: deployed indexes in firestore.indexes.json successfully
```

---

## ⚠️ 수동 설정 필요

### 2. Firestore TTL (Time-To-Live) Policy 설정

`pin_attempt_logs` 컬렉션에 TTL 정책을 설정하여 24시간 경과한 로그를 자동 삭제합니다.

#### **설정 방법 (Firebase Console 사용 - 권장)**

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택 (studyroommanagementsystemtest 또는 production)
3. **Firestore Database** → **Data** 탭으로 이동
4. 좌측 컬렉션 목록에서 `pin_attempt_logs` 클릭
5. 상단 메뉴에서 **⋮** (더보기) → **Manage TTL** 선택
6. TTL 필드 설정:
   - Field name: `expiresAt`
   - Enable TTL: ON
7. **Save** 클릭

#### **설정 방법 (gcloud CLI 사용)**

```bash
# 1. gcloud CLI가 설치되어 있는지 확인
gcloud --version

# 2. Firebase 프로젝트 인증
gcloud auth login

# 3. 프로젝트 설정
gcloud config set project studyroommanagementsystemtest

# 4. TTL 정책 활성화
gcloud firestore fields ttls update expiresAt \
  --collection-group=pin_attempt_logs \
  --enable-ttl

# 5. TTL 정책 확인
gcloud firestore fields ttls list \
  --collection-group=pin_attempt_logs
```

#### **설정 확인**

TTL 정책이 올바르게 설정되었는지 확인:

```bash
# TTL 정책 목록 조회
gcloud firestore fields ttls list --collection-group=pin_attempt_logs
```

예상 출력:
```
COLLECTION_GROUP     FIELD_PATH  STATE
pin_attempt_logs     expiresAt   ACTIVE
```

#### **TTL 동작 방식**

- **자동 삭제 시점**: `expiresAt` 필드의 Timestamp 값이 현재 시간을 지나면 자동 삭제
- **삭제 지연**: 최대 72시간 지연 가능 (Firestore의 백그라운드 프로세스가 처리)
- **비용**: TTL 삭제는 무료 (읽기/쓰기 작업으로 카운트되지 않음)

#### **코드 확인**

TTL이 올바르게 설정되어 있는지 확인하려면 [studentAttendanceManagement.ts:186-189](functions/src/modules/personal/studentAttendanceManagement.ts#L186-L189) 참고:

```typescript
const expiresAt = admin.firestore.Timestamp.fromMillis(
  now.toMillis() + 24 * 60 * 60 * 1000 // 24시간 후
);

await db.collection("pin_attempt_logs").add({
  linkToken,
  success,
  studentId: studentId || null,
  timestamp: now,
  expiresAt  // ← TTL 필드
});
```

---

## 🚀 배포 준비 완료 확인

다음 항목을 모두 확인한 후 배포를 진행하세요:

- [x] **Firestore Composite Indexes 배포**: ✅ 완료
- [x] **TTL Policy 설정**: ✅ 완료 (ACTIVE)
- [x] **Rate Limiting 쿼리 수정**: ✅ 완료 (필드 순서 수정)
- [x] **TypeScript 빌드 성공**: ✅ 완료
- [x] **코드 품질 검증**: ✅ 완료

### 최종 배포 명령어

TTL 정책 설정 완료 후 아래 명령어로 배포:

```bash
# Test 환경 배포
firebase deploy --only functions --project studyroommanagementsystemtest

# Production 환경 배포 (주의!)
firebase deploy --only functions --project studyroommanagementsyste-7a6c6
```

---

## 🐛 긴급 버그 수정 (2025-11-07)

### Issue: Firestore Query 필드 순서 오류

**증상**: `checkAttendanceByPin` 함수 실행 시 500 Internal Server Error

**원인**: Rate Limiting 쿼리에서 필드 순서가 Firestore 인덱스와 맞지 않음

**문제 코드**:
```typescript
// ❌ WRONG - Range filter before equality filter
.where("linkToken", "==", linkToken)
.where("timestamp", ">", fiveMinutesAgo)  // Range filter
.where("success", "==", false)            // Equality filter
```

**수정 코드**:
```typescript
// ✅ CORRECT - Equality filters before range filter
.where("linkToken", "==", linkToken)
.where("success", "==", false)            // Equality filters first
.where("timestamp", ">", fiveMinutesAgo)  // Range filter last
```

**Firestore 규칙**:
- Equality filters (`==`) must come BEFORE range filters (`>`, `<`, `>=`, `<=`)
- Index field order must match query field order
- Range filters must be the LAST field in the query

**수정 위치**: [studentAttendanceManagement.ts:151-159](functions/src/modules/personal/studentAttendanceManagement.ts#L151-L159)

**배포 상태**: ✅ Test 환경 배포 완료 (2025-11-07 12:52 KST)

---

## 📋 배포 후 검증 체크리스트

배포 완료 후 다음 항목을 테스트하여 정상 작동 확인:

### 1. PIN 중복 검증 성능 개선 확인
- [ ] 같은 PIN으로 2번 생성 시도 → "이미 사용 중인 PIN입니다" 에러 즉시 발생
- [ ] 응답 시간: 기존 2-5초 → 개선 후 0.2-0.5초

### 2. Rate Limiting 동작 확인
- [ ] 5분 내 잘못된 PIN 20회 시도 → "너무 많은 실패 시도" 에러 발생
- [ ] 5분 경과 후 자동 복구 확인
- [ ] `pin_attempt_logs` 컬렉션에 로그 기록 확인

### 3. 수동 체크인 개선 확인
- [ ] `not_arrived` 상태 학생을 수동 체크인 → "자동 복구됨" 메시지 확인
- [ ] `notes` 필드에 복구 로그 기록 확인

### 4. 타임존 처리 안정성 확인
- [ ] `createDailyAttendanceRecords` (매일 02:00 KST) 정상 실행
- [ ] `markNotArrivedAtStartTime` (09:00-23:00, 30분 간격) 정상 실행
- [ ] `markAbsentUnexcused` (10분 간격) 정상 실행
- [ ] 한국 시간 기준 정확한 동작 확인

### 5. TTL Policy 동작 확인
- [ ] `pin_attempt_logs` 컬렉션의 오래된 문서 자동 삭제 확인 (24-72시간 후)
- [ ] Firebase Console에서 TTL 정책 상태 확인

---

## 🔍 트러블슈팅

### Issue 1: TTL 정책 설정 실패
**증상**: `gcloud firestore fields ttls update` 명령어 오류

**해결 방법**:
```bash
# 1. gcloud CLI 업데이트
gcloud components update

# 2. Firestore API 활성화 확인
gcloud services enable firestore.googleapis.com

# 3. 권한 확인
gcloud projects get-iam-policy studyroommanagementsystemtest
```

### Issue 2: Composite Index 빌드 중
**증상**: "Index is being built" 에러

**해결 방법**:
- Firebase Console에서 인덱스 빌드 상태 확인
- 빌드 완료까지 대기 (일반적으로 5-10분 소요)
- 대규모 데이터의 경우 최대 1시간 소요 가능

### Issue 3: Functions 배포 타임아웃
**증상**: `firebase deploy --only functions` 타임아웃

**해결 방법**:
```bash
# 1. 특정 함수만 배포
firebase deploy --only functions:generateStudentPin,functions:updateStudentPin

# 2. 타임아웃 설정 증가
firebase deploy --only functions --force
```

---

## 📚 참고 문서

- [ATTENDANCE_IMPROVEMENT_PLAN.md](ATTENDANCE_IMPROVEMENT_PLAN.md) - 개선 계획 상세 문서
- [ATTENDANCE_IMPROVEMENT_PLAN_CHANGELOG.md](ATTENDANCE_IMPROVEMENT_PLAN_CHANGELOG.md) - 변경 이력
- [Firebase TTL Policy 공식 문서](https://firebase.google.com/docs/firestore/ttl)
- [Firestore Composite Indexes 공식 문서](https://firebase.google.com/docs/firestore/query-data/indexing)

---

**마지막 업데이트**: 2025-11-07
**작성자**: Claude Code
**버전**: 1.0
