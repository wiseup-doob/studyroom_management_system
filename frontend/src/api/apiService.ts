import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  limit,
  QueryConstraint,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { Student } from '../types/student';
import { Admin, AcademySettings, AdminPermission } from '../types/admin';
import { securityService } from '../services/securityService';
import { SecurityContext, SecurityError } from '../types/security';
import { 
  backendService, 
  CreateUserRequest, 
  SetUserRoleRequest, 
  GetUsersRequest, 
  CreateAcademyRequest, 
  CreateTestDataRequest 
} from './backendService';

class ApiService {
  private academyId: string | null = null;
  private role: string | null = null;

  constructor() {
    // AuthContext에서 academyId와 role을 가져오는 방법을 찾아야 함
    // 현재는 메서드 호출 시마다 전달받는 방식으로 구현
  }

  // academyId와 role 설정
  setContext(academyId: string, role: string, permissions: string[] = [], isActive: boolean = true) {
    this.academyId = academyId;
    this.role = role;
    
    // 보안 서비스에 컨텍스트 설정
    const securityContext: SecurityContext = {
      academyId,
      role: role as 'student' | 'admin' | 'super_admin',
      permissions,
      isActive
    };
    securityService.setContext(securityContext);
  }

  // academyId 검증
  private validateAcademyId(): string {
    if (!this.academyId) {
      throw new Error('학원 정보가 설정되지 않았습니다. 로그인을 다시 시도해주세요.');
    }
    return this.academyId;
  }

  // 권한 검증
  private validatePermission(requiredRole: string[]): void {
    if (!this.role || !requiredRole.includes(this.role)) {
      throw new Error('이 작업을 수행할 권한이 없습니다.');
    }
  }

  // ==================== 학생 관련 API ====================

