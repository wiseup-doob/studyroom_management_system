import * as admin from 'firebase-admin';
import { DatabaseQuery, DatabaseResult, PaginationOptions } from '../../../types/database';

/**
 * Firebase Admin SDK를 사용한 데이터베이스 핵심 서비스
 * 모든 컬렉션 서비스가 상속받아 사용하는 기본 클래스
 */
export abstract class DatabaseService<T extends Record<string, any>> {
  protected db: admin.firestore.Firestore;
  protected collectionPath: string;

  constructor(collectionPath: string) {
    this.db = admin.firestore();
    this.collectionPath = collectionPath;
  }

  /**
   * 문서 ID로 단일 문서 조회
   */
  async getById(id: string): Promise<DatabaseResult<T & { id: string }>> {
    try {
      const docRef = this.db.collection(this.collectionPath).doc(id);
      const doc = await docRef.get();
      
      if (doc.exists) {
        return {
          success: true,
          data: { id: doc.id, ...doc.data() } as T & { id: string }
        };
      } else {
        return {
          success: false,
          error: '문서를 찾을 수 없습니다.'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `문서 조회 실패: ${error}`
      };
    }
  }

  /**
   * 조건에 따른 문서 조회
   */
  async getByQuery(
    queries: DatabaseQuery[], 
    pagination?: PaginationOptions
  ): Promise<DatabaseResult<(T & { id: string })[]>> {
    try {
      let query: admin.firestore.Query = this.db.collection(this.collectionPath);

      // 쿼리 조건 추가
      queries.forEach(q => {
        query = query.where(q.field, q.operator as admin.firestore.WhereFilterOp, q.value);
      });

      // 정렬 조건 추가
      if (pagination?.orderBy) {
        query = query.orderBy(pagination.orderBy.field, pagination.orderBy.direction);
      }

      // 페이지네이션
      if (pagination?.startAfter) {
        query = query.startAfter(pagination.startAfter);
      }

      if (pagination?.limit) {
        query = query.limit(pagination.limit);
      }

      const snapshot = await query.get();
      
      const docs: (T & { id: string })[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as T & { id: string }));

      return {
        success: true,
        data: docs
      };
    } catch (error) {
      return {
        success: false,
        error: `쿼리 실행 실패: ${error}`
      };
    }
  }

  /**
   * 모든 문서 조회
   */
  async getAll(pagination?: PaginationOptions): Promise<DatabaseResult<(T & { id: string })[]>> {
    return this.getByQuery([], pagination);
  }

  /**
   * 새 문서 생성
   */
  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseResult<string>> {
    try {
      const now = admin.firestore.Timestamp.now();
      
      const docData = {
        ...data,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await this.db.collection(this.collectionPath).add(docData);
      
      return {
        success: true,
        data: docRef.id
      };
    } catch (error) {
      return {
        success: false,
        error: `문서 생성 실패: ${error}`
      };
    }
  }

  /**
   * 특정 ID로 새 문서 생성
   */
  async createWithId(
    id: string, 
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DatabaseResult<string>> {
    try {
      const now = admin.firestore.Timestamp.now();
      
      const docData = {
        ...data,
        createdAt: now,
        updatedAt: now
      };

      await this.db.collection(this.collectionPath).doc(id).set(docData);
      
      return {
        success: true,
        data: id
      };
    } catch (error) {
      return {
        success: false,
        error: `문서 생성 실패: ${error}`
      };
    }
  }

  /**
   * 문서 업데이트
   */
  async update(
    id: string, 
    data: Partial<Omit<T, 'id' | 'createdAt'>>
  ): Promise<DatabaseResult<void>> {
    try {
      const updateData = {
        ...data,
        updatedAt: admin.firestore.Timestamp.now()
      };

      await this.db.collection(this.collectionPath).doc(id).update(updateData);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `문서 업데이트 실패: ${error}`
      };
    }
  }

  /**
   * 문서 삭제
   */
  async delete(id: string): Promise<DatabaseResult<void>> {
    try {
      await this.db.collection(this.collectionPath).doc(id).delete();
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `문서 삭제 실패: ${error}`
      };
    }
  }

  /**
   * 문서 존재 여부 확인
   */
  async exists(id: string): Promise<DatabaseResult<boolean>> {
    try {
      const doc = await this.db.collection(this.collectionPath).doc(id).get();
      
      return {
        success: true,
        data: doc.exists
      };
    } catch (error) {
      return {
        success: false,
        error: `존재 여부 확인 실패: ${error}`
      };
    }
  }

  /**
   * 배치 쓰기 작업
   */
  async batchWrite(operations: Array<{
    type: 'create' | 'update' | 'delete';
    id?: string;
    data?: any;
  }>): Promise<DatabaseResult<void>> {
    try {
      const batch = this.db.batch();
      const now = admin.firestore.Timestamp.now();

      operations.forEach(op => {
        const docRef = op.id 
          ? this.db.collection(this.collectionPath).doc(op.id)
          : this.db.collection(this.collectionPath).doc();

        switch (op.type) {
          case 'create':
            batch.set(docRef, {
              ...op.data,
              createdAt: now,
              updatedAt: now
            });
            break;
          case 'update':
            batch.update(docRef, {
              ...op.data,
              updatedAt: now
            });
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      });

      await batch.commit();
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `배치 작업 실패: ${error}`
      };
    }
  }

  /**
   * 컬렉션 경로 반환
   */
  getCollectionPath(): string {
    return this.collectionPath;
  }

  /**
   * 트랜잭션 실행
   */
  async runTransaction<R>(
    updateFunction: (transaction: admin.firestore.Transaction) => Promise<R>
  ): Promise<DatabaseResult<R>> {
    try {
      const result = await this.db.runTransaction(updateFunction);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: `트랜잭션 실패: ${error}`
      };
    }
  }
}