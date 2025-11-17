/**
 * StudentDetailSidebar.tsx - 학생 상세 정보 사이드바
 *
 * 좌석 클릭 시 오른쪽에 나타나는 사이드바
 * - 학생 정보 및 오늘 출석 상태
 * - 등하원 수동 관리 버튼
 * - 시간표 탭
 * - 출결 현황 달력 탭
 */

import React, { useState, useEffect } from 'react';
import { Student } from '../../../types/student';
import { StudentAttendanceRecord, StudentAttendanceStatus } from '../../../types/attendance';
import { StudentTimetableData, DayOfWeek } from '../../../types/student';
import attendanceService from '../../../services/attendanceService';
import { studentTimetableService } from '../../../services/backendService';
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
  const [timetable, setTimetable] = useState<StudentTimetableData | null>(null);
  const [loadingTimetable, setLoadingTimetable] = useState(false);

  // 시간표 조회
  useEffect(() => {
    if (student && isOpen && activeTab === 'timetable') {
      loadStudentTimetable();
    }
  }, [student, isOpen, activeTab]);

  const loadStudentTimetable = async () => {
    if (!student) return;

    setLoadingTimetable(true);
    try {
      const data = await studentTimetableService.getStudentTimetables(student.id);
      const activeTimetable = data.find((t: StudentTimetableData) => t.isActive);
      setTimetable(activeTimetable || null);
    } catch (error) {
      console.error('시간표 로드 실패:', error);
      setTimetable(null);
    } finally {
      setLoadingTimetable(false);
    }
  };

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

  // 시간표 그리드 헬퍼 함수들 (StudentTimetablePanel에서 복사)
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const generateTimeSlots = () => {
    const slots = [];
    const startHour = 9;
    const endHour = 24;
    const interval = 30;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let min = 0; min < 60; min += interval) {
        const timeString = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const minutes = hour * 60 + min;
        const nextMinutes = minutes + interval;

        slots.push({
          time: timeString,
          startMinutes: minutes,
          endMinutes: nextMinutes
        });
      }
    }

    return slots;
  };

  const getTimeSlotMapping = (day: string) => {
    const daySchedule = timetable?.detailedSchedule[day];
    const timeSlots = generateTimeSlots();
    const mapping: { [key: string]: any } = {};
    const occupiedSlots = new Set<number>();

    // 실제 수업들을 매핑
    if (daySchedule && daySchedule.timeSlots) {
      daySchedule.timeSlots.forEach((slot: any) => {
        const slotStartMinutes = timeToMinutes(slot.startTime);
        const slotEndMinutes = timeToMinutes(slot.endTime);

        const startSlotIndex = timeSlots.findIndex(ts =>
          ts.startMinutes <= slotStartMinutes && ts.endMinutes > slotStartMinutes
        );

        if (startSlotIndex !== -1) {
          const spanCount = Math.ceil((slotEndMinutes - slotStartMinutes) / 30);

          for (let i = 0; i < spanCount; i++) {
            occupiedSlots.add(startSlotIndex + i);
          }

          mapping[startSlotIndex] = {
            ...slot,
            spanCount: Math.max(1, spanCount)
          };
        }
      });
    }

    // 등원시간 범위 내에서만 자습 채우기 (요일별, 활성화된 요일만)
    const basicDaySchedule = timetable?.basicSchedule?.dailySchedules?.[day as DayOfWeek];

    // isActive가 true인 요일만 자습 채우기
    if (basicDaySchedule?.isActive) {
      const arrivalMinutes = timeToMinutes(basicDaySchedule.arrivalTime);
      const departureMinutes = timeToMinutes(basicDaySchedule.departureTime);

      // 빈 슬롯을 자습으로 자동 채우기 (등원시간 범위 내에서만)
      timeSlots.forEach((timeSlot, index) => {
        // 등원시간 범위 내이고, 수업이 차지하지 않는 슬롯만 자습으로 채우기
        if (timeSlot.startMinutes >= arrivalMinutes &&
            timeSlot.startMinutes < departureMinutes &&
            !occupiedSlots.has(index)) {

          mapping[index] = {
            id: `self-study-${day}-${index}`,
            startTime: timeSlot.time,
            endTime: timeSlots[index + 1]?.time || '24:00',
            subject: '자습',
            type: 'self_study',
            color: '#9E9E9E',
            isAutoGenerated: true,
            spanCount: 1
          };
        }
      });
    }

    return { mapping, occupiedSlots };
  };

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
  const timeSlots = timetable ? generateTimeSlots() : [];

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
              {loadingTimetable ? (
                <p className="sds-placeholder">시간표를 불러오는 중...</p>
              ) : !timetable ? (
                <p className="sds-placeholder">시간표가 없습니다.</p>
              ) : (
                <table className="sds-timetable-grid">
                  <thead>
                    <tr>
                      <th className="time-col">시간</th>
                      {dayNames.map((dayName, idx) => (
                        <th key={daysOfWeek[idx]}>{dayName}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((slot, slotIndex) => {
                      const { time } = slot;
                      return (
                        <tr key={slotIndex}>
                          <td className="time-col">{time}</td>
                          {daysOfWeek.map((day) => {
                            const { mapping, occupiedSlots } = getTimeSlotMapping(day);

                            if (occupiedSlots.has(slotIndex) && !mapping[slotIndex]) {
                              return null;
                            }

                            if (mapping[slotIndex]) {
                              const mappedSlot = mapping[slotIndex];
                              return (
                                <td
                                  key={day}
                                  rowSpan={mappedSlot.spanCount}
                                  className="subject-cell"
                                  style={{
                                    backgroundColor: mappedSlot.color || '#e0e0e0',
                                    color: '#000'
                                  }}
                                >
                                  <div className="subject-content">
                                    {mappedSlot.type !== 'self_study' && (
                                      <div className="subject-name">
                                        {mappedSlot.subject}
                                      </div>
                                    )}
                                    <div className="subject-time">
                                      {mappedSlot.startTime} - {mappedSlot.endTime}
                                    </div>
                                    <div className="subject-type">
                                      {mappedSlot.type === 'class' ? '수업' :
                                       mappedSlot.type === 'self_study' ? '자습' : '외부수업'}
                                    </div>
                                  </div>
                                </td>
                              );
                            }

                            return <td key={day} className="empty-cell"></td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
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
