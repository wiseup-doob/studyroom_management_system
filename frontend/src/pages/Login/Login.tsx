import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoginForm } from '../../components/auth/LoginForm';
import './Login.css';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const handleLoginSuccess = () => {
    // 로그인 성공 시 홈 화면으로 리다이렉트
    navigate('/home');
  };

  return (
    <div className="login-page">
      <div className="login-background">
        <div className="login-content">
          <LoginForm onLoginSuccess={handleLoginSuccess} />
        </div>
      </div>
    </div>
  );
};

export default Login;
