// React Query hooks for attendance management
// 서버 상태 관리: 자동 캐싱, refetching, 동기화

import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import attendanceService from '../services/attendanceService';
import {
  SeatLayout,
  SeatAssignment,
  StudentAttendanceRecord,
  AttendanceCheckLink,
  AttendanceStudentPin,
  AssignSeatData,
  CreateSeatLayoutData,
  CreateAttendanceCheckLinkData,
  UpdateAttendanceStatusData,
  GenerateStudentPinData,
  UpdateStudentPinData
} from '../types/attendance';

// ==================== Query Keys ====================

export const attendanceKeys = {
  all: ['attendance'] as const,
  layouts: () => [...attendanceKeys.all, 'layouts'] as const,
  layout: (id: string) => [...attendanceKeys.layouts(), id] as const,
  assignments: (layoutId: string | null) => [...attendanceKeys.all, 'assignments', layoutId] as const,
  todayRecords: (layoutId: string | null) => [...attendanceKeys.all, 'todayRecords', layoutId] as const,
  record: (recordId: string) => [...attendanceKeys.all, 'record', recordId] as const,
  checkLinks: (layoutId: string | null) => [...attendanceKeys.all, 'checkLinks', layoutId] as const,
  studentPin: (studentId: string | null) => [...attendanceKeys.all, 'pin', studentId] as const,
};

// ==================== SeatLayout Queries ====================

/**
 * 좌석 배치도 목록 조회
 */
export function useSeatLayouts() {
  return useQuery({
    queryKey: attendanceKeys.layouts(),
    queryFn: () => attendanceService.getSeatLayouts(),
    staleTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * 좌석 배치도 생성
 */
export function useCreateSeatLayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSeatLayoutData) => attendanceService.createSeatLayout(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.layouts() });
    },
  });
}

/**
 * 좌석 배치도 삭제
 */
export function useDeleteSeatLayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (layoutId: string) => attendanceService.deleteSeatLayout(layoutId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.layouts() });
    },
  });
}

// ==================== SeatAssignment Queries ====================

/**
 * 특정 배치도의 좌석 할당 목록 조회
 */
export function useSeatAssignments(layoutId: string | null) {
  return useQuery({
    queryKey: attendanceKeys.assignments(layoutId),
    queryFn: () => layoutId ? attendanceService.getSeatAssignments(layoutId) : Promise.resolve([]),
    enabled: !!layoutId,
    staleTime: 1 * 60 * 1000, // 1분
  });
}

/**
 * 학생 좌석 할당
 */
export function useAssignSeat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AssignSeatData) => attendanceService.assignSeat(data),
    onSuccess: (_, variables) => {
      // 해당 배치도의 할당 정보 갱신
      queryClient.invalidateQueries({ queryKey: attendanceKeys.assignments(variables.seatLayoutId) });
      // 오늘 출석 기록도 갱신 (새 좌석 할당 시 출석 기록 생성될 수 있음)
      queryClient.invalidateQueries({ queryKey: attendanceKeys.todayRecords(variables.seatLayoutId) });
    },
  });
}

/**
 * 좌석 할당 해제
 */
export function useUnassignSeat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assignmentId: string) => attendanceService.unassignSeat(assignmentId),
    onSuccess: () => {
      // 모든 할당 정보 갱신
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

// ==================== PIN Queries ====================

/**
 * 학생 PIN 정보 조회
 */
export function useStudentPin(studentId: string | null) {
  return useQuery({
    queryKey: attendanceKeys.studentPin(studentId),
    queryFn: () => studentId ? attendanceService.getStudentPin(studentId) : Promise.resolve(null),
    enabled: !!studentId,
    staleTime: 10 * 60 * 1000, // 10분
  });
}

/**
 * 학생 PIN 생성
 */
export function useGenerateStudentPin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GenerateStudentPinData) => attendanceService.generateStudentPin(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.studentPin(variables.studentId) });
    },
  });
}

