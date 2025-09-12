import { StudentService } from './services/StudentService';
import { AttendanceService } from './services/AttendanceService';
import { SeatService, SeatLayoutService, SeatAssignmentService } from './services/SeatService';
import { ClassService, StudentTimetableService } from './services/ClassService';
import { ParentService } from './services/ParentService';
import { DatabaseResult } from '../../types/database';

/**
 * 데이터베이스 매니저 - 모든 서비스를 통합 관리
 * 멀티테넌트 아키텍처를 지원하며, academyId별로 격리된 데이터 접근 제공
 */
export class DatabaseManager {
  private academyId: string;
  
  // 서비스 인스턴스들
  public readonly students: StudentService;
  public readonly attendance: AttendanceService;
  public readonly seats: SeatService;
  public readonly seatLayouts: SeatLayoutService;
  public readonly seatAssignments: SeatAssignmentService;
  public readonly classes: ClassService;
  public readonly timetables: StudentTimetableService;
  public readonly parents: ParentService;

  constructor(academyId: string) {
    this.academyId = academyId;
    
    // 각 서비스 초기화
    this.students = new StudentService(academyId);
    this.attendance = new AttendanceService(academyId);
    this.seats = new SeatService(academyId);
    this.seatLayouts = new SeatLayoutService(academyId);
    this.seatAssignments = new SeatAssignmentService(academyId);
    this.classes = new ClassService(academyId);
    this.timetables = new StudentTimetableService(academyId);
    this.parents = new ParentService(academyId);
  }

  /**
   * Academy ID 반환
   */
  getAcademyId(): string {
    return this.academyId;
  }

  /**
   * 통합 대시보드 데이터 조회
   */
  async getDashboardData(): Promise<DatabaseResult<{
    totalStudents: number;
    activeStudents: number;
    totalSeats: number;
    occupiedSeats: number;
    todayAttendance: number;
    activeClasses: number;
  }>> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 병렬로 데이터 조회
      const [
        allStudentsResult,
        activeStudentsResult,
        allSeatsResult,
        occupiedSeatsResult,
        todayAttendanceResult,
        allClassesResult
      ] = await Promise.all([
        this.students.getAll(),
        this.students.getByStatus('active'),
        this.seats.getAll(),
        this.seats.getByQuery([{ field: 'status', operator: '==', value: 'occupied' }]),
        this.attendance.getByDate(today),
        this.classes.getAll()
      ]);

      // 결과 검증
      if (!allStudentsResult.success || !activeStudentsResult.success || 
          !allSeatsResult.success || !occupiedSeatsResult.success ||
          !todayAttendanceResult.success || !allClassesResult.success) {
        return {
          success: false,
          error: '대시보드 데이터 조회 중 오류 발생'
        };
      }

