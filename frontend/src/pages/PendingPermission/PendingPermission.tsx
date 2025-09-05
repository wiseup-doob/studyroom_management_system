import React from 'react';
import { useAuth } from '../../context/AuthContext';
import './PendingPermission.css';

const PendingPermission: React.FC = () => {
  const { userProfile, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  return (
    <div className="pending-permission-container">
      <div className="pending-permission-content">
        <div className="pending-permission-icon">
          ⏳
        </div>
        <h1>권한 설정 대기 중</h1>
        <p>안녕하세요, <strong>{userProfile?.email}</strong>님!</p>
        <p>계정이 생성되었지만 아직 권한이 설정되지 않았습니다.</p>
        <p>관리자에게 문의하여 권한을 설정해주세요.</p>
        
        <div className="pending-permission-actions">
          <button onClick={handleLogout} className="logout-button">
            로그아웃
          </button>
        </div>
        
        <div className="pending-permission-info">
          <h3>권한 설정 방법:</h3>
          <ol>
            <li>관리자에게 연락하여 계정 권한을 요청하세요</li>
            <li>관리자가 시스템에서 권한을 설정합니다</li>
            <li>권한 설정 후 다시 로그인하세요</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default PendingPermission;
