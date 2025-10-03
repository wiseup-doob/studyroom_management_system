/**
 * CreateTimetableModal.tsx - 새 시간표 생성 모달 (검은색/하얀색 테마)
 *
 * Phase 3 구현:
 * - 새 시간표 생성 폼
 * - 기본 스케줄 설정
 * - 폼 유효성 검사
 * - 자동 채우기 설정
 */

import React, { useState, useRef, useEffect } from 'react';
import { DayOfWeek } from '../../../types/student';
import './CreateTimetableModal.css';

interface CreateTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (timetableData: CreateTimetableData) => Promise<void>;
  studentId: string;
  studentName: string;
}

export interface CreateTimetableData {
  name: string;
  description: string;
  basicSchedule: {
    dailySchedules: {
      [key in DayOfWeek]: {
        arrivalTime: string;
        departureTime: string;
        isActive: boolean;
      };
    };
    timeSlotInterval: number;
  };
  autoFillSettings: {
    enabled: boolean;
    defaultSubject: string;
    fillEmptySlots: boolean;
  };
}

// 요일 옵션
const DAY_OPTIONS: { value: DayOfWeek; label: string; short: string }[] = [
  { value: 'monday', label: '월요일', short: '월' },
  { value: 'tuesday', label: '화요일', short: '화' },
  { value: 'wednesday', label: '수요일', short: '수' },
  { value: 'thursday', label: '목요일', short: '목' },
  { value: 'friday', label: '금요일', short: '금' },
  { value: 'saturday', label: '토요일', short: '토' },
  { value: 'sunday', label: '일요일', short: '일' }
];

// 시간 간격은 고정으로 30분 사용

