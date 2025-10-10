// Zustand store for attendance UI state management
// 클라이언트 사이드 UI 상태만 관리 (서버 상태는 React Query에서 관리)

import { create } from 'zustand';

// ==================== Interface Definitions ====================

interface AttendanceUIState {
  // 선택 상태
  selectedLayoutId: string | null;
  selectedSeatId: string | null;
  selectedStudentId: string | null;
  selectedRecordId: string | null;

  // 모달 상태
  isCreateLayoutModalOpen: boolean;
  isAssignSeatModalOpen: boolean;
  isManagePinModalOpen: boolean;
  isCheckLinkModalOpen: boolean;
  isRecordDetailModalOpen: boolean;

  // Actions
  setSelectedLayoutId: (id: string | null) => void;
  setSelectedSeatId: (id: string | null) => void;
  setSelectedStudentId: (id: string | null) => void;
  setSelectedRecordId: (id: string | null) => void;

  openCreateLayoutModal: () => void;
  closeCreateLayoutModal: () => void;

  openAssignSeatModal: () => void;
  closeAssignSeatModal: () => void;

  openManagePinModal: () => void;
  closeManagePinModal: () => void;

  openCheckLinkModal: () => void;
  closeCheckLinkModal: () => void;

  openRecordDetailModal: () => void;
  closeRecordDetailModal: () => void;

  // 모든 모달 닫기
  closeAllModals: () => void;

  // 모든 선택 초기화
  clearSelections: () => void;

  // 전체 리셋
  reset: () => void;
}

// ==================== Initial State ====================

const initialState = {
  selectedLayoutId: null,
  selectedSeatId: null,
  selectedStudentId: null,
  selectedRecordId: null,
  isCreateLayoutModalOpen: false,
  isAssignSeatModalOpen: false,
  isManagePinModalOpen: false,
  isCheckLinkModalOpen: false,
  isRecordDetailModalOpen: false,
};

// ==================== Zustand Store ====================

export const useAttendanceUIStore = create<AttendanceUIState>((set) => ({
  // State
  ...initialState,

  // Selection Actions
  setSelectedLayoutId: (id) => set({ selectedLayoutId: id }),
  setSelectedSeatId: (id) => set({ selectedSeatId: id }),
  setSelectedStudentId: (id) => set({ selectedStudentId: id }),
  setSelectedRecordId: (id) => set({ selectedRecordId: id }),

  // Modal Actions - CreateLayout
  openCreateLayoutModal: () => set({ isCreateLayoutModalOpen: true }),
  closeCreateLayoutModal: () => set({ isCreateLayoutModalOpen: false }),

  // Modal Actions - AssignSeat
  openAssignSeatModal: () => set({ isAssignSeatModalOpen: true }),
  closeAssignSeatModal: () => set({
    isAssignSeatModalOpen: false,
    selectedSeatId: null,
    selectedStudentId: null
  }),

  // Modal Actions - ManagePin
  openManagePinModal: () => set({ isManagePinModalOpen: true }),
  closeManagePinModal: () => set({
    isManagePinModalOpen: false,
    selectedStudentId: null
  }),

  // Modal Actions - CheckLink
  openCheckLinkModal: () => set({ isCheckLinkModalOpen: true }),
  closeCheckLinkModal: () => set({ isCheckLinkModalOpen: false }),

  // Modal Actions - RecordDetail
  openRecordDetailModal: () => set({ isRecordDetailModalOpen: true }),
  closeRecordDetailModal: () => set({
    isRecordDetailModalOpen: false,
    selectedRecordId: null
  }),

  // Close all modals
  closeAllModals: () => set({
    isCreateLayoutModalOpen: false,
    isAssignSeatModalOpen: false,
    isManagePinModalOpen: false,
    isCheckLinkModalOpen: false,
    isRecordDetailModalOpen: false
  }),

  // Clear all selections
  clearSelections: () => set({
    selectedLayoutId: null,
    selectedSeatId: null,
    selectedStudentId: null,
    selectedRecordId: null
  }),

  // Reset everything
  reset: () => set(initialState)
}));

// ==================== Selector Hooks (Optional Performance Optimization) ====================

/**
 * 선택된 배치도 ID만 구독
 */
export const useSelectedLayoutId = () => useAttendanceUIStore(state => state.selectedLayoutId);

/**
 * 선택된 좌석 ID만 구독
 */
export const useSelectedSeatId = () => useAttendanceUIStore(state => state.selectedSeatId);

/**
 * 선택된 학생 ID만 구독
 */
export const useSelectedStudentId = () => useAttendanceUIStore(state => state.selectedStudentId);

/**
 * 모든 모달 상태만 구독
 */
export const useModalStates = () => useAttendanceUIStore(state => ({
  isCreateLayoutModalOpen: state.isCreateLayoutModalOpen,
  isAssignSeatModalOpen: state.isAssignSeatModalOpen,
  isManagePinModalOpen: state.isManagePinModalOpen,
  isCheckLinkModalOpen: state.isCheckLinkModalOpen,
  isRecordDetailModalOpen: state.isRecordDetailModalOpen
}));
