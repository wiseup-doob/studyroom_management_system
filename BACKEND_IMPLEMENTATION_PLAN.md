# WiseUp 관리 시스템 백엔드 구현 계획

## 📋 개요

현재 프론트엔드에서 구현된 멀티테넌트 로그인 시스템을 동작시키기 위한 백엔드 구현 계획입니다. Firebase Cloud Functions를 활용하여 커스텀 클레임 설정, 사용자 관리, 학원 관리 기능을 구현합니다.

## 🔍 현재 프론트엔드 구현 분석

### ✅ **구현된 기능들**
1. **멀티테넌트 인증 시스템**: academyId 기반 사용자 구분
2. **역할 기반 접근 제어**: student, admin, super_admin 권한 분리
3. **Firestore 보안 규칙**: 학원별 데이터 격리
4. **실시간 인증 상태 관리**: onIdTokenChanged로 커스텀 클레임 동기화
5. **자동 라우팅**: 역할별 대시보드 자동 리다이렉트

### ❌ **현재 문제점**
1. **커스텀 클레임이 설정되지 않음**: 사용자에게 academyId, role 클레임이 없음
2. **실제 사용자 데이터가 없음**: Firestore에 학생/관리자 데이터가 없음
3. **역할 부여 시스템이 없음**: 슈퍼 관리자가 사용자에게 역할을 부여할 방법이 없음

## 🚀 백엔드 구현 계획

### **Phase 1: Firebase Cloud Functions 환경 구성**

#### 1.1 기본 Cloud Functions 환경 구성
```bash
# Firebase Functions 초기화
firebase init functions
cd functions
npm install firebase-admin
```

#### 1.2 필요한 패키지 설치
```bash
cd functions
npm install firebase-admin firebase-functions
npm install --save-dev @types/node typescript
```

#### 1.3 TypeScript 설정
```json
// functions/tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "target": "es2017"
  },
  "compileOnSave": true,
  "include": [
    "src"
  ]
}
```

### **Phase 2: 핵심 Cloud Functions 구현**

#### 2.1 커스텀 클레임 설정 함수
```typescript
// functions/src/index.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// 사용자 역할 부여 함수
export const setUserRole = functions.https.onCall(async (data, context) => {
  // 슈퍼 관리자 권한 검증
  if (!context.auth || !context.auth.token.super_admin) {
    throw new functions.https.HttpsError('permission-denied', '슈퍼 관리자 권한이 필요합니다.');
  }

  const { uid, academyId, role } = data;
  
  // 유효성 검사
  if (!uid || !academyId || !role) {
    throw new functions.https.HttpsError('invalid-argument', '필수 파라미터가 누락되었습니다.');
  }

  if (!['student', 'admin', 'super_admin'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', '유효하지 않은 역할입니다.');
  }

  // 커스텀 클레임 설정
  const customClaims = {
    academyId,
    role,
    [role]: true // admin: true, student: true, 또는 super_admin: true
  };

  // 슈퍼 관리자의 경우 추가 클레임 설정
  if (role === 'super_admin') {
    customClaims.super_admin = true;
  }

  await admin.auth().setCustomUserClaims(uid, customClaims);

  return { 
    success: true, 
    message: '사용자 역할이 설정되었습니다.',
    customClaims 
  };
});
```

#### 2.2 사용자 등록 함수
```typescript
// 사용자 등록 (슈퍼 관리자 전용)
export const createUser = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.super_admin) {
    throw new functions.https.HttpsError('permission-denied', '슈퍼 관리자 권한이 필요합니다.');
  }

  const { email, password, name, academyId, role, grade, permissions } = data;
  
  // 유효성 검사
  if (!email || !password || !name || !academyId || !role) {
    throw new functions.https.HttpsError('invalid-argument', '필수 파라미터가 누락되었습니다.');
  }

  try {
    // Firebase Auth 사용자 생성
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name
    });

    // 커스텀 클레임 설정
    const customClaims = {
      academyId,
      role,
      [role]: true
    };

    // 슈퍼 관리자의 경우 추가 클레임 설정
    if (role === 'super_admin') {
      customClaims.super_admin = true;
    }

    await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

    // Firestore에 사용자 정보 저장
    if (role === 'student') {
      await admin.firestore()
        .collection('academies')
        .doc(academyId)
        .collection('students')
        .doc(userRecord.uid)
        .set({
          authUid: userRecord.uid,
          name,
          grade: grade || '초1',
          status: 'active',
          contactInfo: {
            email: email
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } else if (role === 'admin' || role === 'super_admin') {
      // 수정된 경로: academies/{academyId}/admins
      await admin.firestore()
        .collection('academies')
        .doc(academyId)
        .collection('admins')
        .doc(userRecord.uid)
        .set({
          authUid: userRecord.uid,
          name,
          academyId,
          role,
          permissions: permissions || ['manage_students'],
          contactInfo: {
            email: email
          },
          isActive: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    return { 
      success: true, 
      uid: userRecord.uid,
      email: userRecord.email,
      customClaims 
    };
  } catch (error) {
    console.error('사용자 생성 실패:', error);
    throw new functions.https.HttpsError('internal', '사용자 생성에 실패했습니다.');
  }
});
```