const CreateTimetableModal: React.FC<CreateTimetableModalProps> = ({
  isOpen,
  onClose,
  onSave,
  studentId,
  studentName
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // 폼 데이터
  const [formData, setFormData] = useState<CreateTimetableData>({
    name: '',
    description: '',
    basicSchedule: {
      dailySchedules: {
        monday: { arrivalTime: '09:00', departureTime: '18:00', isActive: true },
        tuesday: { arrivalTime: '09:00', departureTime: '18:00', isActive: true },
        wednesday: { arrivalTime: '09:00', departureTime: '18:00', isActive: true },
        thursday: { arrivalTime: '09:00', departureTime: '18:00', isActive: true },
        friday: { arrivalTime: '09:00', departureTime: '18:00', isActive: true },
        saturday: { arrivalTime: '09:00', departureTime: '18:00', isActive: false },
        sunday: { arrivalTime: '09:00', departureTime: '18:00', isActive: false }
      },
      timeSlotInterval: 30
    },
    autoFillSettings: {
      enabled: true,
      defaultSubject: '자습',
      fillEmptySlots: true
    }
  });

  // 모달 외부 클릭 처리
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 폼 데이터 업데이트
  const updateFormData = (updates: Partial<CreateTimetableData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  // 기본 스케줄 업데이트
  const updateBasicSchedule = (updates: Partial<CreateTimetableData['basicSchedule']>) => {
    setFormData(prev => ({
      ...prev,
      basicSchedule: { ...prev.basicSchedule, ...updates }
    }));
  };

  // 자동 채우기 설정 업데이트
  const updateAutoFillSettings = (updates: Partial<CreateTimetableData['autoFillSettings']>) => {
    setFormData(prev => ({
      ...prev,
      autoFillSettings: { ...prev.autoFillSettings, ...updates }
    }));
  };

  // 요일 토글
  const toggleDay = (day: DayOfWeek) => {
    setFormData(prev => ({
      ...prev,
      basicSchedule: {
        ...prev.basicSchedule,
        dailySchedules: {
          ...prev.basicSchedule.dailySchedules,
          [day]: {
            ...prev.basicSchedule.dailySchedules[day],
            isActive: !prev.basicSchedule.dailySchedules[day].isActive
          }
        }
      }
    }));
  };

  // 요일별 시간 업데이트
  const updateDaySchedule = (day: DayOfWeek, updates: Partial<{ arrivalTime: string; departureTime: string }>) => {
    setFormData(prev => ({
      ...prev,
      basicSchedule: {
        ...prev.basicSchedule,
        dailySchedules: {
          ...prev.basicSchedule.dailySchedules,
          [day]: {
            ...prev.basicSchedule.dailySchedules[day],
            ...updates
          }
        }
      }
    }));
  };

  // 폼 유효성 검사
  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      alert('시간표 이름을 입력해주세요.');
      return false;
    }

    // 활성화된 요일이 있는지 확인
    const activeDays = Object.values(formData.basicSchedule.dailySchedules).filter(day => day.isActive);
    if (activeDays.length === 0) {
      alert('최소 하나의 요일을 선택해주세요.');
      return false;
    }

    // 각 활성 요일의 시간 유효성 검사
    for (const [day, schedule] of Object.entries(formData.basicSchedule.dailySchedules)) {
      if (schedule.isActive && schedule.arrivalTime >= schedule.departureTime) {
        alert(`${day}의 하원 시간은 등원 시간보다 늦어야 합니다.`);
        return false;
      }
    }

    return true;
  };

  // 저장 처리
  const handleSave = async () => {
    if (!validateForm() || isLoading) return;

    try {
      setIsLoading(true);
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('시간표 생성 실패:', error);
      alert('시간표 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // ESC 키 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="ctm-modal-overlay" onClick={handleOverlayClick}>
      <div className="ctm-create-timetable-modal" ref={modalRef}>
        {/* 헤더 */}
        <div className="ctm-modal-header">
          <div className="ctm-header-info">
            <h2 className="ctm-modal-title">새 시간표 생성</h2>
            <div className="ctm-student-info">
              <span className="ctm-student-name">{studentName}</span>
            </div>
          </div>
          <button
            className="ctm-close-button"
            onClick={onClose}
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        {/* 진행 단계 */}
        <div className="ctm-progress-steps">
          <div className={`ctm-step ${currentStep >= 1 ? 'completed' : ''} ${currentStep === 1 ? 'current' : ''}`}>
            <div className="ctm-step-icon">1</div>
            <div className="ctm-step-label">기본 정보</div>
          </div>
          <div className={`ctm-step ${currentStep >= 2 ? 'completed' : ''} ${currentStep === 2 ? 'current' : ''}`}>
            <div className="ctm-step-icon">2</div>
            <div className="ctm-step-label">시간 설정</div>
          </div>
          <div className={`ctm-step ${currentStep >= 3 ? 'completed' : ''} ${currentStep === 3 ? 'current' : ''}`}>
            <div className="ctm-step-icon">3</div>
            <div className="ctm-step-label">자동 설정</div>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="ctm-modal-content">
          {/* 1단계: 기본 정보 */}
          {currentStep === 1 && (
            <div className="ctm-form-section">
              <h3 className="ctm-section-title">기본 정보</h3>
              
              <div className="ctm-form-group">
                <label className="ctm-form-label">시간표 이름 *</label>
                <input
                  type="text"
                  className="ctm-form-input"
                  placeholder="예: 2024년 1학기 시간표"
                  value={formData.name}
                  onChange={(e) => updateFormData({ name: e.target.value })}
                />
              </div>

              <div className="ctm-form-group">
                <label className="ctm-form-label">설명</label>
                <textarea
                  className="ctm-form-textarea"
                  placeholder="시간표에 대한 간단한 설명을 입력하세요 (선택사항)"
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* 2단계: 시간 설정 */}
          {currentStep === 2 && (
            <div className="ctm-form-section">
              <h3 className="ctm-section-title">요일별 시간 설정</h3>
              
              <div className="ctm-daily-schedules">
                {DAY_OPTIONS.map((day) => {
                  const schedule = formData.basicSchedule.dailySchedules[day.value];
                  return (
                    <div key={day.value} className="ctm-day-schedule">
                      <div className="ctm-day-header">
                        <div className="ctm-day-toggle">
                          <input
                            type="checkbox"
                            className="ctm-day-checkbox"
                            checked={schedule.isActive}
                            onChange={() => toggleDay(day.value)}
                          />
                          <span className="ctm-day-label">{day.label}</span>
                        </div>
                      </div>
                      
                      {schedule.isActive && (
                        <div className="ctm-day-time-inputs">
                          <div className="ctm-time-input-group">
                            <label className="ctm-form-label">등원 시간</label>
                            <input
                              type="time"
                              value={schedule.arrivalTime}
                              onChange={(e) => updateDaySchedule(day.value, { arrivalTime: e.target.value })}
                            />
                          </div>
                          <div className="ctm-time-input-group">
                            <label className="ctm-form-label">하원 시간</label>
                            <input
                              type="time"
                              value={schedule.departureTime}
                              onChange={(e) => updateDaySchedule(day.value, { departureTime: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* 3단계: 자동 설정 */}
          {currentStep === 3 && (
            <div className="ctm-form-section">
              <h3 className="ctm-section-title">자동 채우기 설정</h3>
              
              <div className="ctm-auto-fill-section">
                <div className="ctm-checkbox-group">
                  <input
                    type="checkbox"
                    className="ctm-checkbox"
                    checked={formData.autoFillSettings.enabled}
                    onChange={(e) => updateAutoFillSettings({ enabled: e.target.checked })}
                  />
                  <label className="ctm-checkbox-label">
                    자동 자습시간 채우기 활성화
                  </label>
                </div>

                {formData.autoFillSettings.enabled && (
                  <div className="ctm-auto-fill-options">
                    <div className="ctm-form-group">
                      <label className="ctm-form-label">기본 자습 과목명</label>
                      <input
                        type="text"
                        className="ctm-form-input"
                        placeholder="자습"
                        value={formData.autoFillSettings.defaultSubject}
                        onChange={(e) => updateAutoFillSettings({ defaultSubject: e.target.value })}
                      />
                    </div>

                    <div className="ctm-checkbox-group">
                      <input
                        type="checkbox"
                        className="ctm-checkbox"
                        checked={formData.autoFillSettings.fillEmptySlots}
                        onChange={(e) => updateAutoFillSettings({ fillEmptySlots: e.target.checked })}
                      />
                      <label className="ctm-checkbox-label">
                        빈 시간대 자동 채우기
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="ctm-modal-footer">
          <button
            className="ctm-btn ctm-btn-secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            취소
          </button>
          
          {currentStep < 3 ? (
            <button
              className="ctm-btn ctm-btn-primary"
              onClick={() => setCurrentStep(prev => prev + 1)}
            >
              다음
            </button>
          ) : (
            <button
              className="ctm-btn ctm-btn-primary"
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? '생성 중...' : '시간표 생성'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateTimetableModal;