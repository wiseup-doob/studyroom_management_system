import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-section">
            <h3>스터디룸 관리 시스템</h3>
            <p>효율적인 스터디룸 예약과 관리를 위한 통합 솔루션</p>
          </div>
          
          <div className="footer-section">
            <h4>서비스</h4>
            <ul>
              <li>스터디룸 예약</li>
              <li>사용자 관리</li>
              <li>통계 및 분석</li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4>지원</h4>
            <ul>
              <li>도움말</li>
              <li>문의하기</li>
              <li>이용약관</li>
            </ul>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; 2024 스터디룸 관리 시스템. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
