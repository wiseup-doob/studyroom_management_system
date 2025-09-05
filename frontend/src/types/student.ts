// 학생 관련 타입 정의

export interface Student {
  id?: string;                     // Firestore 문서 ID
  authUid: string;                 // Firebase Auth UID (로그인 및 권한 확인용)
  name: string;                    // 학생 이름
  grade: Grade;                    // 학생 학년
  firstAttendanceDate?: Date;
  lastAttendanceDate?: Date;
  parentsId?: string;
  status: 'active' | 'inactive';
  contactInfo?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

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
