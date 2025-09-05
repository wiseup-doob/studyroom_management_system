import { SecurityError } from '../types/security';
import { securityService } from './securityService';

export interface ErrorContext {
  userId?: string;
  academyId?: string;
  role?: string;
  action?: string;
  resource?: string;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface ErrorReport {
  id: string;
  error: Error;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'security' | 'authentication' | 'authorization' | 'data' | 'network' | 'system';
  resolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface ErrorHandlingConfig {
  enableLogging: boolean;
  enableReporting: boolean;
  enableRecovery: boolean;
  maxRetries: number;
  retryDelay: number;
}

class ErrorHandlingService {
  private config: ErrorHandlingConfig = {
    enableLogging: true,
    enableReporting: true,
    enableRecovery: true,
    maxRetries: 3,
    retryDelay: 1000
  };

  private errorReports: ErrorReport[] = [];

  // 설정 업데이트
  updateConfig(newConfig: Partial<ErrorHandlingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // 에러 처리 메인 메서드
  async handleError(error: Error, context: Partial<ErrorContext> = {}): Promise<ErrorReport> {
    const errorContext: ErrorContext = {
      ...context,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      // IP 주소는 실제로는 서버에서 가져와야 함
    };

    const errorReport = this.createErrorReport(error, errorContext);
    
    // 에러 로깅
    if (this.config.enableLogging) {
      this.logError(errorReport);
    }

    // 에러 리포팅
    if (this.config.enableReporting) {
      this.reportError(errorReport);
    }

    // 에러 복구 시도
    if (this.config.enableRecovery) {
      await this.attemptRecovery(errorReport);
    }

    this.errorReports.push(errorReport);
    return errorReport;
  }

  // 에러 리포트 생성
  private createErrorReport(error: Error, context: ErrorContext): ErrorReport {
    const severity = this.determineSeverity(error);
    const category = this.categorizeError(error);

    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      error,
      context,
      severity,
      category,
      resolved: false,
      createdAt: new Date()
    };
  }

  // 에러 심각도 결정
  private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    if (error instanceof SecurityError) {
      switch (error.code) {
        case 'PERMISSION_DENIED':
          return 'high';
        case 'ACADEMY_MISMATCH':
          return 'critical';
        case 'USER_INACTIVE':
          return 'medium';
        case 'INVALID_ROLE':
          return 'high';
        case 'DATA_NOT_FOUND':
          return 'low';
        default:
          return 'medium';
      }
    }

    // 네트워크 에러
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'medium';
    }

    // 인증 에러
    if (error.message.includes('auth') || error.message.includes('login')) {
      return 'high';
    }

    // 일반적인 에러
    return 'low';
  }

  // 에러 카테고리 분류
  private categorizeError(error: Error): 'security' | 'authentication' | 'authorization' | 'data' | 'network' | 'system' {
    if (error instanceof SecurityError) {
      switch (error.code) {
        case 'PERMISSION_DENIED':
        case 'ACADEMY_MISMATCH':
        case 'INVALID_ROLE':
          return 'authorization';
        case 'USER_INACTIVE':
          return 'authentication';
        case 'DATA_NOT_FOUND':
          return 'data';
        default:
          return 'security';
      }
    }

    if (error.message.includes('auth') || error.message.includes('login')) {
      return 'authentication';
    }

    if (error.message.includes('permission') || error.message.includes('access')) {
      return 'authorization';
    }

    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'network';
    }

    if (error.message.includes('data') || error.message.includes('firestore')) {
      return 'data';
    }

