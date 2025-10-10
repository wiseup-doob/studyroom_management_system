import React from 'react';
import { AttendanceStatsSummary } from '../../../types/attendance';
import './AttendanceStatsCard.css';

interface AttendanceStatsCardProps {
  stats: AttendanceStatsSummary;
}

export const AttendanceStatsCard: React.FC<AttendanceStatsCardProps> = ({ stats }) => {
  const attendanceRate = stats.assignedSeats > 0
    ? ((stats.checkedIn / stats.assignedSeats) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="attendance-stats-card">
      <div className="stats-row">
        <div className="stat-box stat-box--total">
          <div className="stat-box__label">전체 좌석</div>
          <div className="stat-box__value">{stats.totalSeats}</div>
        </div>

        <div className="stat-box stat-box--assigned">
          <div className="stat-box__label">할당</div>
          <div className="stat-box__value">{stats.assignedSeats}</div>
        </div>

        <div className="stat-box stat-box--rate">
          <div className="stat-box__label">출석률</div>
          <div className="stat-box__value">{attendanceRate}%</div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-box stat-box--checked-in">
          <div className="stat-box__label">등원</div>
          <div className="stat-box__value">{stats.checkedIn}</div>
        </div>

        <div className="stat-box stat-box--checked-out">
          <div className="stat-box__label">하원</div>
          <div className="stat-box__value">{stats.checkedOut}</div>
        </div>

        <div className="stat-box stat-box--not-arrived">
          <div className="stat-box__label">미등원</div>
          <div className="stat-box__value">{stats.notArrived}</div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-box stat-box--excused">
          <div className="stat-box__label">사유결석</div>
          <div className="stat-box__value">{stats.absentExcused}</div>
        </div>

        <div className="stat-box stat-box--unexcused">
          <div className="stat-box__label">무단결석</div>
          <div className="stat-box__value">{stats.absentUnexcused}</div>
        </div>

        {stats.lateCount > 0 && (
          <div className="stat-box stat-box--late">
            <div className="stat-box__label">지각</div>
            <div className="stat-box__value">{stats.lateCount}</div>
          </div>
        )}

        {stats.earlyLeaveCount > 0 && (
          <div className="stat-box stat-box--early">
            <div className="stat-box__label">조퇴</div>
            <div className="stat-box__value">{stats.earlyLeaveCount}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceStatsCard;
