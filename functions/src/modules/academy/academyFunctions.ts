/**
 * 학원 관리 Cloud Functions
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {createAcademy, createTestData} from "./academyService";
import {CreateAcademyRequest, CreateTestDataRequest} from "../../types";

/**
 * 새 학원 생성 함수
 */
export const createAcademyFunction = onCall(async (request) => {
  try {
    return await createAcademy(request.data as CreateAcademyRequest, request);
  } catch (error) {
    console.error("createAcademyFunction 오류:", error);
    throw new HttpsError("internal", error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
  }
});

/**
 * 테스트 데이터 생성 함수
 */
export const createTestDataFunction = onCall(async (request) => {
  try {
    return await createTestData(request.data as CreateTestDataRequest, request);
  } catch (error) {
    console.error("createTestDataFunction 오류:", error);
    throw new HttpsError("internal", error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
  }
});
