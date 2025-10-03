import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth } from '../services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { authService } from '../services/authService';
import { UserProfile, AuthContextType } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // 사용자 기반 격리 시스템에서는 onAuthStateChanged 사용
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        try {
          console.log('사용자 인증 상태 변경:', {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
          });
          
          // 사용자 기반 격리: uid를 사용하여 직접 Firestore에서 사용자 정보 조회
          const userProfile = await authService.getUserProfile(user.uid);
          setUserProfile(userProfile);
          
          // API 서비스에 사용자 ID 설정
          // apiService.setContext(user.uid, userProfile.isActive);
          
          console.log('사용자 로그인 성공:', {
            uid: user.uid,
            name: userProfile.name,
            email: userProfile.email,
            isActive: userProfile.isActive
          });
        } catch (error) {
          console.error('사용자 프로필 로드 실패:', error);
          console.error('오류 상세:', {
            message: error instanceof Error ? error.message : '알 수 없는 오류',
            stack: error instanceof Error ? error.stack : undefined
          });
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
        // 로그아웃 시 API 서비스 컨텍스트 초기화
        // apiService.setContext('', false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (): Promise<void> => {
    try {
      // Google 로그인은 authService.login()에서 처리
      // 성공 시 onAuthStateChanged가 자동으로 호출됨
      await authService.login();
    } catch (error) {
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
      setUserProfile(null);
    } catch (error) {
      throw error;
    }
  };

  const getCurrentUser = async (): Promise<UserProfile | null> => {
    try {
      return await authService.getCurrentUser();
    } catch (error) {
      console.error('현재 사용자 조회 실패:', error);
      return null;
    }
  };

  const value: AuthContextType = {
    userProfile,
    loading,
    login,
    logout,
    getCurrentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
