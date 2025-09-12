import * as admin from 'firebase-admin';

type FirestoreTimestamp = admin.firestore.Timestamp;

// ===== 기본 타입 정의 =====
export type Grade = '초1' | '초2' | '초3' | '초4' | '초5' | '초6' | 
                   '중1' | '중2' | '중3' | '고1' | '고2' | '고3';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 
                        'friday' | 'saturday' | 'sunday';

export type AttendanceStatus = 'present' | 'dismissed' | 'unauthorized_absent' | 
                              'authorized_absent' | 'not_enrolled';

export type SeatStatus = 'vacant' | 'occupied' | 'unavailable';

export type AssignmentStatus = 'active' | 'released';

// ===== 1. 학생 컬렉션 =====
export interface Student {
  authUid: string;
  name: string;
  grade: Grade;
  firstAttendanceDate?: FirestoreTimestamp;
  lastAttendanceDate?: FirestoreTimestamp;
  parentsId?: string;
  status: 'active' | 'inactive';
  contactInfo?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// ===== 2. 학부모 컬렉션 =====
export interface Parent {
  name: string;
  contactInfo: {
    phone: string;
    email?: string;
  };
  childStudentIds: string[];
  notes?: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// ===== 3. 출석 기록 컬렉션 =====
export interface AttendanceRecord {
  studentId: string;
  studentName: string;
  seatId?: string; // 좌석 배치표를 통한 출결 관리
  date: string; // "2024-03-15" 형태
  status: AttendanceStatus;
  checkInTime?: FirestoreTimestamp;
  checkOutTime?: FirestoreTimestamp;
  notes?: string;
  isLate?: boolean;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// ===== 4. 수업 섹션 컬렉션 =====
export interface ClassSection {
  name: string;
  schedule: {
    dayOfWeek: DayOfWeek;
    startTime: string; // HH:MM
    endTime: string;   // HH:MM
  }[];
  description?: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// ===== 5. 학생 개인 시간표 컬렉션 =====
export interface StudentTimetable {
  studentId: string;
  classSectionIds: string[];
  updatedAt: FirestoreTimestamp;
}

// ===== 6. 좌석 컬렉션 =====
export interface Seat {
  seatNumber: string;
  status: SeatStatus;
  isActive: boolean;
  layoutName: string; // 어떤 배치도에 속하는지
  position: {
    x: number; // 열 위치 (좌표)
    y: number; // 행 위치 (좌표)
  };
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// ===== 7. 좌석 배정 컬렉션 =====
export interface SeatAssignment {
  seatId: string;
  assignedAt: FirestoreTimestamp;
  status: AssignmentStatus;
  updatedAt: FirestoreTimestamp;
}

// ===== 8. 좌석 배치도 컬렉션 =====
export interface SeatLayout {
  name: string;
  description?: string;
  gridSize: {
    rows: number;
    cols: number;
  };
  isActive: boolean;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// ===== 9. 관리자 정보 컬렉션 =====
export interface Admin {
  authUid: string;
  name: string;
  role: 'admin' | 'super_admin';
  email: string;
  phone?: string;
  isActive: boolean;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// ===== 컬렉션 경로 타입 =====
export interface CollectionPaths {
  students: `academies/${string}/students`;
  parents: `academies/${string}/parents`;
  attendanceRecords: `academies/${string}/attendance_records`;
  classSections: `academies/${string}/class_sections`;
  studentTimetables: `academies/${string}/student_timetables`;
  seats: `academies/${string}/seats`;
  seatAssignments: `academies/${string}/seat_assignments`;
  seatLayouts: `academies/${string}/seat_layouts`;
  admins: `academies/${string}/admins`;
}

// ===== 쿼리 및 서비스 타입 =====
export interface DatabaseQuery {
  field: string;
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';
  value: any;
}

export interface DatabaseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginationOptions {
  limit?: number;
  startAfter?: any;
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

// ===== API 요청/응답 타입 =====
export interface CreateStudentRequest {
  academyId: string;
  name: string;
  grade: Grade;
  contactInfo?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  parentsId?: string;
}

export interface UpdateStudentRequest {
  academyId: string;
  studentId: string;
  data: Partial<Omit<Student, 'id' | 'authUid' | 'createdAt' | 'updatedAt'>>;
}

export interface CreateAttendanceRequest {
  academyId: string;
  studentId: string;
  seatId?: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface AssignSeatRequest {
  academyId: string;
  studentId: string;
  seatId: string;
}

export interface CreateSeatLayoutRequest {
  academyId: string;
  name: string;
  description?: string;
  gridSize: {
    rows: number;
    cols: number;
  };
}

export interface CreateSeatRequest {
  academyId: string;
  seatNumber: string;
  layoutName: string;
  position: {
    x: number;
    y: number;
  };
}