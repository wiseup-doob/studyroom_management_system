/**
 * editLinkService.ts - 편집 링크 관리 서비스
 * 
 * 편집 링크의 생성, 조회, 관리, 로그 추적 기능을 제공합니다.
 */

// backendService는 현재 사용하지 않음 (직접 fetch 사용)

// ==================== 타입 정의 ====================

export interface EditLink {
  id: string;
  shareToken: string;
  timetableId: string;
  title?: string;
  description?: string;
  isActive: boolean;
  createdAt: any; // Firebase Timestamp
  lastUsedAt?: any; // Firebase Timestamp
  usageCount: number;
  expiresAt?: any; // Firebase Timestamp
  deactivatedAt?: any; // Firebase Timestamp
  permissions: {
    canEdit: boolean;
    canView: boolean;
    canComment: boolean;
  };
  accessSettings: {
    requireName: boolean;
    requireEmail: boolean;
    maxContributions?: number;
  };
}

export interface EditLinkLog {
  id: string;
  shareToken: string;
  action: 'created' | 'accessed' | 'edited' | 'deactivated' | 'activated' | 'deleted' | 'expired';
  timestamp: any; // Firebase Timestamp
  details: string;
  userId?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface GetEditLinksParams {
  studentId: string;
  includeInactive?: boolean;
}

export interface GetEditLinkLogsParams {
  studentId?: string;
  shareToken?: string;
  limit?: number;
}

export interface RecordUsageParams {
  shareToken: string;
  action: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

// ==================== 서비스 클래스 ====================

class EditLinkService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.VITE_FUNCTIONS_URL || 'https://asia-northeast3-studyroommanagementsystemtest.cloudfunctions.net';
  }

  // ==================== 편집 링크 관리 ====================

  /**
   * 학생별 편집 링크 목록 조회
   */
  async getStudentEditLinks(params: GetEditLinksParams): Promise<EditLink[]> {
    try {
      const queryParams = new URLSearchParams({
        studentId: params.studentId,
        includeInactive: params.includeInactive ? 'true' : 'false'
      });

      const response = await fetch(`${this.baseUrl}/getStudentEditLinks?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '편집 링크 목록 조회에 실패했습니다.');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('편집 링크 목록 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 편집 링크 비활성화
   */
  async deactivateEditLink(shareToken: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/deactivateEditLink`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ shareToken })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '링크 비활성화에 실패했습니다.');
      }

      const data = await response.json();
      console.log('링크 비활성화 성공:', data.message);
    } catch (error) {
      console.error('링크 비활성화 오류:', error);
      throw error;
    }
  }

  /**
   * 편집 링크 재활성화
   */
  async activateEditLink(shareToken: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/activateEditLink`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ shareToken })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '링크 재활성화에 실패했습니다.');
      }

      const data = await response.json();
      console.log('링크 재활성화 성공:', data.message);
    } catch (error) {
      console.error('링크 재활성화 오류:', error);
      throw error;
    }
  }

  /**
   * 편집 링크 삭제
   */
  async deleteEditLink(shareToken: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/deleteEditLink`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ shareToken })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '링크 삭제에 실패했습니다.');
      }

      const data = await response.json();
      console.log('링크 삭제 성공:', data.message);
    } catch (error) {
      console.error('링크 삭제 오류:', error);
      throw error;
    }
  }

  // ==================== 로그 관리 ====================

  /**
   * 편집 링크 로그 조회
   */
  async getEditLinkLogs(params: GetEditLinkLogsParams): Promise<EditLinkLog[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params.studentId) queryParams.append('studentId', params.studentId);
      if (params.shareToken) queryParams.append('shareToken', params.shareToken);
      if (params.limit) queryParams.append('limit', params.limit.toString());

      const response = await fetch(`${this.baseUrl}/getEditLinkLogs?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '링크 로그 조회에 실패했습니다.');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('링크 로그 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 편집 링크 사용 기록
   */
  async recordUsage(params: RecordUsageParams): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/recordEditLinkUsage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shareToken: params.shareToken,
          action: params.action,
          details: params.details,
          ipAddress: params.ipAddress || this.getClientIP(),
          userAgent: params.userAgent || navigator.userAgent
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '사용 기록 저장에 실패했습니다.');
      }

      const data = await response.json();
      console.log('사용 기록 저장 성공:', data.message);
    } catch (error) {
      console.error('사용 기록 저장 오류:', error);
      // 사용 기록 저장 실패는 치명적이지 않으므로 에러를 던지지 않음
      console.warn('사용 기록 저장에 실패했지만 계속 진행합니다.');
    }
  }

  // ==================== 유틸리티 함수 ====================

  /**
   * Firebase Auth 토큰 가져오기
   */
  private async getAuthToken(): Promise<string> {
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('사용자가 로그인되지 않았습니다.');
      }

      const token = await user.getIdToken();
      return token;
    } catch (error) {
      console.error('인증 토큰 가져오기 오류:', error);
      throw new Error('인증 토큰을 가져올 수 없습니다.');
    }
  }

  /**
   * 클라이언트 IP 주소 가져오기 (대략적)
   */
  private getClientIP(): string {
    // 실제 IP는 서버에서 req.ip로 가져오므로 여기서는 대략적인 값만 반환
    return 'client-ip-unknown';
  }

  /**
   * 링크 상태 텍스트 변환
   */
  getLinkStatusText(link: EditLink): string {
    if (!link.isActive) {
      return '비활성화됨';
    }
    
    if (link.expiresAt) {
      const now = new Date();
      const expiresAt = link.expiresAt.toDate ? link.expiresAt.toDate() : new Date(link.expiresAt);
      if (expiresAt < now) {
        return '만료됨';
      }
    }
    
    return '활성';
  }

  /**
   * 링크 상태 색상 반환
   */
  getLinkStatusColor(link: EditLink): string {
    if (!link.isActive) {
      return '#ef4444'; // 빨간색
    }
    
    if (link.expiresAt) {
      const now = new Date();
      const expiresAt = link.expiresAt.toDate ? link.expiresAt.toDate() : new Date(link.expiresAt);
      if (expiresAt < now) {
        return '#f59e0b'; // 주황색
      }
    }
    
    return '#10b981'; // 초록색
  }

  /**
   * 날짜 포맷팅
   */
  formatDate(timestamp: any): string {
    if (!timestamp) return '-';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 액션 아이콘 반환
   */
  getActionIcon(action: string): string {
    const iconMap: { [key: string]: string } = {
      'created': '➕',
      'accessed': '👁️',
      'edited': '✏️',
      'deactivated': '⏸️',
      'activated': '▶️',
      'deleted': '🗑️',
      'expired': '⏰'
    };
    
    return iconMap[action] || '📝';
  }

  /**
   * 액션 텍스트 변환
   */
  getActionText(action: string): string {
    const textMap: { [key: string]: string } = {
      'created': '생성됨',
      'accessed': '접근됨',
      'edited': '편집됨',
      'deactivated': '비활성화됨',
      'activated': '활성화됨',
      'deleted': '삭제됨',
      'expired': '만료됨'
    };
    
    return textMap[action] || action;
  }
}

// ==================== 싱글톤 인스턴스 ====================

const editLinkService = new EditLinkService();
export default editLinkService;
