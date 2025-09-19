/**
 * 백엔드 Cloud Functions 서비스
 * 
 * 프론트엔드에서 백엔드 함수들을 호출하는 서비스
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';

// ==================== 타입 정의 ====================

export interface CreateUserProfileRequest {
  authUid: string;
  name: string;
  email: string;
  profilePicture?: string;
  googleId?: string;
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
  userProfile?: any;
  message?: string;
}

export interface UserDataStatsResponse {
  success: boolean;
  stats?: any;
  message?: string;
}

export interface UserDataBackupResponse {
  success: boolean;
  backupId?: string;
  message?: string;
}

export interface DeleteUserResponse {
  success: boolean;
  deletedDocuments?: number;
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
}

// ==================== 싱글톤 인스턴스 ====================

export const backendService = new BackendService();
