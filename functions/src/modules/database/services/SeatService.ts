import { DatabaseService } from '../core/DatabaseService';
import { Seat, SeatLayout, SeatAssignment, DatabaseResult, DatabaseQuery } from '../../../types/database';
import * as admin from 'firebase-admin';

/**
 * 좌석 관리 서비스
 */
export class SeatService extends DatabaseService<Seat> {
  private layoutService: SeatLayoutService;
  private assignmentService: SeatAssignmentService;

  constructor(academyId: string) {
    super(`academies/${academyId}/seats`);
    this.layoutService = new SeatLayoutService(academyId);
    this.assignmentService = new SeatAssignmentService(academyId);
  }

  /**
   * 배치도별 좌석 조회
   */
  async getByLayout(layoutName: string): Promise<DatabaseResult<(Seat & { id: string })[]>> {
    const queries: DatabaseQuery[] = [
      { field: 'layoutName', operator: '==', value: layoutName }
    ];
    return this.getByQuery(queries, {
      orderBy: { field: 'seatNumber', direction: 'asc' }
    });
  }

  /**
   * 활성 좌석만 조회
   */
  async getActiveSeats(layoutName?: string): Promise<DatabaseResult<(Seat & { id: string })[]>> {
    const queries: DatabaseQuery[] = [
      { field: 'isActive', operator: '==', value: true }
    ];

    if (layoutName) {
      queries.push({ field: 'layoutName', operator: '==', value: layoutName });
    }

    return this.getByQuery(queries);
  }

  /**
   * 사용 가능한 좌석 조회
   */
  async getAvailableSeats(layoutName?: string): Promise<DatabaseResult<(Seat & { id: string })[]>> {
    const queries: DatabaseQuery[] = [
      { field: 'isActive', operator: '==', value: true },
      { field: 'status', operator: '==', value: 'vacant' }
    ];

    if (layoutName) {
      queries.push({ field: 'layoutName', operator: '==', value: layoutName });
    }

    return this.getByQuery(queries);
  }

  /**
   * 좌석 상태 업데이트
   */
  async updateStatus(seatId: string, status: Seat['status']): Promise<DatabaseResult<void>> {
    return this.update(seatId, { status });
  }

  /**
   * 좌석 배치도와 함께 좌석 일괄 생성
   */
  async createSeatsWithLayout(
    layoutName: string,
    description: string,
    gridSize: { rows: number; cols: number },
    seatPositions: Array<{ seatNumber: string; x: number; y: number }>
  ): Promise<DatabaseResult<{ layoutId: string; seatIds: string[] }>> {
    return this.runTransaction(async (transaction) => {
      // 1. 좌석 배치도 생성
      const layoutResult = await this.layoutService.create({
        name: layoutName,
        description,
        gridSize,
        isActive: true
      });

      if (!layoutResult.success || !layoutResult.data) {
        throw new Error(`좌석 배치도 생성 실패: ${layoutResult.error}`);
      }

      const layoutId = layoutResult.data;

      // 2. 좌석들 생성
      const seatIds: string[] = [];
      for (const seatPos of seatPositions) {
        const seatResult = await this.create({
          seatNumber: seatPos.seatNumber,
          status: 'vacant',
          isActive: true,
          layoutName: layoutName,
          position: { x: seatPos.x, y: seatPos.y }
        });

        if (!seatResult.success || !seatResult.data) {
          throw new Error(`좌석 생성 실패: ${seatResult.error}`);
        }

        seatIds.push(seatResult.data);
      }

      return { layoutId, seatIds };
    });
  }

