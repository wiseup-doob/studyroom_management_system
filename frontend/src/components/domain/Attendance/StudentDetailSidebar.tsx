/**
 * StudentDetailSidebar.tsx - 학생 상세 정보 사이드바
 *
 * 좌석 클릭 시 오른쪽에 나타나는 사이드바
 * - 학생 정보 및 오늘 출석 상태
 * - 등하원 수동 관리 버튼
 * - 시간표 탭
 * - 출결 현황 달력 탭
 */

import React, { useState } from 'react';
import { Student } from '../../../types/student';
import { StudentAttendanceRecord, StudentAttendanceStatus } from '../../../types/attendance';
import attendanceService from '../../../services/attendanceService';
import './StudentDetailSidebar.css';

interface StudentDetailSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  todayRecord: StudentAttendanceRecord | null;
  seatNumber: string;
  seatLayoutId: string | null;
  onRecordUpdate: () => void;
}

type TabType = 'timetable' | 'attendance';
type AbsentSubAction = 'excused' | 'unexcused' | null;

const StudentDetailSidebar: React.FC<StudentDetailSidebarProps> = ({
  isOpen,
  onClose,
  student,
  todayRecord,
  seatNumber,
  seatLayoutId,
  onRecordUpdate
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('timetable');
  const [absentSubAction, setAbsentSubAction] = useState<AbsentSubAction>(null);
  const [excusedReason, setExcusedReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !student) return null;

  // 출석 상태 한글 변환
  const getStatusText = (status: string) => {
    switch (status) {
      case 'checked_in': return '등원';
      case 'checked_out': return '하원';
      case 'not_arrived': return '미등원';
      case 'absent_excused': return '사유결석';
      case 'absent_unexcused': return '무단결석';
      default: return '미등원';
    }
  };

  // 출석 상태 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checked_in': return '#10b981';
      case 'checked_out': return '#6b7280';
      case 'not_arrived': return '#94a3b8';
      case 'absent_excused': return '#f59e0b';
      case 'absent_unexcused': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  // 시간 포맷팅
  const formatTime = (date: Date | undefined) => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  // 등원 버튼 클릭
  const handleCheckIn = async () => {
    if (!seatLayoutId) return;
    setIsLoading(true);
    try {
      await attendanceService.manualCheckIn({
        studentId: student.id,
        seatLayoutId,
        notes: '관리자 수동 등원'
      });
      onRecordUpdate();
    } catch (error: any) {
      alert(error.message || '등원 처리에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 하원 버튼 클릭
  const handleCheckOut = async () => {
    if (!seatLayoutId) return;
    setIsLoading(true);
    try {
      await attendanceService.manualCheckOut({
        studentId: student.id,
        seatLayoutId,
        notes: '관리자 수동 하원'
      });
      onRecordUpdate();
    } catch (error: any) {
      alert(error.message || '하원 처리에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 결석 버튼 클릭
  const handleAbsentClick = () => {
    setAbsentSubAction('unexcused'); // 사유결석/무단결석 선택 화면으로
  };

  // 무단결석 확정
  const handleUnexcusedAbsent = async () => {
    if (!seatLayoutId) return;
    setIsLoading(true);
    try {
      await attendanceService.markStudentAbsent({
        studentId: student.id,
        seatLayoutId,
        status: 'absent_unexcused'
      });
      setAbsentSubAction(null);
      onRecordUpdate();
    } catch (error: any) {
      alert(error.message || '무단결석 처리에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 사유결석 - 사유 입력 화면으로
  const handleExcusedAbsentClick = () => {
    setAbsentSubAction('excused');
    setExcusedReason('');
  };

  // 사유결석 확정
  const handleExcusedAbsentConfirm = async () => {
    if (!seatLayoutId) return;
    if (!excusedReason.trim()) {
      alert('결석 사유를 입력해주세요.');
      return;
    }
    setIsLoading(true);
    try {
      await attendanceService.markStudentAbsent({
        studentId: student.id,
        seatLayoutId,
        status: 'absent_excused',
        excusedReason: excusedReason.trim()
      });
      setAbsentSubAction(null);
      setExcusedReason('');
      onRecordUpdate();
    } catch (error: any) {
      alert(error.message || '사유결석 처리에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 취소 버튼
  const handleCancel = () => {
    setAbsentSubAction(null);
    setExcusedReason('');
  };

  return (
    <div className={`sds-sidebar ${isOpen ? 'open' : ''}`}>
        {/* 헤더 */}
        <div className="sds-header">
          <button className="sds-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* 학생 정보 + 오늘 출석 상태 */}
        <div className="sds-info-section">
          <div className="sds-avatar">
            {student.name.charAt(0)}
          </div>
          <div className="sds-info-content">
            <div className="sds-name-row">
              <h2 className="sds-student-name">{student.name}</h2>
              <p className="sds-student-grade">{student.grade}</p>
            </div>
            <div className="sds-status-row">
              <span className="sds-status-label">오늘 출석</span>
              <span
                className="sds-status-badge"
                style={{
                  backgroundColor: getStatusColor(todayRecord?.status || 'not_arrived'),
                  color: 'white'
                }}
              >
                {getStatusText(todayRecord?.status || 'not_arrived')}
              </span>
              {todayRecord?.isLate && (
                <span className="sds-late-badge">지각 {todayRecord.lateMinutes}분</span>
              )}
              {todayRecord?.isEarlyLeave && (
                <span className="sds-early-badge">조퇴 {todayRecord.earlyLeaveMinutes}분</span>
              )}
              <span className="sds-seat-number">좌석: {seatNumber}</span>
            </div>
          </div>
        </div>

        {/* 등하원 수동 관리 버튼 */}
        <div className="sds-action-buttons">
          {absentSubAction === null && (
            <>
              {/* 미등원 상태: 등원, 결석 버튼 (출석 기록이 없거나 not_arrived 상태) */}
              {(!todayRecord || todayRecord?.status === 'not_arrived') && (
                <>
                  <button
                    className="sds-btn sds-btn-checkin"
                    onClick={handleCheckIn}
                    disabled={isLoading}
                  >
                    등원
                  </button>
                  <button
                    className="sds-btn sds-btn-absent"
                    onClick={handleAbsentClick}
                    disabled={isLoading}
                  >
                    결석
                  </button>
                </>
              )}

              {/* 등원 상태: 하원 버튼 */}
              {todayRecord?.status === 'checked_in' && (
                <button
                  className="sds-btn sds-btn-checkout"
                  onClick={handleCheckOut}
                  disabled={isLoading}
                >
                  하원
                </button>
              )}

              {/* 하원 상태: 등원 버튼 (재등원) */}
              {todayRecord?.status === 'checked_out' && (
                <button
                  className="sds-btn sds-btn-checkin"
                  onClick={handleCheckIn}
                  disabled={isLoading}
                >
                  등원
                </button>
              )}

              {/* 결석 상태: 상태 변경 불가 */}
              {(todayRecord?.status === 'absent_excused' || todayRecord?.status === 'absent_unexcused') && (
                <div className="sds-absent-notice">결석 처리 완료</div>
              )}
            </>
          )}

          {/* 결석 선택 화면: 사유결석, 무단결석 버튼 */}
          {absentSubAction === 'unexcused' && (
            <>
              <button
                className="sds-btn sds-btn-excused"
                onClick={handleExcusedAbsentClick}
                disabled={isLoading}
              >
                사유결석
              </button>
              <button
                className="sds-btn sds-btn-unexcused"
                onClick={handleUnexcusedAbsent}
                disabled={isLoading}
              >
                무단결석
              </button>
              <button
                className="sds-btn sds-btn-cancel"
                onClick={handleCancel}
                disabled={isLoading}
              >
                취소
              </button>
            </>
          )}

          {/* 사유결석 입력 화면 */}
          {absentSubAction === 'excused' && (
            <div className="sds-excused-input">
              <input
                type="text"
                className="sds-reason-input"
                placeholder="결석 사유를 입력하세요"
                value={excusedReason}
                onChange={(e) => setExcusedReason(e.target.value)}
                disabled={isLoading}
              />
              <div className="sds-excused-buttons">
                <button
                  className="sds-btn sds-btn-confirm"
                  onClick={handleExcusedAbsentConfirm}
                  disabled={isLoading}
                >
                  확인
                </button>
                <button
                  className="sds-btn sds-btn-cancel"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 탭 */}
        <div className="sds-tabs">
          <button
            className={`sds-tab ${activeTab === 'timetable' ? 'active' : ''}`}
            onClick={() => setActiveTab('timetable')}
          >
            시간표
          </button>
          <button
            className={`sds-tab ${activeTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setActiveTab('attendance')}
          >
            출결 현황
          </button>
        </div>

        {/* 탭 내용 */}
        <div className="sds-tab-content">
          {activeTab === 'timetable' && (
            <div className="sds-timetable-tab">
              <p className="sds-placeholder">시간표를 불러오는 중...</p>
              {/* TODO: 시간표 컴포넌트 추가 */}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="sds-attendance-tab">
              <p className="sds-placeholder">출결 현황을 불러오는 중...</p>
              {/* TODO: 출결 달력 컴포넌트 추가 */}
            </div>
          )}
        </div>
    </div>
  );
};

export default StudentDetailSidebar;