      return {
        success: true,
        data: {
          totalStudents: allStudentsResult.data?.length || 0,
          activeStudents: activeStudentsResult.data?.length || 0,
          totalSeats: allSeatsResult.data?.length || 0,
          occupiedSeats: occupiedSeatsResult.data?.length || 0,
          todayAttendance: todayAttendanceResult.data?.filter(a => 
            a.status === 'present' || a.status === 'dismissed').length || 0,
          activeClasses: allClassesResult.data?.length || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `대시보드 데이터 조회 실패: ${error}`
      };
    }
  }

  /**
   * 학생 등록 (학부모 정보 포함)
   */
  async enrollStudentWithParent(
    authUid: string,
    studentData: {
      name: string;
      grade: string;
      contactInfo?: any;
    },
    parentData?: {
      name: string;
      contactInfo: { phone: string; email?: string };
      notes?: string;
    }
  ): Promise<DatabaseResult<{ studentId: string; parentId?: string }>> {
    try {
      // 1. 학생 생성
      const studentResult = await this.students.createStudent(authUid, {
        ...studentData,
        grade: studentData.grade as any,
        status: 'active'
      });

      if (!studentResult.success || !studentResult.data) {
        return {
          success: false,
          error: `학생 생성 실패: ${studentResult.error}`
        };
      }

      const studentId = studentResult.data;
      let parentId: string | undefined;

      // 2. 학부모 정보가 있으면 생성
      if (parentData) {
        const parentResult = await this.parents.createWithStudents(parentData, [studentId]);
        
        if (!parentResult.success || !parentResult.data) {
          // 학생 생성은 성공했지만 학부모 생성 실패 - 로그만 남기고 계속 진행
          console.warn(`학부모 생성 실패: ${parentResult.error}`);
        } else {
          parentId = parentResult.data;
          
          // 3. 학생에 학부모 ID 연결
          await this.students.update(studentId, { parentsId: parentId });
        }
      }

      return {
        success: true,
        data: { studentId, parentId }
      };
    } catch (error) {
      return {
        success: false,
        error: `학생 등록 실패: ${error}`
      };
    }
  }

  /**
   * 좌석 배치표 기반 출석 처리
   */
  async processAttendanceWithSeat(
    studentId: string,
    seatId: string,
    action: 'checkin' | 'checkout'
  ): Promise<DatabaseResult<void>> {
    try {
      // 1. 학생 정보 조회
      const studentResult = await this.students.getById(studentId);
      if (!studentResult.success || !studentResult.data) {
        return {
          success: false,
          error: '학생을 찾을 수 없습니다.'
        };
      }

      const student = studentResult.data;

      if (action === 'checkin') {
        // 2. 좌석에 학생 배정 (이미 배정되어 있으면 스킵)
        const assignmentResult = await this.seatAssignments.getById(studentId);
        if (!assignmentResult.success || assignmentResult.data?.seatId !== seatId) {
          const seatAssignResult = await this.seats.assignStudent(seatId, studentId);
          if (!seatAssignResult.success) {
            return seatAssignResult;
          }
        }

        // 3. 출석 체크인
        const result = await this.attendance.checkIn(studentId, student.name, seatId);
        return { success: result.success, error: result.error };
        
      } else {
        // 체크아웃
        return this.attendance.checkOut(studentId);
      }
    } catch (error) {
      return {
        success: false,
        error: `출석 처리 실패: ${error}`
      };
    }
  }

  /**
   * 학생별 종합 정보 조회
   */
  async getStudentCompleteInfo(studentId: string): Promise<DatabaseResult<{
    student: any;
    parent?: any;
    currentSeat?: any;
    classes: string[];
    recentAttendance: any[];
  }>> {
    try {
      // 병렬 조회
      const [
        studentResult,
        seatAssignmentResult,
        classesResult,
        attendanceResult
      ] = await Promise.all([
        this.students.getById(studentId),
        this.seatAssignments.getById(studentId),
        this.timetables.getStudentClasses(studentId),
        this.attendance.getByStudent(studentId, undefined, undefined)
      ]);

      if (!studentResult.success || !studentResult.data) {
        return {
          success: false,
          error: '학생 정보를 찾을 수 없습니다.'
        };
      }

      const student = studentResult.data;
      let parent = undefined;
      let currentSeat = undefined;

      // 학부모 정보 조회
      if (student.parentsId) {
        const parentResult = await this.parents.getById(student.parentsId);
        if (parentResult.success) {
          parent = parentResult.data;
        }
      }

      // 현재 좌석 정보 조회
      if (seatAssignmentResult.success && seatAssignmentResult.data) {
        const seatResult = await this.seats.getById(seatAssignmentResult.data.seatId);
        if (seatResult.success) {
          currentSeat = seatResult.data;
        }
      }

      return {
        success: true,
        data: {
          student,
          parent,
          currentSeat,
          classes: classesResult.success ? classesResult.data || [] : [],
          recentAttendance: attendanceResult.success ? 
            (attendanceResult.data || []).slice(0, 10) : [] // 최근 10개
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `학생 종합 정보 조회 실패: ${error}`
      };
    }
  }

  /**
   * 데이터 정리 (고아 레코드 제거 등)
   */
  async cleanupData(): Promise<DatabaseResult<{
    orphanedParents: number;
    inactiveAssignments: number;
  }>> {
    try {
      let cleanedItems = {
        orphanedParents: 0,
        inactiveAssignments: 0
      };

      // 1. 자녀가 없는 학부모 조회 및 정리
      const orphanedParentsResult = await this.parents.getOrphanedParents();
      if (orphanedParentsResult.success && orphanedParentsResult.data) {
        for (const parent of orphanedParentsResult.data) {
          await this.parents.delete(parent.id);
          cleanedItems.orphanedParents++;
        }
      }

      // 2. 비활성 좌석 배정 정리는 필요시 추가 구현

      return {
        success: true,
        data: cleanedItems
      };
    } catch (error) {
      return {
        success: false,
        error: `데이터 정리 실패: ${error}`
      };
    }
  }
}

/**
 * 팩토리 함수 - DatabaseManager 인스턴스 생성
 */
export function createDatabaseManager(academyId: string): DatabaseManager {
  return new DatabaseManager(academyId);
}

/**
 * Academy ID 유효성 검증
 */
export function validateAcademyId(academyId: string): boolean {
  return typeof academyId === 'string' && academyId.length > 0 && /^[a-zA-Z0-9_-]+$/.test(academyId);
}