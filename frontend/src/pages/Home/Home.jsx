import './Home.css';

const Home = () => {
  return (
    <div className="home">
      <div className="hero-section">
        <h1>스터디룸 관리 시스템</h1>
        <p>효율적인 스터디룸 예약과 관리를 위한 통합 솔루션</p>
        <button className="cta-button">시작하기</button>
      </div>
      
      <div className="features-section">
        <h2>주요 기능</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>실시간 예약</h3>
            <p>실시간으로 스터디룸을 예약하고 관리할 수 있습니다.</p>
          </div>
          <div className="feature-card">
            <h3>사용자 관리</h3>
            <p>사용자별 권한과 예약 내역을 체계적으로 관리합니다.</p>
          </div>
          <div className="feature-card">
            <h3>통계 및 분석</h3>
            <p>사용 패턴과 통계를 통해 효율적인 운영이 가능합니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
