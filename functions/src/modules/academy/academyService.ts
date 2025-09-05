/**
 * 학원 관리 서비스
 */

import * as admin from "firebase-admin";
import {CreateAcademyRequest, CreateTestDataRequest} from "../../types";
import {validateSuperAdmin} from "../utils/auth";
import {validateRequiredFields, validateEmail, validatePhone, validateAcademyId} from "../utils/validation";
import {createAcademyResponse, createTestDataResponse} from "../utils/response";

/**
 * 새 학원 생성
 */
export async function createAcademy(data: CreateAcademyRequest, request: any) {
  // 슈퍼 관리자 권한 검증
  validateSuperAdmin(request);

  // 유효성 검사
  validateRequiredFields(data, ["academyId", "name", "address", "phone", "email"]);
  validateAcademyId(data.academyId);
  validateEmail(data.email);
  validatePhone(data.phone);

  try {
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // 학원 기본 정보 생성
    await admin.firestore()
      .collection("academies")
      .doc(data.academyId)
      .set({
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    // 학원 설정 생성 (중복 제거: 순수한 설정값만 저장)
    await admin.firestore()
      .collection("academies")
      .doc(data.academyId)
      .collection("academy_settings")
      .doc("main")
      .set({
        academyId: data.academyId,
        operatingHours: data.operatingHours || {
          open: "09:00",
          close: "22:00",
        },
        settings: data.settings || {
          maxStudents: 100,
          seatCapacity: 50,
          attendanceCheckInTime: "09:00",
          attendanceCheckOutTime: "22:00",
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    return createAcademyResponse(data.academyId, "학원이 성공적으로 생성되었습니다.");
  } catch (error) {
    console.error("학원 생성 실패:", error);
    throw new Error("학원 생성에 실패했습니다.");
  }
}

/**
 * 테스트 데이터 생성
 */
export async function createTestData(data: CreateTestDataRequest, request: any) {
  // 슈퍼 관리자 권한 검증
  validateSuperAdmin(request);

  // 유효성 검사
  validateRequiredFields(data, ["academyId"]);
  validateAcademyId(data.academyId);

  try {
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // 테스트 학생 데이터 생성
    const testStudents = [
      {
        authUid: "test_student_1",
        name: "김학생",
        grade: "중1",
        status: "active",
        contactInfo: {
          phone: "010-1234-5678",
          email: "student1@test.com",
        },
      },
      {
        authUid: "test_student_2",
        name: "이학생",
        grade: "중2",
        status: "active",
        contactInfo: {
          phone: "010-2345-6789",
          email: "student2@test.com",
        },
      },
      {
        authUid: "test_student_3",
        name: "박학생",
        grade: "고1",
        status: "active",
        contactInfo: {
          phone: "010-3456-7890",
          email: "student3@test.com",
        },
      },
    ];

    // 테스트 관리자 데이터 생성
    const testAdmins = [
      {
        authUid: "test_admin_1",
        name: "김관리자",
        academyId: data.academyId,
        role: "admin",
        permissions: ["manage_students", "view_reports"],
        contactInfo: {
          email: "admin1@test.com",
          phone: "010-1111-2222",
        },
        isActive: true,
      },
    ];

    // Firestore에 데이터 저장
    for (const student of testStudents) {
      await admin.firestore()
        .collection("academies")
        .doc(data.academyId)
        .collection("students")
        .doc(student.authUid)
        .set({
          ...student,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
    }

    for (const adminUser of testAdmins) {
      await admin.firestore()
        .collection("academies")
        .doc(data.academyId)
        .collection("admins")
        .doc(adminUser.authUid)
        .set({
          ...adminUser,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
    }

    return createTestDataResponse(
      testStudents.length,
      testAdmins.length,
      "테스트 데이터가 생성되었습니다."
    );
  } catch (error) {
    console.error("테스트 데이터 생성 실패:", error);
    throw new Error("테스트 데이터 생성에 실패했습니다.");
  }
}
