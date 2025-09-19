// 출결 관리 관련 타입 정의

// 강의실 타입
export interface Classroom {
  id: string;
  name: string;
  rows: number;
  cols: number;
  seats: AttendanceSeat[];
  createdAt: Date;
  updatedAt: Date;
}

// 출결 관리용 좌석 타입
export interface AttendanceSeat {
  id: string;
  number: number;
  row: number;
  col: number;
  studentId?: string;  // 기존 Student.id와 연결
  status: SeatStatus;
  // isSelected는 UI 상태이므로 데이터 구조에서 분리
}

// 좌석 상태 타입
export type SeatStatus = 
  | 'empty'         // 빈 좌석 (흰색)
  | 'not-enrolled'  // 미등원 (흰색)
  | 'dismissed'     // 사유결석 (연한 노란색)
  | 'present'       // 등원 (연한 초록색)
  | 'unauthorized'  // 무단결석 (연한 빨간색)
  | 'authorized'    // 하원 (연한 회색)

// 출결 관리용 학생 타입 (기존 Student 타입 확장)
export interface AttendanceStudent {
  id: string;
  name: string;
  studentId: string;
  grade: string;
  // 기존 Student 타입의 다른 필드들도 필요시 추가
}

// 출결 상태 관리용 Context 타입
export interface AttendanceState {
  selectedClassroom: Classroom | null;
  seats: AttendanceSeat[];
  students: AttendanceStudent[];
  selectedSeatId: string | null;
  searchQuery: string;
  loading: boolean;
  error: string | null;
}

// 출결 상태 관리용 Action 타입
export type AttendanceAction = 
  | { type: 'SELECT_CLASSROOM'; payload: Classroom }
  | { type: 'SELECT_SEAT'; payload: string }
  | { type: 'UPDATE_SEAT_STATUS'; payload: { seatId: string; status: SeatStatus } }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_SELECTION' };

// API 응답 타입
export interface AttendanceApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 출결 통계 타입
export interface AttendanceStats {
  totalSeats: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  emptyCount: number;
  attendanceRate: number;
}

// 출석 기록 타입
export interface Attendance {
  id: string;
  date: Date;
  checkInTime?: Date;
  checkOutTime?: Date;
  status: 'present' | 'absent' | 'late' | 'early_leave';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 출석 요약 타입
export interface AttendanceSummary {
  id: string;
  period: string; // 'daily' | 'weekly' | 'monthly'
  startDate: Date;
  endDate: Date;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  attendanceRate: number;
  createdAt: Date;
  updatedAt: Date;
}
