import React from 'react';
import { MainLayout } from '../../components/layout/MainLayout';
import './StudentsPage.css';

const StudentsPage: React.FC = () => {
  return (
    <MainLayout>
      <div className="students-page-container">
        <div className="students-page">
          <div className="page-header">
            <h1 className="page-title">학생 관리</h1>
            <button className="create-student-btn" disabled>
              새 학생 등록
            </button>
          </div>

          <div className="students-list-section">
            <div className="search-filters">
              <input 
                type="text"
                className="search-input"
                placeholder="학생 검색..."
                disabled
              />
            </div>
            
            <div className="students-grid">
              <div className="loading-message">
                학생 관리 기능은 준비 중입니다.<br/>
                학생 등록, 정보 관리, 수강 현황, 교사 및 강의실 관리 등의 기능이 추가될 예정입니다.
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default StudentsPage;