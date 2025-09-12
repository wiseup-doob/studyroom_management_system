import { DatabaseService } from '../core/DatabaseService';
import { ClassSection, StudentTimetable, DatabaseResult, DatabaseQuery } from '../../../types/database';

/**
 * 수업 관리 서비스
 */
export class ClassService extends DatabaseService<ClassSection> {
  private timetableService: StudentTimetableService;

  constructor(academyId: string) {
    super(`academies/${academyId}/class_sections`);
    this.timetableService = new StudentTimetableService(academyId);
  }

  /**
   * 요일별 수업 조회
   */
  async getByDayOfWeek(dayOfWeek: string): Promise<DatabaseResult<(ClassSection & { id: string })[]>> {
    // Firestore에서 배열 내부 요소 검색을 위해 array-contains 사용
    const queries: DatabaseQuery[] = [
      { field: 'schedule', operator: 'array-contains', value: { dayOfWeek } }
    ];
    return this.getByQuery(queries);
  }

  /**
   * 시간대별 수업 검색 (특정 요일과 시간)
   */
  async getBySchedule(
    dayOfWeek: string, 
    startTime: string, 
    endTime: string
  ): Promise<DatabaseResult<(ClassSection & { id: string })[]>> {
    // 복잡한 쿼리는 클라이언트 사이드에서 필터링
    const allClasses = await this.getAll();
    
    if (!allClasses.success || !allClasses.data) {
      return allClasses;
    }

    const filteredClasses = allClasses.data.filter(cls => {
      return cls.schedule.some(sch => 
        sch.dayOfWeek === dayOfWeek &&
        sch.startTime <= endTime &&
        sch.endTime >= startTime
      );
    });

    return {
      success: true,
      data: filteredClasses
    };
  }

  /**
   * 수업에 학생 등록
   */
  async enrollStudent(classId: string, studentId: string): Promise<DatabaseResult<void>> {
    return this.runTransaction(async () => {
      // 1. 수업 존재 확인
      const classResult = await this.getById(classId);
      if (!classResult.success) {
        throw new Error('수업을 찾을 수 없습니다.');
      }

      // 2. 학생 시간표 조회 또는 생성
      let timetableResult = await this.timetableService.getById(studentId);
      
      if (!timetableResult.success) {
        // 시간표가 없으면 새로 생성
        const createResult = await this.timetableService.createWithId(studentId, {
          studentId,
          classSectionIds: [classId]
        });
        
        if (!createResult.success) {
          throw new Error(`시간표 생성 실패: ${createResult.error}`);
        }
      } else {
        // 기존 시간표에 수업 추가
        const currentIds = timetableResult.data!.classSectionIds;
        if (!currentIds.includes(classId)) {
          const updateResult = await this.timetableService.update(studentId, {
            classSectionIds: [...currentIds, classId]
          });
          
          if (!updateResult.success) {
            throw new Error(`시간표 업데이트 실패: ${updateResult.error}`);
          }
        }
      }

      return;
    });
  }

  /**
   * 수업에서 학생 제외
   */
  async unenrollStudent(classId: string, studentId: string): Promise<DatabaseResult<void>> {
    const timetableResult = await this.timetableService.getById(studentId);
    
    if (!timetableResult.success || !timetableResult.data) {
      return {
        success: false,
        error: '학생의 시간표를 찾을 수 없습니다.'
      };
    }

    const currentIds = timetableResult.data!.classSectionIds.filter(id => id !== classId);
    
    return this.timetableService.update(studentId, {
      classSectionIds: currentIds
    });
  }

  /**
   * 특정 수업에 등록된 학생들 조회
   */
  async getEnrolledStudents(classId: string): Promise<DatabaseResult<string[]>> {
    const allTimetables = await this.timetableService.getAll();
    
    if (!allTimetables.success || !allTimetables.data) {
      return {
        success: false,
        error: '시간표 조회 실패'
      };
    }

    const enrolledStudents = allTimetables.data
      .filter(timetable => timetable.classSectionIds.includes(classId))
      .map(timetable => timetable.studentId);

    return {
      success: true,
      data: enrolledStudents
    };
  }
}

/**
 * 학생 시간표 관리 서비스
 */
export class StudentTimetableService extends DatabaseService<StudentTimetable> {
  constructor(academyId: string) {
    super(`academies/${academyId}/student_timetables`);
  }

  /**
   * 학생의 수업 목록 조회
   */
  async getStudentClasses(studentId: string): Promise<DatabaseResult<string[]>> {
    const timetableResult = await this.getById(studentId);
    
    if (!timetableResult.success || !timetableResult.data) {
      return {
        success: false,
        error: '학생의 시간표를 찾을 수 없습니다.'
      };
    }

    return {
      success: true,
      data: timetableResult.data.classSectionIds
    };
  }

  /**
   * 학생의 시간표에 수업 추가
   */
  async addClass(studentId: string, classId: string): Promise<DatabaseResult<void>> {
    const timetableResult = await this.getById(studentId);
    
    if (!timetableResult.success) {
      // 시간표가 없으면 새로 생성
      return this.createWithId(studentId, {
        studentId,
        classSectionIds: [classId]
      }).then(result => ({ success: result.success, error: result.error }));
    }

    const currentIds = timetableResult.data!.classSectionIds;
    if (!currentIds.includes(classId)) {
      return this.update(studentId, {
        classSectionIds: [...currentIds, classId]
      });
    }

    return { success: true }; // 이미 등록된 경우
  }

  /**
   * 학생의 시간표에서 수업 제거
   */
  async removeClass(studentId: string, classId: string): Promise<DatabaseResult<void>> {
    const timetableResult = await this.getById(studentId);
    
    if (!timetableResult.success || !timetableResult.data) {
      return {
        success: false,
        error: '학생의 시간표를 찾을 수 없습니다.'
      };
    }

    const updatedIds = timetableResult.data.classSectionIds.filter(id => id !== classId);
    
    return this.update(studentId, {
      classSectionIds: updatedIds
    });
  }

  /**
   * 학생의 전체 시간표 재설정
   */
  async setStudentClasses(studentId: string, classIds: string[]): Promise<DatabaseResult<void>> {
    const timetableResult = await this.getById(studentId);
    
    if (!timetableResult.success) {
      // 시간표가 없으면 새로 생성
      return this.createWithId(studentId, {
        studentId,
        classSectionIds: classIds
      }).then(result => ({ success: result.success, error: result.error }));
    }

    return this.update(studentId, {
      classSectionIds: classIds
    });
  }

  /**
   * 특정 수업이 포함된 모든 시간표 조회
   */
  async getTimetablesByClass(classId: string): Promise<DatabaseResult<(StudentTimetable & { id: string })[]>> {
    const queries: DatabaseQuery[] = [
      { field: 'classSectionIds', operator: 'array-contains', value: classId }
    ];
    return this.getByQuery(queries);
  }
}