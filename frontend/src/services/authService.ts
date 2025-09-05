import { 
  signInWithEmailAndPassword, 
  signOut
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, CustomClaims } from '../types/auth';

class AuthService {
  async login(email: string, password: string): Promise<UserProfile> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // ID 토큰에서 직접 클레임 정보를 가져옵니다.
      const idTokenResult = await user.getIdTokenResult(true); // true로 강제 갱신
      const claims = idTokenResult.claims as unknown as CustomClaims;
      
      const academyId = claims.academyId;
      const role = claims.role;
      
      if (!academyId || !role) {
        // 커스텀 클레임이 없는 경우 (아직 권한이 설정되지 않은 사용자)
        return {
          uid: user.uid,
          email: user.email || '',
          academyId: '',
          role: 'pending' as any,
          name: user.displayName || '',
          isActive: true
        };
      }
      
      // 이제 이 academyId와 role을 사용하여 Firestore에서 추가 정보를 가져옵니다.
      const userProfile = await this.getUserProfile(academyId, role, user.uid);
      return userProfile;
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async getUserProfile(academyId: string, role: string, uid: string): Promise<UserProfile> {
    try {
      let userDoc;
      
      if (role === 'student') {
        // students 컬렉션에서 조회
        const studentDocRef = doc(db, 'academies', academyId, 'students', uid);
        userDoc = await getDoc(studentDocRef);
      } else if (role === 'admin' || role === 'super_admin') {
        // admins 컬렉션에서 조회 (수정된 경로)
        const adminDocRef = doc(db, 'academies', academyId, 'admins', uid);
        userDoc = await getDoc(adminDocRef);
      } else {
        throw new Error('알 수 없는 사용자 역할입니다.');
      }

      if (!userDoc.exists()) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }

      const userData = userDoc.data();
      
      // 사용자가 비활성화된 경우
      if (!userData.isActive) {
        throw new Error('비활성화된 계정입니다.');
      }

      return {
        uid,
        email: userData.email || '',
        academyId,
        role: role as 'student' | 'admin' | 'super_admin',
        name: userData.name || '',
        isActive: userData.isActive
      };
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    const user = auth.currentUser;
    if (!user) return null;

    try {
      const idTokenResult = await user.getIdTokenResult();
      const claims = idTokenResult.claims as unknown as CustomClaims;
      
      const academyId = claims.academyId;
      const role = claims.role;
      
      if (!academyId || !role) {
        return null;
      }
      
      return await this.getUserProfile(academyId, role, user.uid);
    } catch (error) {
      console.error('현재 사용자 정보 조회 실패:', error);
      return null;
    }
  }

  async getIdTokenClaims(): Promise<{academyId: string, role: string}> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('로그인된 사용자가 없습니다.');
    }

    const idTokenResult = await user.getIdTokenResult();
    const claims = idTokenResult.claims as unknown as CustomClaims;
    
    return {
      academyId: claims.academyId,
      role: claims.role
    };
  }

  private getErrorMessage(error: any): string {
    const errorCode = error.code;
    
    switch (errorCode) {
      case 'auth/user-not-found':
        return '등록되지 않은 이메일입니다.';
      case 'auth/wrong-password':
        return '잘못된 비밀번호입니다.';
      case 'auth/invalid-email':
        return '유효하지 않은 이메일 형식입니다.';
      case 'auth/user-disabled':
        return '비활성화된 계정입니다.';
      case 'auth/too-many-requests':
        return '너무 많은 로그인 시도로 인해 일시적으로 차단되었습니다.';
      case 'auth/network-request-failed':
        return '네트워크 연결을 확인해주세요.';
      default:
        return error.message || '로그인 중 오류가 발생했습니다.';
    }
  }
}

export const authService = new AuthService();
