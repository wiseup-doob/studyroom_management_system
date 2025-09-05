import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ProtectedRoute, AdminRoute } from '../components/auth/ProtectedRoute';
import { MainLayout } from '../layouts/MainLayout';
import { ROUTES } from './routeConfig';
import Home from '../pages/Home/Home';
import Login from '../pages/Login/Login';
import AttendancePage from '../pages/Attendance/AttendancePage';
import StudentsPage from '../pages/Students/StudentsPage';
import AdminDashboard from '../pages/admin/AdminDashboard';
import PendingPermission from '../pages/PendingPermission/PendingPermission';

// 로그인 상태에 따른 리다이렉트 컴포넌트
export const AuthenticatedRoute: React.FC = () => {
  const { userProfile } = useAuth();

  if (!userProfile) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // 로그인된 사용자는 메인 레이아웃으로 리다이렉트
  return <Navigate to={ROUTES.MAIN} replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 루트 경로 - 로그인 상태에 따라 리다이렉트 */}
      <Route path={ROUTES.ROOT} element={<AuthenticatedRoute />} />
      
      {/* 로그인 페이지 */}
      <Route path={ROUTES.LOGIN} element={<Login />} />
      
      {/* 권한 설정 대기 페이지 */}
      <Route 
        path={ROUTES.PENDING_PERMISSION} 
        element={
          <ProtectedRoute>
            <PendingPermission />
          </ProtectedRoute>
        } 
      />
      
      {/* 보호된 메인 레이아웃과 페이지들 */}
      <Route 
        path={ROUTES.MAIN} 
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        } 
      >
        <Route index element={<Home />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route 
          path="admin/dashboard" 
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } 
        />
      </Route>
      
      {/* 404 등 기타 경로는 루트로 리다이렉트 */}
      <Route path="*" element={<Navigate to={ROUTES.ROOT} replace />} />
    </Routes>
  );
};
