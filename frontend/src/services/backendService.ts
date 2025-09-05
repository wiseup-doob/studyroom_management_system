/**
 * 백엔드 Cloud Functions 서비스
 * 
 * 프론트엔드에서 백엔드 함수들을 호출하는 서비스
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

// ==================== 타입 정의 ====================

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  academyId: string;
  role: 'student' | 'admin' | 'super_admin';
  grade?: string;
  permissions?: string[];
}

export interface SetUserRoleRequest {
  uid: string;
  academyId: string;
  role: 'student' | 'admin' | 'super_admin';
}

export interface GetUsersRequest {
  academyId?: string;
  role: 'student' | 'admin' | 'super_admin';
}

export interface CreateAcademyRequest {
  academyId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  operatingHours?: {
    open: string;
    close: string;
  };
  settings?: {
    maxStudents: number;
    seatCapacity: number;
    attendanceCheckInTime: string;
    attendanceCheckOutTime: string;
  };
}

export interface CreateTestDataRequest {
  academyId: string;
}

// ==================== 응답 타입 ====================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface UserResponse {
  success: boolean;
  uid?: string;
  email?: string;
  customClaims?: any;
  message?: string;
}

export interface UsersListResponse {
  success: boolean;
  users: any[];
  count: number;
}

export interface AcademyResponse {
  success: boolean;
  academyId?: string;
  message?: string;
}

export interface TestDataResponse {
  success: boolean;
  message?: string;
  studentsCount?: number;
  adminsCount?: number;
}

// ==================== 백엔드 서비스 클래스 ====================

class BackendService {
  private functions = functions;

  // ==================== 사용자 관리 함수 ====================

  /**
   * 사용자 역할 부여
   */
  async setUserRole(data: SetUserRoleRequest): Promise<ApiResponse> {
    try {
      const setUserRoleFunction = httpsCallable(this.functions, 'setUserRole');
      const result = await setUserRoleFunction(data);
      return result.data as ApiResponse;
    } catch (error) {
      console.error('사용자 역할 설정 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자 등록
   */
  async createUser(data: CreateUserRequest): Promise<UserResponse> {
    try {
      const createUserFunction = httpsCallable(this.functions, 'createUser');
      const result = await createUserFunction(data);
      return result.data as UserResponse;
    } catch (error) {
      console.error('사용자 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자 목록 조회
   */
  async getUsers(data: GetUsersRequest): Promise<UsersListResponse> {
    try {
      const getUsersFunction = httpsCallable(this.functions, 'getUsers');
      const result = await getUsersFunction(data);
      return result.data as UsersListResponse;
    } catch (error) {
      console.error('사용자 목록 조회 실패:', error);
      throw error;
    }
  }

  // ==================== 학원 관리 함수 ====================

  /**
   * 학원 생성
   */
  async createAcademy(data: CreateAcademyRequest): Promise<AcademyResponse> {
    try {
      const createAcademyFunction = httpsCallable(this.functions, 'createAcademy');
      const result = await createAcademyFunction(data);
      return result.data as AcademyResponse;
    } catch (error) {
      console.error('학원 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 테스트 데이터 생성
   */
  async createTestData(data: CreateTestDataRequest): Promise<TestDataResponse> {
    try {
      const createTestDataFunction = httpsCallable(this.functions, 'createTestData');
      const result = await createTestDataFunction(data);
      return result.data as TestDataResponse;
    } catch (error) {
      console.error('테스트 데이터 생성 실패:', error);
      throw error;
    }
  }
}

// ==================== 싱글톤 인스턴스 ====================

export const backendService = new BackendService();
