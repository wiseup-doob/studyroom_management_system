/**
 * 학생 시간표 관리 서비스
 * 
 * 학생별 시간표 CRUD, 시간 슬롯 관리, 자동 채우기 등 시간표 관련 기능
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import {
  StudentTimetableData,
  CreateStudentTimetableRequest,
  UpdateStudentTimetableRequest,
  DayOfWeek,
  TimeSlot,
} from '../types/student';

// ==================== 학생 시간표 관리 서비스 클래스 ====================

class StudentTimetableService {
  private functions = functions;

  /**
   * 학생별 시간표 생성
   */
  async createStudentTimetable(request: CreateStudentTimetableRequest): Promise<StudentTimetableData> {
    try {
      const createFunc = httpsCallable(this.functions, 'createStudentTimetable');
      const result = await createFunc(request);
      return (result.data as any).data as StudentTimetableData;
    } catch (error) {
      console.error('학생 시간표 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 학생별 시간표 목록 조회
   */
  async getStudentTimetables(studentId: string): Promise<StudentTimetableData[]> {
    try {
      const getFunc = httpsCallable(this.functions, 'getStudentTimetables');
      const result = await getFunc({ studentId });
      return (result.data as any).data as StudentTimetableData[];
    } catch (error) {
      console.error('학생 시간표 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 학생별 시간표 업데이트
   */
  async updateStudentTimetable(timetableId: string, updates: UpdateStudentTimetableRequest): Promise<void> {
    try {
      const updateFunc = httpsCallable(this.functions, 'updateStudentTimetable');
      await updateFunc({ timetableId, updates });
    } catch (error) {
      console.error('학생 시간표 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 학생별 시간표 삭제
   */
  async deleteStudentTimetable(timetableId: string): Promise<void> {
    try {
      const deleteFunc = httpsCallable(this.functions, 'deleteStudentTimetable');
      await deleteFunc({ timetableId });
    } catch (error) {
      console.error('학생 시간표 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 활성 시간표 설정
   */
  async setActiveStudentTimetable(timetableId: string, studentId: string): Promise<void> {
    try {
      const setActiveFunc = httpsCallable(this.functions, 'setActiveStudentTimetable');
      await setActiveFunc({ timetableId, studentId });
    } catch (error) {
      console.error('활성 시간표 설정 실패:', error);
      throw error;
    }
  }

  /**
   * 자동 자습시간 채우기
   */
  async autoFillStudentTimetable(timetableId: string): Promise<StudentTimetableData> {
    try {
      const autoFillFunc = httpsCallable(this.functions, 'autoFillStudentTimetable');
      const result = await autoFillFunc({ timetableId });
      return (result.data as any).data as StudentTimetableData;
    } catch (error) {
      console.error('자동 자습시간 채우기 실패:', error);
      throw error;
    }
  }

  /**
   * 시간 슬롯 업데이트
   */
  async updateTimeSlot(
    timetableId: string,
    day: DayOfWeek,
    timeSlot: TimeSlot
  ): Promise<StudentTimetableData> {
    try {
      const updateFunc = httpsCallable(this.functions, 'updateTimeSlot');
      const result = await updateFunc({
        timetableId,
        day,
        timeSlot
      });
      return (result.data as any).data as StudentTimetableData;
    } catch (error) {
      console.error('시간 슬롯 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 시간 슬롯 삭제
   */
  async deleteTimeSlot(
    timetableId: string,
    day: DayOfWeek,
    startTime: string,
    endTime: string
  ): Promise<StudentTimetableData> {
    try {
      const deleteFunc = httpsCallable(this.functions, 'deleteTimeSlot');
      const result = await deleteFunc({
        timetableId,
        day,
        startTime,
        endTime
      });
      return (result.data as any).data as StudentTimetableData;
    } catch (error) {
      console.error('시간 슬롯 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 시간표 복제
   */
  async duplicateStudentTimetable(
    timetableId: string,
    newName?: string
  ): Promise<StudentTimetableData> {
    try {
      const duplicateFunc = httpsCallable(this.functions, 'duplicateStudentTimetable');
      const result = await duplicateFunc({
        timetableId,
        newName
      });
      return (result.data as any).data as StudentTimetableData;
    } catch (error) {
      console.error('시간표 복제 실패:', error);
      throw error;
    }
  }

  /**
   * 기본 스케줄 업데이트
   */
  async updateBasicSchedule(
    timetableId: string,
    basicSchedule: any,
    autoFillSettings?: any
  ): Promise<StudentTimetableData> {
    try {
      const updateFunc = httpsCallable(this.functions, 'updateBasicSchedule');
      const result = await updateFunc({
        timetableId,
        basicSchedule,
        autoFillSettings
      });
      return (result.data as any).data as StudentTimetableData;
    } catch (error) {
      console.error('기본 스케줄 업데이트 실패:', error);
      throw error;
    }
  }
}

// ==================== 싱글톤 인스턴스 ====================

export const studentTimetableService = new StudentTimetableService();