/**
 * 학생 PIN 변경
 */
export function useUpdateStudentPin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateStudentPinData) => attendanceService.updateStudentPin(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.studentPin(variables.studentId) });
    },
  });
}

/**
 * PIN 잠금 해제
 */
export function useUnlockStudentPin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (studentId: string) => attendanceService.unlockStudentPin(studentId),
    onSuccess: (_, studentId) => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.studentPin(studentId) });
    },
  });
}

// ==================== Attendance Record Queries ====================

/**
 * 오늘 출석 기록 조회
 */
export function useTodayAttendanceRecords(seatLayoutId: string | null) {
  return useQuery({
    queryKey: attendanceKeys.todayRecords(seatLayoutId),
    queryFn: () => seatLayoutId ? attendanceService.getTodayAttendanceRecords(seatLayoutId) : Promise.resolve([]),
    enabled: !!seatLayoutId,
    staleTime: 10 * 1000, // 10초 (더 자주 갱신)
    refetchInterval: 30 * 1000, // 30초마다 자동 refetch
  });
}

/**
 * 출석 기록 상세 조회
 */
export function useAttendanceRecord(recordId: string | null) {
  return useQuery({
    queryKey: attendanceKeys.record(recordId || ''),
    queryFn: () => recordId ? attendanceService.getAttendanceRecord(recordId) : Promise.resolve(null),
    enabled: !!recordId,
  });
}

/**
 * 출석 상태 변경
 */
export function useUpdateAttendanceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateAttendanceStatusData) => attendanceService.updateAttendanceStatus(data),
    onSuccess: (_, variables) => {
      // 특정 기록 갱신
      queryClient.invalidateQueries({ queryKey: attendanceKeys.record(variables.recordId) });
      // 오늘 출석 기록 전체 갱신
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

/**
 * 수동 체크인
 */
export function useManualCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { studentId: string; seatLayoutId: string; notes?: string }) =>
      attendanceService.manualCheckIn(data),
    onSuccess: (_, variables) => {
      // 즉시 캐시 무효화 및 refetch
      queryClient.invalidateQueries({ queryKey: attendanceKeys.todayRecords(variables.seatLayoutId) });
      queryClient.refetchQueries({
        queryKey: attendanceKeys.todayRecords(variables.seatLayoutId),
        type: 'active' // 활성화된 쿼리만
      });
    },
  });
}

/**
 * 수동 체크아웃
 */
export function useManualCheckOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { studentId: string; seatLayoutId: string; notes?: string }) =>
      attendanceService.manualCheckOut(data),
    onSuccess: (_, variables) => {
      // 즉시 캐시 무효화 및 refetch
      queryClient.invalidateQueries({ queryKey: attendanceKeys.todayRecords(variables.seatLayoutId) });
      queryClient.refetchQueries({
        queryKey: attendanceKeys.todayRecords(variables.seatLayoutId),
        type: 'active' // 활성화된 쿼리만
      });
    },
  });
}

// ==================== Attendance Check Link Queries ====================

/**
 * 출석 체크 링크 목록 조회
 */
export function useAttendanceCheckLinks(seatLayoutId: string | null) {
  return useQuery({
    queryKey: attendanceKeys.checkLinks(seatLayoutId),
    queryFn: async () => {
      const allLinks = await attendanceService.getAttendanceCheckLinks();
      // Frontend에서 seatLayoutId로 필터링
      return seatLayoutId ? allLinks.filter(link => link.seatLayoutId === seatLayoutId) : allLinks;
    },
    enabled: !!seatLayoutId,
    staleTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * 출석 체크 링크 생성
 */
export function useCreateAttendanceCheckLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAttendanceCheckLinkData) => attendanceService.createAttendanceCheckLink(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.checkLinks(variables.seatLayoutId) });
    },
  });
}

/**
 * 출석 체크 링크 비활성화
 */
export function useDeactivateAttendanceCheckLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => attendanceService.deactivateAttendanceCheckLink(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}
