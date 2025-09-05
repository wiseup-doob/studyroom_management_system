import React, { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../common/Sidebar/Sidebar';
import { MainContent } from '../common/MainContent/MainContent';
import './MainLayout.css';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="layout-container">
      {/* Sidebar 컴포넌트 재사용 */}
      <Sidebar />

      {/* MainContent 컴포넌트 재사용 */}
      <MainContent>
        {children}
      </MainContent>
    </div>
  );
};

export default MainLayout;