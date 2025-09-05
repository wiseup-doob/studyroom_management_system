import React, { ReactNode } from 'react';
import './MainContent.css';

interface MainContentProps {
  children: ReactNode;
  className?: string;
}

export const MainContent: React.FC<MainContentProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`main-content ${className}`}>
      {children}
    </div>
  );
};

export default MainContent;