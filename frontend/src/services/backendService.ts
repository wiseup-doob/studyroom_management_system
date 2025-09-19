/**
 * 백엔드 Cloud Functions 서비스
 * 
 * 프론트엔드에서 백엔드 함수들을 호출하는 서비스
 * 사용자 기반 데이터 격리 아키텍처
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { Student, CreateStudentRequest, UpdateStudentRequest, SearchStudentsRequest } from '../types/student';

// ==================== 사용자 프로필 관리 타입 ====================

export interface CreateUserProfileRequest {
  name: string;
  email: string;
  profilePicture?: string;
  googleId: string;
}

export interface UpdateUserProfileRequest {
  name?: string;
  email?: string;
  profilePicture?: string;
}

export interface DeactivateUserProfileRequest {
  userId: string;
}

export interface DeleteUserProfileRequest {
  userId: string;
  confirmDeletion: boolean;
}

export interface RestoreUserProfileRequest {
  userId: string;
}

export interface GetUserDataStatsRequest {
  userId: string;
}

export interface CreateUserDataBackupRequest {
  userId: string;
}

// ==================== 응답 타입 ====================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface UserProfileResponse {
  success: boolean;
  data?: {
    authUid: string;
    name: string;
    email: string;
    profilePicture?: string;
    googleId: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  message?: string;
}

export interface UserDataStatsResponse {
  success: boolean;
  data?: {
    userId: string;
    totalDocuments: number;
    collectionStats: {
      [collectionName: string]: number;
    };
    userInfo: {
      name: string;
      email: string;
      isActive: boolean;
      createdAt: Date;
    };
  };
  message?: string;
}

export interface UserDataBackupResponse {
  success: boolean;
  data?: {
    userId: string;
    userProfile: any;
    collections: {
      [collectionName: string]: Array<{
        id: string;
        data: any;
      }>;
    };
    createdAt: Date;
    backupType: string;
  };
  message?: string;
}

export interface DeleteUserResponse {
  success: boolean;
  message?: string;
}

// ==================== 백엔드 서비스 클래스 ====================

class BackendService {
  private functions = functions;

  // ==================== 사용자 프로필 관리 함수 ====================

  /**
   * 사용자 프로필 생성/업데이트
   */
  async createOrUpdateUserProfile(data: CreateUserProfileRequest): Promise<UserProfileResponse> {
    try {
      const createOrUpdateUserProfileFunction = httpsCallable(this.functions, 'createOrUpdateUserProfile');
      const result = await createOrUpdateUserProfileFunction(data);
      return result.data as UserProfileResponse;
    } catch (error) {
      console.error('사용자 프로필 생성/업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자 프로필 조회
   */
  async getUserProfile(userId: string): Promise<UserProfileResponse> {
    try {
      const getUserProfileFunction = httpsCallable(this.functions, 'getUserProfile');
      const result = await getUserProfileFunction({ userId });
      return result.data as UserProfileResponse;
    } catch (error) {
      console.error('사용자 프로필 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자 프로필 비활성화
   */
  async deactivateUserProfile(userId: string): Promise<ApiResponse> {
    try {
      const deactivateUserProfileFunction = httpsCallable(this.functions, 'deactivateUserProfile');
      const result = await deactivateUserProfileFunction({ userId });
      return result.data as ApiResponse;
    } catch (error) {
      console.error('사용자 프로필 비활성화 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자 프로필 완전 삭제
   */
  async deleteUserProfile(userId: string, confirmDeletion: boolean = false): Promise<DeleteUserResponse> {
    try {
      const deleteUserProfileFunction = httpsCallable(this.functions, 'deleteUserProfile');
      const result = await deleteUserProfileFunction({ userId, confirmDeletion });
      return result.data as DeleteUserResponse;
    } catch (error) {
      console.error('사용자 프로필 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자 프로필 복구
   */
  async restoreUserProfile(userId: string): Promise<ApiResponse> {
    try {
      const restoreUserProfileFunction = httpsCallable(this.functions, 'restoreUserProfile');
      const result = await restoreUserProfileFunction({ userId });
      return result.data as ApiResponse;
    } catch (error) {
      console.error('사용자 프로필 복구 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자 데이터 통계 조회
   */
  async getUserDataStats(userId: string): Promise<UserDataStatsResponse> {
    try {
      const getUserDataStatsFunction = httpsCallable(this.functions, 'getUserDataStats');
      const result = await getUserDataStatsFunction({ userId });
      return result.data as UserDataStatsResponse;
    } catch (error) {
      console.error('사용자 데이터 통계 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자 데이터 백업 생성
   */
  async createUserDataBackup(userId: string): Promise<UserDataBackupResponse> {
    try {
      const createUserDataBackupFunction = httpsCallable(this.functions, 'createUserDataBackup');
      const result = await createUserDataBackupFunction({ userId });
      return result.data as UserDataBackupResponse;
    } catch (error) {
      console.error('사용자 데이터 백업 생성 실패:', error);
      throw error;
    }
  }

  // ==================== 학생 관리 함수 ====================

  /**
   * 학생 생성
   */
  async createStudent(data: CreateStudentRequest): Promise<Student> {
    try {
      const createStudentFunction = httpsCallable(this.functions, 'createStudent');
      const result = await createStudentFunction(data);
      return result.data.data as Student;
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
      
      // HTTP 요청으로 Cloud Function 호출
      const response = await fetch('https://us-central1-studyroommanagementsystemtest.cloudfunctions.net/getStudents', {
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
      return result.data as Student[];
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
      return result.data.data as Student;
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
      return result.data.data as Student;
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
      return result.data.data as Student[];
    } catch (error) {
      console.error('학생 검색 실패:', error);
      throw error;
    }
  }
}

// ==================== 싱글톤 인스턴스 ====================

export const backendService = new BackendService();
