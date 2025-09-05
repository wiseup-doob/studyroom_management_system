import { SecurityContext, AccessControl, SecurityError, PermissionCheck, DataAccessRule } from '../types/security';
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

  // 학원 ID 검증
  validateAcademyId(requiredAcademyId: string): void {
    const context = this.validateContext();
    if (context.academyId !== requiredAcademyId) {
      throw new SecurityError('ACADEMY_MISMATCH', '다른 학원의 데이터에 접근할 수 없습니다.');
    }
  }

  // 역할 검증
  validateRole(requiredRoles: string[]): void {
    const context = this.validateContext();
    if (!requiredRoles.includes(context.role)) {
      throw new SecurityError('PERMISSION_DENIED', `이 작업을 수행하려면 ${requiredRoles.join(' 또는 ')} 권한이 필요합니다.`);
    }
  }

  // 권한 검증
  validatePermission(requiredPermissions: AdminPermission[]): PermissionCheck {
    const context = this.validateContext();
    
    if (context.role === 'super_admin') {
      return { allowed: true };
    }

    if (context.role === 'admin') {
      const hasAllPermissions = requiredPermissions.every(permission => 
        context.permissions.includes(permission)
      );
      
      return {
        allowed: hasAllPermissions,
        reason: hasAllPermissions ? undefined : '필요한 권한이 없습니다.',
        requiredPermissions,
        userPermissions: context.permissions
      };
    }

    return {
      allowed: false,
      reason: '학생은 이 작업을 수행할 수 없습니다.',
      requiredPermissions,
      userPermissions: []
    };
  }

  // 데이터 접근 권한 검증
  checkDataAccess(resource: string, action: 'read' | 'write' | 'delete'): AccessControl {
    const context = this.validateContext();
    this.validateUserActive();

    const rules: DataAccessRule[] = [
      {
        resource: 'students',
        readRoles: ['admin', 'super_admin'],
        writeRoles: ['admin', 'super_admin'],
        deleteRoles: ['super_admin']
      },
      {
        resource: 'attendance_records',
        readRoles: ['admin', 'super_admin'],
        writeRoles: ['admin', 'super_admin'],
        deleteRoles: ['super_admin']
      },
      {
        resource: 'seat_assignments',
        readRoles: ['admin', 'super_admin'],
        writeRoles: ['admin', 'super_admin'],
        deleteRoles: ['super_admin']
      },
      {
        resource: 'admins',
        readRoles: ['super_admin'],
        writeRoles: ['super_admin'],
        deleteRoles: ['super_admin']
      }
    ];

    const rule = rules.find(r => r.resource === resource);
    if (!rule) {
      return { canRead: false, canWrite: false, canDelete: false, canManage: false };
    }

    const canRead = rule.readRoles.includes(context.role);
    const canWrite = rule.writeRoles.includes(context.role);
    const canDelete = rule.deleteRoles.includes(context.role);
    const canManage = context.role === 'super_admin';

    return { canRead, canWrite, canDelete, canManage };
  }

  // 학생 데이터 접근 권한 검증 (본인 데이터 접근 허용)
  checkStudentDataAccess(studentId: string, currentUserId: string): AccessControl {
    const context = this.validateContext();
    this.validateUserActive();

    // 본인 데이터인 경우 읽기 권한 허용
    if (studentId === currentUserId && context.role === 'student') {
      return { canRead: true, canWrite: false, canDelete: false, canManage: false };
    }

    // 관리자 권한 검증
    return this.checkDataAccess('students', 'read');
  }

  // 감사 로그 생성
  createAuditLog(action: string, resource: string, resourceId: string, success: boolean, errorMessage?: string): AuditLog {
    const context = this.validateContext();
    
    return {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: context.academyId, // 실제로는 사용자 UID를 사용해야 함
      academyId: context.academyId,
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
      academyId: context.academyId,
      role: context.role,
      timestamp: new Date().toISOString(),
      details
    });
  }

  // 의심스러운 활동 감지
  detectSuspiciousActivity(action: string, resource: string): boolean {
    const context = this.validateContext();
    
    // 예시: 학생이 관리자 전용 리소스에 접근 시도
    if (context.role === 'student' && ['admins', 'system_settings'].includes(resource)) {
      this.logSecurityEvent('SUSPICIOUS_ACCESS_ATTEMPT', {
        action,
        resource,
        userRole: context.role
      });
      return true;
    }

    // 예시: 다른 학원 데이터 접근 시도
    if (action.includes('cross_academy')) {
      this.logSecurityEvent('CROSS_ACADEMY_ACCESS_ATTEMPT', {
        action,
        resource,
        userAcademyId: context.academyId
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
