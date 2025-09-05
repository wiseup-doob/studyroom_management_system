// 멀티테넌트 아키텍처를 위한 인증 관련 타입 정의

export interface UserProfile {
  uid: string;
  email: string;
  academyId: string;
  role: 'student' | 'admin' | 'super_admin' | 'pending';
  name: string;
  isActive: boolean;
}

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  academyId: string | null;
  role: string | null;
}

export interface AuthContextType {
  userProfile: UserProfile | null;
  loading: boolean;
  academyId: string | null;
  role: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<UserProfile | null>;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface AuthError {
  code: string;
  message: string;
}

// 커스텀 클레임 타입
export interface CustomClaims {
  academyId: string;
  role: 'student' | 'admin' | 'super_admin';
  admin?: boolean;
  super_admin?: boolean;
}
