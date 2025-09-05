// 보안 관련 타입 정의

export interface SecurityContext {
  academyId: string;
  role: 'student' | 'admin' | 'super_admin';
  permissions: string[];
  isActive: boolean;
}

export interface AccessControl {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canManage: boolean;
}

export interface SecurityErrorInterface {
  code: 'PERMISSION_DENIED' | 'ACADEMY_MISMATCH' | 'USER_INACTIVE' | 'INVALID_ROLE' | 'DATA_NOT_FOUND';
  message: string;
  details?: any;
}

export class SecurityError extends Error implements SecurityErrorInterface {
  public code: 'PERMISSION_DENIED' | 'ACADEMY_MISMATCH' | 'USER_INACTIVE' | 'INVALID_ROLE' | 'DATA_NOT_FOUND';
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
  academyId: string;
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

// 데이터 접근 제어 설정
export interface DataAccessRule {
  resource: string;
  readRoles: string[];
  writeRoles: string[];
  deleteRoles: string[];
  conditions?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'in' | 'not_in';
    value: any;
  }[];
}
