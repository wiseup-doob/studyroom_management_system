import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import './Sidebar.css';

interface SidebarProps {
  className?: string;
}

const SIDEBAR_MENU_ITEMS = [
  {
    id: 'home',
    label: '홈',
    path: '/home',
    icon: '🏠'
  },
  {
    id: 'attendance',
    label: '출결 관리',
    path: '/attendance',
    icon: '📋'
  },
  {
    id: 'students',
    label: '원생 관리',
    path: '/students',
    icon: '👥'
  }
];

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, logout } = useAuth();

  const handleMenuClick = (path: string) => {
    navigate(path);
  };

  const handleAccountClick = () => {
    navigate('/home');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  return (
    <div className={`sidebar ${className}`}>
      {/* 로고 섹션 */}
      <div className="sidebar-logo">
        <div className="wiseup-logo">
          WiseUp
        </div>
      </div>

      {/* 계정 섹션 */}
      <div className="sidebar-section">
        <h5 className="section-title">계정</h5>
        
        <div className="account-button" onClick={handleAccountClick}>
          <div className="account-avatar">
            {userProfile?.name?.charAt(0) || 'U'}
          </div>
          <div className="account-info">
            <div className="account-name">{userProfile?.name || '사용자'}</div>
            <div className="account-email">관리자</div>
          </div>
        </div>
      </div>

      {/* 일반 메뉴 섹션 */}
      <div className="sidebar-section">
        <h5 className="section-title">일반</h5>
        <nav className="sidebar-nav">
          <ul className="sidebar-menu">
            {SIDEBAR_MENU_ITEMS.map((item) => (
              <li key={item.path} className="sidebar-menu-item">
                <button
                  className={`sidebar-button ${location.pathname === item.path ? 'sidebar-button--active' : ''}`}
                  onClick={() => handleMenuClick(item.path)}
                  data-active={location.pathname === item.path}
                >
                  <span className="sidebar-button__icon">{item.icon}</span>
                  <span className="sidebar-button__label">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* 로그아웃 버튼 */}
      <div className="sidebar-footer">
        <button className="logout-button" onClick={handleLogout}>
          <span className="logout-button__icon">🚪</span>
          <span className="logout-button__label">로그아웃</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;