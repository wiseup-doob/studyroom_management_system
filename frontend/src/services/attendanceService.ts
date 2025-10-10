/**
 * 출석 관리 서비스
 *
 * Backend Functions (studentAttendanceManagement.ts, seatManagement.ts)와 통신하여
 * 출석 관리 시스템의 모든 기능을 제공합니다.
 *
 * 주요 기능:
 * - 좌석 배치도 관리 (생성, 조회, 삭제)
 * - 좌석 할당 (학생 좌석 배정)
 * - 출석 기록 관리 (체크인/아웃, 조회)
 * - PIN 관리 (생성, 변경, 잠금해제)
 * - 출석 체크 링크 관리
 */

import { auth } from './firebase';
import { convertTimestampToDate } from '../utils/dateConverter';
import {
  SeatLayout,
  SeatAssignment,
  StudentAttendanceRecord,
  AttendanceCheckLink,
  AttendanceStudentPin,
  AssignSeatData,
  CreateSeatLayoutData,
  CreateAttendanceCheckLinkData,
  UpdateAttendanceStatusData,
  GenerateStudentPinData,
  UpdateStudentPinData
} from '../types/attendance';

class AttendanceService {
  private projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  /**
   * 인증된 fetch 헬퍼 메서드 (v2 Callable Functions용)
   * v2 Callable은 { data: {...} } 형태로 요청하고 { result: {...} } 형태로 응답
   */
  private async callFunction<T = any>(functionName: string, data: any = {}): Promise<T> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('사용자가 로그인되지 않았습니다.');
    }

    const token = await user.getIdToken();
    const functionUrl = `https://asia-northeast3-${this.projectId}.cloudfunctions.net/${functionName}`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      // v2 Callable Functions는 { data: {...} } 형태를 기대
      body: JSON.stringify({ data })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Function ${functionName} error:`, errorText);

      // 백엔드 에러 메시지 파싱
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error && errorData.error.message) {
          throw new Error(errorData.error.message);
        }
        // error.message가 없으면 기본 에러
        throw new Error(`HTTP error! status: ${response.status}`);
      } catch (parseError) {
        // parseError가 Error 객체면 그대로 던지기 (위에서 던진 에러)
        if (parseError instanceof Error && parseError.message !== `HTTP error! status: ${response.status}`) {
          throw parseError;
        }
        // JSON 파싱 실패 시 기본 에러
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }

    const responseData = await response.json();

    // v2 Callable은 { result: {...} } 형태로 응답
    return responseData.result || responseData;
  }

  /**
   * ==================== 좌석 배치도 관리 ====================
   */

  /**
   * 좌석 배치도 목록 조회
   */
  async getSeatLayouts(): Promise<SeatLayout[]> {
    try {
      const result = await this.callFunction('getSeatLayouts', {});

      if (!result.success) {
        throw new Error(result.message || '좌석 배치도 목록 조회 실패');
      }

      return convertTimestampToDate(result.data);
    } catch (error: any) {
      console.error('좌석 배치도 목록 조회 오류:', error);
      throw new Error(error.message || '좌석 배치도 목록을 불러오지 못했습니다.');
    }
  }

  /**
   * 좌석 배치도 생성
   */
  async createSeatLayout(data: CreateSeatLayoutData): Promise<{ layoutId: string }> {
    try {
      const result = await this.callFunction('createSeatLayout', data);

      if (!result.success) {
        throw new Error(result.message || '좌석 배치도 생성 실패');
      }

      return result.data;
    } catch (error: any) {
      console.error('좌석 배치도 생성 오류:', error);
      throw new Error(error.message || '좌석 배치도를 생성하지 못했습니다.');
    }
  }

  /**
   * 좌석 배치도 수정
   */
  async updateSeatLayout(seatLayoutId: string, data: { name: string; layout: any }): Promise<void> {
    try {
      const result = await this.callFunction('updateSeatLayout', {
        seatLayoutId,
        ...data
      });

      if (!result.success) {
        throw new Error(result.message || '좌석 배치도 수정 실패');
      }
    } catch (error: any) {
      console.error('좌석 배치도 수정 오류:', error);
      throw new Error(error.message || '좌석 배치도를 수정하지 못했습니다.');
    }
  }

  /**
   * 좌석 배치도 삭제
   */
  async deleteSeatLayout(seatLayoutId: string): Promise<void> {
    try {
      const result = await this.callFunction('deleteSeatLayout', { seatLayoutId });

      if (!result.success) {
        throw new Error(result.message || '좌석 배치도 삭제 실패');
      }
    } catch (error: any) {
      console.error('좌석 배치도 삭제 오류:', error);
      throw new Error(error.message || '좌석 배치도를 삭제하지 못했습니다.');
    }
  }

  /**
   * ==================== 좌석 할당 관리 ====================
   */

  /**
   * 특정 배치도의 좌석 할당 목록 조회
   */
  async getSeatAssignments(seatLayoutId: string): Promise<SeatAssignment[]> {
    try {
      const result = await this.callFunction('getSeatAssignments', { seatLayoutId });

      if (!result.success) {
        throw new Error(result.message || '좌석 할당 목록 조회 실패');
      }

      return convertTimestampToDate(result.data);
    } catch (error: any) {
      console.error('좌석 할당 목록 조회 오류:', error);
      throw new Error(error.message || '좌석 할당 목록을 불러오지 못했습니다.');
    }
  }

  /**
   * 좌석 할당 (학생에게 좌석 배정)
   */
  async assignSeat(data: AssignSeatData): Promise<{ assignmentId: string }> {
    try {
      const result = await this.callFunction('assignSeat', data);

      if (!result.success) {
        throw new Error(result.message || '좌석 할당 실패');
      }

      return result.data;
    } catch (error: any) {
      console.error('좌석 할당 오류:', error);
      throw new Error(error.message || '좌석을 할당하지 못했습니다.');
    }
  }

  /**
   * 좌석 할당 해제
   */
  async unassignSeat(assignmentId: string): Promise<void> {
    try {
      const result = await this.callFunction('unassignSeat', { assignmentId });

      if (!result.success) {
        throw new Error(result.message || '좌석 할당 해제 실패');
      }
    } catch (error: any) {
      console.error('좌석 할당 해제 오류:', error);
      throw new Error(error.message || '좌석 할당을 해제하지 못했습니다.');
    }
  }

  /**
   * 학생 시간표 검증 (좌석 할당 전)
   */
  async validateStudentTimetableForSeat(studentId: string): Promise<{
    timetableId: string;
    activeDays: Array<{ day: string; arrivalTime: string; departureTime: string }>;
  }> {
    try {
      const result = await this.callFunction('validateStudentTimetableForSeat', { studentId });

      if (!result.success) {
        throw new Error(result.message || '시간표 검증 실패');
      }

      return result.data;
    } catch (error: any) {
      console.error('시간표 검증 오류:', error);
      throw new Error(error.message || '시간표를 검증하지 못했습니다.');
    }
  }

  /**
   * ==================== 출석 기록 관리 ====================
   */

  /**
   * 오늘 출석 기록 조회 (특정 좌석 배치도)
   */
  async getTodayAttendanceRecords(seatLayoutId: string): Promise<StudentAttendanceRecord[]> {
    try {
      const result = await this.callFunction('getTodayAttendanceRecords', { seatLayoutId });

      if (!result.success) {
        throw new Error(result.message || '출석 기록 조회 실패');
      }

      return convertTimestampToDate(result.data);
    } catch (error: any) {
      console.error('오늘 출석 기록 조회 오류:', error);
      throw new Error(error.message || '출석 기록을 불러오지 못했습니다.');
    }
  }

  /**
   * 출석 기록 상세 조회
   */
  async getAttendanceRecord(recordId: string): Promise<StudentAttendanceRecord> {
    try {
      const result = await this.callFunction('getAttendanceRecord', { recordId });

      if (!result.success) {
        throw new Error(result.message || '출석 기록 조회 실패');
      }

      return convertTimestampToDate(result.data);
    } catch (error: any) {
      console.error('출석 기록 상세 조회 오류:', error);
      throw new Error(error.message || '출석 기록을 불러오지 못했습니다.');
    }
  }

  /**
   * 출석 기록 조회 (필터링)
   */
  async getStudentAttendanceRecords(params: {
    studentId?: string;
    seatLayoutId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<StudentAttendanceRecord[]> {
    try {
      const result = await this.callFunction('getStudentAttendanceRecords', params);

      if (!result.success) {
        throw new Error(result.message || '출석 기록 조회 실패');
      }

      return convertTimestampToDate(result.data);
    } catch (error: any) {
      console.error('출석 기록 조회 오류:', error);
      throw new Error(error.message || '출석 기록을 불러오지 못했습니다.');
    }
  }

  /**
   * 출석 상태 변경 (관리자)
   */
  async updateAttendanceStatus(data: UpdateAttendanceStatusData): Promise<void> {
    try {
      const result = await this.callFunction('updateAttendanceStatus', data);

      if (!result.success) {
        throw new Error(result.message || '출석 상태 변경 실패');
      }
    } catch (error: any) {
      console.error('출석 상태 변경 오류:', error);
      throw new Error(error.message || '출석 상태를 변경하지 못했습니다.');
    }
  }

  /**
   * 수동 체크인 (관리자)
   */
  async manualCheckIn(data: {
    studentId: string;
    seatLayoutId: string;
    notes?: string;
  }): Promise<{ action: string; record: StudentAttendanceRecord }> {
    try {
      const result = await this.callFunction('manualCheckIn', data);

      if (!result.success) {
        throw new Error(result.message || '수동 체크인 실패');
      }

      return {
        action: result.action,
        record: convertTimestampToDate(result.data)
      };
    } catch (error: any) {
      console.error('수동 체크인 오류:', error);
      throw new Error(error.message || '체크인을 처리하지 못했습니다.');
    }
  }

  /**
   * 수동 체크아웃 (관리자)
   */
  async manualCheckOut(data: {
    studentId: string;
    seatLayoutId: string;
    notes?: string;
  }): Promise<{ action: string; record: StudentAttendanceRecord }> {
    try {
      const result = await this.callFunction('manualCheckOut', data);

      if (!result.success) {
        throw new Error(result.message || '수동 체크아웃 실패');
      }

      return {
        action: result.action,
        record: convertTimestampToDate(result.data)
      };
    } catch (error: any) {
      console.error('수동 체크아웃 오류:', error);
      throw new Error(error.message || '체크아웃을 처리하지 못했습니다.');
    }
  }

  /**
   * ==================== PIN 관리 ====================
   */

  /**
   * 학생 PIN 정보 조회
   */
  async getStudentPin(studentId: string): Promise<AttendanceStudentPin | null> {
    try {
      const result = await this.callFunction('getStudentPin', { studentId });

      if (!result.success) {
        throw new Error(result.message || 'PIN 조회 실패');
      }

      return result.data ? convertTimestampToDate(result.data) : null;
    } catch (error: any) {
      console.error('PIN 조회 오류:', error);
      throw new Error(error.message || 'PIN 정보를 불러오지 못했습니다.');
    }
  }

  /**
   * 학생 PIN 생성
   */
  async generateStudentPin(data: GenerateStudentPinData): Promise<{ pin: string }> {
    try {
      const result = await this.callFunction('generateStudentPin', data);

      if (!result.success) {
        throw new Error(result.message || 'PIN 생성 실패');
      }

      return result.data;
    } catch (error: any) {
      console.error('PIN 생성 오류:', error);
      throw new Error(error.message || 'PIN을 생성하지 못했습니다.');
    }
  }

  /**
   * 학생 PIN 변경
   */
  async updateStudentPin(data: UpdateStudentPinData): Promise<void> {
    try {
      const result = await this.callFunction('updateStudentPin', data);

      if (!result.success) {
        throw new Error(result.message || 'PIN 변경 실패');
      }
    } catch (error: any) {
      console.error('PIN 변경 오류:', error);
      throw new Error(error.message || 'PIN을 변경하지 못했습니다.');
    }
  }

  /**
   * 학생 PIN 잠금 해제
   */
  async unlockStudentPin(studentId: string): Promise<void> {
    try {
      const result = await this.callFunction('unlockStudentPin', { studentId });

      if (!result.success) {
        throw new Error(result.message || 'PIN 잠금 해제 실패');
      }
    } catch (error: any) {
      console.error('PIN 잠금 해제 오류:', error);
      throw new Error(error.message || 'PIN 잠금을 해제하지 못했습니다.');
    }
  }

  /**
   * ==================== 출석 체크 링크 관리 ====================
   */

  /**
   * 출석 체크 링크 생성
   */
  async createAttendanceCheckLink(data: CreateAttendanceCheckLinkData): Promise<{
    linkId: string;
    linkToken: string;
    linkUrl: string;
  }> {
    try {
      const result = await this.callFunction('createAttendanceCheckLink', data);

      if (!result.success) {
        throw new Error(result.message || '출석 체크 링크 생성 실패');
      }

      return result.data;
    } catch (error: any) {
      console.error('출석 체크 링크 생성 오류:', error);
      throw new Error(error.message || '출석 체크 링크를 생성하지 못했습니다.');
    }
  }

  /**
   * 출석 체크 링크 목록 조회
   */
  async getAttendanceCheckLinks(): Promise<AttendanceCheckLink[]> {
    try {
      const result = await this.callFunction('getAttendanceCheckLinks', {});

      if (!result.success) {
        throw new Error(result.message || '출석 체크 링크 조회 실패');
      }

      return convertTimestampToDate(result.data);
    } catch (error: any) {
      console.error('출석 체크 링크 조회 오류:', error);
      throw new Error(error.message || '출석 체크 링크 목록을 불러오지 못했습니다.');
    }
  }

  /**
   * 출석 체크 링크 비활성화
   */
  async deactivateAttendanceCheckLink(linkId: string): Promise<void> {
    try {
      const result = await this.callFunction('deactivateAttendanceCheckLink', { linkId });

      if (!result.success) {
        throw new Error(result.message || '출석 체크 링크 비활성화 실패');
      }
    } catch (error: any) {
      console.error('출석 체크 링크 비활성화 오류:', error);
      throw new Error(error.message || '출석 체크 링크를 비활성화하지 못했습니다.');
    }
  }

  /**
   * 출석 체크 링크 활성화
   */
  async activateAttendanceCheckLink(linkId: string): Promise<void> {
    try {
      const result = await this.callFunction('activateAttendanceCheckLink', { linkId });

      if (!result.success) {
        throw new Error(result.message || '출석 체크 링크 활성화 실패');
      }
    } catch (error: any) {
      console.error('출석 체크 링크 활성화 오류:', error);
      throw new Error(error.message || '출석 체크 링크를 활성화하지 못했습니다.');
    }
  }

  /**
   * 출석 체크 링크 삭제
   */
  async deleteAttendanceCheckLink(linkId: string): Promise<void> {
    try {
      const result = await this.callFunction('deleteAttendanceCheckLink', { linkId });

      if (!result.success) {
        throw new Error(result.message || '출석 체크 링크 삭제 실패');
      }
    } catch (error: any) {
      console.error('출석 체크 링크 삭제 오류:', error);
      throw new Error(error.message || '출석 체크 링크를 삭제하지 못했습니다.');
    }
  }

  /**
   * PIN으로 출석 체크 (학생용)
   */
  async checkAttendanceByPin(data: {
    linkToken: string;
    pin: string;
  }): Promise<{
    action: 'checked_in' | 'checked_out';
    message: string;
    record: StudentAttendanceRecord;
  }> {
    try {
      const result = await this.callFunction('checkAttendanceByPin', data);

      if (!result.success) {
        throw new Error(result.message || '출석 체크 실패');
      }

      return {
        action: result.action,
        message: result.message,
        record: convertTimestampToDate(result.data)
      };
    } catch (error: any) {
      console.error('출석 체크 오류:', error);
      throw new Error(error.message || '출석 체크를 처리하지 못했습니다.');
    }
  }
}

// Singleton 인스턴스 export
const attendanceService = new AttendanceService();
export default attendanceService;
