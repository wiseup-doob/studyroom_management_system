// 출결 관리용 Mock 데이터

import { Classroom, AttendanceSeat, AttendanceStudent, SeatStatus } from './attendance';

// Mock 학생 데이터
export const mockStudents: AttendanceStudent[] = [
  { id: 'student-1', name: '홍길동', studentId: 'S001', grade: '3' },
  { id: 'student-2', name: '김철수', studentId: 'S002', grade: '3' },
  { id: 'student-3', name: '이영희', studentId: 'S003', grade: '3' },
  { id: 'student-4', name: '박민수', studentId: 'S004', grade: '3' },
  { id: 'student-5', name: '정수진', studentId: 'S005', grade: '3' },
  { id: 'student-6', name: '최동현', studentId: 'S006', grade: '3' },
  { id: 'student-7', name: '한소영', studentId: 'S007', grade: '3' },
  { id: 'student-8', name: '윤태호', studentId: 'S008', grade: '3' },
  { id: 'student-9', name: '강미래', studentId: 'S009', grade: '3' },
  { id: 'student-10', name: '임재현', studentId: 'S010', grade: '3' },
];

// 좌석 생성 헬퍼 함수
const generateMockSeats = (rows: number, cols: number): AttendanceSeat[] => {
  const seats: AttendanceSeat[] = [];
  let seatNumber = 1;
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const seatId = `seat-${row}-${col}`;
      const studentId = Math.random() > 0.3 ? mockStudents[Math.floor(Math.random() * mockStudents.length)].id : undefined;
      
      // 랜덤한 출결 상태 생성
      const statuses: SeatStatus[] = ['empty', 'not-enrolled', 'dismissed', 'present', 'unauthorized', 'authorized'];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      
      seats.push({
        id: seatId,
        number: seatNumber,
        row: row + 1,
        col: col + 1,
        studentId: studentId,
        status: studentId ? randomStatus : 'empty'
      });
      
      seatNumber++;
    }
  }
  
  return seats;
};

// Mock 강의실 데이터
export const mockClassrooms: Classroom[] = [
  {
    id: 'classroom-1',
    name: '제1강의실',
    rows: 7,
    cols: 7,
    seats: generateMockSeats(7, 7),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'classroom-2',
    name: '제2강의실',
    rows: 5,
    cols: 6,
    seats: generateMockSeats(5, 6),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'classroom-3',
    name: '제3강의실',
    rows: 6,
    cols: 8,
    seats: generateMockSeats(6, 8),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
];

// 기본 출결 상태
export const defaultAttendanceState = {
  selectedClassroom: null,
  seats: [],
  students: mockStudents,
  selectedSeatId: null,
  searchQuery: '',
  loading: false,
  error: null
};
