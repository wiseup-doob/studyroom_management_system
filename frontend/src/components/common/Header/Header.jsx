import { useAuth } from '../../../context/AuthContext';
import { authService } from '../../../services/authService';
import { useNavigate } from 'react-router-dom';
import './Header.css';

const Header = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authService.signOut();
    navigate('/');
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="logo" onClick={() => navigate('/')}>
          <h1>스터디룸 관리</h1>
        </div>
        
        <nav className="nav">
          <button 
            className="nav-link" 
            onClick={() => navigate('/')}
          >
            홈
          </button>
          
          {currentUser ? (
            <>
              <button 
                className="nav-link" 
                onClick={() => navigate('/dashboard')}
              >
                대시보드
              </button>
              <div className="user-menu">
                <span className="user-name">{currentUser.displayName || currentUser.email}</span>
                <button 
                  className="logout-button" 
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </div>
            </>
          ) : (
            <button 
              className="nav-link" 
              onClick={() => navigate('/login')}
            >
              로그인
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
