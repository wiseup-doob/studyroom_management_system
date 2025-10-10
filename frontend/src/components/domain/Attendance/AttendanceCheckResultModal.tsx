import React, { useEffect } from 'react';
import './AttendanceCheckResultModal.css';

interface AttendanceCheckResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: {
    success: boolean;
    action?: 'checked_in' | 'checked_out';
    message: string;
    studentName?: string;
    timestamp?: Date;
    isLate?: boolean;
    lateMinutes?: number;
    isEarlyLeave?: boolean;
    earlyLeaveMinutes?: number;
  } | null;
}

const AttendanceCheckResultModal: React.FC<AttendanceCheckResultModalProps> = ({
  isOpen,
  onClose,
  result
}) => {
  // 3초 후 자동 닫힘
  useEffect(() => {
    if (isOpen && result) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, result, onClose]);

  if (!isOpen || !result) return null;

  const formatTime = (date: Date | undefined) => {
    if (!date) return '';
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content ${result.success ? 'modal-content--success' : 'modal-content--error'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {result.success ? (
          // 성공 모달
          <div className="modal-success">
            <div className="modal-icon modal-icon--success">
              {result.action === 'checked_in' ? '✅' : '👋'}
            </div>

            <div className="modal-title">
              {result.action === 'checked_in' ? '등원 완료' : '하원 완료'}
            </div>

            {result.studentName && (
              <div className="modal-student-name">
                {result.studentName}
              </div>
            )}

            <div className="modal-time">
              {formatTime(result.timestamp)}
            </div>

            {result.message && (
              <div className="modal-message">
                {result.message}
              </div>
            )}

            {/* 지각 뱃지 */}
            {result.isLate && (
              <div className="modal-badge modal-badge--late">
                <span className="badge-icon">⏰</span>
                <span className="badge-text">
                  지각 ({result.lateMinutes}분)
                </span>
              </div>
            )}

            {/* 조퇴 뱃지 */}
            {result.isEarlyLeave && (
              <div className="modal-badge modal-badge--early">
                <span className="badge-icon">🏃</span>
                <span className="badge-text">
                  조퇴 ({result.earlyLeaveMinutes}분)
                </span>
              </div>
            )}

            <div className="modal-auto-close">
              3초 후 자동으로 닫힙니다
            </div>

            <button
              type="button"
              onClick={onClose}
              className="modal-button modal-button--success"
            >
              확인
            </button>
          </div>
        ) : (
          // 실패 모달
          <div className="modal-error">
            <div className="modal-icon modal-icon--error">
              ❌
            </div>

            <div className="modal-title modal-title--error">
              출석 체크 실패
            </div>

            <div className="modal-message modal-message--error">
              {result.message}
            </div>

            <div className="modal-auto-close">
              3초 후 자동으로 닫힙니다
            </div>

            <button
              type="button"
              onClick={onClose}
              className="modal-button modal-button--error"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceCheckResultModal;
