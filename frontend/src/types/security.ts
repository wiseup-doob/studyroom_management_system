// 사용자 기반 보안 관련 타입 정의

export interface SecurityContext {
  userId: string;
  isActive: boolean;
}

export interface AccessControl {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canManage: boolean;
}

export interface SecurityErrorInterface {
  code: 'PERMISSION_DENIED' | 'USER_MISMATCH' | 'USER_INACTIVE' | 'INVALID_USER' | 'DATA_NOT_FOUND';
  message: string;
  details?: any;
}

export class SecurityError extends Error implements SecurityErrorInterface {
  public code: 'PERMISSION_DENIED' | 'USER_MISMATCH' | 'USER_INACTIVE' | 'INVALID_USER' | 'DATA_NOT_FOUND';
  public details?: any;

  constructor(code: SecurityErrorInterface['code'], message: string, details?: any) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.details = details;
  }
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

// 권한 검증 결과
export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
  requiredPermissions?: string[];
  userPermissions?: string[];
}

// 사용자 기반 데이터 접근 제어 설정
export interface DataAccessRule {
  resource: string;
  ownerOnly: boolean; // 소유자만 접근 가능 여부
  conditions?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'in' | 'not_in';
    value: any;
  }[];
}
