import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { Attendance, AttendanceSummary } from '../types/attendance';
import { Timetable, ShareSchedule, Seat, ClassSection, UserSettings, Student, CreateStudentRequest, UpdateStudentRequest, SearchStudentsRequest } from '../types/student';
import { securityService } from './securityService';
import { SecurityContext } from '../types/security';
import { 
  backendService, 
  CreateUserProfileRequest, 
  UpdateUserProfileRequest, 
  DeactivateUserProfileRequest, 
  DeleteUserProfileRequest, 
  RestoreUserProfileRequest, 
  GetUserDataStatsRequest, 
  CreateUserDataBackupRequest 
} from './backendService';

class ApiService {
  private userId: string | null = null;

  constructor() {
    // 사용자 기반 격리 시스템에서는 userId만 필요
  }

  // userId 설정
  setContext(userId: string, isActive: boolean = true) {
    this.userId = userId;

    // 보안 서비스에 컨텍스트 설정
    const securityContext: SecurityContext = {
      userId,
      isActive
    };
    securityService.setContext(securityContext);
  }

  // userId 검증
  private validateUserId(): string {
    if (!this.userId) {
      throw new Error('사용자 정보가 설정되지 않았습니다. 로그인을 다시 시도해주세요.');
    }
    return this.userId;
  }


  // ==================== 학생 관리 API ====================

  async createStudent(studentData: CreateStudentRequest): Promise<Student> {
    try {
      return await backendService.createStudent(studentData);
    } catch (error) {
      console.error('학생 생성 실패:', error);
      throw error;
    }
  }

  async getStudents(): Promise<Student[]> {
    try {
      return await backendService.getStudents();
    } catch (error) {
      console.error('학생 목록 조회 실패:', error);
      throw error;
    }
  }

  async getStudent(studentId: string): Promise<Student> {
    try {
      return await backendService.getStudent(studentId);
    } catch (error) {
      console.error('학생 조회 실패:', error);
      throw error;
    }
  }

  async updateStudent(studentId: string, updateData: UpdateStudentRequest): Promise<Student> {
    try {
      return await backendService.updateStudent(studentId, updateData);
    } catch (error) {
      console.error('학생 정보 수정 실패:', error);
      throw error;
    }
  }

  async deleteStudent(studentId: string): Promise<void> {
    try {
      return await backendService.deleteStudent(studentId);
    } catch (error) {
      console.error('학생 삭제 실패:', error);
      throw error;
    }
  }

  async searchStudents(query: string, limit?: number): Promise<Student[]> {
    try {
      return await backendService.searchStudents(query, limit);
    } catch (error) {
      console.error('학생 검색 실패:', error);
      throw error;
    }
  }

  // ==================== 출석 관리 API ====================

