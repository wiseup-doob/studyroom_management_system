/**
 * BasicScheduleEditModal.tsx - 학생용 기본 스케줄 편집 모달
 *
 * Phase 2 구현:
 * - 등원/하원 시간 편집 (요일별)
 * - 시간 간격 설정
 * - 요일 활성화/비활성화
 * - 권한 기반 UI 제어
 */

import React, { useState, useEffect } from 'react';
import { BasicSchedule, DayOfWeek } from '../../../types/student';
import './BasicScheduleEditModal.css';

interface BasicScheduleEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  basicSchedule: BasicSchedule;
  permissions?: any; // 더 이상 사용하지 않지만 호환성을 위해 유지
  onSave: (updatedBasicSchedule: BasicSchedule) => void;
}

const BasicScheduleEditModal: React.FC<BasicScheduleEditModalProps> = ({
  isOpen,
  onClose,
  basicSchedule,
  onSave
}) => {
  // 모든 요일을 포함하는 초기 dailySchedules 생성 함수
  const createInitialDailySchedules = (inputSchedule: BasicSchedule) => {
    let dailySchedules = inputSchedule.dailySchedules || {};
    
    // 모든 요일이 있는지 확인하고, 없으면 기본값 추가
    const allDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    allDays.forEach(day => {
      if (!dailySchedules[day]) {
        dailySchedules[day] = { arrivalTime: "09:00", departureTime: "18:00", isActive: false };
      }
    });
    
    return dailySchedules;
  };

  // 실제 dailySchedules 구조에 맞는 상태 관리 (원본 데이터 그대로 사용)
  const [formData, setFormData] = useState<BasicSchedule>({
    dailySchedules: createInitialDailySchedules(basicSchedule),
    timeSlotInterval: 30 // 고정값
  });

  const [errors, setErrors] = useState<string[]>([]);

  // 컴포넌트가 열릴 때마다 초기 데이터로 리셋
  useEffect(() => {
    if (isOpen) {
      setFormData({
        dailySchedules: createInitialDailySchedules(basicSchedule),
        timeSlotInterval: 30 // 고정값
      });
      setErrors([]);
    }
  }, [isOpen, basicSchedule]);

  // 요일별 시간 업데이트 함수 (실제 구조 반영)
  const updateDaySchedule = (day: DayOfWeek, updates: {
    arrivalTime?: string;
    departureTime?: string;
    isActive?: boolean;
  }) => {
    setFormData(prev => ({
      ...prev,
      dailySchedules: {
        ...prev.dailySchedules,
        [day]: {
          ...(prev.dailySchedules[day] || { arrivalTime: "09:00", departureTime: "18:00", isActive: false }),
          ...updates
        }
      }
    }));
  };

  // 유효성 검사 (실제 DB 제한 반영)
  const validateForm = (): string[] => {
    const validationErrors: string[] = [];
    
    // 요일 이름 매핑 (실제 프로젝트 구조 반영)
    const dayNames: { [key: string]: string } = {
      monday: '월요일',
      tuesday: '화요일',
      wednesday: '수요일',
      thursday: '목요일',
      friday: '금요일',
      saturday: '토요일',
      sunday: '일요일'
    };

    // 시간을 분으로 변환하는 유틸리티 함수 (실제 프로젝트 구조 반영)
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    Object.entries(formData.dailySchedules).forEach(([day, schedule]) => {
      if (schedule.isActive) {
        const startMinutes = timeToMinutes(schedule.arrivalTime);
        const endMinutes = timeToMinutes(schedule.departureTime);
        
        // 등원/하원 시간 순서 검증
        if (startMinutes >= endMinutes) {
          validationErrors.push(`${dayNames[day]}의 하원 시간은 등원 시간보다 늦어야 합니다.`);
        }
        
        // 16시간 제한 검증
        if (endMinutes - startMinutes > 16 * 60) {
          validationErrors.push(`${dayNames[day]}은 하루 16시간을 초과할 수 없습니다.`);
        }
      }
    });
    
    // 시간 간격 검증
    if (formData.timeSlotInterval < 15) {
      validationErrors.push("시간 간격은 최소 15분 이상이어야 합니다.");
    }
    
    return validationErrors;
  };

  // 저장 핸들러
  const handleSave = () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    onSave(formData);
    onClose();
  };

  // 요일 이름 매핑
  const dayNames: { [key: string]: string } = {
    monday: '월요일',
    tuesday: '화요일',
    wednesday: '수요일',
    thursday: '목요일',
    friday: '금요일',
    saturday: '토요일',
    sunday: '일요일'
  };

  if (!isOpen) return null;

  return (
    <div className="basic-schedule-edit-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>등원/하원 시간 편집</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* 오류 메시지 표시 */}
        {errors.length > 0 && (
          <div className="validation-errors">
            {errors.map((error, index) => (
              <div key={index} className="error-message">
                ⚠️ {error}
              </div>
            ))}
          </div>
        )}

        {/* 시간 간격 정보 (고정값) */}
        <div className="time-slot-interval">
          <label>시간 간격</label>
          <div className="interval-display">
            30분 (고정)
          </div>
        </div>

        {/* 요일별 스케줄 편집 (실제 dailySchedules 구조 반영) */}
        <div className="daily-schedules">
          <h4>요일별 등원/하원 시간</h4>
          {formData.dailySchedules && Object.entries(formData.dailySchedules).map(([day, schedule]) => (
            <div key={day} className="day-schedule">
              <div className="day-header">
                <h5>{dayNames[day]}</h5>
                
                {/* 요일 활성화 토글 (항상 표시) */}
                <label className="active-toggle">
                  <input
                    type="checkbox"
                    checked={schedule.isActive}
                    onChange={(e) => updateDaySchedule(day as DayOfWeek, {
                      isActive: e.target.checked
                    })}
                  />
                  <span className="toggle-label">활성화</span>
                </label>
              </div>

              {/* 등원/하원 시간 (항상 표시) */}
              <div className="time-inputs">
                {/* 등원 시간 (항상 표시) */}
                <div className="time-input">
                  <label>등원 시간</label>
                  <input
                    type="time"
                    value={schedule.arrivalTime}
                    onChange={(e) => updateDaySchedule(day as DayOfWeek, {
                      arrivalTime: e.target.value
                    })}
                  />
                </div>

                {/* 하원 시간 (항상 표시) */}
                <div className="time-input">
                  <label>하원 시간</label>
                  <input
                    type="time"
                    value={schedule.departureTime}
                    min={schedule.arrivalTime} // 등원 시간보다 늦어야 함
                    onChange={(e) => updateDaySchedule(day as DayOfWeek, {
                      departureTime: e.target.value
                    })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* 저장 버튼 */}
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            취소
          </button>
          <button 
            className="btn-save" 
            onClick={handleSave}
            disabled={validateForm().length > 0}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default BasicScheduleEditModal;
