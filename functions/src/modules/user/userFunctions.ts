/**
 * 사용자 관리 Cloud Functions
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {setUserRole, createUser, getUsers} from "./userService";
import {CreateUserRequest, SetUserRoleRequest, GetUsersRequest} from "../../types";

/**
 * 사용자 역할 부여 함수
 */
export const setUserRoleFunction = onCall(async (request) => {
  try {
    return await setUserRole(request.data as SetUserRoleRequest, request);
  } catch (error) {
    console.error("setUserRoleFunction 오류:", error);
    throw new HttpsError("internal", error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
  }
});

/**
 * 사용자 등록 함수
 */
export const createUserFunction = onCall(async (request) => {
  try {
    return await createUser(request.data as CreateUserRequest, request);
  } catch (error) {
    console.error("createUserFunction 오류:", error);
    throw new HttpsError("internal", error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
  }
});

/**
 * 사용자 목록 조회 함수
 */
export const getUsersFunction = onCall(async (request) => {
  try {
    return await getUsers(request.data as GetUsersRequest, request);
  } catch (error) {
    console.error("getUsersFunction 오류:", error);
    throw new HttpsError("internal", error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
  }
});
