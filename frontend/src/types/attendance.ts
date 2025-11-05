// 출석 관리 시스템 타입 정의
// 기반: ATTENDANCE_DATABASE_DESIGN.md
// 백엔드: functions/src/modules/personal/studentAttendanceManagement.ts

import { Student } from './student';

// ==================== 백엔드 타입과 일치 ====================

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type StudentAttendanceStatus =
  | 'scheduled'        // 예정 (배치로 사전 생성된 레코드)
  | 'checked_in'      // 등원
  | 'checked_out'     // 하원
  | 'not_arrived'     // 미등원
  | 'absent_excused'  // 사유결석
  | 'absent_unexcused'; // 무단결석

// ==================== SeatLayout (백엔드와 동일) ====================

export interface SeatLayoutGroup {
  id: string;
  name: string;
  rows: number;
  cols: number;
  position: { x: number; y: number };
}

export interface SeatLayoutSeat {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  groupId?: string;
  row?: number;
  col?: number;
  label?: string;
}

export interface SeatLayout {
  id: string;
  name: string;
  layout: {
    groups?: SeatLayoutGroup[];
    seats: SeatLayoutSeat[];
    dimensions: { width: number; height: number };
  };
  createdAt: Date;
  updatedAt: Date;
}

// ==================== SeatAssignment (백엔드와 동일) ====================

export interface SeatAssignment {
  id: string;
  seatId: string;
  assignedAt: Date;
  expiresAt?: Date;
  status: 'active' | 'expired' | 'cancelled';
  updatedAt: Date;

  // 출석 시스템용 필드
  studentId?: string;
  studentName?: string;
  seatNumber?: string;
  timetableId?: string;
  seatLayoutId?: string;
  expectedSchedule?: {
    [key in DayOfWeek]?: {
      arrivalTime: string;
      departureTime: string;
      isActive: boolean;
    };
  };
}

// ==================== StudentAttendanceRecord (백엔드와 동일) ====================

export interface StudentAttendanceRecord {
  id: string;
  userId: string;
  studentId: string;
  studentName: string;
  seatLayoutId: string;
  seatId: string;
  seatNumber: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: DayOfWeek;

  // 시간표 슬롯 정보 (optional - 하위 호환성 유지)
  timetableId?: string; // 시간표 ID
  timeSlotId?: string; // 슬롯 ID (slot.id 또는 slot_0, slot_1...)
  timeSlotSubject?: string; // 과목명 (예: "수학", "자습")
  timeSlotType?: 'class' | 'self_study' | 'external'; // 슬롯 타입

  expectedArrivalTime: string;
  expectedDepartureTime: string;
  actualArrivalTime?: Date;
  actualDepartureTime?: Date;

  // 시간 로깅 필드 (optional)
  notArrivedAt?: Date; // 미등원 확정 시간 (수업 시작 시간)
  absentConfirmedAt?: Date; // 결석 확정 시간 (유예 종료 시간)
  absentMarkedAt?: Date; // 배치 처리 시간

  status: StudentAttendanceStatus;
  excusedReason?: string;
  excusedNote?: string;
  excusedBy?: string;
  isLate: boolean;
  isEarlyLeave: boolean;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  checkInMethod?: 'pin' | 'manual' | 'admin';
  checkOutMethod?: 'pin' | 'manual' | 'admin';
  notes?: string;
  sessionNumber: number; // 당일 몇 번째 세션인지 (1, 2, 3...)
  isLatestSession: boolean; // 가장 최신 세션 여부
  createdAt: Date;
  updatedAt: Date;
  recordTimestamp: Date;
}

// ==================== AttendanceCheckLink (백엔드와 동일) ====================

export interface AttendanceCheckLink {
  id: string;
  userId: string;
  linkToken: string;
  linkUrl: string;
  seatLayoutId: string;
  seatLayoutName: string;
  title: string;
  description?: string;
  isActive: boolean;
  expiresAt?: Date;
  usageCount: number;
  lastUsedAt?: Date;
  requireConfirmation: boolean;
  allowedDaysOfWeek?: DayOfWeek[];
  allowedTimeRange?: {
    startTime: string;
    endTime: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ==================== AttendanceStudentPin (백엔드와 동일) ====================

export interface AttendanceStudentPin {
  id: string;
  userId: string;
  studentId: string;
  studentName: string;
  pinHash: string; // Frontend에서는 표시하지 않음
  actualPin: string; // 실제 PIN (관리자 확인용)
  isActive: boolean;
  isLocked: boolean;
  failedAttempts: number;
  lastFailedAt?: Date;
  lastChangedAt: Date;
  lastUsedAt?: Date;
  changeHistory?: {
    changedAt: Date;
    changedBy: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// ==================== UI 전용 타입 ====================

// 좌석 배치도 시각화용 타입
export interface SeatingChartSeat {
  seatLayoutSeat: SeatLayoutSeat; // 좌석 배치 정보
  assignment?: SeatAssignment; // 할당 정보
  attendanceRecord?: StudentAttendanceRecord; // 오늘 출석 기록
  student?: Student; // 학생 정보
}

// 그룹별 좌석 그리드
export interface GroupSeatingGrid {
  group: SeatLayoutGroup;
  grid: (SeatingChartSeat | null)[][]; // row x col 2차원 배열
}

// 좌석 할당 요청 데이터
export interface AssignSeatData {
  seatId: string;
  studentId: string;
  timetableId?: string;
  seatLayoutId: string;
}

// 좌석 배치도 생성 요청 데이터 (현재 백엔드 API에 맞춤)
export interface CreateSeatLayoutData {
  name: string;
  layout: {
    groups?: SeatLayoutGroup[];
    seats: SeatLayoutSeat[];
    dimensions: { width: number; height: number };
  };
}

// 좌석 배치도 빠른 생성 요청 데이터 (향후 백엔드 API 수정 시 사용)
export interface QuickCreateSeatLayoutData {
  name: string;
  groups: {
    name: string;
    rows: number;
    cols: number;
    position: { x: number; y: number };
  }[];
}

// 출석 체크 링크 생성 요청 데이터
export interface CreateAttendanceCheckLinkData {
  seatLayoutId: string;
  title: string;
  description?: string;
  expiresInDays?: number;
}

// 출석 상태 변경 요청 데이터
export interface UpdateAttendanceStatusData {
  recordId: string;
  status: StudentAttendanceStatus;
  excusedReason?: string;
  excusedNote?: string;
}

// PIN 생성 요청 데이터
export interface GenerateStudentPinData {
  studentId: string;
  pin: string;
}

// PIN 변경 요청 데이터
export interface UpdateStudentPinData {
  studentId: string;
  newPin: string;
}

// 학생 결석 처리 요청 데이터
export interface MarkStudentAbsentData {
  studentId: string;
  seatLayoutId: string;
  status: 'absent_excused' | 'absent_unexcused';
  excusedReason?: string;
  excusedNote?: string;
}

// ==================== 통계 타입 ====================

export interface AttendanceStatsSummary {
  totalSeats: number;
  assignedSeats: number;
  checkedIn: number;
  checkedOut: number;
  notArrived: number;
  absentExcused: number;
  absentUnexcused: number;
  lateCount: number;
  earlyLeaveCount: number;
}
