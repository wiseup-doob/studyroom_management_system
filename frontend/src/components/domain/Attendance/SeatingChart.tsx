import React from 'react';
import { Classroom, AttendanceStudent } from '../../../types/attendance';
import { Seat } from './Seat';
import './SeatingChart.css';

interface SeatingChartProps {
  classroom: Classroom;
  students: AttendanceStudent[];
  selectedSeatId: string | null;
  onSeatClick: (seatId: string) => void;
}

export const SeatingChart: React.FC<SeatingChartProps> = ({
  classroom,
  students,
  selectedSeatId,
  onSeatClick
}) => {
  // 학생 ID로 학생 정보를 찾는 헬퍼 함수
  const findStudentById = (studentId: string | undefined): AttendanceStudent | undefined => {
    if (!studentId) return undefined;
    return students.find(student => student.id === studentId);
  };

  // 반응형 그리드 크기 계산
  const getResponsiveGridSize = () => {
    const screenWidth = window.innerWidth;
    
    if (screenWidth >= 1400) {
      return { rows: classroom.rows, cols: classroom.cols, gap: '12px' };
    } else if (screenWidth >= 1200) {
      return { rows: classroom.rows, cols: classroom.cols, gap: '10px' };
    } else if (screenWidth >= 1024) {
      return { rows: classroom.rows, cols: classroom.cols, gap: '8px' };
    } else if (screenWidth >= 768) {
      return { rows: classroom.rows, cols: classroom.cols, gap: '6px' };
    } else if (screenWidth >= 480) {
      return { rows: classroom.rows, cols: classroom.cols, gap: '4px' };
    } else {
      return { rows: classroom.rows, cols: classroom.cols, gap: '3px' };
    }
  };

  const gridSize = getResponsiveGridSize();

  // 좌석 통계 계산
  const getSeatStats = () => {
    const stats = {
      total: classroom.seats.length,
      empty: 0,
      present: 0,
      dismissed: 0,
      unauthorized: 0,
      authorized: 0,
      notEnrolled: 0
    };

    classroom.seats.forEach(seat => {
      switch (seat.status) {
        case 'empty':
          stats.empty++;
          break;
        case 'present':
          stats.present++;
          break;
        case 'dismissed':
          stats.dismissed++;
          break;
        case 'unauthorized':
          stats.unauthorized++;
          break;
        case 'authorized':
          stats.authorized++;
          break;
        case 'not-enrolled':
          stats.notEnrolled++;
          break;
      }
    });

    return stats;
  };

  const stats = getSeatStats();

  return (
    <div className="seating-chart">
      {/* 좌석 통계 */}
      <div className="seating-chart__stats">
        <div className="stat-item">
          <span className="stat-label">전체:</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat-item stat-item--empty">
          <span className="stat-label">빈 좌석:</span>
          <span className="stat-value">{stats.empty}</span>
        </div>
        <div className="stat-item stat-item--present">
          <span className="stat-label">등원:</span>
          <span className="stat-value">{stats.present}</span>
        </div>
        <div className="stat-item stat-item--dismissed">
          <span className="stat-label">사유결석:</span>
          <span className="stat-value">{stats.dismissed}</span>
        </div>
        <div className="stat-item stat-item--unauthorized">
          <span className="stat-label">무단결석:</span>
          <span className="stat-value">{stats.unauthorized}</span>
        </div>
        <div className="stat-item stat-item--authorized">
          <span className="stat-label">하원:</span>
          <span className="stat-value">{stats.authorized}</span>
        </div>
        <div className="stat-item stat-item--not-enrolled">
          <span className="stat-label">미등원:</span>
          <span className="stat-value">{stats.notEnrolled}</span>
        </div>
      </div>

      {/* 좌석 그리드 */}
      <div 
        className="seating-chart__grid"
        style={{
          gridTemplateColumns: `repeat(${gridSize.cols}, 1fr)`,
          gridTemplateRows: `repeat(${gridSize.rows}, 1fr)`,
          gap: gridSize.gap
        }}
        role="grid"
        aria-label={`${classroom.name} 좌석 배치도`}
      >
        {classroom.seats.map(seat => (
          <Seat
            key={seat.id}
            seat={seat}
            student={findStudentById(seat.studentId)}
            isSelected={selectedSeatId === seat.id}
            onClick={onSeatClick}
          />
        ))}
      </div>

      {/* 범례 */}
      <div className="seating-chart__legend">
        <div className="legend-item">
          <div className="legend-color legend-color--empty"></div>
          <span>빈 좌석</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-color--not-enrolled"></div>
          <span>미등원</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-color--dismissed"></div>
          <span>사유결석</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-color--present"></div>
          <span>등원</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-color--unauthorized"></div>
          <span>무단결석</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-color--authorized"></div>
          <span>하원</span>
        </div>
      </div>
    </div>
  );
};

export default SeatingChart;
