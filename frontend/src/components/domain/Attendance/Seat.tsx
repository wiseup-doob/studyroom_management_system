import React from 'react';
import { SeatingChartSeat } from '../../../types/attendance';
import './Seat.css';

interface SeatProps {
  seat: SeatingChartSeat | null;
  isSelected: boolean;
  onClick: () => void;
}

export const Seat: React.FC<SeatProps> = React.memo(({
  seat,
  isSelected,
  onClick
}) => {
  // 빈 좌석
  if (!seat) {
    return <div className="seat seat--empty" />;
  }

  // 출석 상태에 따른 색상 결정
  const getStatusColor = (): string => {
    if (!seat.attendanceRecord) {
      // 할당은 되어 있지만 출석 기록이 없는 경우
      return seat.assignment ? '#F3F4F6' : '#FFFFFF'; // 할당됨(연회색) / 미할당(흰색)
    }

    switch (seat.attendanceRecord.status) {
      case 'checked_in': return '#4CAF50'; // 등원 (초록)
      case 'checked_out': return '#9E9E9E'; // 하원 (회색)
      case 'absent_excused': return '#FFC107'; // 사유결석 (노랑)
      case 'absent_unexcused': return '#F44336'; // 무단결석 (빨강)
      case 'not_arrived': return '#FFFFFF'; // 미등원 (흰색)
      default: return '#FFFFFF';
    }
  };

  // 접근성을 위한 레이블
  const getAriaLabel = (): string => {
    const label = seat.seatLayoutSeat.label || '좌석';
    if (seat.student) {
      const status = seat.attendanceRecord?.status || '미등원';
      return `${label} - ${seat.student.name} (${status})`;
    }
    return `${label} - 빈 좌석`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`seat ${isSelected ? 'seat--selected' : ''}`}
      style={{ backgroundColor: getStatusColor() }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={getAriaLabel()}
    >
      {/* 학생 이름 또는 미등록 */}
      {seat.student ? (
        <div className="seat__student-name">
          {seat.student.name}
        </div>
      ) : (
        <div className="seat__student-name">
          미등록
        </div>
      )}
    </div>
  );
});

Seat.displayName = 'Seat';

export default Seat;