  async getAttendance(): Promise<Attendance[]> {
    const userId = this.validateUserId();
    
    try {
      const attendanceRef = collection(db, 'users', userId, 'attendance');
      const querySnapshot = await getDocs(attendanceRef);
      
      const attendance = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date(),
        checkInTime: doc.data().checkInTime?.toDate(),
        checkOutTime: doc.data().checkOutTime?.toDate(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Attendance[];

      return attendance;
    } catch (error) {
      console.error('출석 기록 조회 실패:', error);
      throw new Error('출석 기록을 불러오는데 실패했습니다.');
    }
  }

  async createAttendance(attendanceData: Omit<Attendance, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const userId = this.validateUserId();
    
    try {
      const attendanceRef = collection(db, 'users', userId, 'attendance');
      const docRef = await addDoc(attendanceRef, {
        ...attendanceData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('출석 기록 생성 실패:', error);
      throw new Error('출석 기록을 생성하는데 실패했습니다.');
    }
  }

  async updateAttendance(attendanceId: string, updateData: Partial<Attendance>): Promise<void> {
    const userId = this.validateUserId();
    
    try {
      const attendanceRef = doc(db, 'users', userId, 'attendance', attendanceId);
      await updateDoc(attendanceRef, {
        ...updateData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('출석 기록 업데이트 실패:', error);
      throw new Error('출석 기록을 업데이트하는데 실패했습니다.');
    }
  }

  async deleteAttendance(attendanceId: string): Promise<void> {
    const userId = this.validateUserId();
    
    try {
      const attendanceRef = doc(db, 'users', userId, 'attendance', attendanceId);
      await deleteDoc(attendanceRef);
    } catch (error) {
      console.error('출석 기록 삭제 실패:', error);
      throw new Error('출석 기록을 삭제하는데 실패했습니다.');
    }
  }

  // ==================== 시간표 관리 API ====================

  async getTimetables(): Promise<Timetable[]> {
    const userId = this.validateUserId();
    
    try {
      const timetablesRef = collection(db, 'users', userId, 'timetables');
      const querySnapshot = await getDocs(timetablesRef);
      
      const timetables = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Timetable[];

      return timetables;
    } catch (error) {
      console.error('시간표 조회 실패:', error);
      throw new Error('시간표를 불러오는데 실패했습니다.');
    }
  }

  async createTimetable(timetableData: Omit<Timetable, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const userId = this.validateUserId();
    
    try {
      const timetablesRef = collection(db, 'users', userId, 'timetables');
      const docRef = await addDoc(timetablesRef, {
        ...timetableData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('시간표 생성 실패:', error);
      throw new Error('시간표를 생성하는데 실패했습니다.');
    }
  }

  async updateTimetable(timetableId: string, updateData: Partial<Timetable>): Promise<void> {
    const userId = this.validateUserId();
    
    try {
      const timetableRef = doc(db, 'users', userId, 'timetables', timetableId);
      await updateDoc(timetableRef, {
        ...updateData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('시간표 업데이트 실패:', error);
      throw new Error('시간표를 업데이트하는데 실패했습니다.');
    }
  }

  async deleteTimetable(timetableId: string): Promise<void> {
    const userId = this.validateUserId();
    
    try {
      const timetableRef = doc(db, 'users', userId, 'timetables', timetableId);
      await deleteDoc(timetableRef);
    } catch (error) {
      console.error('시간표 삭제 실패:', error);
      throw new Error('시간표를 삭제하는데 실패했습니다.');
    }
  }

  // ==================== 공유 일정 관리 API ====================

  async getShareSchedules(): Promise<ShareSchedule[]> {
    const userId = this.validateUserId();
    
    try {
      const shareSchedulesRef = collection(db, 'users', userId, 'shareSchedules');
      const querySnapshot = await getDocs(shareSchedulesRef);
      
      const shareSchedules = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as ShareSchedule[];

      return shareSchedules;
    } catch (error) {
      console.error('공유 일정 조회 실패:', error);
      throw new Error('공유 일정을 불러오는데 실패했습니다.');
    }
  }

  async createShareSchedule(shareScheduleData: Omit<ShareSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const userId = this.validateUserId();
    
    try {
      const shareSchedulesRef = collection(db, 'users', userId, 'shareSchedules');
      const docRef = await addDoc(shareSchedulesRef, {
        ...shareScheduleData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('공유 일정 생성 실패:', error);
      throw new Error('공유 일정을 생성하는데 실패했습니다.');
    }
  }

  async updateShareSchedule(shareScheduleId: string, updateData: Partial<ShareSchedule>): Promise<void> {
    const userId = this.validateUserId();
    
    try {
      const shareScheduleRef = doc(db, 'users', userId, 'shareSchedules', shareScheduleId);
      await updateDoc(shareScheduleRef, {
        ...updateData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('공유 일정 업데이트 실패:', error);
      throw new Error('공유 일정을 업데이트하는데 실패했습니다.');
    }
  }

  async deleteShareSchedule(shareScheduleId: string): Promise<void> {
    const userId = this.validateUserId();
    
    try {
      const shareScheduleRef = doc(db, 'users', userId, 'shareSchedules', shareScheduleId);
      await deleteDoc(shareScheduleRef);
    } catch (error) {
      console.error('공유 일정 삭제 실패:', error);
      throw new Error('공유 일정을 삭제하는데 실패했습니다.');
    }
  }

  // ==================== 좌석 관리 API ====================

  async getSeats(): Promise<Seat[]> {
    const userId = this.validateUserId();
    
    try {
      const seatsRef = collection(db, 'users', userId, 'seats');
      const querySnapshot = await getDocs(seatsRef);
      
      const seats = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Seat[];

      return seats;
    } catch (error) {
      console.error('좌석 조회 실패:', error);
      throw new Error('좌석을 불러오는데 실패했습니다.');
    }
  }

  async createSeat(seatData: Omit<Seat, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const userId = this.validateUserId();
    
    try {
      const seatsRef = collection(db, 'users', userId, 'seats');
      const docRef = await addDoc(seatsRef, {
        ...seatData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('좌석 생성 실패:', error);
      throw new Error('좌석을 생성하는데 실패했습니다.');
    }
  }

  async updateSeat(seatId: string, updateData: Partial<Seat>): Promise<void> {
    const userId = this.validateUserId();
    
    try {
      const seatRef = doc(db, 'users', userId, 'seats', seatId);
      await updateDoc(seatRef, {
        ...updateData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('좌석 업데이트 실패:', error);
      throw new Error('좌석을 업데이트하는데 실패했습니다.');
    }
  }

  async deleteSeat(seatId: string): Promise<void> {
    const userId = this.validateUserId();
    
    try {
      const seatRef = doc(db, 'users', userId, 'seats', seatId);
      await deleteDoc(seatRef);
    } catch (error) {
      console.error('좌석 삭제 실패:', error);
      throw new Error('좌석을 삭제하는데 실패했습니다.');
    }
  }

  // ==================== 반 관리 API ====================

  async getClassSections(): Promise<ClassSection[]> {
    const userId = this.validateUserId();
    
    try {
      const classSectionsRef = collection(db, 'users', userId, 'classSections');
      const querySnapshot = await getDocs(classSectionsRef);
      
      const classSections = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as ClassSection[];

      return classSections;
    } catch (error) {
      console.error('반 조회 실패:', error);
      throw new Error('반을 불러오는데 실패했습니다.');
    }
  }

  async createClassSection(classSectionData: Omit<ClassSection, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const userId = this.validateUserId();
    
    try {
      const classSectionsRef = collection(db, 'users', userId, 'classSections');
      const docRef = await addDoc(classSectionsRef, {
        ...classSectionData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('반 생성 실패:', error);
      throw new Error('반을 생성하는데 실패했습니다.');
    }
  }

  async updateClassSection(classSectionId: string, updateData: Partial<ClassSection>): Promise<void> {
    const userId = this.validateUserId();
    
    try {
      const classSectionRef = doc(db, 'users', userId, 'classSections', classSectionId);
      await updateDoc(classSectionRef, {
        ...updateData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('반 업데이트 실패:', error);
      throw new Error('반을 업데이트하는데 실패했습니다.');
    }
  }

  async deleteClassSection(classSectionId: string): Promise<void> {
    const userId = this.validateUserId();
    
    try {
      const classSectionRef = doc(db, 'users', userId, 'classSections', classSectionId);
      await deleteDoc(classSectionRef);
    } catch (error) {
      console.error('반 삭제 실패:', error);
      throw new Error('반을 삭제하는데 실패했습니다.');
    }
  }

  // ==================== 출석 요약 API ====================

  async getAttendanceSummaries(): Promise<AttendanceSummary[]> {
    const userId = this.validateUserId();
    
    try {
      const attendanceSummariesRef = collection(db, 'users', userId, 'attendanceSummaries');
      const querySnapshot = await getDocs(attendanceSummariesRef);
      
      const attendanceSummaries = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as AttendanceSummary[];

      return attendanceSummaries;
    } catch (error) {
      console.error('출석 요약 조회 실패:', error);
      throw new Error('출석 요약을 불러오는데 실패했습니다.');
    }
  }

  async createAttendanceSummary(attendanceSummaryData: Omit<AttendanceSummary, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const userId = this.validateUserId();
    
    try {
      const attendanceSummariesRef = collection(db, 'users', userId, 'attendanceSummaries');
      const docRef = await addDoc(attendanceSummariesRef, {
        ...attendanceSummaryData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('출석 요약 생성 실패:', error);
      throw new Error('출석 요약을 생성하는데 실패했습니다.');
    }
  }

  // ==================== 사용자 설정 API ====================

  async getUserSettings(): Promise<UserSettings | null> {
    const userId = this.validateUserId();
    
    try {
      const settingsRef = doc(db, 'users', userId, 'settings', 'general');
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
      } as UserSettings;
    } catch (error) {
      console.error('사용자 설정 조회 실패:', error);
      throw new Error('사용자 설정을 불러오는데 실패했습니다.');
    }
  }

  async updateUserSettings(settingsData: Partial<UserSettings>): Promise<void> {
    const userId = this.validateUserId();
    
    try {
      const settingsRef = doc(db, 'users', userId, 'settings', 'general');
      await updateDoc(settingsRef, {
        ...settingsData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('사용자 설정 업데이트 실패:', error);
      throw new Error('사용자 설정을 업데이트하는데 실패했습니다.');
    }
  }

  // ==================== 백엔드 함수 호출 메서드 ====================

  /**
   * 백엔드를 통한 사용자 프로필 생성/업데이트
   */
  async createOrUpdateUserProfile(userData: CreateUserProfileRequest) {
    try {
      return await backendService.createOrUpdateUserProfile(userData);
    } catch (error) {
      console.error('백엔드 사용자 프로필 생성/업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 백엔드를 통한 사용자 프로필 조회
   */
  async getUserProfile(userId: string) {
    try {
      return await backendService.getUserProfile(userId);
    } catch (error) {
      console.error('백엔드 사용자 프로필 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 백엔드를 통한 사용자 프로필 비활성화
   */
  async deactivateUserProfile(userId: string) {
    try {
      return await backendService.deactivateUserProfile(userId);
    } catch (error) {
      console.error('백엔드 사용자 프로필 비활성화 실패:', error);
      throw error;
    }
  }

  /**
   * 백엔드를 통한 사용자 프로필 완전 삭제
   */
  async deleteUserProfile(userId: string, confirmDeletion: boolean = false) {
    try {
      return await backendService.deleteUserProfile(userId, confirmDeletion);
    } catch (error) {
      console.error('백엔드 사용자 프로필 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 백엔드를 통한 사용자 프로필 복구
   */
  async restoreUserProfile(userId: string) {
    try {
      return await backendService.restoreUserProfile(userId);
    } catch (error) {
      console.error('백엔드 사용자 프로필 복구 실패:', error);
      throw error;
    }
  }

  /**
   * 백엔드를 통한 사용자 데이터 통계 조회
   */
  async getUserDataStats(userId: string) {
    try {
      return await backendService.getUserDataStats(userId);
    } catch (error) {
      console.error('백엔드 사용자 데이터 통계 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 백엔드를 통한 사용자 데이터 백업 생성
   */
  async createUserDataBackup(userId: string) {
    try {
      return await backendService.createUserDataBackup(userId);
    } catch (error) {
      console.error('백엔드 사용자 데이터 백업 생성 실패:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
