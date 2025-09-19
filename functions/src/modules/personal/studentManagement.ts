/**
 * 학생 관리 Cloud Functions
 * 
 * 사용자 기반 데이터 격리 아키텍처에 따른 학생 데이터 관리
 * - 각 사용자는 자신의 학생 데이터에만 접근 가능
 * - Google 인증 기반 권한 관리
 * - 완전한 데이터 격리
 */

import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

const db = getFirestore();

// 학생 데이터 인터페이스
export interface Student {
  id: string;
  name: string;
  email: string;
  grade: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

// 요청 인터페이스
export interface CreateStudentRequest {
  name: string;
  email: string;
  grade: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  address?: string;
}

export interface UpdateStudentRequest {
  name?: string;
  email?: string;
  grade?: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  address?: string;
}

export interface SearchStudentsRequest {
  query: string;
  limit?: number;
}

/**
 * 데이터 검증 함수
 * @param {CreateStudentRequest | UpdateStudentRequest} data - 검증할 데이터
 */
function validateStudentData(data: CreateStudentRequest | UpdateStudentRequest): void {
  if ("name" in data && (!data.name || data.name.trim().length === 0)) {
    throw new HttpsError("invalid-argument", "이름은 필수 입력 항목입니다.");
  }
  
  if ("email" in data && data.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new HttpsError("invalid-argument", "올바른 이메일 형식이 아닙니다.");
    }
  }
  
  if ("grade" in data && data.grade && !["중1", "중2", "중3", "고1", "고2", "고3"].includes(data.grade)) {
    throw new HttpsError("invalid-argument", "올바른 학년을 선택해주세요.");
  }
  
  if ("phone" in data && data.phone) {
    const phoneRegex = /^010-\d{4}-\d{4}$/;
    if (!phoneRegex.test(data.phone)) {
      throw new HttpsError("invalid-argument", "올바른 전화번호 형식이 아닙니다. (010-0000-0000)");
    }
  }
  
  if ("parentPhone" in data && data.parentPhone) {
    const phoneRegex = /^010-\d{4}-\d{4}$/;
    if (!phoneRegex.test(data.parentPhone)) {
      throw new HttpsError("invalid-argument", "올바른 보호자 전화번호 형식이 아닙니다. (010-0000-0000)");
    }
  }
}

// 사용자 인증 및 권한 확인 (현재 미사용, 향후 확장용)
// async function verifyUser(authToken: string): Promise<string> {
//   try {
//     const decodedToken = await getAuth().verifyIdToken(authToken);
//     return decodedToken.uid;
//   } catch (error) {
//     logger.error('사용자 인증 실패:', error);
//     throw new HttpsError('unauthenticated', '인증이 필요합니다.');
//   }
// }

/**
 * 학생 생성
 */
export const createStudent = onCall({
  cors: true
}, async (request) => {
  try {
    const { auth, data } = request;
    
    if (!auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    const userId = auth.uid;
    const studentData = data as CreateStudentRequest;

    // 데이터 검증
    validateStudentData(studentData);

    // 필수 필드 확인
    if (!studentData.name || !studentData.grade) {
      throw new HttpsError("invalid-argument", "이름, 학년은 필수 입력 항목입니다.");
    }

    // 이메일이 제공된 경우에만 중복 확인
    if (studentData.email && studentData.email.trim()) {
      const existingStudent = await db
        .collection("users")
        .doc(userId)
        .collection("students")
        .where("email", "==", studentData.email.toLowerCase().trim())
        .where("isActive", "==", true)
        .get();

      if (!existingStudent.empty) {
        throw new HttpsError("already-exists", "이미 등록된 이메일입니다.");
      }
    }

    // 학생 데이터 생성
    const studentId = db.collection("users").doc(userId).collection("students").doc().id;
    const now = new Date();
    
    const newStudent: Student = {
      id: studentId,
      name: studentData.name.trim(),
      email: studentData.email ? studentData.email.toLowerCase().trim() : "",
      grade: studentData.grade,
      phone: studentData.phone?.trim(),
      parentName: studentData.parentName?.trim(),
      parentPhone: studentData.parentPhone?.trim(),
      address: studentData.address?.trim(),
      isActive: true,
      createdAt: now,
      updatedAt: now,
      userId: userId
    };

    // Firestore에 저장
    await db
      .collection("users")
      .doc(userId)
      .collection("students")
      .doc(studentId)
      .set(newStudent);

    logger.info(`학생 생성 성공: ${studentId}`, { userId, studentName: studentData.name });

    return {
      success: true,
      data: newStudent
    };
  } catch (error) {
    logger.error("학생 생성 실패:", error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError("internal", "학생 생성 중 오류가 발생했습니다.");
  }
});

/**
 * 학생 목록 조회
 */
export const getStudents = onRequest(async (request, response) => {
  // CORS 헤더 설정
  response.set("Access-Control-Allow-Origin", "*");
  response.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  // OPTIONS 요청 처리 (Preflight)
  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return;
  }

  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      response.status(401).json({ error: "인증이 필요합니다." });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require("firebase-admin");
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    // 학생 목록 조회 (활성 상태만)
    const studentsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("students")
      .where("isActive", "==", true)
      .orderBy("createdAt", "desc")
      .get();

    const students: Student[] = [];
    studentsSnapshot.forEach(doc => {
      const data = doc.data();
      students.push({
        ...data,
        createdAt: (data.createdAt as any).toDate(),
        updatedAt: (data.updatedAt as any).toDate()
      } as Student);
    });

    logger.info(`학생 목록 조회 성공: ${students.length}명`, { userId });

    response.json({
      success: true,
      data: students
    });
  } catch (error) {
    logger.error("학생 목록 조회 실패:", error);
    response.status(500).json({ 
      error: "학생 목록 조회 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "알 수 없는 오류"
    });
  }
});

