/**
 * TimeSlotEditDialog.tsx - 시간 슬롯 편집 다이얼로그
 *
 * Phase 2 구현:
 * - 시간 슬롯 추가/수정/삭제 기능
 * - 간단한 폼 인터페이스
 * - 실시간 검증 및 충돌 확인
 */

import React, { useState, useEffect } from 'react';
import { StudentTimetableData, TimeSlot, TimeSlotType } from '../../../types/student';

interface TimeSlotEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  day: string;
  slot?: TimeSlot;
  timeSlot?: string;
  timetable: StudentTimetableData;
  permissions: {
    canAddSlots: boolean;
    canDeleteSlots: boolean;
    canModifySlots: boolean;
    restrictedTimeSlots?: string[];
  };
  onSave: (updatedTimetable: StudentTimetableData) => void;
}

const TimeSlotEditDialog: React.FC<TimeSlotEditDialogProps> = ({
  isOpen,
  onClose,
  day,
  slot,
  timeSlot,
  timetable,
  permissions,
  onSave
}) => {
  const [formData, setFormData] = useState({
    subject: '',
    startTime: '',
    endTime: '',
    teacher: '',
    location: '',
    type: 'class' as TimeSlotType,
    color: '#2196F3',
    notes: ''
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dayNames: { [key: string]: string } = {
    monday: '월요일',
    tuesday: '화요일',
    wednesday: '수요일',
    thursday: '목요일',
    friday: '금요일',
    saturday: '토요일',
    sunday: '일요일'
  };

  const typeOptions = [
    { value: 'class', label: '정규 수업', color: '#2196F3' },
    { value: 'external', label: '외부 수업', color: '#FF9800' },
    { value: 'self_study', label: '자습', color: '#9E9E9E' }
  ];

  const isEditing = !!slot;

  // 폼 데이터 초기화
  useEffect(() => {
    if (isOpen) {
      if (slot) {
        // 기존 슬롯 편집
        setFormData({
          subject: slot.subject,
          startTime: slot.startTime,
          endTime: slot.endTime,
          teacher: slot.teacher || '',
          location: slot.location || '',
          type: slot.type,
          color: slot.color || '#2196F3',
          notes: slot.notes || ''
        });
      } else if (timeSlot) {
        // 새 슬롯 추가
        const endTime = getNextHourTime(timeSlot);
        setFormData({
          subject: '',
          startTime: timeSlot,
          endTime: endTime,
          teacher: '',
          location: '',
          type: 'class',
          color: '#2196F3',
          notes: ''
        });
      }
      setErrors([]);
    }
  }, [isOpen, slot, timeSlot]);

  // 다음 시간 계산
  const getNextHourTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const nextHour = hours + 1;
    return `${nextHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // 시간을 분으로 변환
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // 입력값 검증
  const validateForm = (): string[] => {
    const newErrors: string[] = [];

    if (!formData.subject.trim()) {
      newErrors.push('과목명을 입력해주세요.');
    }

    if (!formData.startTime) {
      newErrors.push('시작 시간을 선택해주세요.');
    }

    if (!formData.endTime) {
      newErrors.push('종료 시간을 선택해주세요.');
    }

    if (formData.startTime && formData.endTime) {
      const startMinutes = timeToMinutes(formData.startTime);
      const endMinutes = timeToMinutes(formData.endTime);

      if (startMinutes >= endMinutes) {
        newErrors.push('종료 시간은 시작 시간보다 늦어야 합니다.');
      }

      if (endMinutes - startMinutes < 30) {
        newErrors.push('수업 시간은 최소 30분 이상이어야 합니다.');
      }

      // 시간 충돌 확인
      const conflicts = checkTimeConflicts(day, formData.startTime, formData.endTime, slot?.id);
      if (conflicts.length > 0) {
        newErrors.push(`시간이 겹치는 수업이 있습니다: ${conflicts.join(', ')}`);
      }
    }

    return newErrors;
  };

  // 시간 충돌 확인
  const checkTimeConflicts = (targetDay: string, startTime: string, endTime: string, excludeSlotId?: string): string[] => {
    const daySchedule = timetable.detailedSchedule[targetDay];
    if (!daySchedule) return [];

    const conflicts: string[] = [];
    const newStartMinutes = timeToMinutes(startTime);
    const newEndMinutes = timeToMinutes(endTime);

    daySchedule.timeSlots.forEach(existingSlot => {
      if (excludeSlotId && existingSlot.id === excludeSlotId) return;

      const existingStartMinutes = timeToMinutes(existingSlot.startTime);
      const existingEndMinutes = timeToMinutes(existingSlot.endTime);

      // 시간 겹침 확인
      if (
        (newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes)
      ) {
        conflicts.push(existingSlot.subject);
      }
    });

    return conflicts;
  };

  // 폼 입력 핸들러
  const handleInputChange = (field: string, value: string) => {
    // 타입이 변경될 때 색상 자동 업데이트
    if (field === 'type') {
      const typeOption = typeOptions.find(option => option.value === value);
      if (typeOption) {
        setFormData(prev => ({
          ...prev,
          [field]: value as TimeSlotType,
          color: typeOption.color
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [field]: value as TimeSlotType
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  // 저장 핸들러
  const handleSave = async () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors([]);

    try {
      // 더 안전한 깊은 복사로 독립적인 시간표 생성
      const deepClone = (obj: any) => JSON.parse(JSON.stringify(obj));
      const newTimetable = deepClone(timetable);

      // 요일 스케줄이 존재하지 않는 경우 초기화
      if (!newTimetable.detailedSchedule[day]) {
        newTimetable.detailedSchedule[day] = { timeSlots: [] };
      }

      if (isEditing && slot) {
        // 기존 슬롯 수정
        const slotIndex = newTimetable.detailedSchedule[day].timeSlots.findIndex((s: TimeSlot) => s.id === slot.id);
        if (slotIndex !== -1) {
          newTimetable.detailedSchedule[day].timeSlots[slotIndex] = {
            id: slot.id, // ID는 기존 slot에서 가져와 유지
            isAutoGenerated: slot.isAutoGenerated || false, // isAutoGenerated 값도 유지

            // 나머지 모든 데이터는 'formData' 상태에서 가져옴
            subject: formData.subject.trim(),
            startTime: formData.startTime,
            endTime: formData.endTime,
            teacher: formData.teacher.trim() || undefined,
            location: formData.location.trim() || undefined,
            type: formData.type,
            color: formData.color,
            notes: formData.notes.trim() || undefined
          };
        }
      } else {
        // 새 슬롯 추가
        const newSlot: TimeSlot = {
          id: `slot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          subject: formData.subject.trim(),
          startTime: formData.startTime,
          endTime: formData.endTime,
          teacher: formData.teacher.trim() || undefined,
          location: formData.location.trim() || undefined,
          type: formData.type,
          color: formData.color,
          notes: formData.notes.trim() || undefined,
          isAutoGenerated: false
        };

        newTimetable.detailedSchedule[day].timeSlots.push(newSlot);
      }

          // 시간순으로 정렬
          newTimetable.detailedSchedule[day].timeSlots.sort((a: TimeSlot, b: TimeSlot) =>
            a.startTime.localeCompare(b.startTime)
          );

          // ✅ 누락 방지 코드 추가
          // 만약 복제된 객체에 autofilledsetting이 없다면, 원본에서 직접 복사해줍니다.
          if (timetable.autoFillSettings && !newTimetable.autoFillSettings) {
            newTimetable.autoFillSettings = timetable.autoFillSettings;
          }

          onSave(newTimetable);
          onClose();
    } catch (error) {
      console.error('저장 실패:', error);
      setErrors(['저장 중 오류가 발생했습니다.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 삭제 핸들러
  const handleDelete = () => {
    if (!isEditing || !slot || !permissions.canDeleteSlots) return;

    if (window.confirm('이 시간 슬롯을 삭제하시겠습니까?')) {
      // 더 안전한 깊은 복사로 독립적인 시간표 생성
      const deepClone = (obj: any) => JSON.parse(JSON.stringify(obj));
      const newTimetable = deepClone(timetable);
      if (newTimetable.detailedSchedule[day]) {
        newTimetable.detailedSchedule[day].timeSlots =
          newTimetable.detailedSchedule[day].timeSlots.filter((s: TimeSlot) => s.id !== slot.id);
        onSave(newTimetable);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="tsed-overlay" onClick={onClose}>
      <div className="tsed-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="tsed-header">
          <h2>
            {isEditing ? '시간 슬롯 수정' : '새 시간 슬롯 추가'}
          </h2>
          <p className="tsed-day-info">{dayNames[day]}</p>
          <button className="tsed-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="tsed-content">
          {errors.length > 0 && (
            <div className="tsed-errors">
              {errors.map((error, index) => (
                <div key={index} className="tsed-error-item">
                  ⚠️ {error}
                </div>
              ))}
            </div>
          )}

          <div className="tsed-form">
            {/* 과목명 */}
            <div className="tsed-form-group">
              <label>과목명 *</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                placeholder="과목명을 입력하세요"
                className="tsed-input"
              />
            </div>

            {/* 시간 */}
            <div className="tsed-form-row">
              <div className="tsed-form-group">
                <label>시작 시간 *</label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => handleInputChange('startTime', e.target.value)}
                  className="tsed-input"
                  min="09:00"
                  max="23:30"
                />
              </div>
              <div className="tsed-form-group">
                <label>종료 시간 *</label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => handleInputChange('endTime', e.target.value)}
                  className="tsed-input"
                  min="09:30"
                  max="24:00"
                />
              </div>
            </div>

            {/* 수업 유형 */}
            <div className="tsed-form-group">
              <label>수업 유형</label>
              <select
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className="tsed-select"
              >
                {typeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 강사 */}
            <div className="tsed-form-group">
              <label>강사</label>
              <input
                type="text"
                value={formData.teacher}
                onChange={(e) => handleInputChange('teacher', e.target.value)}
                placeholder="강사명을 입력하세요"
                className="tsed-input"
              />
            </div>

            {/* 장소 */}
            <div className="tsed-form-group">
              <label>장소</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="장소를 입력하세요"
                className="tsed-input"
              />
            </div>

            {/* 색상 */}
            <div className="tsed-form-group">
              <label>색상</label>
              <div className="tsed-color-input-wrapper">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => handleInputChange('color', e.target.value)}
                  className="tsed-color-input"
                />
                <span className="tsed-color-preview" style={{ backgroundColor: formData.color }}></span>
              </div>
            </div>

            {/* 메모 */}
            <div className="tsed-form-group">
              <label>메모</label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="추가 메모를 입력하세요"
                className="tsed-textarea"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="tsed-footer">
          <div className="tsed-footer-left">
            {isEditing && permissions.canDeleteSlots && (
              <button
                className="tsed-btn-delete"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                🗑️ 삭제
              </button>
            )}
          </div>
          <div className="tsed-footer-right">
            <button
              className="tsed-btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              className="tsed-btn-save"
              onClick={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? '저장 중...' : isEditing ? '수정' : '추가'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeSlotEditDialog;