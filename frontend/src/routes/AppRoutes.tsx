import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { MainLayout } from '../components/layout/MainLayout';
import { ROUTES } from './routeConfig';
import Home from '../pages/Home/Home';
import Login from '../pages/Login/Login';
import Student from '../pages/Student/Student';
import TimeTable from '../pages/TimeTable/TimeTable';
import Attendance from '../pages/Attendance/Attendance';
import AttendanceCheckIn from '../pages/AttendanceCheckIn/AttendanceCheckIn';
import StudentTimetableSharedEdit from '../pages/StudentTimetableSharedEdit/StudentTimetableSharedEdit';
import SubmissionComplete from '../pages/SubmissionComplete/SubmissionComplete';

// 로그인 상태에 따른 리다이렉트 컴포넌트
export const AuthenticatedRoute: React.FC = () => {
  const { userProfile } = useAuth();

  if (!userProfile) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // 로그인된 사용자는 홈으로 리다이렉트
  return <Navigate to={ROUTES.HOME} replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 루트 경로 - 로그인 상태에 따라 리다이렉트 */}
      <Route path={ROUTES.ROOT} element={<AuthenticatedRoute />} />
      
      {/* 로그인 페이지 - 사이드바 없음 */}
      <Route path={ROUTES.LOGIN} element={<Login />} />
      
      {/* 보호된 페이지들 - 사이드바 있음 */}
      <Route 
        path={ROUTES.HOME} 
        element={
          <ProtectedRoute>
            <MainLayout>
              <Home />
            </MainLayout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path={ROUTES.STUDENT} 
        element={
          <ProtectedRoute>
            <MainLayout>
              <Student />
            </MainLayout>
          </ProtectedRoute>
        } 
      />
      
      <Route
        path={ROUTES.TIMETABLE}
        element={
          <ProtectedRoute>
            <MainLayout>
              <TimeTable />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path={ROUTES.ATTENDANCE}
        element={
          <ProtectedRoute>
            <MainLayout>
              <Attendance />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 학생용 출석 체크 페이지 - 사이드바 없음 (공개 링크, 로그인 불필요) */}
      <Route
        path="/attendance-check/:linkToken"
        element={<AttendanceCheckIn />}
      />

      {/* 학생용 시간표 편집 페이지 - 사이드바 없음 (외부 공유 링크) */}
      <Route
        path="/student-timetable-edit/:shareToken"
        element={<StudentTimetableSharedEdit />}
      />

      {/* 제출 완료 페이지 - 사이드바 없음 */}
      <Route
        path="/submission-complete"
        element={<SubmissionComplete />}
      />

      {/* 404 등 기타 경로는 루트로 리다이렉트 */}
      <Route path="*" element={<Navigate to={ROUTES.ROOT} replace />} />
    </Routes>
  );
};
