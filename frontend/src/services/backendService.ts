/**
 * 백엔드 서비스 통합 인덱스
 * 
 * 모든 백엔드 서비스들을 통합하여 제공하는 인덱스 파일
 * 각 도메인별 서비스들을 재export하여 기존 코드와의 호환성 유지
 */

// ==================== 서비스 재export ====================

// 사용자 프로필 관리 서비스
export {
  userProfileService,
  type CreateUserProfileRequest,
  type UpdateUserProfileRequest,
  type DeactivateUserProfileRequest,
  type DeleteUserProfileRequest,
  type RestoreUserProfileRequest,
  type GetUserDataStatsRequest,
  type CreateUserDataBackupRequest,
  type ApiResponse,
  type UserProfileResponse,
  type UserDataStatsResponse,
  type UserDataBackupResponse,
  type DeleteUserResponse,
} from './userProfileService';

// 학생 관리 서비스
export {
  studentService,
} from './studentService';

// 학생 시간표 관리 서비스 (기존 유지)
export {
  studentTimetableService,
} from './studentTimetableService';

// ==================== 기존 호환성을 위한 백엔드 서비스 클래스 ====================

import { auth, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { userProfileService } from './userProfileService';
import { studentService } from './studentService';

class BackendService {
  // 사용자 프로필 관리 함수들 (userProfileService로 위임)
  createOrUpdateUserProfile = userProfileService.createOrUpdateUserProfile.bind(userProfileService);
  getUserProfile = userProfileService.getUserProfile.bind(userProfileService);
  deactivateUserProfile = userProfileService.deactivateUserProfile.bind(userProfileService);
  deleteUserProfile = userProfileService.deleteUserProfile.bind(userProfileService);
  restoreUserProfile = userProfileService.restoreUserProfile.bind(userProfileService);
  getUserDataStats = userProfileService.getUserDataStats.bind(userProfileService);
  createUserDataBackup = userProfileService.createUserDataBackup.bind(userProfileService);

  // 학생 관리 함수들 (studentService로 위임)
  createStudent = studentService.createStudent.bind(studentService);
  getStudents = studentService.getStudents.bind(studentService);
  getStudent = studentService.getStudent.bind(studentService);
  updateStudent = studentService.updateStudent.bind(studentService);
  deleteStudent = studentService.deleteStudent.bind(studentService);
  searchStudents = studentService.searchStudents.bind(studentService);
  getStudentsWithTimetables = studentService.getStudentsWithTimetables.bind(studentService);
  getStudentWithTimetable = studentService.getStudentWithTimetable.bind(studentService);

  // ==================== Firebase Functions 호출 메서드 ====================

  /**
   * Firebase Functions 호출을 위한 범용 call 메서드 (fetch API 사용)
   */
  async call(functionName: string, data?: any): Promise<any> {
    try {
      // 현재 사용자 확인
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('사용자가 로그인되어 있지 않습니다.');
      }

      console.log(`Firebase Function ${functionName} 호출 시작:`, {
        userId: currentUser.uid,
        email: currentUser.email,
        data: data
      });

      // ID 토큰 획득 (최신 토큰 보장)
      const idToken = await currentUser.getIdToken(true);
      console.log('ID 토큰 획득 완료:', idToken ? '성공' : '실패');

      // Functions URL 구성 (https.onRequest 타입 함수용)
      const functionUrl = `https://${functionName}-rwsdour62q-du.a.run.app`;
      console.log('Function URL:', functionUrl);

      // fetch API를 사용하여 명시적으로 인증 토큰 전달
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ data })
      });

      console.log('Response Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response Error:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`Firebase Function ${functionName} 호출 성공:`, result);
      
      // onRequest 타입 함수는 직접 JSON을 반환하므로 result 자체가 응답 데이터
      return result;
    } catch (error) {
      console.error(`Firebase Function ${functionName} 호출 실패:`, error);
      throw error;
    }
  }

  // ==================== 공유 링크 관련 메서드들 ====================

  /**
   * 학생 시간표 편집 링크 생성
   */
  async createStudentTimetableEditLink(data: {
    studentId: string;
    timetableId: string;
    expiresInDays?: number;
    title?: string;
    description?: string;
    editPermissions?: {
      canAddSlots: boolean;
      canDeleteSlots: boolean;
      canModifySlots: boolean;
      restrictedTimeSlots?: string[];
      // 확장된 기본 스케줄 편집 권한
      canEditBasicSchedule?: boolean;
      canEditDailySchedules?: boolean;
      canEditTimeSlotInterval?: boolean;
      dailySchedulePermissions?: {
        [key: string]: {
          canEditArrivalTime: boolean;
          canEditDepartureTime: boolean;
          canToggleActive: boolean;
        };
      };
      timeSlotIntervalOptions?: number[];
    };
  }): Promise<any> {
    try {
      const createLinkFunction = httpsCallable(functions, 'createStudentTimetableEditLink');
      const result = await createLinkFunction(data);
      return result.data;
    } catch (error) {
      console.error('링크 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 공유된 시간표 데이터 조회
   */
  async getSharedTimetableData(data: {
    shareToken: string;
  }): Promise<any> {
    try {
      console.log('getSharedTimetableData 호출 시작:', data);
      const getDataFunction = httpsCallable(functions, 'getSharedTimetableData');
      const result = await getDataFunction(data);
      console.log('getSharedTimetableData 호출 성공:', result.data);
      return result.data;
    } catch (error) {
      console.error('getSharedTimetableData 호출 실패:', error);
      throw error;
    }
  }

  /**
   * 편집 상태 업데이트 (Firebase 기반 임시 저장)
   * 확장된 기능: 기본 스케줄 변경사항 지원
   */
  async updateEditState(data: {
    shareToken: string;
    currentTimetable: any;
    changes?: any;
    // 새로운 기본 스케줄 편집 지원
    updatedBasicSchedule?: any;
    basicScheduleChanges?: any;
  }): Promise<any> {
    try {
      const updateFunction = httpsCallable(functions, 'updateEditState');
      const result = await updateFunction(data);
      return result.data;
    } catch (error) {
      console.error('편집 상태 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 편집 상태 조회
   */
  async getEditState(data: {
    shareToken: string;
  }): Promise<any> {
    try {
      console.log('getEditState 호출 시작:', data);
      const getStateFunction = httpsCallable(functions, 'getEditState');
      const result = await getStateFunction(data);
      console.log('getEditState 호출 성공:', result.data);
      return result.data;
    } catch (error) {
      console.error('getEditState 호출 실패:', error);
      throw error;
    }
  }

  /**
   * 시간표 편집 제출 (새로운 구조)
   */
  async submitTimetableEdit(data: {
    shareToken: string;
    submissionNotes?: string;
  }): Promise<any> {
    // onRequest 타입으로 직접 HTTP 호출
    const functionUrl = 'https://asia-northeast3-studyroommanagementsystemtest.cloudfunctions.net/submitTimetableEdit';
    
    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '시간표 편집 제출 실패');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('시간표 편집 제출 실패:', error);
      throw error;
    }
  }

  /**
   * 제출된 편집 상태 승인/거부
   */
  async processEditSubmission(data: {
    editStateId: string;
    action: 'approve' | 'reject';
    rejectionReason?: string;
  }): Promise<any> {
    // Firebase Functions SDK 사용 (onCall 타입)
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions();
    const processEditSubmissionFunction = httpsCallable(functions, 'processEditSubmission');

    try {
      const result = await processEditSubmissionFunction(data);
      return result.data;
    } catch (error) {
      console.error('편집 제출 처리 실패:', error);
      throw error;
    }
  }

  /**
   * 제출 대기 중인 편집 상태 목록 조회
   */
  async getPendingEditSubmissions(): Promise<any> {
    // Firebase Functions SDK 사용 (onCall 타입)
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions();
    const getPendingEditSubmissionsFunction = httpsCallable(functions, 'getPendingEditSubmissions');

    try {
      const result = await getPendingEditSubmissionsFunction({});
      return result.data;
    } catch (error) {
      console.error('대기 중인 편집 제출 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 기여 데이터 승인/거부 (onCall 타입 함수)
   */
  async processContribution(data: {
    contributionId: string;
    action: 'approve' | 'reject';
    rejectionReason?: string;
  }): Promise<any> {
    try {
      // Firebase Functions SDK를 사용하여 onCall 함수 호출
      const processContributionFunction = httpsCallable(functions, 'processContribution');
      
      console.log('processContribution 호출 시작:', data);
      console.log('현재 사용자:', auth.currentUser?.uid);
      
      const result = await processContributionFunction(data);
      
      console.log('processContribution 호출 성공:', result.data);
      return result.data;
    } catch (error) {
      console.error('processContribution 호출 실패:', error);
      throw error;
    }
  }

  /**
   * 공유 링크 관리 (비활성화/삭제)
   */
  async manageShareLink(data: {
    shareId: string;
    action: 'disable' | 'delete';
  }): Promise<any> {
    return this.call('manageShareLink', data);
  }

  /**
   * 시간표 편집 잠금 생성
   */
  async createTimetableEditLock(data: {
    timetableId: string;
    studentId: string;
    shareToken?: string;
    lockType?: string;
    expiresInMinutes?: number;
  }): Promise<any> {
    return this.call('createTimetableEditLock', data);
  }

  /**
   * 시간표 편집 잠금 해제
   */
  async releaseTimetableEditLock(data: {
    lockId: string;
  }): Promise<any> {
    return this.call('releaseTimetableEditLock', data);
  }

  /**
   * 시간표 편집 잠금 상태 조회
   */
  async getTimetableEditLock(data: {
    timetableId: string;
    studentId: string;
  }): Promise<any> {
    return this.call('getTimetableEditLock', data);
  }

  /**
   * 편집 잠금 활동 업데이트 (하트비트)
   */
  async updateEditLockActivity(data: {
    shareToken: string;
  }): Promise<any> {
    return this.call('updateEditLockActivity', data);
  }
}

// ==================== 싱글톤 인스턴스 ====================

export const backendService = new BackendService();
