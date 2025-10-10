// 출석 관리 시스템 타입 변환 유틸리티
// Firestore 데이터 → TypeScript 타입 변환

import { Timestamp } from 'firebase/firestore';
import {
  SeatLayout,
  SeatAssignment,
  StudentAttendanceRecord,
  AttendanceCheckLink,
  AttendanceStudentPin,
  SeatingChartSeat,
  SeatLayoutGroup
} from '../types/attendance';

/**
 * Firestore Timestamp를 Date로 변환
 */
export function convertTimestampToDate(timestamp: any): Date {
  if (timestamp instanceof Date) return timestamp;
  if (timestamp?.toDate) return timestamp.toDate();
  if (timestamp?.seconds) return new Date(timestamp.seconds * 1000);
  if (typeof timestamp === 'string') return new Date(timestamp);
  return new Date();
}

/**
 * Firestore 문서를 SeatLayout 타입으로 변환
 */
export function convertToSeatLayout(doc: any): SeatLayout {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id || data.id,
    name: data.name,
    layout: data.layout,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt)
  };
}

/**
 * Firestore 문서를 SeatAssignment 타입으로 변환
 */
export function convertToSeatAssignment(doc: any): SeatAssignment {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id || data.id,
    seatId: data.seatId,
    assignedAt: convertTimestampToDate(data.assignedAt),
    expiresAt: data.expiresAt ? convertTimestampToDate(data.expiresAt) : undefined,
    status: data.status,
    updatedAt: convertTimestampToDate(data.updatedAt),
    studentId: data.studentId,
    studentName: data.studentName,
    seatNumber: data.seatNumber,
    timetableId: data.timetableId,
    seatLayoutId: data.seatLayoutId,
    expectedSchedule: data.expectedSchedule
  };
}

/**
 * Firestore 문서를 StudentAttendanceRecord 타입으로 변환
 */
export function convertToStudentAttendanceRecord(doc: any): StudentAttendanceRecord {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id || data.id,
    userId: data.userId,
    studentId: data.studentId,
    studentName: data.studentName,
    seatLayoutId: data.seatLayoutId,
    seatId: data.seatId,
    seatNumber: data.seatNumber,
    date: data.date,
    dayOfWeek: data.dayOfWeek,
    expectedArrivalTime: data.expectedArrivalTime,
    expectedDepartureTime: data.expectedDepartureTime,
    actualArrivalTime: data.actualArrivalTime ? convertTimestampToDate(data.actualArrivalTime) : undefined,
    actualDepartureTime: data.actualDepartureTime ? convertTimestampToDate(data.actualDepartureTime) : undefined,
    status: data.status,
    excusedReason: data.excusedReason,
    excusedNote: data.excusedNote,
    excusedBy: data.excusedBy,
    isLate: data.isLate,
    isEarlyLeave: data.isEarlyLeave,
    lateMinutes: data.lateMinutes,
    earlyLeaveMinutes: data.earlyLeaveMinutes,
    checkInMethod: data.checkInMethod,
    checkOutMethod: data.checkOutMethod,
    notes: data.notes,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt),
    recordTimestamp: convertTimestampToDate(data.recordTimestamp)
  };
}

/**
 * Firestore 문서를 AttendanceCheckLink 타입으로 변환
 */
export function convertToAttendanceCheckLink(doc: any): AttendanceCheckLink {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id || data.id,
    userId: data.userId,
    linkToken: data.linkToken,
    linkUrl: data.linkUrl,
    seatLayoutId: data.seatLayoutId,
    seatLayoutName: data.seatLayoutName,
    title: data.title,
    description: data.description,
    isActive: data.isActive,
    expiresAt: data.expiresAt ? convertTimestampToDate(data.expiresAt) : undefined,
    usageCount: data.usageCount,
    lastUsedAt: data.lastUsedAt ? convertTimestampToDate(data.lastUsedAt) : undefined,
    requireConfirmation: data.requireConfirmation,
    allowedDaysOfWeek: data.allowedDaysOfWeek,
    allowedTimeRange: data.allowedTimeRange,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt)
  };
}

/**
 * Firestore 문서를 AttendanceStudentPin 타입으로 변환
 */
export function convertToAttendanceStudentPin(doc: any): AttendanceStudentPin {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id || data.id,
    userId: data.userId,
    studentId: data.studentId,
    studentName: data.studentName,
    pinHash: data.pinHash,
    isActive: data.isActive,
    isLocked: data.isLocked,
    failedAttempts: data.failedAttempts,
    lastFailedAt: data.lastFailedAt ? convertTimestampToDate(data.lastFailedAt) : undefined,
    lastChangedAt: convertTimestampToDate(data.lastChangedAt),
    changeHistory: data.changeHistory?.map((h: any) => ({
      changedAt: convertTimestampToDate(h.changedAt),
      changedBy: h.changedBy
    })),
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt)
  };
}

/**
 * SeatingChartSeat 배열을 GroupSeatingGrid로 변환
 *
 * @param group - 그룹 정보
 * @param seats - 해당 그룹에 속한 좌석 배열
 * @returns rows x cols 크기의 2차원 배열
 */
export function convertToGroupSeatingGrid(
  group: SeatLayoutGroup,
  seats: SeatingChartSeat[]
): (SeatingChartSeat | null)[][] {
  // rows x cols 크기의 2차원 배열 초기화
  const grid: (SeatingChartSeat | null)[][] = Array.from(
    { length: group.rows },
    () => Array(group.cols).fill(null)
  );

  // 그룹에 속한 좌석들을 그리드에 배치
  seats.forEach(seat => {
    const { row, col } = seat.seatLayoutSeat;
    if (row !== undefined && col !== undefined && row < group.rows && col < group.cols) {
      grid[row][col] = seat;
    }
  });

  return grid;
}

/**
 * 오늘 날짜를 DayOfWeek 타입으로 변환
 */
export function getTodayDayOfWeek(): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date().getDay()];
}

/**
 * Date 객체를 YYYY-MM-DD 형식 문자열로 변환
 */
export function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 시간 문자열(HH:mm) 비교
 * @returns time1이 time2보다 늦으면 양수, 빠르면 음수, 같으면 0
 */
export function compareTime(time1: string, time2: string): number {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);

  const minutes1 = h1 * 60 + m1;
  const minutes2 = h2 * 60 + m2;

  return minutes1 - minutes2;
}

/**
 * 두 시간 사이의 차이를 분 단위로 계산
 */
export function getTimeDifferenceInMinutes(time1: string, time2: string): number {
  return Math.abs(compareTime(time1, time2));
}