#### 2.3 학원 생성 함수
```typescript
// 새 학원 생성 (슈퍼 관리자 전용)
export const createAcademy = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.super_admin) {
    throw new functions.https.HttpsError('permission-denied', '슈퍼 관리자 권한이 필요합니다.');
  }

  const { academyId, name, address, phone, email, operatingHours, settings } = data;
  
  // 유효성 검사
  if (!academyId || !name || !address || !phone || !email) {
    throw new functions.https.HttpsError('invalid-argument', '필수 파라미터가 누락되었습니다.');
  }

  try {
    // 학원 기본 정보 생성
    await admin.firestore()
      .collection('academies')
      .doc(academyId)
      .set({
        name,
        address,
        phone,
        email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    // 학원 설정 생성 (중복 제거: 순수한 설정값만 저장)
    await admin.firestore()
      .collection('academies')
      .doc(academyId)
      .collection('academy_settings')
      .doc('main')
      .set({
        academyId,
        operatingHours: operatingHours || {
          open: '09:00',
          close: '22:00'
        },
        settings: settings || {
          maxStudents: 100,
          seatCapacity: 50,
          attendanceCheckInTime: '09:00',
          attendanceCheckOutTime: '22:00'
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    return { 
      success: true, 
      academyId,
      message: '학원이 성공적으로 생성되었습니다.' 
    };
  } catch (error) {
    console.error('학원 생성 실패:', error);
    throw new functions.https.HttpsError('internal', '학원 생성에 실패했습니다.');
  }
});
```

#### 2.4 사용자 목록 조회 함수
```typescript
// 사용자 목록 조회 (슈퍼 관리자 전용)
export const getUsers = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.super_admin) {
    throw new functions.https.HttpsError('permission-denied', '슈퍼 관리자 권한이 필요합니다.');
  }

  try {
    const { academyId, role } = data;
    let users = [];

    if (role === 'student' && academyId) {
      // 학생 목록 조회
      const studentsSnapshot = await admin.firestore()
        .collection('academies')
        .doc(academyId)
        .collection('students')
        .get();

      users = studentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } else if (role === 'admin' && academyId) {
      // 관리자 목록 조회 (수정된 경로)
      const adminsSnapshot = await admin.firestore()
        .collection('academies')
        .doc(academyId)
        .collection('admins')
        .get();

      users = adminsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } else if (role === 'super_admin') {
      // 슈퍼 관리자 목록 조회
      const superAdminsSnapshot = await admin.firestore()
        .collection('academies')
        .doc('system')
        .collection('admins')
        .get();

      users = superAdminsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }

    return { 
      success: true, 
      users,
      count: users.length 
    };
  } catch (error) {
    console.error('사용자 목록 조회 실패:', error);
    throw new functions.https.HttpsError('internal', '사용자 목록 조회에 실패했습니다.');
  }
});
```

### **Phase 3: 테스트 데이터 생성**

#### 3.1 초기 데이터 생성 함수
```typescript
// 테스트 데이터 생성 (개발용)
export const createTestData = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.super_admin) {
    throw new functions.https.HttpsError('permission-denied', '슈퍼 관리자 권한이 필요합니다.');
  }

  const { academyId } = data;
  
  if (!academyId) {
    throw new functions.https.HttpsError('invalid-argument', 'academyId가 필요합니다.');
  }

  try {
    // 테스트 학생 데이터 생성
    const testStudents = [
      {
        authUid: 'test_student_1',
        name: '김학생',
        grade: '중1',
        status: 'active',
        contactInfo: {
          phone: '010-1234-5678',
          email: 'student1@test.com'
        }
      },
      {
        authUid: 'test_student_2',
        name: '이학생',
        grade: '중2',
        status: 'active',
        contactInfo: {
          phone: '010-2345-6789',
          email: 'student2@test.com'
        }
      },
      {
        authUid: 'test_student_3',
        name: '박학생',
        grade: '고1',
        status: 'active',
        contactInfo: {
          phone: '010-3456-7890',
          email: 'student3@test.com'
        }
      }
    ];

    // 테스트 관리자 데이터 생성
    const testAdmins = [
      {
        authUid: 'test_admin_1',
        name: '김관리자',
        academyId,
        role: 'admin',
        permissions: ['manage_students', 'view_reports'],
        contactInfo: {
          email: 'admin1@test.com',
          phone: '010-1111-2222'
        },
        isActive: true
      }
    ];

    // Firestore에 데이터 저장
    for (const student of testStudents) {
      await admin.firestore()
        .collection('academies')
        .doc(academyId)
        .collection('students')
        .doc(student.authUid)
        .set({
          ...student,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    for (const adminUser of testAdmins) {
      // 수정된 경로: academies/{academyId}/admins
      await admin.firestore()
        .collection('academies')
        .doc(academyId)
        .collection('admins')
        .doc(adminUser.authUid)
        .set({
          ...adminUser,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    return { 
      success: true, 
      message: '테스트 데이터가 생성되었습니다.',
      studentsCount: testStudents.length,
      adminsCount: testAdmins.length
    };
  } catch (error) {
    console.error('테스트 데이터 생성 실패:', error);
    throw new functions.https.HttpsError('internal', '테스트 데이터 생성에 실패했습니다.');
  }
});
```

