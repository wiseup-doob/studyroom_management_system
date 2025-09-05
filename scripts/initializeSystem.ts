/**
 * WiseUp 관리 시스템 초기화 스크립트
 * 
 * ⚠️ 보안 주의사항: 이 스크립트는 로컬에서만 실행해야 합니다.
 * 절대 공개 함수로 만들면 안 됩니다.
 */

import * as admin from 'firebase-admin';

// Firebase Admin SDK 초기화
// 실제 사용 시에는 서비스 계정 키 파일 경로를 설정해야 합니다
admin.initializeApp({
  projectId: 'studyroommanagementsystemtest',
  // credential: admin.credential.cert(require('../path/to/serviceAccountKey.json'))
  // 또는 환경 변수 사용: GOOGLE_APPLICATION_CREDENTIALS
});

// Firebase CLI 인증 사용을 위한 설정
process.env.GOOGLE_APPLICATION_CREDENTIALS = '';
process.env.FIREBASE_PROJECT_ID = 'studyroommanagementsystemtest';

async function initializeSystem() {
  try {
    console.log('🚀 WiseUp 관리 시스템 초기화를 시작합니다...');
    
    const superAdminEmail = 'superadmin@wiseup.com';
    const superAdminPassword = 'SuperAdmin123!';
    
    // 1. 슈퍼 관리자 계정 생성
    console.log('👤 슈퍼 관리자 계정을 생성합니다...');
    const superAdmin = await admin.auth().createUser({
      email: superAdminEmail,
      password: superAdminPassword,
      displayName: '슈퍼 관리자'
    });

    // 2. 슈퍼 관리자 클레임 설정
    console.log('🔐 슈퍼 관리자 권한을 설정합니다...');
    await admin.auth().setCustomUserClaims(superAdmin.uid, {
      academyId: 'system',
      role: 'super_admin',
      super_admin: true
    });

    // 3. 슈퍼 관리자 정보를 admins 컬렉션에 저장 (수정된 경로)
    console.log('💾 슈퍼 관리자 정보를 저장합니다...');
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
    console.log('🏫 테스트 학원을 생성합니다...');
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
    console.log('⚙️ 학원 설정을 생성합니다...');
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

    console.log('✅ 시스템 초기화가 완료되었습니다!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 슈퍼 관리자 이메일:', superAdminEmail);
    console.log('🔑 슈퍼 관리자 비밀번호:', superAdminPassword);
    console.log('🏫 테스트 학원 ID:', testAcademyId);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 이제 프론트엔드에서 슈퍼 관리자로 로그인할 수 있습니다!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 시스템 초기화 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
initializeSystem();
