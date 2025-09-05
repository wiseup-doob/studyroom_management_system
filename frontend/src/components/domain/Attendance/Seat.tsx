import React from 'react';
import { AttendanceSeat, AttendanceStudent } from '../../../types/attendance';
import './Seat.css';

interface SeatProps {
  seat: AttendanceSeat;
  student?: AttendanceStudent;
  isSelected: boolean;
  onClick: (seatId: string) => void;
}

export const Seat: React.FC<SeatProps> = ({ 
  seat, 
  student, 
  isSelected, 
  onClick 
}) => {
  const handleClick = () => {
    onClick(seat.id);
  };

  return (
    <div 
      className={`seat seat--${seat.status} ${isSelected ? 'seat--selected' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`좌석 ${seat.number}번 ${student ? `${student.name} 학생` : '빈 좌석'}`}
    >
      <div className="seat__number">{seat.number}</div>
      {student && seat.status !== 'empty' && (
        <div className="seat__student">
          <div className="seat__student-name">{student.name}</div>
          <div className="seat__student-id">{student.studentId}</div>
        </div>
      )}
    </div>
  );
};

export default Seat;