#### 3.2 초기 시스템 설정 (로컬 스크립트)

**⚠️ 보안 주의사항**: 시스템 초기화는 절대 공개 함수로 만들면 안 됩니다. 로컬 스크립트로만 실행해야 합니다.

```typescript
// scripts/initializeSystem.ts (로컬 실행용)
import * as admin from 'firebase-admin';

// Firebase Admin SDK 초기화
const serviceAccount = require('../path/to/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function initializeSystem() {
  try {
    const superAdminEmail = 'superadmin@wiseup.com';
    const superAdminPassword = 'SuperAdmin123!';
    
    // 1. 슈퍼 관리자 계정 생성
    const superAdmin = await admin.auth().createUser({
      email: superAdminEmail,
      password: superAdminPassword,
      displayName: '슈퍼 관리자'
    });

    // 2. 슈퍼 관리자 클레임 설정
    await admin.auth().setCustomUserClaims(superAdmin.uid, {
      academyId: 'system',
      role: 'super_admin',
      super_admin: true
    });

    // 3. 슈퍼 관리자 정보를 admins 컬렉션에 저장 (수정된 경로)
    await admin.firestore()
      .collection('academies')
      .doc('system')
      .collection('admins')
      .doc(superAdmin.uid)
      .set({
        authUid: superAdmin.uid,
        name: '슈퍼 관리자',
        academyId: 'system',
        role: 'super_admin',
        permissions: ['manage_system', 'manage_academies', 'manage_admins'],
        contactInfo: {
          email: superAdminEmail
        },
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    // 4. 테스트 학원 생성
    const testAcademyId = 'wiseup_gangnam';
    await admin.firestore()
      .collection('academies')
      .doc(testAcademyId)
      .set({
        name: '와이즈업 강남점',
        address: '서울시 강남구 테헤란로 123',
        phone: '02-1234-5678',
        email: 'gangnam@wiseup.com',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    // 5. 테스트 학원 설정 생성 (중복 제거)
    await admin.firestore()
      .collection('academies')
      .doc(testAcademyId)
      .collection('academy_settings')
      .doc('main')
      .set({
        academyId: testAcademyId,
        operatingHours: {
          open: '09:00',
          close: '22:00'
        },
        settings: {
          maxStudents: 100,
          seatCapacity: 50,
          attendanceCheckInTime: '09:00',
          attendanceCheckOutTime: '22:00'
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    console.log('✅ 시스템 초기화 완료!');
    console.log(`📧 슈퍼 관리자 이메일: ${superAdminEmail}`);
    console.log(`🔑 슈퍼 관리자 비밀번호: ${superAdminPassword}`);
    console.log(`🏫 테스트 학원 ID: ${testAcademyId}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 시스템 초기화 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
initializeSystem();
```

**실행 방법:**
```bash
# 로컬에서 스크립트 실행
cd functions
npx ts-node scripts/initializeSystem.ts
```

### **Phase 4: 배포 및 설정**

#### 4.1 Firebase Functions 배포
```bash
# Functions 배포
firebase deploy --only functions

# Firestore 보안 규칙 배포
firebase deploy --only firestore:rules

# 전체 배포
firebase deploy
```

#### 4.2 환경 변수 설정
```bash
# Firebase 프로젝트 설정 확인
firebase use --list

# 프로덕션 프로젝트 선택
firebase use studyroommanagementsyste-7a6c6

