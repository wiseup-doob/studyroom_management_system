/**
 * TimeSlotEditModal.tsx - 시간표 편집 모달 (2단 레이아웃)
 * 
 * 왼쪽: 기존 수업 목록 (삭제 기능 포함)
 * 오른쪽: 새 수업 추가 폼
 */

import React, { useState, useEffect } from 'react';
import { TimeSlot, TimeSlotType, StudentTimetableData } from '../../../types/student';
import './TimeSlotEditModal.css';

interface TimeSlotEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddClass: (classData: {
    day: string;
    startTime: string;
    endTime: string;
    subject: string;
    teacher?: string;
    location?: string;
    type: TimeSlotType;
    color: string;
    notes?: string;
  }) => Promise<void>;
  onDeleteClass: (day: string, slotId: string) => Promise<void>;
  timetable: StudentTimetableData;
}



const TimeSlotEditModal: React.FC<TimeSlotEditModalProps> = ({
  isOpen,
  onClose,
  onAddClass,
  onDeleteClass,
  timetable
}) => {
  // 새 수업 추가 폼 상태
  const [formData, setFormData] = useState({
    day: 'monday',
    startTime: '09:00',
    endTime: '10:00',
    subject: '',
    teacher: '',
    location: '',
    type: 'class' as TimeSlotType,
    color: '#2196F3',
    notes: ''
  });

  // 로딩 및 에러 상태
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 요일 이름 매핑
  const dayNames = {
    monday: '월요일',
    tuesday: '화요일',
    wednesday: '수요일',
    thursday: '목요일',
    friday: '금요일',
    saturday: '토요일',
    sunday: '일요일'
  };

  // 모든 수업 목록 가져오기
  const getAllTimeSlots = (): Array<TimeSlot & { day: string; dayName: string }> => {
    const allSlots: Array<TimeSlot & { day: string; dayName: string }> = [];
    
    Object.entries(timetable.detailedSchedule).forEach(([day, daySchedule]) => {
      // daySchedule이 존재하고 timeSlots가 있는 경우만 처리
      if (daySchedule && daySchedule.timeSlots) {
        daySchedule.timeSlots.forEach(slot => {
          allSlots.push({
            ...slot,
            day,
            dayName: dayNames[day as keyof typeof dayNames]
          });
        });
      }
    });
    
    return allSlots.sort((a, b) => {
      if (a.day !== b.day) {
        const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
      }
      return a.startTime.localeCompare(b.startTime);
    });
  };

  // 폼 데이터 초기화
  useEffect(() => {
    if (isOpen) {
      setFormData({
        day: 'monday',
        startTime: '09:00',
        endTime: '10:00',
        subject: '',
        teacher: '',
        location: '',
        type: 'class',
        color: '#2196F3',
        notes: ''
      });
    }
  }, [isOpen]);

  // 폼 입력 핸들러
  const handleInputChange = (field: string, value: string) => {
    if (field === 'color') {
      console.log('Color changed to:', value);
    }
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 새 수업 추가
  const handleAddClass = async () => {
    if (!formData.subject.trim()) {
      setError('수업명을 입력해주세요.');
      return;
    }

    if (!formData.startTime || !formData.endTime) {
      setError('시작 시간과 끝 시간을 입력해주세요.');
      return;
    }

    if (formData.startTime >= formData.endTime) {
      setError('끝 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 시간 충돌 검사
      const daySchedule = timetable.detailedSchedule[formData.day];
      if (daySchedule) {
        const hasConflict = daySchedule.timeSlots.some(slot => 
          (formData.startTime < slot.endTime && formData.endTime > slot.startTime)
        );

        if (hasConflict) {
          setError('선택한 시간대에 이미 수업이 있습니다.');
          return;
        }
      }

      // 부모 컴포넌트의 콜백 호출
      await onAddClass({
        day: formData.day,
        startTime: formData.startTime,
        endTime: formData.endTime,
        subject: formData.subject,
        teacher: formData.teacher,
        location: formData.location,
        type: formData.type,
        color: formData.color,
        notes: formData.notes
      });

      // 폼 초기화
      setFormData(prev => ({
        ...prev,
        subject: '',
        teacher: '',
        location: '',
        notes: ''
      }));
    } catch (error) {
      console.error('수업 추가 실패:', error);
      setError('수업 추가에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 수업 삭제
  const handleDeleteClass = async (day: string, slotId: string) => {
    if (!confirm('정말로 이 수업을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 부모 컴포넌트의 콜백 호출
      await onDeleteClass(day, slotId);
    } catch (error) {
      console.error('수업 삭제 실패:', error);
      setError('수업 삭제에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 시간 옵션 생성
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();
  const allTimeSlots = getAllTimeSlots();

  if (!isOpen) return null;

  return (
    <div className="tsem-modal-overlay" onClick={onClose}>
      <div className="tsem-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tsem-modal-header">
          <h2>시간표 편집</h2>
          <button className="tsem-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="tsem-modal-content">
          {/* 왼쪽: 기존 수업 목록 */}
          <div className="tsem-left-panel">
            <h3>기존 수업 목록</h3>
            <div className="tsem-class-list">
              {allTimeSlots.length === 0 ? (
                <div className="tsem-empty-list">
                  <p>등록된 수업이 없습니다.</p>
                </div>
              ) : (
                allTimeSlots.map((slot) => (
                  <div key={`${slot.day}-${slot.id}`} className="tsem-class-item">
                    <div className="tsem-class-info">
                      <div className="tsem-class-header">
                        <span className="tsem-class-subject">{slot.subject}</span>
                        <span className="tsem-class-type">
                          {slot.type === 'class' ? '수업' : 
                           slot.type === 'self_study' ? '자습' : '외부수업'}
                        </span>
                      </div>
                      <div className="tsem-class-details">
                        <span className="tsem-class-day">{slot.dayName}</span>
                        <span className="tsem-class-time">
                          {slot.startTime} - {slot.endTime}
                        </span>
                      </div>
                      {slot.teacher && (
                        <div className="tsem-class-teacher">강사: {slot.teacher}</div>
                      )}
                      {slot.location && (
                        <div className="tsem-class-location">장소: {slot.location}</div>
                      )}
                    </div>
                    <button
                      className="tsem-delete-btn"
                      onClick={() => handleDeleteClass(slot.day, slot.id)}
                      title="삭제"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 오른쪽: 새 수업 추가 */}
          <div className="tsem-right-panel">
            <h3>새 수업 추가</h3>
            
            {/* 에러 메시지 */}
            {error && (
              <div className="tsem-error-message">
                {error}
              </div>
            )}
            
            <div className="tsem-form">
              <div className="tsem-form-row">
                <div className="tsem-form-group">
                  <label>요일</label>
                  <select
                    value={formData.day}
                    onChange={(e) => handleInputChange('day', e.target.value)}
                  >
                    {Object.entries(dayNames).map(([key, name]) => (
                      <option key={key} value={key}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="tsem-form-row">
                <div className="tsem-form-group">
                  <label>시작 시간</label>
                  <select
                    value={formData.startTime}
                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                  >
                    {timeOptions.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                <div className="tsem-form-group">
                  <label>끝 시간</label>
                  <select
                    value={formData.endTime}
                    onChange={(e) => handleInputChange('endTime', e.target.value)}
                  >
                    {timeOptions.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="tsem-form-row">
                <div className="tsem-form-group">
                  <label>수업명 *</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => handleInputChange('subject', e.target.value)}
                    placeholder="수업명을 입력하세요"
                  />
                </div>
                <div className="tsem-form-group">
                  <label>속성</label>
                  <select
                    value={formData.type}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                  >
                    <option value="class">수업</option>
                    <option value="self_study">자습</option>
                    <option value="external">외부수업</option>
                  </select>
                </div>
              </div>

              <div className="tsem-form-row">
                <div className="tsem-form-group">
                  <label>강사</label>
                  <input
                    type="text"
                    value={formData.teacher}
                    onChange={(e) => handleInputChange('teacher', e.target.value)}
                    placeholder="강사명 (선택사항)"
                  />
                </div>
                <div className="tsem-form-group">
                  <label>장소</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="장소 (선택사항)"
                  />
                </div>
              </div>

              <div className="tsem-form-group">
                <label>색상</label>
                <div className="tsem-color-input-wrapper">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => handleInputChange('color', e.target.value)}
                    className="tsem-color-input"
                  />
                  <span className="tsem-color-preview" style={{ backgroundColor: formData.color }}></span>
                </div>
              </div>

              <div className="tsem-form-group">
                <label>메모</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="메모 (선택사항)"
                  rows={3}
                />
              </div>

              <div className="tsem-form-actions">
                <button
                  className="tsem-save-btn"
                  onClick={handleAddClass}
                  disabled={isLoading}
                >
                  {isLoading ? '저장 중...' : '수업 추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeSlotEditModal;