/**
 * MonthlyView.tsx - 월간 달력 출결 현황 뷰
 */

import React from 'react';
import { StudentAttendanceRecord } from '../../../types/attendance';
import './MonthlyView.css';

interface MonthlyViewProps {
  currentDate: Date;
  attendanceRecords: StudentAttendanceRecord[];
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

const MonthlyView: React.FC<MonthlyViewProps> = ({
  currentDate,
  attendanceRecords,
  onPreviousMonth,
  onNextMonth
}) => {
  // 월의 첫날
  const getMonthStart = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  };

  // 월의 마지막 날
  const getMonthEnd = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  };

  // 달력 표시를 위한 날짜 배열 생성 (이전달/다음달 날짜 포함)
  const getCalendarDays = (): (Date | null)[] => {
    const monthStart = getMonthStart(currentDate);
    const monthEnd = getMonthEnd(currentDate);
    const startDay = monthStart.getDay(); // 0(일) ~ 6(토)
    const days: (Date | null)[] = [];

    // 이전 달의 날짜들 (일요일부터 시작하도록)
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // 현재 달의 날짜들
    for (let day = 1; day <= monthEnd.getDate(); day++) {
      days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    }

    return days;
  };

  const calendarDays = getCalendarDays();
  const weekDayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // 날짜별 출석 기록 찾기
  const getRecordForDate = (date: Date): StudentAttendanceRecord | undefined => {
    const dateStr = date.toISOString().split('T')[0];
    return attendanceRecords.find(record => record.date === dateStr);
  };

  // 출석 상태에 따른 아이콘 반환
  const getStatusIcon = (record?: StudentAttendanceRecord): string => {
    if (!record) return '➖';

    switch (record.status) {
      case 'checked_out':
        if (record.isLate || record.isEarlyLeave) return '⚠️';
        return '✅';
      case 'checked_in':
        return '⏱️';
      case 'absent_excused':
      case 'absent_unexcused':
        return '❌';
      case 'not_arrived':
        return '⏰';
      case 'scheduled':
        return '📝';
      default:
        return '➖';
    }
  };

  // 출석 상태에 따른 색상 반환
  const getStatusColor = (record?: StudentAttendanceRecord): string => {
    if (!record) return '#f1f5f9';

    switch (record.status) {
      case 'checked_out':
        if (record.isLate || record.isEarlyLeave) return '#fef3c7';
        return '#d1fae5';
      case 'checked_in':
        return '#dbeafe';
      case 'absent_excused':
      case 'absent_unexcused':
        return '#fee2e2';
      case 'not_arrived':
        return '#fef3c7';
      case 'scheduled':
        return '#f1f5f9';
      default:
        return '#f1f5f9';
    }
  };

  // 오늘 날짜인지 확인
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // 날짜 클릭 핸들러 (향후 상세 정보 표시용)
  const handleDateClick = (date: Date) => {
    const record = getRecordForDate(date);
    if (record) {
      // TODO: 상세 정보 모달 표시
      console.log('출석 기록:', record);
    }
  };

  return (
    <div className="monthly-view">
      <div className="mv-header">
        <div className="mv-month-name">
          {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
        </div>
        <div className="mv-navigation">
          <button className="mv-nav-btn" onClick={onPreviousMonth}>
            ◀ 이전달
          </button>
          <button className="mv-nav-btn" onClick={onNextMonth}>
            다음달 ▶
          </button>
        </div>
      </div>

      <div className="mv-calendar">
        {/* 요일 헤더 */}
        <div className="mv-weekdays">
          {weekDayNames.map((dayName, index) => (
            <div
              key={index}
              className={`mv-weekday ${index === 0 ? 'mv-weekday--sunday' : ''} ${index === 6 ? 'mv-weekday--saturday' : ''}`}
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="mv-days">
          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={index} className="mv-day mv-day--empty" />;
            }

            const record = getRecordForDate(date);
            const statusIcon = getStatusIcon(record);
            const statusColor = getStatusColor(record);
            const today = isToday(date);
            const dayOfWeek = date.getDay();

            return (
              <div
                key={index}
                className={`mv-day ${today ? 'mv-day--today' : ''} ${record ? 'mv-day--has-record' : ''}`}
                style={{ backgroundColor: statusColor }}
                onClick={() => handleDateClick(date)}
              >
                <div
                  className={`mv-day-number ${dayOfWeek === 0 ? 'mv-day-number--sunday' : ''} ${dayOfWeek === 6 ? 'mv-day-number--saturday' : ''}`}
                >
                  {date.getDate()}
                </div>
                <div className="mv-status-icon">{statusIcon}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 범례 */}
      <div className="mv-legend">
        <div className="mv-legend-title">범례</div>
        <div className="mv-legend-items">
          <div className="mv-legend-item">
            <span className="mv-legend-icon">✅</span>
            <span className="mv-legend-text">출석</span>
          </div>
          <div className="mv-legend-item">
            <span className="mv-legend-icon">⚠️</span>
            <span className="mv-legend-text">지각/조퇴</span>
          </div>
          <div className="mv-legend-item">
            <span className="mv-legend-icon">⏱️</span>
            <span className="mv-legend-text">등원중</span>
          </div>
          <div className="mv-legend-item">
            <span className="mv-legend-icon">❌</span>
            <span className="mv-legend-text">결석</span>
          </div>
          <div className="mv-legend-item">
            <span className="mv-legend-icon">⏰</span>
            <span className="mv-legend-text">미등원</span>
          </div>
          <div className="mv-legend-item">
            <span className="mv-legend-icon">📝</span>
            <span className="mv-legend-text">예정</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyView;
