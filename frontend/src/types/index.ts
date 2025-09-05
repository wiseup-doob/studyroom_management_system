// 사용자 타입 정의
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 인증 컨텍스트 타입
export interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
}

// API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 스터디룸 타입
export interface StudyRoom {
  id: string;
  name: string;
  description: string;
  capacity: number;
  location: string;
  amenities: string[];
  images: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 예약 타입
export interface Reservation {
  id: string;
  userId: string;
  studyRoomId: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  purpose: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 폼 데이터 타입
export interface LoginFormData {
  email: string;
  password: string;
}

export interface SignupFormData {
  email: string;
  password: string;
  displayName: string;
}

// 컴포넌트 Props 타입
export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  className?: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}
