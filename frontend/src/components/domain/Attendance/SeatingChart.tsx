import React, { useMemo } from 'react';
import {
  SeatLayout,
  SeatAssignment,
  StudentAttendanceRecord,
  SeatingChartSeat
} from '../../../types/attendance';
import { Student } from '../../../types/student';
import SeatGroup from './SeatGroup';
import './SeatingChart.css';

interface SeatingChartProps {
  layout: SeatLayout;
  assignments: SeatAssignment[];
  attendanceRecords: StudentAttendanceRecord[];
  students: Student[];
  selectedSeatId: string | null;
  onSeatClick: (seatId: string) => void;
}

export const SeatingChart: React.FC<SeatingChartProps> = ({
  layout,
  assignments,
  attendanceRecords,
  students,
  selectedSeatId,
  onSeatClick
}) => {
  // 1. SeatingChartSeat 배열 생성 (useMemo로 최적화)
  const seatingChartSeats: SeatingChartSeat[] = useMemo(() => {
    return layout.layout.seats.map(seat => {
      const assignment = assignments.find(a => a.seatId === seat.id);
      const record = attendanceRecords.find(r => r.seatId === seat.id);
      const student = assignment?.studentId
        ? students.find(s => s.id === assignment.studentId)
        : undefined;

      return {
        seatLayoutSeat: seat,
        assignment,
        attendanceRecord: record,
        student
      };
    });
  }, [layout.layout.seats, assignments, attendanceRecords, students]);

  // 2. 그룹별로 분류
  const groupedSeats = useMemo(() => {
    return layout.layout.groups?.map(group => {
      const groupSeats = seatingChartSeats.filter(
        s => s.seatLayoutSeat.groupId === group.id
      );
      return {
        group,
        seats: groupSeats
      };
    }) || [];
  }, [layout.layout.groups, seatingChartSeats]);

  // 3. 출석 통계 계산
  const stats = useMemo(() => {
    const summary = {
      totalSeats: layout.layout.seats.length,
      assignedSeats: 0,
      checkedIn: 0,
      checkedOut: 0,
      notArrived: 0,
      absentExcused: 0,
      absentUnexcused: 0,
      lateCount: 0,
      earlyLeaveCount: 0
    };

    attendanceRecords.forEach(record => {
      switch (record.status) {
        case 'checked_in':
          summary.checkedIn++;
          break;
        case 'checked_out':
          summary.checkedOut++;
          break;
        case 'not_arrived':
          summary.notArrived++;
          break;
        case 'absent_excused':
          summary.absentExcused++;
          break;
        case 'absent_unexcused':
          summary.absentUnexcused++;
          break;
      }

      if (record.isLate) summary.lateCount++;
      if (record.isEarlyLeave) summary.earlyLeaveCount++;
    });

    summary.assignedSeats = assignments.length;

    return summary;
  }, [layout.layout.seats.length, assignments.length, attendanceRecords]);

  return (
    <div className="seating-chart">
      {/* 헤더: 배치도 이름 + 통계 */}
      <div className="seating-chart__header">
        <h3 className="seating-chart__title">{layout.name}</h3>

        <div className="seating-chart__stats">
          <div className="stat-item">
            <span className="stat-label">전체:</span>
            <span className="stat-value">{stats.totalSeats}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">할당:</span>
            <span className="stat-value">{stats.assignedSeats}</span>
          </div>
          <div className="stat-item stat-item--checked-in">
            <span className="stat-label">등원:</span>
            <span className="stat-value">{stats.checkedIn}</span>
          </div>
          <div className="stat-item stat-item--checked-out">
            <span className="stat-label">하원:</span>
            <span className="stat-value">{stats.checkedOut}</span>
          </div>
          <div className="stat-item stat-item--excused">
            <span className="stat-label">사유결석:</span>
            <span className="stat-value">{stats.absentExcused}</span>
          </div>
          <div className="stat-item stat-item--unexcused">
            <span className="stat-label">무단결석:</span>
            <span className="stat-value">{stats.absentUnexcused}</span>
          </div>
          {stats.lateCount > 0 && (
            <div className="stat-item stat-item--late">
              <span className="stat-label">지각:</span>
              <span className="stat-value">{stats.lateCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* 그룹별 좌석 배치도 */}
      <div className="seating-chart__groups">
        {groupedSeats.map(({ group, seats }) => (
          <SeatGroup
            key={group.id}
            group={group}
            seats={seats}
            selectedSeatId={selectedSeatId}
            onSeatClick={onSeatClick}
          />
        ))}
      </div>

      {/* 범례 */}
      <div className="seating-chart__legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#4CAF50' }}></div>
          <span>등원</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#9E9E9E' }}></div>
          <span>하원</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#FFC107' }}></div>
          <span>사유결석</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#F44336' }}></div>
          <span>무단결석</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#FFFFFF', border: '1px solid #e2e8f0' }}></div>
          <span>미등원</span>
        </div>
      </div>
    </div>
  );
};

export default SeatingChart;
