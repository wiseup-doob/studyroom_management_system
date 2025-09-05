import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute, AdminRoute } from './components/auth/ProtectedRoute';
import { ErrorHandler } from './components/security/ErrorHandler';
import Home from './pages/Home/Home';
import Login from './pages/Login/Login';
import AttendancePage from './pages/Attendance/AttendancePage';
import StudentsPage from './pages/Students/StudentsPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import PendingPermission from './pages/PendingPermission/PendingPermission';
import './App.css';

// 로그인 상태에 따른 리다이렉트 컴포넌트
const AuthenticatedRoute: React.FC = () => {
  const { userProfile } = useAuth();

  if (!userProfile) {
    return <Navigate to="/login" replace />;
  }

  // 로그인된 사용자는 홈으로 리다이렉트
  return <Navigate to="/home" replace />;
};

const App: React.FC = () => {
  return (
    <ErrorHandler>
      <AuthProvider>
        <Router>
          <Routes>
            {/* 루트 경로 - 로그인 상태에 따라 리다이렉트 */}
            <Route path="/" element={<AuthenticatedRoute />} />
            
            {/* 로그인 페이지 */}
            <Route path="/login" element={<Login />} />
            
            {/* 보호된 메인 페이지들 */}
            <Route 
              path="/home" 
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/attendance" 
              element={
                <ProtectedRoute>
                  <AttendancePage />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/students" 
              element={
                <ProtectedRoute>
                  <StudentsPage />
                </ProtectedRoute>
              } 
            />
            
            {/* 기존 역할별 대시보드 (호환성 유지) */}
            
            <Route 
              path="/admin/dashboard" 
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              } 
            />
            
            
            {/* 권한 설정 대기 페이지 */}
            <Route 
              path="/pending-permission" 
              element={
                <ProtectedRoute>
                  <PendingPermission />
                </ProtectedRoute>
              } 
            />
            
            {/* 404 등 기타 경로는 루트로 리다이렉트 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorHandler>
  );
}

export default App