  async getStudents(): Promise<Student[]> {
    const academyId = this.validateAcademyId();
    
    try {
      // 보안 검증: 학생 목록 조회 권한 확인
      const accessControl = securityService.checkDataAccess('students', 'read');
      if (!accessControl.canRead) {
        throw new SecurityError('PERMISSION_DENIED', '학생 목록을 조회할 권한이 없습니다.');
      }

      // 의심스러운 활동 감지
      if (securityService.detectSuspiciousActivity('getStudents', 'students')) {
        throw new SecurityError('PERMISSION_DENIED', '보안상의 이유로 접근이 차단되었습니다.');
      }

      const studentsRef = collection(db, 'academies', academyId, 'students');
      const querySnapshot = await getDocs(studentsRef);
      
      const students = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        firstAttendanceDate: doc.data().firstAttendanceDate?.toDate(),
        lastAttendanceDate: doc.data().lastAttendanceDate?.toDate()
      })) as Student[];

      // 감사 로그 생성
      securityService.createAuditLog('getStudents', 'students', 'all', true);

      return students;
    } catch (error) {
      console.error('학생 목록 조회 실패:', error);
      
      // 감사 로그 생성 (실패)
      securityService.createAuditLog('getStudents', 'students', 'all', false, error instanceof Error ? error.message : 'Unknown error');
      
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new Error('학생 목록을 불러오는데 실패했습니다.');
    }
  }

  async getStudent(studentId: string): Promise<Student | null> {
    const academyId = this.validateAcademyId();
    
    try {
      // 보안 검증: 학생 데이터 접근 권한 확인
      const accessControl = securityService.checkStudentDataAccess(studentId, this.academyId || '');
      if (!accessControl.canRead) {
        throw new SecurityError('PERMISSION_DENIED', '해당 학생 정보에 접근할 권한이 없습니다.');
      }

      const studentRef = doc(db, 'academies', academyId, 'students', studentId);
      const studentDoc = await getDoc(studentRef);
      
      if (!studentDoc.exists()) {
        // 감사 로그 생성 (데이터 없음)
        securityService.createAuditLog('getStudent', 'students', studentId, false, 'Student not found');
        return null;
      }

      const data = studentDoc.data();
      const student = {
        id: studentDoc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        firstAttendanceDate: data.firstAttendanceDate?.toDate(),
        lastAttendanceDate: data.lastAttendanceDate?.toDate()
      } as Student;

      // 감사 로그 생성
      securityService.createAuditLog('getStudent', 'students', studentId, true);

      return student;
    } catch (error) {
      console.error('학생 정보 조회 실패:', error);
      
      // 감사 로그 생성 (실패)
      securityService.createAuditLog('getStudent', 'students', studentId, false, error instanceof Error ? error.message : 'Unknown error');
      
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new Error('학생 정보를 불러오는데 실패했습니다.');
    }
  }

  async createStudent(studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const academyId = this.validateAcademyId();
    
    try {
      // 보안 검증: 학생 생성 권한 확인
      const accessControl = securityService.checkDataAccess('students', 'write');
      if (!accessControl.canWrite) {
        throw new SecurityError('PERMISSION_DENIED', '학생을 생성할 권한이 없습니다.');
      }

      // 권한 검증
      const permissionCheck = securityService.validatePermission(['manage_students']);
      if (!permissionCheck.allowed) {
        throw new SecurityError('PERMISSION_DENIED', permissionCheck.reason || '필요한 권한이 없습니다.');
      }

      const studentsRef = collection(db, 'academies', academyId, 'students');
      const docRef = await addDoc(studentsRef, {
        ...studentData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // 감사 로그 생성
      securityService.createAuditLog('createStudent', 'students', docRef.id, true);
      
      return docRef.id;
    } catch (error) {
      console.error('학생 생성 실패:', error);
      
      // 감사 로그 생성 (실패)
      securityService.createAuditLog('createStudent', 'students', 'new', false, error instanceof Error ? error.message : 'Unknown error');
      
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new Error('학생을 생성하는데 실패했습니다.');
    }
  }

  async updateStudent(studentId: string, updateData: Partial<Student>): Promise<void> {
    const academyId = this.validateAcademyId();
    this.validatePermission(['admin', 'super_admin']);
    
    try {
      const studentRef = doc(db, 'academies', academyId, 'students', studentId);
      await updateDoc(studentRef, {
        ...updateData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('학생 정보 업데이트 실패:', error);
      throw new Error('학생 정보를 업데이트하는데 실패했습니다.');
    }
  }

  async deleteStudent(studentId: string): Promise<void> {
    const academyId = this.validateAcademyId();
    this.validatePermission(['admin', 'super_admin']);
    
    try {
      const studentRef = doc(db, 'academies', academyId, 'students', studentId);
      await deleteDoc(studentRef);
    } catch (error) {
      console.error('학생 삭제 실패:', error);
      throw new Error('학생을 삭제하는데 실패했습니다.');
    }
  }

  // ==================== 관리자 관련 API ====================

  async getAdmins(): Promise<Admin[]> {
    this.validatePermission(['super_admin']);
    
    try {
      const adminsRef = collection(db, 'admins');
      const querySnapshot = await getDocs(adminsRef);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Admin[];
    } catch (error) {
      console.error('관리자 목록 조회 실패:', error);
      throw new Error('관리자 목록을 불러오는데 실패했습니다.');
    }
  }

  async getAdmin(adminId: string): Promise<Admin | null> {
    this.validatePermission(['admin', 'super_admin']);
    
    try {
      const adminRef = doc(db, 'admins', adminId);
      const adminDoc = await getDoc(adminRef);
      
      if (!adminDoc.exists()) {
        return null;
      }

      const data = adminDoc.data();
      return {
        id: adminDoc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as Admin;
    } catch (error) {
      console.error('관리자 정보 조회 실패:', error);
      throw new Error('관리자 정보를 불러오는데 실패했습니다.');
    }
  }

  // ==================== 학원 설정 관련 API ====================

  async getAcademySettings(): Promise<AcademySettings | null> {
    const academyId = this.validateAcademyId();
    this.validatePermission(['admin', 'super_admin']);
    
    try {
      const settingsRef = doc(db, 'academies', academyId, 'settings', 'general');
      const settingsDoc = await getDoc(settingsRef);
      
      if (!settingsDoc.exists()) {
        return null;
      }

      const data = settingsDoc.data();
      return {
        id: settingsDoc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as AcademySettings;
    } catch (error) {
      console.error('학원 설정 조회 실패:', error);
      throw new Error('학원 설정을 불러오는데 실패했습니다.');
    }
  }

  async updateAcademySettings(settingsData: Partial<AcademySettings>): Promise<void> {
    const academyId = this.validateAcademyId();
    this.validatePermission(['admin', 'super_admin']);
    
    try {
      const settingsRef = doc(db, 'academies', academyId, 'settings', 'general');
      await updateDoc(settingsRef, {
        ...settingsData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('학원 설정 업데이트 실패:', error);
      throw new Error('학원 설정을 업데이트하는데 실패했습니다.');
    }
  }

  // ==================== 유틸리티 메서드 ====================

  // 특정 학원의 학생 수 조회
  async getStudentCount(): Promise<number> {
    const academyId = this.validateAcademyId();
    
    try {
      const studentsRef = collection(db, 'academies', academyId, 'students');
      const querySnapshot = await getDocs(studentsRef);
      return querySnapshot.size;
    } catch (error) {
      console.error('학생 수 조회 실패:', error);
      throw new Error('학생 수를 조회하는데 실패했습니다.');
    }
  }

  // 활성 학생 수 조회
  async getActiveStudentCount(): Promise<number> {
    const academyId = this.validateAcademyId();
    
    try {
      const studentsRef = collection(db, 'academies', academyId, 'students');
      const q = query(studentsRef, where('status', '==', 'active'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error('활성 학생 수 조회 실패:', error);
      throw new Error('활성 학생 수를 조회하는데 실패했습니다.');
    }
  }

  // ==================== 백엔드 함수 호출 메서드 ====================

  /**
   * 백엔드를 통한 사용자 생성
   */
  async createUserBackend(userData: CreateUserRequest) {
    try {
      return await backendService.createUser(userData);
    } catch (error) {
      console.error('백엔드 사용자 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 백엔드를 통한 사용자 역할 부여
   */
  async setUserRoleBackend(roleData: SetUserRoleRequest) {
    try {
      return await backendService.setUserRole(roleData);
    } catch (error) {
      console.error('백엔드 사용자 역할 설정 실패:', error);
      throw error;
    }
  }

  /**
   * 백엔드를 통한 사용자 목록 조회
   */
  async getUsersBackend(usersData: GetUsersRequest) {
    try {
      return await backendService.getUsers(usersData);
    } catch (error) {
      console.error('백엔드 사용자 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 백엔드를 통한 학원 생성
   */
  async createAcademyBackend(academyData: CreateAcademyRequest) {
    try {
      return await backendService.createAcademy(academyData);
    } catch (error) {
      console.error('백엔드 학원 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 백엔드를 통한 테스트 데이터 생성
   */
  async createTestDataBackend(testData: CreateTestDataRequest) {
    try {
      return await backendService.createTestData(testData);
    } catch (error) {
      console.error('백엔드 테스트 데이터 생성 실패:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
