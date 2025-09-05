import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar/Sidebar';
import { MainContent } from '../components/common/MainContent/MainContent';
import './MainLayout.css';

export const MainLayout: React.FC = () => {
  return (
    <div className="layout-container">
      {/* Sidebar 컴포넌트 */}
      <Sidebar />

      {/* MainContent 컴포넌트 - Outlet으로 페이지 렌더링 */}
      <MainContent>
        <Outlet />
      </MainContent>
    </div>
  );
};

export default MainLayout;