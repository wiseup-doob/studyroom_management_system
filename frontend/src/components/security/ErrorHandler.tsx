import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorHandlingService, ErrorContext } from '../../services/errorHandlingService';
import { useAuth } from '../../context/AuthContext';
import './ErrorHandler.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId?: string;
}

// 클래스 컴포넌트로 에러 바운더리 구현
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 에러 컨텍스트 생성
    const context: Partial<ErrorContext> = {
      action: 'component_render',
      resource: 'react_component',
      timestamp: new Date()
    };

    // 에러 처리 서비스에 에러 전달
    errorHandlingService.handleError(error, context).then(errorReport => {
      this.setState({ errorId: errorReport.id });
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ErrorFallback error={this.state.error} errorId={this.state.errorId} />;
    }

    return this.props.children;
  }
}

// 에러 폴백 컴포넌트
interface ErrorFallbackProps {
  error?: Error;
  errorId?: string;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, errorId }) => {
  const { userProfile } = useAuth();

  const handleRetry = () => {
    window.location.reload();
  };

  const handleReport = () => {
    if (errorId) {
      console.log('Error reported:', errorId);
      // 실제 구현에서는 에러 리포트를 관리자에게 전송
    }
  };

  return (
    <div className="error-fallback">
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h2>예상치 못한 오류가 발생했습니다</h2>
        <p>시스템에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</p>
        
        {error && (
          <details className="error-details">
            <summary>오류 상세 정보</summary>
            <div className="error-message">{error.message}</div>
            {error.stack && (
              <pre className="error-stack">{error.stack}</pre>
            )}
          </details>
        )}

        {errorId && (
          <div className="error-id">
            오류 ID: <code>{errorId}</code>
          </div>
        )}

        <div className="error-actions">
          <button onClick={handleRetry} className="retry-button">
            다시 시도
          </button>
          <button onClick={handleReport} className="report-button">
            오류 신고
          </button>
        </div>

        {userProfile && (
          <div className="user-context">
            <p>사용자 정보: {userProfile.name} ({userProfile.role})</p>
            <p>학원 ID: {userProfile.academyId}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 훅 기반 에러 핸들러
export const useErrorHandler = () => {
  const { userProfile } = useAuth();

  const handleError = async (error: Error, context: Partial<ErrorContext> = {}) => {
    const errorContext: Partial<ErrorContext> = {
      ...context,
      userId: userProfile?.uid,
      academyId: userProfile?.academyId,
      role: userProfile?.role,
      timestamp: new Date()
    };

    return await errorHandlingService.handleError(error, errorContext);
  };

  const handleAsyncError = (asyncFn: () => Promise<any>) => {
    return async (...args: any[]) => {
      try {
        return await asyncFn.apply(this, args);
      } catch (error) {
        await handleError(error as Error, {
          action: 'async_operation',
          resource: asyncFn.name || 'unknown_function'
        });
        throw error;
      }
    };
  };

  return {
    handleError,
    handleAsyncError
  };
};

// 에러 핸들러 컴포넌트
export const ErrorHandler: React.FC<Props> = ({ children, fallback }) => {
  return (
    <ErrorBoundary fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
};

export default ErrorHandler;
