import { DatabaseService } from '../core/DatabaseService';
import { Parent, DatabaseResult, DatabaseQuery } from '../../../types/database';

/**
 * 학부모 관리 서비스
 */
export class ParentService extends DatabaseService<Parent> {
  constructor(academyId: string) {
    super(`academies/${academyId}/parents`);
  }

  /**
   * 학부모 이름으로 검색
   */
  async getByName(name: string): Promise<DatabaseResult<(Parent & { id: string })[]>> {
    const queries: DatabaseQuery[] = [
      { field: 'name', operator: '==', value: name }
    ];
    return this.getByQuery(queries);
  }

  /**
   * 전화번호로 학부모 검색
   */
  async getByPhone(phone: string): Promise<DatabaseResult<Parent & { id: string }>> {
    const queries: DatabaseQuery[] = [
      { field: 'contactInfo.phone', operator: '==', value: phone }
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
        error: '해당 전화번호를 가진 학부모를 찾을 수 없습니다.'
      };
    }
  }

  /**
   * 특정 학생의 학부모 조회
   */
  async getByStudentId(studentId: string): Promise<DatabaseResult<(Parent & { id: string })[]>> {
    const queries: DatabaseQuery[] = [
      { field: 'childStudentIds', operator: 'array-contains', value: studentId }
    ];
    return this.getByQuery(queries);
  }

  /**
   * 학부모에게 학생 추가
   */
  async addStudent(parentId: string, studentId: string): Promise<DatabaseResult<void>> {
    const parentResult = await this.getById(parentId);
    
    if (!parentResult.success || !parentResult.data) {
      return {
        success: false,
        error: '학부모를 찾을 수 없습니다.'
      };
    }

    const currentStudentIds = parentResult.data.childStudentIds;
    if (!currentStudentIds.includes(studentId)) {
      return this.update(parentId, {
        childStudentIds: [...currentStudentIds, studentId]
      });
    }

    return { success: true }; // 이미 등록된 경우
  }

  /**
   * 학부모에서 학생 제거
   */
  async removeStudent(parentId: string, studentId: string): Promise<DatabaseResult<void>> {
    const parentResult = await this.getById(parentId);
    
    if (!parentResult.success || !parentResult.data) {
      return {
        success: false,
        error: '학부모를 찾을 수 없습니다.'
      };
    }

    const updatedStudentIds = parentResult.data.childStudentIds.filter(id => id !== studentId);
    
    return this.update(parentId, {
      childStudentIds: updatedStudentIds
    });
  }

  /**
   * 학부모 연락처 정보 업데이트
   */
  async updateContactInfo(
    parentId: string, 
    contactInfo: { phone?: string; email?: string }
  ): Promise<DatabaseResult<void>> {
    const parentResult = await this.getById(parentId);
    
    if (!parentResult.success || !parentResult.data) {
      return {
        success: false,
        error: '학부모를 찾을 수 없습니다.'
      };
    }

    const updatedContactInfo = {
      ...parentResult.data.contactInfo,
      ...contactInfo
    };

    return this.update(parentId, {
      contactInfo: updatedContactInfo
    });
  }

  /**
   * 학부모와 학생을 함께 생성
   */
  async createWithStudents(
    parentData: Omit<Parent, 'id' | 'childStudentIds' | 'createdAt' | 'updatedAt'>,
    studentIds: string[]
  ): Promise<DatabaseResult<string>> {
    const data = {
      ...parentData,
      childStudentIds: studentIds
    };
    return this.create(data);
  }

  /**
   * 자녀가 없는 학부모 조회 (정리 목적)
   */
  async getOrphanedParents(): Promise<DatabaseResult<(Parent & { id: string })[]>> {
    const queries: DatabaseQuery[] = [
      { field: 'childStudentIds', operator: '==', value: [] }
    ];
    return this.getByQuery(queries);
  }

  /**
   * 학부모 통계 정보
   */
  async getParentStats(): Promise<DatabaseResult<{
    totalParents: number;
    parentsWithMultipleChildren: number;
    orphanedParents: number;
  }>> {
    const allParentsResult = await this.getAll();
    
    if (!allParentsResult.success || !allParentsResult.data) {
      return {
        success: false,
        error: '학부모 데이터 조회 실패'
      };
    }

    const parents = allParentsResult.data;
    const stats = {
      totalParents: parents.length,
      parentsWithMultipleChildren: parents.filter(p => p.childStudentIds.length > 1).length,
      orphanedParents: parents.filter(p => p.childStudentIds.length === 0).length
    };

    return {
      success: true,
      data: stats
    };
  }

  /**
   * 학부모 메모 업데이트
   */
  async updateNotes(parentId: string, notes: string): Promise<DatabaseResult<void>> {
    return this.update(parentId, { notes });
  }

  /**
   * 이메일로 학부모 검색
   */
  async getByEmail(email: string): Promise<DatabaseResult<Parent & { id: string }>> {
    const queries: DatabaseQuery[] = [
      { field: 'contactInfo.email', operator: '==', value: email }
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
        error: '해당 이메일을 가진 학부모를 찾을 수 없습니다.'
      };
    }
  }
}