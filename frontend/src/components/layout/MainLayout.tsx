import React, { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../common/Sidebar/Sidebar';
import { MainContent } from '../common/MainContent/MainContent';
import { MainHeader } from './MainHeader';
import './MainLayout.css';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="layout-container">
      {/* Sidebar 컴포넌트 재사용 */}
      <Sidebar />

      {/* 메인 컨텐츠 영역 */}
      <div className="layout-main-area">
        {/* 헤더 (알림 시스템 포함) */}
        <MainHeader />

        {/* MainContent 컴포넌트 재사용 */}
        <MainContent>
          {children}
        </MainContent>
      </div>
    </div>
  );
};

export default MainLayout;