    return 'system';
  }

  // 에러 로깅
  private logError(errorReport: ErrorReport): void {
    const logLevel = this.getLogLevel(errorReport.severity);
    const logMessage = this.formatLogMessage(errorReport);

    switch (logLevel) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      default:
        console.log(logMessage);
    }

    // 보안 이벤트 로깅
    if (errorReport.category === 'security' || errorReport.category === 'authorization') {
      securityService.logSecurityEvent('SECURITY_ERROR', {
        errorId: errorReport.id,
        errorCode: errorReport.error instanceof SecurityError ? errorReport.error.code : 'UNKNOWN',
        severity: errorReport.severity,
        context: errorReport.context
      });
    }
  }

  // 로그 레벨 결정
  private getLogLevel(severity: string): 'error' | 'warn' | 'info' | 'log' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
        return 'info';
      default:
        return 'log';
    }
  }

  // 로그 메시지 포맷팅
  private formatLogMessage(errorReport: ErrorReport): string {
    const { error, context, severity, category } = errorReport;
    
    return `[${severity.toUpperCase()}] ${category.toUpperCase()} ERROR: ${error.message}` +
           `\nContext: ${JSON.stringify(context, null, 2)}` +
           `\nStack: ${error.stack}`;
  }

  // 에러 리포팅
  private reportError(errorReport: ErrorReport): void {
    // 실제 구현에서는 외부 에러 리포팅 서비스(예: Sentry)에 전송
    // 현재는 콘솔에 출력
    console.group(`🚨 Error Report: ${errorReport.id}`);
    console.error('Error:', errorReport.error);
    console.info('Context:', errorReport.context);
    console.info('Severity:', errorReport.severity);
    console.info('Category:', errorReport.category);
    console.groupEnd();
  }

  // 에러 복구 시도
  private async attemptRecovery(errorReport: ErrorReport): Promise<void> {
    const { error, context } = errorReport;

    try {
      // 네트워크 에러 복구
      if (errorReport.category === 'network') {
        await this.retryNetworkOperation(context);
        return;
      }

      // 인증 에러 복구
      if (errorReport.category === 'authentication') {
        await this.handleAuthenticationError(context);
        return;
      }

      // 권한 에러 복구
      if (errorReport.category === 'authorization') {
        await this.handleAuthorizationError(context);
        return;
      }

      // 데이터 에러 복구
      if (errorReport.category === 'data') {
        await this.handleDataError(context);
        return;
      }

    } catch (recoveryError) {
      console.error('Error recovery failed:', recoveryError);
    }
  }

  // 네트워크 작업 재시도
  private async retryNetworkOperation(context: ErrorContext): Promise<void> {
    // 실제 구현에서는 네트워크 요청을 재시도
    console.info('Attempting network operation recovery...');
    
    // 재시도 로직 구현
    for (let i = 0; i < this.config.maxRetries; i++) {
      try {
        // 네트워크 요청 재시도
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * (i + 1)));
        console.info(`Network retry attempt ${i + 1} completed`);
        return;
      } catch (retryError) {
        console.warn(`Network retry attempt ${i + 1} failed:`, retryError);
        if (i === this.config.maxRetries - 1) {
          throw retryError;
        }
      }
    }
  }

  // 인증 에러 처리
  private async handleAuthenticationError(context: ErrorContext): Promise<void> {
    console.info('Handling authentication error...');
    
    // 토큰 갱신 시도
    // 실제 구현에서는 Firebase Auth 토큰 갱신 로직 구현
    console.info('Authentication error handled');
  }

  // 권한 에러 처리
  private async handleAuthorizationError(context: ErrorContext): Promise<void> {
    console.info('Handling authorization error...');
    
    // 권한 재검증
    // 실제 구현에서는 사용자 권한을 다시 확인하고 필요시 재인증 요청
    console.info('Authorization error handled');
  }

  // 데이터 에러 처리
  private async handleDataError(context: ErrorContext): Promise<void> {
    console.info('Handling data error...');
    
    // 데이터 캐시 클리어
    // 실제 구현에서는 관련 데이터 캐시를 클리어하고 재로드
    console.info('Data error handled');
  }

  // 에러 리포트 조회
  getErrorReports(): ErrorReport[] {
    return [...this.errorReports];
  }

  // 특정 에러 리포트 조회
  getErrorReport(errorId: string): ErrorReport | undefined {
    return this.errorReports.find(report => report.id === errorId);
  }

  // 에러 해결 표시
  resolveError(errorId: string): boolean {
    const errorReport = this.getErrorReport(errorId);
    if (errorReport) {
      errorReport.resolved = true;
      errorReport.resolvedAt = new Date();
      return true;
    }
    return false;
  }

  // 에러 통계
  getErrorStatistics(): {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    resolved: number;
    unresolved: number;
  } {
    const total = this.errorReports.length;
    const resolved = this.errorReports.filter(r => r.resolved).length;
    const unresolved = total - resolved;

    const bySeverity = this.errorReports.reduce((acc, report) => {
      acc[report.severity] = (acc[report.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byCategory = this.errorReports.reduce((acc, report) => {
      acc[report.category] = (acc[report.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      bySeverity,
      byCategory,
      resolved,
      unresolved
    };
  }

  // 에러 리포트 클리어
  clearErrorReports(): void {
    this.errorReports = [];
  }
}

export const errorHandlingService = new ErrorHandlingService();
