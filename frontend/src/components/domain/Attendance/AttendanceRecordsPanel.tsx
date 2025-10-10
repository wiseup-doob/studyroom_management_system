import React, { useMemo, useState } from 'react';
import { StudentAttendanceRecord } from '../../../types/attendance';
import { Student } from '../../../types/student';
import './AttendanceRecordsPanel.css';

interface AttendanceRecordsPanelProps {
  records: StudentAttendanceRecord[];
  students: Student[];
  onRecordClick: (record: StudentAttendanceRecord) => void;
  loading?: boolean;
}

type StatusFilter = 'all' | 'checked_in' | 'checked_out' | 'late' | 'absent';

export const AttendanceRecordsPanel: React.FC<AttendanceRecordsPanelProps> = ({
  records,
  students,
  onRecordClick,
  loading = false
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // 학생 정보와 출석 기록 결합
  const recordsWithStudents = useMemo(() => {
    return records.map(record => {
      const student = students.find(s => s.id === record.studentId);
      return {
        record,
        student
      };
    }).filter(item => item.student); // 학생 정보가 있는 것만
  }, [records, students]);

  // 필터링된 기록
  const filteredRecords = useMemo(() => {
    if (statusFilter === 'all') return recordsWithStudents;
    return recordsWithStudents.filter(item => item.record.status === statusFilter);
  }, [recordsWithStudents, statusFilter]);

  // 상태별 카운트
  const statusCounts = useMemo(() => {
    return {
      all: recordsWithStudents.length,
      checked_in: recordsWithStudents.filter(r => r.record.status === 'checked_in').length,
      checked_out: recordsWithStudents.filter(r => r.record.status === 'checked_out').length,
      late: recordsWithStudents.filter(r => r.record.isLate).length,
      absent: recordsWithStudents.filter(r => r.record.status === 'absent').length,
    };
  }, [recordsWithStudents]);

  // 상태 텍스트 및 스타일
  const getStatusInfo = (record: StudentAttendanceRecord) => {
    if (record.status === 'absent') {
      return { text: '결석', className: 'status-badge--absent' };
    }
    if (record.status === 'checked_out') {
      return { text: '하원', className: 'status-badge--checked-out' };
    }
    if (record.isLate) {
      return { text: '지각', className: 'status-badge--late' };
    }
    if (record.status === 'checked_in') {
      return { text: '등원', className: 'status-badge--checked-in' };
    }
    return { text: '미상', className: 'status-badge--unknown' };
  };

  // 시간 포맷
  const formatTime = (date: Date | null | undefined) => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="attendance-records-panel">
      {/* 헤더 */}
      <div className="records-panel__header">
        <h3 className="records-panel__title">출석 기록</h3>
        <span className="records-panel__count">{filteredRecords.length}명</span>
      </div>

      {/* 상태 필터 탭 */}
      <div className="status-filter-tabs">
        <button
          className={`filter-tab ${statusFilter === 'all' ? 'filter-tab--active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          전체 <span className="filter-tab__count">{statusCounts.all}</span>
        </button>
        <button
          className={`filter-tab ${statusFilter === 'checked_in' ? 'filter-tab--active' : ''}`}
          onClick={() => setStatusFilter('checked_in')}
        >
          등원 <span className="filter-tab__count">{statusCounts.checked_in}</span>
        </button>
        <button
          className={`filter-tab ${statusFilter === 'checked_out' ? 'filter-tab--active' : ''}`}
          onClick={() => setStatusFilter('checked_out')}
        >
          하원 <span className="filter-tab__count">{statusCounts.checked_out}</span>
        </button>
        <button
          className={`filter-tab ${statusFilter === 'late' ? 'filter-tab--active' : ''}`}
          onClick={() => setStatusFilter('late')}
        >
          지각 <span className="filter-tab__count">{statusCounts.late}</span>
        </button>
        <button
          className={`filter-tab ${statusFilter === 'absent' ? 'filter-tab--active' : ''}`}
          onClick={() => setStatusFilter('absent')}
        >
          결석 <span className="filter-tab__count">{statusCounts.absent}</span>
        </button>
      </div>

      {/* 출석 기록 목록 */}
      <div className="records-list">
        {loading ? (
          <div className="records-list__loading">
            <div className="spinner"></div>
            <div className="loading-text">로딩 중...</div>
          </div>
        ) : filteredRecords.length > 0 ? (
          filteredRecords.map(({ record, student }) => {
            const statusInfo = getStatusInfo(record);
            return (
              <div
                key={record.id}
                className="record-card"
                onClick={() => onRecordClick(record)}
              >
                <div className="record-card__header">
                  <div className="record-card__student">
                    <div className="student-name">{student?.name}</div>
                    <div className="student-details">
                      {student?.grade} · 좌석 {record.seatNumber}
                    </div>
                  </div>
                  <div className={`status-badge ${statusInfo.className}`}>
                    {statusInfo.text}
                  </div>
                </div>

                <div className="record-card__times">
                  <div className="time-item">
                    <span className="time-item__label">등원:</span>
                    <span className="time-item__value">
                      {formatTime(record.checkInTime)}
                    </span>
                  </div>
                  {record.checkOutTime && (
                    <div className="time-item">
                      <span className="time-item__label">하원:</span>
                      <span className="time-item__value">
                        {formatTime(record.checkOutTime)}
                      </span>
                    </div>
                  )}
                </div>

                {/* 사유 표시 */}
                {record.note && (
                  <div className="record-card__note">
                    <span className="note-icon">📝</span>
                    <span className="note-text">{record.note}</span>
                  </div>
                )}

                {/* 특이사항 표시 */}
                <div className="record-card__flags">
                  {record.isLate && (
                    <span className="flag flag--late">지각</span>
                  )}
                  {record.isEarlyLeave && (
                    <span className="flag flag--early-leave">조퇴</span>
                  )}
                  {record.isExcused && (
                    <span className="flag flag--excused">사유결석</span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="records-list--empty">
            <div className="empty-state__icon">📋</div>
            <div className="empty-state__text">
              {statusFilter === 'all'
                ? '오늘 출석 기록이 없습니다'
                : `${statusFilter === 'checked_in' ? '등원' :
                     statusFilter === 'checked_out' ? '하원' :
                     statusFilter === 'late' ? '지각' : '결석'} 기록이 없습니다`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceRecordsPanel;