/**
 * 특정 학생 조회
 */
export const getStudent = onCall({
  cors: true
}, async (request) => {
  try {
    const { auth, data } = request;
    
    if (!auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    const userId = auth.uid;
    const { studentId } = data as { studentId: string };

    if (!studentId) {
      throw new HttpsError("invalid-argument", "학생 ID가 필요합니다.");
    }

    // 학생 조회
    const studentDoc = await db
      .collection("users")
      .doc(userId)
      .collection("students")
      .doc(studentId)
      .get();

    if (!studentDoc.exists) {
      throw new HttpsError("not-found", "학생을 찾을 수 없습니다.");
    }

    const studentData = studentDoc.data();
    if (!studentData) {
      throw new HttpsError("not-found", "학생 데이터를 찾을 수 없습니다.");
    }
    
    const student: Student = {
      ...studentData,
      createdAt: (studentData.createdAt as any).toDate(),
      updatedAt: (studentData.updatedAt as any).toDate()
    } as Student;

    logger.info(`학생 조회 성공: ${studentId}`, { userId });

    return {
      success: true,
      data: student
    };
  } catch (error) {
    logger.error("학생 조회 실패:", error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError("internal", "학생 조회 중 오류가 발생했습니다.");
  }
});

/**
 * 학생 정보 수정
 */
export const updateStudent = onCall({
  cors: true
}, async (request) => {
  try {
    const { auth, data } = request;
    
    if (!auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    const userId = auth.uid;
    const { studentId, ...updateData } = data as { studentId: string } & UpdateStudentRequest;

    if (!studentId) {
      throw new HttpsError("invalid-argument", "학생 ID가 필요합니다.");
    }

    // 데이터 검증
    validateStudentData(updateData);

    // 학생 존재 확인
    const studentRef = db
      .collection("users")
      .doc(userId)
      .collection("students")
      .doc(studentId);

    const studentDoc = await studentRef.get();
    if (!studentDoc.exists) {
      throw new HttpsError("not-found", "학생을 찾을 수 없습니다.");
    }

    // 이메일 중복 확인 (이메일이 변경되는 경우)
    if (updateData.email) {
      const existingStudent = await db
        .collection("users")
        .doc(userId)
        .collection("students")
        .where("email", "==", updateData.email)
        .where("isActive", "==", true)
        .get();

      const duplicateStudent = existingStudent.docs.find(doc => doc.id !== studentId);
      if (duplicateStudent) {
        throw new HttpsError("already-exists", "이미 등록된 이메일입니다.");
      }
    }

    // 업데이트 데이터 준비
    const updateFields: any = {
      updatedAt: FieldValue.serverTimestamp()
    };

    if (updateData.name) updateFields.name = updateData.name.trim();
    if (updateData.email) updateFields.email = updateData.email.toLowerCase().trim();
    if (updateData.grade) updateFields.grade = updateData.grade;
    if (updateData.phone !== undefined) updateFields.phone = updateData.phone?.trim() || null;
    if (updateData.parentName !== undefined) updateFields.parentName = updateData.parentName?.trim() || null;
    if (updateData.parentPhone !== undefined) updateFields.parentPhone = updateData.parentPhone?.trim() || null;
    if (updateData.address !== undefined) updateFields.address = updateData.address?.trim() || null;

    // 학생 정보 업데이트
    await studentRef.update(updateFields);

    // 업데이트된 학생 정보 조회
    const updatedStudentDoc = await studentRef.get();
    const updatedStudentData = updatedStudentDoc.data();
    if (!updatedStudentData) {
      throw new HttpsError("not-found", "업데이트된 학생 데이터를 찾을 수 없습니다.");
    }
    
    const updatedStudent: Student = {
      ...updatedStudentData,
      createdAt: (updatedStudentData.createdAt as any).toDate(),
      updatedAt: (updatedStudentData.updatedAt as any).toDate()
    } as Student;

    logger.info(`학생 정보 수정 성공: ${studentId}`, { userId });

    return {
      success: true,
      data: updatedStudent
    };
  } catch (error) {
    logger.error("학생 정보 수정 실패:", error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError("internal", "학생 정보 수정 중 오류가 발생했습니다.");
  }
});

/**
 * 학생 삭제 (소프트 삭제)
 */
export const deleteStudent = onCall({
  cors: true
}, async (request) => {
  try {
    const { auth, data } = request;
    
    if (!auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    const userId = auth.uid;
    const { studentId } = data as { studentId: string };

    if (!studentId) {
      throw new HttpsError("invalid-argument", "학생 ID가 필요합니다.");
    }

    // 학생 존재 확인
    const studentRef = db
      .collection("users")
      .doc(userId)
      .collection("students")
      .doc(studentId);

    const studentDoc = await studentRef.get();
    if (!studentDoc.exists) {
      throw new HttpsError("not-found", "학생을 찾을 수 없습니다.");
    }

    // 소프트 삭제 (isActive = false)
    await studentRef.update({
      isActive: false,
      updatedAt: FieldValue.serverTimestamp()
    });

    logger.info(`학생 삭제 성공: ${studentId}`, { userId });

    return {
      success: true,
      message: "학생이 삭제되었습니다."
    };
  } catch (error) {
    logger.error("학생 삭제 실패:", error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError("internal", "학생 삭제 중 오류가 발생했습니다.");
  }
});

/**
 * 학생 검색
 */
export const searchStudents = onCall({
  cors: true
}, async (request) => {
  try {
    const { auth, data } = request;
    
    if (!auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    const userId = auth.uid;
    const { query, limit = 20 } = data as SearchStudentsRequest;

    if (!query || query.trim().length === 0) {
      throw new HttpsError("invalid-argument", "검색어를 입력해주세요.");
    }

    const searchQuery = query.trim().toLowerCase();

    // 이름으로 검색
    const nameResults = await db
      .collection("users")
      .doc(userId)
      .collection("students")
      .where("isActive", "==", true)
      .where("name", ">=", searchQuery)
      .where("name", "<=", searchQuery + "\uf8ff")
      .limit(limit)
      .get();

    // 이메일로 검색
    const emailResults = await db
      .collection("users")
      .doc(userId)
      .collection("students")
      .where("isActive", "==", true)
      .where("email", ">=", searchQuery)
      .where("email", "<=", searchQuery + "\uf8ff")
      .limit(limit)
      .get();

    // 결과 합치기 및 중복 제거
    const allResults = new Map<string, Student>();
    
    [...nameResults.docs, ...emailResults.docs].forEach(doc => {
      const data = doc.data();
      const student: Student = {
        ...data,
        createdAt: (data.createdAt as any).toDate(),
        updatedAt: (data.updatedAt as any).toDate()
      } as Student;
      allResults.set(doc.id, student);
    });

    const students = Array.from(allResults.values()).slice(0, limit);

    logger.info(`학생 검색 성공: "${searchQuery}" - ${students.length}명`, { userId });

    return {
      success: true,
      data: students
    };
  } catch (error) {
    logger.error("학생 검색 실패:", error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError("internal", "학생 검색 중 오류가 발생했습니다.");
  }
});
