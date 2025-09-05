/**
 * 사용자 관리 서비스
 */

import * as admin from "firebase-admin";
import {CreateUserRequest, SetUserRoleRequest, GetUsersRequest} from "../../types";
import {validateSuperAdmin, createCustomClaims} from "../utils/auth";
import {
  validateRequiredFields,
  validateEmail,
  validatePassword,
  validateRole,
  validateAcademyId,
} from "../utils/validation";
import {createUserResponse, createUsersListResponse} from "../utils/response";

/**
 * 사용자 역할 부여
 */
export async function setUserRole(data: SetUserRoleRequest, request: any) {
  // 슈퍼 관리자 권한 검증
  validateSuperAdmin(request);

  // 유효성 검사
  validateRequiredFields(data, ["uid", "academyId", "role"]);
  validateRole(data.role);
  validateAcademyId(data.academyId);

  try {
    // 커스텀 클레임 설정
    const customClaims = createCustomClaims(data.academyId, data.role);
    await admin.auth().setCustomUserClaims(data.uid, customClaims);

    return {
      success: true,
      message: "사용자 역할이 설정되었습니다.",
      customClaims,
    };
  } catch (error) {
    console.error("사용자 역할 설정 실패:", error);
    throw new Error("사용자 역할 설정에 실패했습니다.");
  }
}

/**
 * 사용자 등록
 */
export async function createUser(data: CreateUserRequest, request: any) {
  // 슈퍼 관리자 권한 검증
  validateSuperAdmin(request);

  // 유효성 검사
  validateRequiredFields(data, ["email", "password", "name", "academyId", "role"]);
  validateEmail(data.email);
  validatePassword(data.password);
  validateRole(data.role);
  validateAcademyId(data.academyId);

  try {
    // Firebase Auth 사용자 생성
    const userRecord = await admin.auth().createUser({
      email: data.email,
      password: data.password,
      displayName: data.name,
    });

    // 커스텀 클레임 설정
    const customClaims = createCustomClaims(data.academyId, data.role);
    await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

    // Firestore에 사용자 정보 저장
    await saveUserToFirestore(userRecord, data);

    return createUserResponse(
      userRecord.uid,
      userRecord.email || "",
      customClaims,
      "사용자가 성공적으로 생성되었습니다."
    );
  } catch (error) {
    console.error("사용자 생성 실패:", error);
    throw new Error("사용자 생성에 실패했습니다.");
  }
}

/**
 * 사용자 목록 조회
 */
export async function getUsers(data: GetUsersRequest, request: any) {
  // 슈퍼 관리자 권한 검증
  validateSuperAdmin(request);

  try {
    let users: any[] = [];

    if (data.role === "student" && data.academyId) {
      // 학생 목록 조회
      const studentsSnapshot = await admin.firestore()
        .collection("academies")
        .doc(data.academyId)
        .collection("students")
        .get();

      users = studentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } else if (data.role === "admin" && data.academyId) {
      // 관리자 목록 조회
      const adminsSnapshot = await admin.firestore()
        .collection("academies")
        .doc(data.academyId)
        .collection("admins")
        .get();

      users = adminsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } else if (data.role === "super_admin") {
      // 슈퍼 관리자 목록 조회
      const superAdminsSnapshot = await admin.firestore()
        .collection("academies")
        .doc("system")
        .collection("admins")
        .get();

      users = superAdminsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    }

    return createUsersListResponse(users);
  } catch (error) {
    console.error("사용자 목록 조회 실패:", error);
    throw new Error("사용자 목록 조회에 실패했습니다.");
  }
}

/**
 * Firestore에 사용자 정보 저장
 */
async function saveUserToFirestore(userRecord: admin.auth.UserRecord, data: CreateUserRequest): Promise<void> {
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  if (data.role === "student") {
    await admin.firestore()
      .collection("academies")
      .doc(data.academyId)
      .collection("students")
      .doc(userRecord.uid)
      .set({
        authUid: userRecord.uid,
        name: data.name,
        grade: data.grade || "초1",
        status: "active",
        contactInfo: {
          email: data.email,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      });
  } else if (data.role === "admin" || data.role === "super_admin") {
    await admin.firestore()
      .collection("academies")
      .doc(data.academyId)
      .collection("admins")
      .doc(userRecord.uid)
      .set({
        authUid: userRecord.uid,
        name: data.name,
        academyId: data.academyId,
        role: data.role,
        permissions: data.permissions || ["manage_students"],
        contactInfo: {
          email: data.email,
        },
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
  }
}
