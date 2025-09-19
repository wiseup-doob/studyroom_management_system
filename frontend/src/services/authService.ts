import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from '../types/auth';

class AuthService {
  private googleProvider = new GoogleAuthProvider();

  async login(): Promise<void> {
    try {
      const result = await signInWithPopup(auth, this.googleProvider);
      const user = result.user;

      // 사용자 프로필이 Firestore에 없으면 생성
      await this.createOrUpdateUserProfile(user);
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  private async createOrUpdateUserProfile(user: any): Promise<void> {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        // 새 사용자 프로필 생성
        const userData = {
          authUid: user.uid,
          name: user.displayName || '',
          email: user.email || '',
          profilePicture: user.photoURL || '',
          googleId: user.uid,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await setDoc(userRef, userData);
      } else {
        // 기존 사용자 프로필 업데이트
        await setDoc(userRef, {
          name: user.displayName || '',
          email: user.email || '',
          profilePicture: user.photoURL || '',
          updatedAt: new Date()
        }, { merge: true });
      }
    } catch (error) {
      console.error('사용자 프로필 생성/업데이트 실패:', error);
      throw error;
    }
  }

  async getUserProfile(uid: string): Promise<UserProfile> {
    try {
      console.log('getUserProfile 호출:', { uid });
      console.log('현재 인증 상태:', { 
        currentUser: auth.currentUser?.uid,
        isAuthenticated: !!auth.currentUser
      });

      // 사용자별 컬렉션에서 조회
      const userDocRef = doc(db, 'users', uid);
      console.log('Firestore 문서 경로:', userDocRef.path);
      
      const userDoc = await getDoc(userDocRef);
      console.log('문서 존재 여부:', userDoc.exists());

      if (!userDoc.exists()) {
        console.log('사용자 프로필이 없음, 생성 시도');
        
        // 사용자 프로필이 없으면 현재 인증된 사용자 정보로 생성
        const currentUser = auth.currentUser;
        if (!currentUser || currentUser.uid !== uid) {
          console.error('인증된 사용자 정보 불일치:', {
            requestedUid: uid,
            currentUserUid: currentUser?.uid
          });
          throw new Error('사용자 정보를 찾을 수 없습니다.');
        }

        console.log('사용자 프로필 생성 시작:', {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName
        });

        // 자동으로 사용자 프로필 생성
        await this.createOrUpdateUserProfile(currentUser);
        
        // 다시 조회
        const newUserDoc = await getDoc(userDocRef);
        if (!newUserDoc.exists()) {
          throw new Error('사용자 프로필 생성에 실패했습니다.');
        }
        
        const userData = newUserDoc.data();
        console.log('사용자 프로필 생성 완료:', userData);
        
        return {
          uid,
          email: userData.email || '',
          name: userData.name || '',
          isActive: userData.isActive
        };
      }

      const userData = userDoc.data();
      console.log('기존 사용자 프로필 조회:', userData);

      // 사용자가 비활성화된 경우
      if (!userData.isActive) {
        throw new Error('비활성화된 계정입니다.');
      }

      return {
        uid,
        email: userData.email || '',
        name: userData.name || '',
        isActive: userData.isActive
      };
    } catch (error: any) {
      console.error('getUserProfile 오류:', error);
      console.error('오류 코드:', error.code);
      console.error('오류 메시지:', error.message);
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
      return await this.getUserProfile(user.uid);
    } catch (error) {
      console.error('현재 사용자 정보 조회 실패:', error);
      return null;
    }
  }

  async getIdTokenClaims(): Promise<{}> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('로그인된 사용자가 없습니다.');
    }

    // 사용자 기반 격리에서는 커스텀 클레임이 불필요
    return {};
  }

  private getErrorMessage(error: any): string {
    const errorCode = error.code;
    
    switch (errorCode) {
      case 'auth/popup-closed-by-user':
        return '로그인 팝업이 사용자에 의해 닫혔습니다.';
      case 'auth/popup-blocked':
        return '팝업이 차단되었습니다. 팝업 차단을 해제해주세요.';
      case 'auth/cancelled-popup-request':
        return '로그인 요청이 취소되었습니다.';
      case 'auth/account-exists-with-different-credential':
        return '이미 다른 방법으로 가입된 계정입니다.';
      case 'auth/invalid-credential':
        return '유효하지 않은 인증 정보입니다.';
      case 'auth/operation-not-allowed':
        return 'Google 로그인이 허용되지 않습니다.';
      case 'auth/too-many-requests':
        return '너무 많은 로그인 시도로 인해 일시적으로 차단되었습니다.';
      case 'auth/network-request-failed':
        return '네트워크 연결을 확인해주세요.';
      default:
        return error.message || 'Google 로그인 중 오류가 발생했습니다.';
    }
  }
}

export const authService = new AuthService();
