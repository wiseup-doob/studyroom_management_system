/**
 * StudentCard.tsx - 학생 카드 컴포넌트
 */

import React from 'react';
import { Student } from '../../../types/student';
import './StudentCard.css';

interface StudentCardProps {
  student: Student;
  isSelected: boolean;
  onClick: () => void;
  attendanceRate?: number;
}

const StudentCard: React.FC<StudentCardProps> = ({
  student,
  isSelected,
  onClick,
  attendanceRate
}) => {
  const getAttendanceRateColor = (rate?: number) => {
    if (!rate) return '#94a3b8';
    if (rate >= 95) return '#10b981';
    if (rate >= 85) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div
      className={`student-card ${isSelected ? 'student-card--selected' : ''}`}
      onClick={onClick}
    >
      <div className="student-card__header">
        <div className="student-card__avatar">
          {student.name.charAt(0)}
        </div>
        <div className="student-card__info">
          <div className="student-card__name">{student.name}</div>
          <div className="student-card__grade">{student.grade}</div>
        </div>
      </div>

      {attendanceRate !== undefined && (
        <div className="student-card__attendance">
          <span className="student-card__attendance-label">출석률</span>
          <span
            className="student-card__attendance-value"
            style={{ color: getAttendanceRateColor(attendanceRate) }}
          >
            {attendanceRate.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
};

export default StudentCard;
