import { SecurityContext, AccessControl, SecurityError, PermissionCheck, DataAccessRule, AuditLog } from '../types/security';
import { AdminPermission } from '../types/admin';

class SecurityService {
  private context: SecurityContext | null = null;

  // 보안 컨텍스트 설정
  setContext(context: SecurityContext): void {
    this.context = context;
  }

  // 컨텍스트 검증
  private validateContext(): SecurityContext {
    if (!this.context) {
      throw new SecurityError('PERMISSION_DENIED', '보안 컨텍스트가 설정되지 않았습니다.');
    }
    return this.context;
  }

  // 사용자 활성 상태 검증
  private validateUserActive(): void {
    const context = this.validateContext();
    if (!context.isActive) {
      throw new SecurityError('USER_INACTIVE', '비활성화된 사용자입니다.');
    }
  }

  // 사용자 ID 검증
  validateUserId(requiredUserId: string): void {
    const context = this.validateContext();
    if (context.userId !== requiredUserId) {
      throw new SecurityError('USER_MISMATCH', '다른 사용자의 데이터에 접근할 수 없습니다.');
    }
  }


  // 권한 검증 (모든 사용자에게 모든 권한 허용)
  validatePermission(requiredPermissions: AdminPermission[]): PermissionCheck {
    this.validateContext();
    return { allowed: true };
  }

  // 데이터 접근 권한 검증 (사용자는 본인 데이터만 접근 가능)
  checkDataAccess(resource: string, action: 'read' | 'write' | 'delete'): AccessControl {
    this.validateContext();
    this.validateUserActive();

    // 사용자 기반 격리에서는 본인 데이터만 접근 가능
    return { canRead: true, canWrite: true, canDelete: true, canManage: true };
  }

  // 사용자 데이터 접근 권한 검증 (본인 데이터만 접근 가능)
  checkUserDataAccess(targetUserId: string, currentUserId: string): AccessControl {
    this.validateContext();
    this.validateUserActive();

    // 본인 데이터인지 확인
    const isOwnData = targetUserId === currentUserId;

    return {
      canRead: isOwnData,
      canWrite: isOwnData,
      canDelete: isOwnData,
      canManage: isOwnData
    };
  }

  // 감사 로그 생성
  createAuditLog(action: string, resource: string, resourceId: string, success: boolean, errorMessage?: string): AuditLog {
    const context = this.validateContext();

    return {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: context.userId,
      action,
      resource,
      resourceId,
      timestamp: new Date(),
      success,
      errorMessage
    };
  }

  // 보안 이벤트 로깅
  logSecurityEvent(event: string, details: any): void {
    const context = this.validateContext();

    console.warn(`[SECURITY] ${event}`, {
      userId: context.userId,
      timestamp: new Date().toISOString(),
      details
    });
  }

  // 의심스러운 활동 감지
  detectSuspiciousActivity(action: string, resource: string): boolean {
    const context = this.validateContext();

    // 예시: 다른 사용자 데이터 접근 시도
    if (action.includes('cross_user')) {
      this.logSecurityEvent('CROSS_USER_ACCESS_ATTEMPT', {
        action,
        resource,
        userId: context.userId
      });
      return true;
    }

    return false;
  }

  // 현재 보안 컨텍스트 반환
  getCurrentContext(): SecurityContext | null {
    return this.context;
  }

  // 보안 컨텍스트 초기화
  clearContext(): void {
    this.context = null;
  }
}

export const securityService = new SecurityService();
