import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles = [],
  requiredPermissions = [],
  fallbackPath = '/login'
}) => {
  const { userProfile, loading } = useAuth();
  const location = useLocation();

  // 로딩 중일 때
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>권한을 확인하는 중...</p>
        </div>
      </div>
    );
  }

  // 로그인되지 않은 경우
  if (!userProfile) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // 사용자가 비활성화된 경우
  if (!userProfile.isActive) {
    return (
      <div className="error-container">
        <div className="error-message">
          <h2>계정이 비활성화되었습니다</h2>
          <p>관리자에게 문의하세요.</p>
        </div>
      </div>
    );
  }

  // 역할 검증
  if (requiredRoles.length > 0 && !requiredRoles.includes(userProfile.role)) {
    return (
      <div className="error-container">
        <div className="error-message">
          <h2>접근 권한이 없습니다</h2>
          <p>이 페이지에 접근할 권한이 없습니다.</p>
          <p>현재 역할: {getRoleDisplayName(userProfile.role)}</p>
          <p>필요한 역할: {requiredRoles.map(getRoleDisplayName).join(', ')}</p>
        </div>
      </div>
    );
  }

  // 권한 검증 (관리자만 해당)
  if (requiredPermissions.length > 0 && userProfile.role !== 'super_admin') {
    // 여기서는 간단히 역할만 검증하고, 실제 권한 검증은 서버에서 수행
    // Phase 3에서 더 자세히 구현할 예정
  }

  return <>{children}</>;
};

// 역할 표시명 변환 함수
const getRoleDisplayName = (role: string): string => {
  switch (role) {
    case 'student':
      return '학생';
    case 'admin':
      return '관리자';
    case 'super_admin':
      return '슈퍼 관리자';
    default:
      return role;
  }
};

// 특정 역할을 위한 편의 컴포넌트들
export const StudentRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requiredRoles={['student']}>
    {children}
  </ProtectedRoute>
);

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
    {children}
  </ProtectedRoute>
);

export const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requiredRoles={['super_admin']}>
    {children}
  </ProtectedRoute>
);