  /**
   * 좌석에 학생 배정
   */
  async assignStudent(seatId: string, studentId: string): Promise<DatabaseResult<void>> {
    return this.runTransaction(async (transaction) => {
      // 1. 좌석 상태 확인
      const seatResult = await this.getById(seatId);
      if (!seatResult.success || !seatResult.data) {
        throw new Error('좌석을 찾을 수 없습니다.');
      }

      if (seatResult.data.status !== 'vacant') {
        throw new Error('이미 사용중인 좌석입니다.');
      }

      // 2. 기존 학생의 좌석 배정 해제
      await this.assignmentService.releaseStudentSeat(studentId);

      // 3. 새로운 좌석 배정
      const assignResult = await this.assignmentService.createWithId(studentId, {
        seatId,
        assignedAt: admin.firestore.Timestamp.now(),
        status: 'active'
      });

      if (!assignResult.success) {
        throw new Error(`좌석 배정 실패: ${assignResult.error}`);
      }

      // 4. 좌석 상태 업데이트
      const updateResult = await this.updateStatus(seatId, 'occupied');
      if (!updateResult.success) {
        throw new Error(`좌석 상태 업데이트 실패: ${updateResult.error}`);
      }

      return;
    });
  }

  /**
   * 학생 좌석 배정 해제
   */
  async unassignStudent(studentId: string): Promise<DatabaseResult<void>> {
    return this.runTransaction(async (transaction) => {
      // 1. 현재 배정된 좌석 조회
      const assignmentResult = await this.assignmentService.getById(studentId);
      if (!assignmentResult.success || !assignmentResult.data) {
        throw new Error('배정된 좌석이 없습니다.');
      }

      const seatId = assignmentResult.data.seatId;

      // 2. 좌석 배정 해제
      await this.assignmentService.delete(studentId);

      // 3. 좌석 상태 업데이트
      await this.updateStatus(seatId, 'vacant');

      return;
    });
  }
}

/**
 * 좌석 배치도 관리 서비스
 */
export class SeatLayoutService extends DatabaseService<SeatLayout> {
  constructor(academyId: string) {
    super(`academies/${academyId}/seat_layouts`);
  }

  /**
   * 활성 배치도만 조회
   */
  async getActiveLayouts(): Promise<DatabaseResult<(SeatLayout & { id: string })[]>> {
    const queries: DatabaseQuery[] = [
      { field: 'isActive', operator: '==', value: true }
    ];
    return this.getByQuery(queries);
  }

  /**
   * 배치도 활성/비활성 토글
   */
  async toggleActive(layoutId: string): Promise<DatabaseResult<void>> {
    const layoutResult = await this.getById(layoutId);
    if (!layoutResult.success || !layoutResult.data) {
      return {
        success: false,
        error: '배치도를 찾을 수 없습니다.'
      };
    }

    const newStatus = !layoutResult.data.isActive;
    return this.update(layoutId, { isActive: newStatus });
  }
}

/**
 * 좌석 배정 관리 서비스
 */
export class SeatAssignmentService extends DatabaseService<SeatAssignment> {
  constructor(academyId: string) {
    super(`academies/${academyId}/seat_assignments`);
  }

  /**
   * 특정 좌석의 현재 배정 조회
   */
  async getCurrentAssignmentBySeat(seatId: string): Promise<DatabaseResult<SeatAssignment & { id: string }>> {
    const queries: DatabaseQuery[] = [
      { field: 'seatId', operator: '==', value: seatId },
      { field: 'status', operator: '==', value: 'active' }
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
        error: '활성 배정을 찾을 수 없습니다.'
      };
    }
  }

  /**
   * 학생의 현재 좌석 배정 해제
   */
  async releaseStudentSeat(studentId: string): Promise<DatabaseResult<void>> {
    const assignmentResult = await this.getById(studentId);
    if (assignmentResult.success && assignmentResult.data) {
      return this.update(studentId, { status: 'released' });
    }
    return { success: true }; // 배정이 없으면 성공으로 처리
  }

  /**
   * 모든 활성 배정 조회
   */
  async getActiveAssignments(): Promise<DatabaseResult<(SeatAssignment & { id: string })[]>> {
    const queries: DatabaseQuery[] = [
      { field: 'status', operator: '==', value: 'active' }
    ];
    return this.getByQuery(queries);
  }
}