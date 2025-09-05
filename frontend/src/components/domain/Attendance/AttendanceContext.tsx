import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { 
  AttendanceState, 
  AttendanceAction, 
  Classroom, 
  AttendanceSeat, 
  SeatStatus 
} from '../../../types/attendance';

// 초기 상태
const initialState: AttendanceState = {
  selectedClassroom: null,
  seats: [],
  students: [],
  selectedSeatId: null,
  searchQuery: '',
  loading: false,
  error: null
};

// Reducer 함수
const attendanceReducer = (state: AttendanceState, action: AttendanceAction): AttendanceState => {
  switch (action.type) {
    case 'SELECT_CLASSROOM':
      return {
        ...state,
        selectedClassroom: action.payload,
        seats: action.payload.seats,
        selectedSeatId: null, // 강의실 변경 시 선택 해제
        error: null
      };
    
    case 'SELECT_SEAT':
      return {
        ...state,
        selectedSeatId: action.payload
      };
    
    case 'UPDATE_SEAT_STATUS':
      return {
        ...state,
        seats: state.seats.map(seat =>
          seat.id === action.payload.seatId
            ? { ...seat, status: action.payload.status }
            : seat
        ),
        error: null
      };
    
    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        searchQuery: action.payload
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false
      };
    
    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedSeatId: null
      };
    
    default:
      return state;
  }
};

// Context 생성
const AttendanceContext = createContext<{
  state: AttendanceState;
  dispatch: React.Dispatch<AttendanceAction>;
} | null>(null);

// Provider 컴포넌트
interface AttendanceProviderProps {
  children: ReactNode;
}

export const AttendanceProvider: React.FC<AttendanceProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(attendanceReducer, initialState);

  return (
    <AttendanceContext.Provider value={{ state, dispatch }}>
      {children}
    </AttendanceContext.Provider>
  );
};

// Custom Hook
export const useAttendance = () => {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
};

// 액션 생성자 함수들
export const attendanceActions = {
  selectClassroom: (classroom: Classroom): AttendanceAction => ({
    type: 'SELECT_CLASSROOM',
    payload: classroom
  }),

  selectSeat: (seatId: string): AttendanceAction => ({
    type: 'SELECT_SEAT',
    payload: seatId
  }),

  updateSeatStatus: (seatId: string, status: SeatStatus): AttendanceAction => ({
    type: 'UPDATE_SEAT_STATUS',
    payload: { seatId, status }
  }),

  setSearchQuery: (query: string): AttendanceAction => ({
    type: 'SET_SEARCH_QUERY',
    payload: query
  }),

  setLoading: (loading: boolean): AttendanceAction => ({
    type: 'SET_LOADING',
    payload: loading
  }),

  setError: (error: string | null): AttendanceAction => ({
    type: 'SET_ERROR',
    payload: error
  }),

  clearSelection: (): AttendanceAction => ({
    type: 'CLEAR_SELECTION'
  })
};

export default AttendanceContext;
