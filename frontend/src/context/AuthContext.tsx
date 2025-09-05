import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth } from '../services/firebase';
import { onIdTokenChanged, User } from 'firebase/auth';
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
  const [academyId, setAcademyId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    // onAuthStateChanged 대신 onIdTokenChanged 사용
    const unsubscribe = onIdTokenChanged(auth, async (user: User | null) => {
      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult();
          const claims = idTokenResult.claims as any;
          
          // 클레임과 Firestore 정보를 조합하여 UserProfile 생성
          const academyId = claims.academyId as string;
          const role = claims.role as string;
          
          if (academyId && role) {
            const userProfile = await authService.getUserProfile(academyId, role, user.uid);
            setUserProfile(userProfile);
            setAcademyId(academyId);
            setRole(role);
          } else {
            // 클레임이 없는 경우 (아직 권한이 설정되지 않은 사용자)
            // Firebase Authentication은 성공했지만 권한이 설정되지 않은 상태
            setUserProfile({
              uid: user.uid,
              email: user.email || '',
              academyId: '',
              role: 'pending' as any,
              name: user.displayName || '',
              isActive: true
            });
            setAcademyId(null);
            setRole(null);
          }
        } catch (error) {
          console.error('사용자 프로필 로드 실패:', error);
          setUserProfile(null);
          setAcademyId(null);
          setRole(null);
        }
      } else {
        setUserProfile(null);
        setAcademyId(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const userProfile = await authService.login(email, password);
      setUserProfile(userProfile);
      setAcademyId(userProfile.academyId);
      setRole(userProfile.role);
    } catch (error) {
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
      setUserProfile(null);
      setAcademyId(null);
      setRole(null);
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
    academyId,
    role,
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
