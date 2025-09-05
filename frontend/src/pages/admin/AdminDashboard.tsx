import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/apiService';
import { Student } from '../../types/student';
import { AcademySettings } from '../../types/admin';
import './AdminDashboard.css';

const AdminDashboard: React.FC = () => {
  const { userProfile, logout } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [academySettings, setAcademySettings] = useState<AcademySettings | null>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [activeStudentCount, setActiveStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadAdminData = async () => {
      if (!userProfile) return;

      try {
        setLoading(true);
        // ApiService에 컨텍스트 설정
        apiService.setContext(userProfile.academyId, userProfile.role);
        
        // 병렬로 데이터 로드
        const [
          studentsData,
          settingsData,
          totalCount,
          activeCount
        ] = await Promise.all([
          apiService.getStudents(),
          apiService.getAcademySettings(),
          apiService.getStudentCount(),
          apiService.getActiveStudentCount()
        ]);

        setStudents(studentsData);
        setAcademySettings(settingsData);
        setStudentCount(totalCount);
        setActiveStudentCount(activeCount);
      } catch (err: any) {
        setError(err.message || '데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadAdminData();
  }, [userProfile]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>관리자 데이터를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="error-container">
          <div className="error-message">
            <h2>오류가 발생했습니다</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>관리자 대시보드</h1>
          <div className="user-info">
            <span className="welcome-text">안녕하세요, {userProfile?.name}님!</span>
            <span className="role-badge">관리자</span>
            <button onClick={handleLogout} className="logout-button">
              로그아웃
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* 통계 카드 */}
        <div className="stats-cards">
          <div className="stat-card">
            <h3>전체 학생</h3>
            <div className="stat-number">{studentCount}</div>
            <p>명</p>
          </div>
          <div className="stat-card">
            <h3>활성 학생</h3>
            <div className="stat-number">{activeStudentCount}</div>
            <p>명</p>
          </div>
          <div className="stat-card">
            <h3>비활성 학생</h3>
            <div className="stat-number">{studentCount - activeStudentCount}</div>
            <p>명</p>
          </div>
          <div className="stat-card">
            <h3>학원 ID</h3>
            <div className="stat-number-small">{userProfile?.academyId}</div>
          </div>
        </div>

        {/* 학원 정보 */}
        {academySettings && (
          <div className="academy-info-card">
            <h3>학원 정보</h3>
            <div className="academy-details">
              <div className="detail-row">
                <strong>학원명:</strong> {academySettings.name}
              </div>
              <div className="detail-row">
                <strong>주소:</strong> {academySettings.address}
              </div>
              <div className="detail-row">
                <strong>전화번호:</strong> {academySettings.phone}
              </div>
              <div className="detail-row">
                <strong>이메일:</strong> {academySettings.email}
              </div>
              <div className="detail-row">
                <strong>운영시간:</strong> {academySettings.operatingHours.open} - {academySettings.operatingHours.close}
              </div>
            </div>
          </div>
        )}

        {/* 학생 목록 */}
        <div className="students-section">
          <h3>학생 목록</h3>
          <div className="students-grid">
            {students.length > 0 ? (
              students.map((student) => (
                <div key={student.id} className="student-card">
                  <div className="student-header">
                    <h4>{student.name}</h4>
                    <span className={`status-badge ${student.status}`}>
                      {student.status === 'active' ? '활성' : '비활성'}
                    </span>
                  </div>
                  <div className="student-details">
                    <p><strong>학년:</strong> {student.grade}학년</p>
                    <p><strong>이메일:</strong> {student.contactInfo?.email || '정보 없음'}</p>
                    <p><strong>전화번호:</strong> {student.contactInfo?.phone || '정보 없음'}</p>
                    {student.lastAttendanceDate && (
                      <p><strong>마지막 출석:</strong> {new Date(student.lastAttendanceDate).toLocaleDateString('ko-KR')}</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-students">
                <p>등록된 학생이 없습니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* 관리 기능 */}
        <div className="admin-features">
          <h3>관리 기능</h3>
          <div className="feature-buttons">
            <button className="admin-button" disabled>
              학생 추가 (준비 중)
            </button>
            <button className="admin-button" disabled>
              출석 관리 (준비 중)
            </button>
            <button className="admin-button" disabled>
              좌석 관리 (준비 중)
            </button>
            <button className="admin-button" disabled>
              리포트 생성 (준비 중)
            </button>
          </div>
        </div>

        <div className="phase-info">
          <h3>Phase 2 구현 완료</h3>
          <p>멀티테넌트 인증 로직과 역할별 라우팅이 구현되었습니다.</p>
          <ul>
            <li>✅ 커스텀 클레임 기반 인증</li>
            <li>✅ 사용자 정보 조회</li>
            <li>✅ ProtectedRoute 컴포넌트</li>
            <li>✅ 역할별 라우팅</li>
            <li>✅ ApiService (academyId 자동 주입)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
