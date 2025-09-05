import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LoginFormData } from '../../types/auth';
import './LoginForm.css';

interface LoginFormProps {
  onLoginSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // 입력 시 에러 메시지 초기화
    if (error) setError('');
  };

  const validateForm = (): boolean => {
    if (!formData.email.trim()) {
      setError('이메일을 입력해주세요.');
      return false;
    }

    if (!formData.password.trim()) {
      setError('비밀번호를 입력해주세요.');
      return false;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('올바른 이메일 형식을 입력해주세요.');
      return false;
    }

    // 비밀번호 길이 검증
    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      await login(formData.email, formData.password);
      onLoginSuccess?.();
    } catch (error: any) {
      setError(error.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login-form-container">
      <div className="login-form-header">
        <h2>WiseUp 관리 시스템</h2>
        <p>로그인하여 계속하세요</p>
      </div>

      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <label htmlFor="email">이메일</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="이메일을 입력하세요"
            disabled={loading}
            className={error ? 'error' : ''}
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">비밀번호</label>
          <div className="password-input-container">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="비밀번호를 입력하세요"
              disabled={loading}
              className={error ? 'error' : ''}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={togglePasswordVisibility}
              disabled={loading}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="login-button"
          disabled={loading}
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <div className="login-form-footer">
        <p>비밀번호를 잊으셨나요?</p>
        <button type="button" className="forgot-password-link">
          비밀번호 찾기
        </button>
      </div>
    </div>
  );
};
