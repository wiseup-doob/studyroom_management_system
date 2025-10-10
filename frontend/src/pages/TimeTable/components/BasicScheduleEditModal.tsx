/**
 * BasicScheduleEditModal.tsx - 등하원 시간 편집 모달
 *
 * 학생 시간표의 basicSchedule.dailySchedules를 편집하는 모달
 */

import React, { useState, useEffect } from 'react';
import { DayOfWeek } from '../../../types/student';
import './BasicScheduleEditModal.css';

interface BasicScheduleEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedSchedule: DailySchedules) => Promise<void>;
  currentSchedule: DailySchedules;
  studentName: string;
}

interface DailySchedule {
  arrivalTime: string;
  departureTime: string;
  isActive: boolean;
}

interface DailySchedules {
  [key: string]: DailySchedule;
}

const DAY_OPTIONS: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: '월요일' },
  { value: 'tuesday', label: '화요일' },
  { value: 'wednesday', label: '수요일' },
  { value: 'thursday', label: '목요일' },
  { value: 'friday', label: '금요일' },
  { value: 'saturday', label: '토요일' },
  { value: 'sunday', label: '일요일' }
];

const BasicScheduleEditModal: React.FC<BasicScheduleEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentSchedule,
  studentName
}) => {
  const [schedule, setSchedule] = useState<DailySchedules>(currentSchedule);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 현재 스케줄이 변경되면 로컬 상태 업데이트
  useEffect(() => {
    setSchedule(currentSchedule);
  }, [currentSchedule]);

  // 요일 활성화/비활성화 토글
  const handleToggleDay = (day: DayOfWeek) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        isActive: !prev[day].isActive
      }
    }));
  };

  // 등원 시간 변경
  const handleArrivalTimeChange = (day: DayOfWeek, time: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        arrivalTime: time
      }
    }));
  };

  // 하원 시간 변경
  const handleDepartureTimeChange = (day: DayOfWeek, time: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        departureTime: time
      }
    }));
  };

  // 저장
  const handleSave = async () => {
    setError(null);

    // 유효성 검사: 활성화된 요일은 시간이 설정되어야 함
    for (const day of DAY_OPTIONS) {
      const daySchedule = schedule[day.value];
      if (daySchedule.isActive) {
        if (!daySchedule.arrivalTime || !daySchedule.departureTime) {
          setError(`${day.label}의 등원/하원 시간을 설정해주세요.`);
          return;
        }
        // 등원 시간이 하원 시간보다 늦으면 안됨
        if (daySchedule.arrivalTime >= daySchedule.departureTime) {
          setError(`${day.label}의 하원 시간은 등원 시간보다 늦어야 합니다.`);
          return;
        }
      }
    }

    try {
      setIsSaving(true);
      await onSave(schedule);
      onClose();
    } catch (err) {
      console.error('등하원 시간 저장 실패:', err);
      setError('등하원 시간 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 모달 외부 클릭 시 닫기
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bsem-overlay" onClick={handleOverlayClick}>
      <div className="bsem-modal">
        {/* 헤더 */}
        <div className="bsem-header">
          <h2>등하원 시간 편집</h2>
          <p className="bsem-student-name">{studentName}</p>
          <button className="bsem-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bsem-error">
            {error}
          </div>
        )}

        {/* 본문 */}
        <div className="bsem-body">
          <div className="bsem-schedule-list">
            {DAY_OPTIONS.map(day => {
              const daySchedule = schedule[day.value];
              return (
                <div
                  key={day.value}
                  className={`bsem-day-row ${daySchedule.isActive ? 'active' : 'inactive'}`}
                >
                  {/* 요일 + 활성화 체크박스 */}
                  <div className="bsem-day-header">
                    <label className="bsem-checkbox-label">
                      <input
                        type="checkbox"
                        checked={daySchedule.isActive}
                        onChange={() => handleToggleDay(day.value)}
                      />
                      <span className="bsem-day-label">{day.label}</span>
                    </label>
                  </div>

                  {/* 등원/하원 시간 입력 */}
                  {daySchedule.isActive && (
                    <div className="bsem-time-inputs">
                      <div className="bsem-time-input-group">
                        <label>등원</label>
                        <input
                          type="time"
                          value={daySchedule.arrivalTime}
                          onChange={(e) => handleArrivalTimeChange(day.value, e.target.value)}
                        />
                      </div>
                      <span className="bsem-time-separator">~</span>
                      <div className="bsem-time-input-group">
                        <label>하원</label>
                        <input
                          type="time"
                          value={daySchedule.departureTime}
                          onChange={(e) => handleDepartureTimeChange(day.value, e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 푸터 */}
        <div className="bsem-footer">
          <button
            className="bsem-btn bsem-btn--cancel"
            onClick={onClose}
            disabled={isSaving}
          >
            취소
          </button>
          <button
            className="bsem-btn bsem-btn--save"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BasicScheduleEditModal;
