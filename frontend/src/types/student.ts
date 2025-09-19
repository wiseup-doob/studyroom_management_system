// 학생 관련 타입 정의

export interface Student {
  id: string;                      // Firestore 문서 ID
  name: string;                    // 학생 이름
  email: string;                   // 학생 이메일
  grade: string;                   // 학생 학년 (중1, 중2, 중3, 고1, 고2, 고3)
  phone?: string;                  // 학생 전화번호
  parentName?: string;             // 보호자 이름
  parentPhone?: string;            // 보호자 전화번호
  address?: string;                // 주소
  isActive: boolean;               // 활성 상태
  createdAt: Date;                 // 생성일
  updatedAt: Date;                 // 수정일
  userId: string;                  // 소유자 사용자 ID
}

// 학생 생성 요청 타입
export interface CreateStudentRequest {
  name: string;
  email: string;
  grade: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  address?: string;
}

// 학생 수정 요청 타입
export interface UpdateStudentRequest {
  name?: string;
  email?: string;
  grade?: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  address?: string;
}

// 학생 검색 요청 타입
export interface SearchStudentsRequest {
  query: string;
  limit?: number;
}

// 학년 타입 (기존 호환성 유지)
export type Grade = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';

export interface StudentTimetable {
  studentId: string;
  schedule: {
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    subject: string;
    teacher?: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// 시간표 타입
export interface Timetable {
  id: string;
  name: string;
  description?: string;
  schedule: {
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    subject: string;
    teacher?: string;
    location?: string;
  }[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 공유 일정 타입
export interface ShareSchedule {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  location?: string;
  participants: string[]; // 사용자 ID 배열
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 좌석 타입
export interface Seat {
  id: string;
  number: string;
  row: number;
  col: number;
  isAvailable: boolean;
  studentId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 반 타입
export interface ClassSection {
  id: string;
  name: string;
  grade: Grade;
  description?: string;
  studentIds: string[];
  teacherId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 사용자 설정 타입
export interface UserSettings {
  id: string;
  theme: 'light' | 'dark';
  language: 'ko' | 'en';
  notifications: {
    email: boolean;
    push: boolean;
    attendance: boolean;
    schedule: boolean;
  };
  attendance: {
    checkInTime: string;
    checkOutTime: string;
    autoCheckOut: boolean;
  };
  privacy: {
    showProfile: boolean;
    showSchedule: boolean;
    showAttendance: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
