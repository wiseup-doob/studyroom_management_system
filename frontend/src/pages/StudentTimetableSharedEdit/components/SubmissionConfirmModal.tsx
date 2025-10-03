/**
 * SubmissionConfirmModal.tsx - 제출 확인 모달
 *
 * Phase 2 구현:
 * - 변경사항 요약 표시
 * - 제출 확인 및 메모 입력
 * - 최종 제출 처리
 */

import React, { useState } from 'react';
import { StudentWithTimetable, StudentTimetableData, TimeSlot } from '../../../types/student';

interface SubmissionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (submissionNotes?: string) => void;
  student: StudentWithTimetable;
  timetable: StudentTimetableData;
  changes: {
    modifiedSlots: string[];
    addedSlots: TimeSlot[];
    deletedSlots: string[];
  };
  isSubmitting: boolean;
}

const SubmissionConfirmModal: React.FC<SubmissionConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  student,
  timetable,
  changes,
  isSubmitting
}) => {
  const [submissionNotes, setSubmissionNotes] = useState('');

  const dayNames: { [key: string]: string } = {
    monday: '월요일',
    tuesday: '화요일',
    wednesday: '수요일',
    thursday: '목요일',
    friday: '금요일',
    saturday: '토요일',
    sunday: '일요일'
  };

  // 변경 사항 개수 계산
  const totalChanges = changes.addedSlots.length + changes.modifiedSlots.length + changes.deletedSlots.length;

  // 추가된 슬롯을 요일별로 그룹핑
  const getSlotsByDay = (slots: TimeSlot[]): { [day: string]: TimeSlot[] } => {
    const groupedSlots: { [day: string]: TimeSlot[] } = {};

    Object.keys(timetable.detailedSchedule).forEach(day => {
      const daySlots = slots.filter(slot => {
        return timetable.detailedSchedule[day]?.timeSlots.some(s => s.id === slot.id);
      });
      if (daySlots.length > 0) {
        groupedSlots[day] = daySlots;
      }
    });

    return groupedSlots;
  };

  // 삭제된 슬롯 정보 조회
  const getDeletedSlotInfo = (slotId: string): { day: string; slot: TimeSlot } | null => {
    for (const [day, daySchedule] of Object.entries(timetable.detailedSchedule)) {
      if (daySchedule?.timeSlots) {
        const slot = daySchedule.timeSlots.find(s => s.id === slotId);
        if (slot) {
          return { day, slot };
        }
      }
    }
    return null;
  };

  // 수정된 슬롯 정보 조회
  const getModifiedSlotInfo = (slotId: string): { day: string; slot: TimeSlot } | null => {
    for (const [day, daySchedule] of Object.entries(timetable.detailedSchedule)) {
      if (daySchedule?.timeSlots) {
        const slot = daySchedule.timeSlots.find(s => s.id === slotId);
        if (slot) {
          return { day, slot };
        }
      }
    }
    return null;
  };

  const handleConfirm = () => {
    onConfirm(submissionNotes.trim() || undefined);
  };

  if (!isOpen) return null;

  return (
    <div className="scm-overlay" onClick={onClose}>
      <div className="scm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="scm-header">
          <h2>시간표 변경사항 제출</h2>
          <button className="scm-close-btn" onClick={onClose} disabled={isSubmitting}>
            ×
          </button>
        </div>

        <div className="scm-content">
          {/* 학생 정보 */}
          <div className="scm-student-info">
            <h3>{student.name}</h3>
            <p>{student.grade} • {timetable.name}</p>
          </div>

          {/* 변경사항 요약 */}
          <div className="scm-summary">
            <div className="scm-summary-header">
              <h4>변경사항 요약</h4>
              <span className="scm-change-count">{totalChanges}개 항목</span>
            </div>

            <div className="scm-changes-list">
              {/* 추가된 슬롯 */}
              {changes.addedSlots.length > 0 && (
                <div className="scm-change-group">
                  <h5 className="scm-change-title">
                    <span className="scm-change-icon scm-added">➕</span>
                    추가된 수업 ({changes.addedSlots.length}개)
                  </h5>
                  <div className="scm-change-items">
                    {changes.addedSlots.map((slot, index) => (
                      <div key={index} className="scm-change-item scm-item-added">
                        <div className="scm-slot-info">
                          {slot.type !== 'self_study' && (
                            <span className="scm-slot-subject">{slot.subject}</span>
                          )}
                          <span className="scm-slot-time">
                            {slot.startTime} - {slot.endTime}
                          </span>
                          {slot.teacher && (
                            <span className="scm-slot-teacher">강사: {slot.teacher}</span>
                          )}
                          {slot.location && (
                            <span className="scm-slot-location">장소: {slot.location}</span>
                          )}
                        </div>
                        <div className="scm-slot-type">
                          {slot.type === 'class' ? '수업' :
                           slot.type === 'self_study' ? '자습' : '외부수업'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 수정된 슬롯 */}
              {changes.modifiedSlots.length > 0 && (
                <div className="scm-change-group">
                  <h5 className="scm-change-title">
                    <span className="scm-change-icon scm-modified">✏️</span>
                    수정된 수업 ({changes.modifiedSlots.length}개)
                  </h5>
                  <div className="scm-change-items">
                    {changes.modifiedSlots.map(slotId => {
                      const slotInfo = getModifiedSlotInfo(slotId);
                      if (!slotInfo) return null;

                      const { day, slot } = slotInfo;
                      return (
                        <div key={slotId} className="scm-change-item scm-item-modified">
                          <div className="scm-slot-info">
                            <span className="scm-slot-subject">{slot.subject}</span>
                            <span className="scm-slot-day">{dayNames[day]}</span>
                            <span className="scm-slot-time">
                              {slot.startTime} - {slot.endTime}
                            </span>
                          </div>
                          <div className="scm-slot-type">
                            {slot.type === 'class' ? '수업' :
                             slot.type === 'self_study' ? '자습' : '외부수업'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 삭제된 슬롯 */}
              {changes.deletedSlots.length > 0 && (
                <div className="scm-change-group">
                  <h5 className="scm-change-title">
                    <span className="scm-change-icon scm-deleted">🗑️</span>
                    삭제된 수업 ({changes.deletedSlots.length}개)
                  </h5>
                  <div className="scm-change-items">
                    {changes.deletedSlots.map(slotId => {
                      const slotInfo = getDeletedSlotInfo(slotId);
                      if (!slotInfo) return null;

                      const { day, slot } = slotInfo;
                      return (
                        <div key={slotId} className="scm-change-item scm-item-deleted">
                          <div className="scm-slot-info">
                            <span className="scm-slot-subject">{slot.subject}</span>
                            <span className="scm-slot-day">{dayNames[day]}</span>
                            <span className="scm-slot-time">
                              {slot.startTime} - {slot.endTime}
                            </span>
                          </div>
                          <div className="scm-slot-type">
                            {slot.type === 'class' ? '수업' :
                             slot.type === 'self_study' ? '자습' : '외부수업'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 제출 메모 */}
          <div className="scm-notes-section">
            <label htmlFor="submissionNotes" className="scm-notes-label">
              변경 사유 및 요청사항 (선택사항)
            </label>
            <textarea
              id="submissionNotes"
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              placeholder="변경 사유나 관리자에게 전달할 메시지를 입력하세요..."
              className="scm-notes-textarea"
              rows={4}
              disabled={isSubmitting}
            />
          </div>

          {/* 안내 메시지 */}
          <div className="scm-notice">
            <div className="scm-notice-icon">ℹ️</div>
            <div className="scm-notice-content">
              <p><strong>제출 후 처리 과정:</strong></p>
              <ol>
                <li>관리자가 변경사항을 검토합니다</li>
                <li>승인되면 시간표에 자동으로 반영됩니다</li>
                <li>거부되면 사유와 함께 알림을 받게 됩니다</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="scm-footer">
          <button
            className="scm-btn-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            className="scm-btn-submit"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="scm-spinner"></span>
                제출 중...
              </>
            ) : (
              <>
                <span className="scm-submit-icon">📤</span>
                제출하기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubmissionConfirmModal;