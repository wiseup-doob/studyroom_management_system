// 관리자 관련 타입 정의

export interface Admin {
  id?: string;                     // Firestore 문서 ID
  authUid: string;                 // Firebase Auth UID
  name: string;                    // 관리자 이름
  academyId: string;               // 소속 학원 ID
  contactInfo?: {
    phone?: string;
    email?: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AdminPermission = 
  | 'manage_students'      // 학생 관리
  | 'manage_attendance'    // 출석 관리
  | 'manage_seats'         // 좌석 관리
  | 'view_reports'         // 리포트 조회
  | 'manage_academy'       // 학원 관리
  | 'manage_admins';       // 관리자 관리

export interface AcademySettings {
  id?: string;                     // Firestore 문서 ID
  academyId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  operatingHours: {
    open: string;
    close: string;
  };
  settings: {
    maxStudents: number;
    seatCapacity: number;
    attendanceCheckInTime: string;
    attendanceCheckOutTime: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