# 테스트 프로젝트 선택
firebase use studyroommanagementsystemtest
```

## 📋 구현 순서

### **1단계: Cloud Functions 환경 구성**
- [ ] Firebase Functions 초기화
- [ ] 필요한 패키지 설치
- [ ] TypeScript 설정
- [ ] 기본 함수 구조 설정

### **2단계: 핵심 함수 구현**
- [ ] `setUserRole`: 사용자 역할 부여
- [ ] `createUser`: 사용자 등록
- [ ] `createAcademy`: 학원 생성
- [ ] `getUsers`: 사용자 목록 조회

### **3단계: 테스트 데이터 생성**
- [ ] `createTestData`: 테스트 데이터 생성
- [ ] `initializeSystem`: 초기 시스템 설정

### **4단계: 배포 및 테스트**
- [ ] Functions 배포
- [ ] Firestore 보안 규칙 배포
- [ ] 프론트엔드와 연동 테스트

### **5단계: 초기 데이터 설정**
- [ ] 슈퍼 관리자 계정 생성
- [ ] 테스트 학원 생성
- [ ] 테스트 사용자 생성
- [ ] 로그인 테스트

## 🎯 예상 결과

이 백엔드 구현이 완료되면:

1. **슈퍼 관리자 계정**으로 로그인 가능
2. **새 학원 생성** 및 **관리자 임명** 가능
3. **학생 등록** 및 **역할 부여** 가능
4. **프론트엔드 로그인 시스템**이 정상 작동
5. **멀티테넌트 아키텍처**가 완전히 구현

## 🔧 테스트 시나리오

### **시나리오 1: 시스템 초기화**
1. `initializeSystem` 함수 호출
2. 슈퍼 관리자 계정 생성 확인
3. 테스트 학원 생성 확인

### **시나리오 2: 사용자 등록 및 역할 부여**
1. 슈퍼 관리자로 로그인
2. `createUser` 함수로 새 사용자 생성
3. `setUserRole` 함수로 역할 부여
4. 프론트엔드에서 로그인 테스트

### **시나리오 3: 멀티테넌트 테스트**
1. 여러 학원 생성
2. 각 학원에 관리자 및 학생 등록
3. 학원별 데이터 격리 확인
4. 권한 기반 접근 제어 확인

## 📝 주의사항

1. **보안**: 모든 관리자 함수는 슈퍼 관리자 권한 검증 필수
2. **에러 처리**: 모든 함수에 적절한 에러 처리 및 로깅 구현
3. **유효성 검사**: 입력 파라미터에 대한 철저한 유효성 검사
4. **트랜잭션**: 여러 Firestore 작업이 필요한 경우 트랜잭션 사용
5. **로깅**: 모든 중요한 작업에 대한 로깅 구현

## 🎯 전문가 피드백 반영 및 개선사항

이 구현 계획서는 실무 전문가의 피드백을 반영하여 다음과 같이 개선되었습니다:

### ✅ 주요 개선사항

1. **보안 강화**
   - **기존**: `initializeSystem` 함수를 공개 함수로 구현
   - **개선**: 로컬 스크립트로만 실행하도록 변경하여 보안 위험 제거

2. **데이터 구조 일관성**
   - **기존**: `admins` 컬렉션을 최상위에 저장
   - **개선**: `academies/{academyId}/admins` 경로로 수정하여 멀티테넌트 구조 일관성 확보

3. **클레임 구조 개선**
   - **기존**: 슈퍼 관리자 클레임 구조 불일치
   - **개선**: `super_admin: true` 클레임 추가로 권한 검증 로직 통일

4. **데이터 중복 제거**
   - **기존**: 학원 기본 정보와 설정 정보 중복 저장
   - **개선**: `academy_settings`에는 순수한 설정값만 저장하여 데이터 관리 포인트 통일

### 🚀 보안 및 아키텍처 개선 효과

- **보안 강화**: 시스템 초기화를 로컬 스크립트로 격리하여 외부 공격 위험 제거
- **데이터 일관성**: 멀티테넌트 구조에 맞는 올바른 데이터 경로 사용
- **권한 관리**: 일관된 클레임 구조로 권한 검증 로직 단순화
- **유지보수성**: 데이터 중복 제거로 관리 포인트 통일

### 💡 핵심 아키텍처 원칙

1. **보안 우선**: 시스템 초기화는 절대 공개 함수로 구현하지 않음
2. **멀티테넌트 일관성**: 모든 데이터는 `academies/{academyId}/` 구조 준수
3. **권한 통일**: 슈퍼 관리자는 `super_admin: true` 클레임으로 일관된 검증
4. **데이터 정규화**: 중복 데이터 제거로 단일 진실 원천(Single Source of Truth) 확보

## 🚀 다음 단계

백엔드 구현 완료 후:
1. 프론트엔드와 연동 테스트
2. 실제 사용자 데이터로 테스트
3. 성능 최적화
4. 모니터링 및 알림 설정
5. 백업 및 복구 전략 수립

---

**참고**: 이 계획은 현재 프론트엔드 구현을 기반으로 하며, 실제 구현 과정에서 요구사항에 따라 추가 수정될 수 있습니다.
