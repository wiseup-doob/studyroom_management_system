import { DatabaseService } from '../core/DatabaseService';
import { AttendanceRecord, DatabaseResult, DatabaseQuery } from '../../../types/database';
import * as admin from 'firebase-admin';

/**
 * 출석 관리 서비스
 */
export class AttendanceService extends DatabaseService<AttendanceRecord> {
  constructor(academyId: string) {
    super(`academies/${academyId}/attendance_records`);
  }

  /**
   * 특정 날짜의 출석 기록 조회
   */
  async getByDate(date: string): Promise<DatabaseResult<(AttendanceRecord & { id: string })[]>> {
    const queries: DatabaseQuery[] = [
      { field: 'date', operator: '==', value: date }
    ];
    return this.getByQuery(queries, {
      orderBy: { field: 'checkInTime', direction: 'asc' }
    });
  }

  /**
   * 특정 학생의 출석 기록 조회
   */
  async getByStudent(
    studentId: string, 
    startDate?: string, 
    endDate?: string
  ): Promise<DatabaseResult<(AttendanceRecord & { id: string })[]>> {
    const queries: DatabaseQuery[] = [
      { field: 'studentId', operator: '==', value: studentId }
    ];

    if (startDate) {
      queries.push({ field: 'date', operator: '>=', value: startDate });
    }
    if (endDate) {
      queries.push({ field: 'date', operator: '<=', value: endDate });
    }

    return this.getByQuery(queries, {
      orderBy: { field: 'date', direction: 'desc' }
    });
  }

  /**
   * 좌석별 출석 기록 조회
   */
  async getBySeat(seatId: string, date?: string): Promise<DatabaseResult<(AttendanceRecord & { id: string })[]>> {
    const queries: DatabaseQuery[] = [
      { field: 'seatId', operator: '==', value: seatId }
    ];

    if (date) {
      queries.push({ field: 'date', operator: '==', value: date });
    }

    return this.getByQuery(queries, {
      orderBy: { field: 'checkInTime', direction: 'desc' }
    });
  }

  /**
   * 출석 체크인 처리
   */
  async checkIn(
    studentId: string,
    studentName: string,
    seatId?: string,
    notes?: string
  ): Promise<DatabaseResult<string>> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형태
    const now = admin.firestore.Timestamp.now();

    // 이미 오늘 출석 기록이 있는지 확인
    const existingRecord = await this.getByQuery([
      { field: 'studentId', operator: '==', value: studentId },
      { field: 'date', operator: '==', value: today }
    ]);

    if (existingRecord.success && existingRecord.data && existingRecord.data.length > 0) {
      return {
        success: false,
        error: '이미 오늘 출석 기록이 존재합니다.'
      };
    }

    const attendanceData = {
      studentId,
      studentName,
      seatId,
      date: today,
      status: 'present' as const,
      checkInTime: now,
      notes,
      isLate: this.isLateTime(new Date())
    };

    return this.create(attendanceData);
  }

  /**
   * 출석 체크아웃 처리
   */
  async checkOut(studentId: string): Promise<DatabaseResult<void>> {
    const today = new Date().toISOString().split('T')[0];
    const now = admin.firestore.Timestamp.now();

    // 오늘의 출석 기록 찾기
    const todayRecord = await this.getByQuery([
      { field: 'studentId', operator: '==', value: studentId },
      { field: 'date', operator: '==', value: today }
    ]);

    if (!todayRecord.success || !todayRecord.data || todayRecord.data.length === 0) {
      return {
        success: false,
        error: '오늘의 출석 기록을 찾을 수 없습니다.'
      };
    }

    const recordId = todayRecord.data[0].id;
    return this.update(recordId, {
      checkOutTime: now,
      status: 'dismissed'
    });
  }

  /**
   * 출석 상태 업데이트
   */
  async updateStatus(
    recordId: string,
    status: AttendanceRecord['status'],
    notes?: string
  ): Promise<DatabaseResult<void>> {
    const updateData: any = { status };
    if (notes) {
      updateData.notes = notes;
    }
    return this.update(recordId, updateData);
  }

  /**
   * 날짜 범위별 출석 통계
   */
  async getAttendanceStats(
    startDate: string,
    endDate: string
  ): Promise<DatabaseResult<{
    totalRecords: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
  }>> {
    const result = await this.getByQuery([
      { field: 'date', operator: '>=', value: startDate },
      { field: 'date', operator: '<=', value: endDate }
    ]);

    if (!result.success || !result.data) {
      return result as any;
    }

    const stats = {
      totalRecords: result.data.length,
      presentCount: result.data.filter(r => r.status === 'present' || r.status === 'dismissed').length,
      absentCount: result.data.filter(r => r.status === 'unauthorized_absent' || r.status === 'authorized_absent').length,
      lateCount: result.data.filter(r => r.isLate === true).length
    };

    return {
      success: true,
      data: stats
    };
  }

  /**
   * 지각 시간 판단 (예시: 오전 9시 이후는 지각)
   */
  private isLateTime(time: Date): boolean {
    const hour = time.getHours();
    const minute = time.getMinutes();
    return hour > 9 || (hour === 9 && minute > 0);
  }
}