import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
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
          <p>사용자 정보를 확인하는 중...</p>
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


  return <>{children}</>;
};


