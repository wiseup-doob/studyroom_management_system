/**
 * WeeklyView.tsx - 주간 출결 현황 뷰
 */

import React from 'react';
import { StudentAttendanceRecord } from '../../../types/attendance';
import './WeeklyView.css';

interface WeeklyViewProps {
  currentDate: Date;
  attendanceRecords: StudentAttendanceRecord[];
  onPreviousWeek: () => void;
  onNextWeek: () => void;
}

const WeeklyView: React.FC<WeeklyViewProps> = ({
  currentDate,
  attendanceRecords,
  onPreviousWeek,
  onNextWeek
}) => {
  // 주의 시작일 (월요일) 계산
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  // 주간 날짜 배열 생성 (월~일)
  const getWeekDays = (): Date[] => {
    const weekStart = getWeekStart(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return date;
    });
  };

  const weekDays = getWeekDays();
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  // 날짜 형식화
  const formatDate = (date: Date): string => {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatDateFull = (date: Date): string => {
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  // 요일 이름
  const dayNames = ['월', '화', '수', '목', '금', '토', '일'];

  // 날짜별 출석 기록 찾기
  const getRecordForDate = (date: Date): StudentAttendanceRecord | undefined => {
    const dateStr = date.toISOString().split('T')[0];
    return attendanceRecords.find(record => record.date === dateStr);
  };

  // 출석 상태에 따른 정보 반환
  const getStatusInfo = (record?: StudentAttendanceRecord) => {
    if (!record) {
      return {
        icon: '➖',
        text: '기록 없음',
        color: '#94a3b8',
        bgColor: '#f1f5f9'
      };
    }

    switch (record.status) {
      case 'checked_out':
        if (record.isLate && record.isEarlyLeave) {
          return {
            icon: '⚠️',
            text: '지각/조퇴',
            color: '#f59e0b',
            bgColor: '#fef3c7',
            detail: `지각 ${record.lateMinutes}분 / 조퇴 ${record.earlyLeaveMinutes}분`
          };
        } else if (record.isLate) {
          return {
            icon: '⚠️',
            text: '지각',
            color: '#f59e0b',
            bgColor: '#fef3c7',
            detail: `${record.lateMinutes}분 지각`
          };
        } else if (record.isEarlyLeave) {
          return {
            icon: '🏃',
            text: '조퇴',
            color: '#f97316',
            bgColor: '#ffedd5',
            detail: `${record.earlyLeaveMinutes}분 조퇴`
          };
        }
        return {
          icon: '✅',
          text: '출석',
          color: '#10b981',
          bgColor: '#d1fae5'
        };
      case 'checked_in':
        return {
          icon: '⏱️',
          text: '등원중',
          color: '#3b82f6',
          bgColor: '#dbeafe'
        };
      case 'absent_excused':
        return {
          icon: '❌',
          text: '사유결석',
          color: '#ef4444',
          bgColor: '#fee2e2',
          detail: record.excusedReason
        };
      case 'absent_unexcused':
        return {
          icon: '❌',
          text: '무단결석',
          color: '#dc2626',
          bgColor: '#fee2e2'
        };
      case 'not_arrived':
        return {
          icon: '⏰',
          text: '미등원',
          color: '#f59e0b',
          bgColor: '#fef3c7'
        };
      case 'scheduled':
        return {
          icon: '📝',
          text: '예정',
          color: '#64748b',
          bgColor: '#f1f5f9'
        };
      default:
        return {
          icon: '➖',
          text: '기록 없음',
          color: '#94a3b8',
          bgColor: '#f1f5f9'
        };
    }
  };

  // 오늘 날짜인지 확인
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // 시간 형식화
  const formatTime = (timestamp: any): string => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="weekly-view">
      <div className="wv-header">
        <div className="wv-date-range">
          {formatDateFull(weekStart)} ~ {formatDateFull(weekEnd)}
        </div>
        <div className="wv-navigation">
          <button className="wv-nav-btn" onClick={onPreviousWeek}>
            ◀ 이전주
          </button>
          <button className="wv-nav-btn" onClick={onNextWeek}>
            다음주 ▶
          </button>
        </div>
      </div>

      <div className="wv-grid">
        {weekDays.map((date, index) => {
          const record = getRecordForDate(date);
          const statusInfo = getStatusInfo(record);

          return (
            <div
              key={index}
              className={`wv-day-card ${isToday(date) ? 'wv-day-card--today' : ''}`}
              style={{ backgroundColor: statusInfo.bgColor }}
            >
              <div className="wv-day-header">
                <div className="wv-day-name">{dayNames[index]}</div>
                <div className="wv-day-date">{formatDate(date)}</div>
              </div>

              <div className="wv-status-icon" style={{ fontSize: '32px' }}>
                {statusInfo.icon}
              </div>

              <div
                className="wv-status-text"
                style={{ color: statusInfo.color }}
              >
                {statusInfo.text}
              </div>

              {record && (
                <div className="wv-times">
                  {record.actualArrivalTime && (
                    <div className="wv-time">
                      <span className="wv-time-label">등원</span>
                      <span className="wv-time-value">{formatTime(record.actualArrivalTime)}</span>
                    </div>
                  )}
                  {record.actualDepartureTime && (
                    <div className="wv-time">
                      <span className="wv-time-label">하원</span>
                      <span className="wv-time-value">{formatTime(record.actualDepartureTime)}</span>
                    </div>
                  )}
                </div>
              )}

              {statusInfo.detail && (
                <div className="wv-detail">{statusInfo.detail}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyView;
