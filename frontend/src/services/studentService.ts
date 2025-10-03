/**
 * 학생 관리 서비스
 * 
 * 학생 CRUD, 검색, 시간표 통합 조회 등 학생 관련 기능
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import {
  Student,
  CreateStudentRequest,
  UpdateStudentRequest,
  StudentWithTimetable,
} from '../types/student';

// ==================== 학생 관리 서비스 클래스 ====================

class StudentService {
  private functions = functions;

  /**
   * 학생 생성
   */
  async createStudent(data: CreateStudentRequest): Promise<Student> {
    try {
      const createStudentFunction = httpsCallable(this.functions, 'createStudent');
      const result = await createStudentFunction(data);
      return (result.data as any).data as Student;
    } catch (error) {
      console.error('학생 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 학생 목록 조회
   */
  async getStudents(): Promise<Student[]> {
    try {
      // Firebase Auth에서 현재 사용자의 ID 토큰 가져오기
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('사용자가 로그인되지 않았습니다.');
      }

      const token = await user.getIdToken();
      
      // 환경 변수에서 프로젝트 ID 가져오기
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      const functionUrl = `https://asia-northeast3-${projectId}.cloudfunctions.net/getStudents`;
      
      // HTTP 요청으로 Cloud Function 호출
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('getStudents 응답:', result);
      
      // 응답 구조 확인 및 안전한 데이터 추출
      if (result && result.data && Array.isArray(result.data)) {
        return result.data as Student[];
      } else if (result && Array.isArray(result)) {
        return result as Student[];
      } else {
        console.warn('예상과 다른 응답 구조:', result);
        return [];
      }
    } catch (error) {
      console.error('학생 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 학생 조회
   */
  async getStudent(studentId: string): Promise<Student> {
    try {
      const getStudentFunction = httpsCallable(this.functions, 'getStudent');
      const result = await getStudentFunction({ studentId });
      return (result.data as any).data as Student;
    } catch (error) {
      console.error('학생 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 학생 정보 수정
   */
  async updateStudent(studentId: string, data: UpdateStudentRequest): Promise<Student> {
    try {
      const updateStudentFunction = httpsCallable(this.functions, 'updateStudent');
      const result = await updateStudentFunction({ studentId, ...data });
      return (result.data as any).data as Student;
    } catch (error) {
      console.error('학생 정보 수정 실패:', error);
      throw error;
    }
  }

  /**
   * 학생 삭제
   */
  async deleteStudent(studentId: string): Promise<void> {
    try {
      const deleteStudentFunction = httpsCallable(this.functions, 'deleteStudent');
      await deleteStudentFunction({ studentId });
    } catch (error) {
      console.error('학생 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 학생 검색
   */
  async searchStudents(query: string, limit?: number): Promise<Student[]> {
    try {
      const searchStudentsFunction = httpsCallable(this.functions, 'searchStudents');
      const result = await searchStudentsFunction({ query, limit });
      return (result.data as any).data as Student[];
    } catch (error) {
      console.error('학생 검색 실패:', error);
      throw error;
    }
  }

  /**
   * 학생 + 시간표 통합 조회 (시간표 페이지용)
   */
  async getStudentsWithTimetables(): Promise<StudentWithTimetable[]> {
    try {
      const getStudentsWithTimetablesFunction = httpsCallable(this.functions, 'getStudentsWithTimetables');
      const result = await getStudentsWithTimetablesFunction();
      return (result.data as any).data as StudentWithTimetable[];
    } catch (error) {
      console.error('학생 + 시간표 통합 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 학생 + 시간표 조회
   */
  async getStudentWithTimetable(studentId: string): Promise<StudentWithTimetable> {
    try {
      const getStudentWithTimetableFunction = httpsCallable(this.functions, 'getStudentWithTimetable');
      const result = await getStudentWithTimetableFunction({ studentId });
      return (result.data as any).data as StudentWithTimetable;
    } catch (error) {
      console.error('학생 + 시간표 조회 실패:', error);
      throw error;
    }
  }
}

// ==================== 싱글톤 인스턴스 ====================

export const studentService = new StudentService();
