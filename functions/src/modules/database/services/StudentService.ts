import { DatabaseService } from '../core/DatabaseService';
import { Student, DatabaseResult, DatabaseQuery } from '../../../types/database';
import * as admin from 'firebase-admin';

/**
 * 학생 관리 서비스
 */
export class StudentService extends DatabaseService<Student> {
  constructor(academyId: string) {
    super(`academies/${academyId}/students`);
  }

  /**
   * 학생 이름으로 검색
   */
  async getByName(name: string): Promise<DatabaseResult<(Student & { id: string })[]>> {
    const queries: DatabaseQuery[] = [
      { field: 'name', operator: '==', value: name }
    ];
    return this.getByQuery(queries);
  }

  /**
   * 학년별 학생 조회
   */
  async getByGrade(grade: string): Promise<DatabaseResult<(Student & { id: string })[]>> {
    const queries: DatabaseQuery[] = [
      { field: 'grade', operator: '==', value: grade }
    ];
    return this.getByQuery(queries);
  }

  /**
   * 활성 상태별 학생 조회
   */
  async getByStatus(status: 'active' | 'inactive'): Promise<DatabaseResult<(Student & { id: string })[]>> {
    const queries: DatabaseQuery[] = [
      { field: 'status', operator: '==', value: status }
    ];
    return this.getByQuery(queries);
  }

  /**
   * Auth UID로 학생 조회
   */
  async getByAuthUid(authUid: string): Promise<DatabaseResult<Student & { id: string }>> {
    const queries: DatabaseQuery[] = [
      { field: 'authUid', operator: '==', value: authUid }
    ];
    const result = await this.getByQuery(queries);
    
    if (result.success && result.data && result.data.length > 0) {
      return {
        success: true,
        data: result.data[0]
      };
    } else {
      return {
        success: false,
        error: '해당 Auth UID를 가진 학생을 찾을 수 없습니다.'
      };
    }
  }

  /**
   * 학생 생성 (Auth UID와 함께)
   */
  async createStudent(
    authUid: string,
    studentData: Omit<Student, 'id' | 'authUid' | 'createdAt' | 'updatedAt'>
  ): Promise<DatabaseResult<string>> {
    const data = {
      ...studentData,
      authUid
    };
    return this.create(data);
  }

  /**
   * 학생 상태 업데이트
   */
  async updateStatus(
    studentId: string, 
    status: 'active' | 'inactive'
  ): Promise<DatabaseResult<void>> {
    return this.update(studentId, { status });
  }

  /**
   * 학생 출석 날짜 업데이트
   */
  async updateAttendanceDate(
    studentId: string,
    type: 'first' | 'last',
    date: Date
  ): Promise<DatabaseResult<void>> {
    const timestamp = admin.firestore.Timestamp.fromDate(date);
    const updateData = type === 'first' 
      ? { firstAttendanceDate: timestamp }
      : { lastAttendanceDate: timestamp };
    
    return this.update(studentId, updateData);
  }
}