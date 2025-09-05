import React from 'react';
import { MainLayout } from '../../components/layout/MainLayout';
import './AttendancePage.css';

const AttendancePage: React.FC = () => {
  return (
    <MainLayout>
      <div className="attendance-page">
        <h1 className="page-title">출결 관리</h1>
        
        <div className="search-section">
          <input 
            type="text" 
            className="search-input" 
            placeholder="학생 검색..."
            disabled
          />
        </div>

        <div className="seat-arrangement-section">
          <h2 className="section-title">좌석 배치</h2>
          
          <div className="loading-section">
            <div className="loading-text">
              출결 관리 기능은 준비 중입니다.<br/>
              학생들의 출석체크, 좌석 배치, 출석률 통계 등의 기능이 추가될 예정입니다.
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default AttendancePage;