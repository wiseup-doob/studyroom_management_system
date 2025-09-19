// 사용자 기반 데이터 격리를 위한 인증 관련 타입 정의

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  profilePicture?: string;
  isActive: boolean;
}

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
}

export interface AuthContextType {
  userProfile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<UserProfile | null>;
}

export interface AuthError {
  code: string;
  message: string;
}
