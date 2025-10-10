import React, { useState, useEffect } from 'react';
import { Student } from '../../../types/student';
import { SeatAssignment } from '../../../types/attendance';
import './ManagePinModal.css';

interface ManagePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGeneratePin: (studentId: string) => Promise<string>;
  onUpdatePin: (studentId: string, newPin: string) => Promise<void>;
  onUnlockPin: (studentId: string, unlockPin: string) => Promise<void>;
  student: Student | null;
  assignment: SeatAssignment | null;
}

type PinAction = 'generate' | 'change' | 'unlock';

export const ManagePinModal: React.FC<ManagePinModalProps> = ({
  isOpen,
  onClose,
  onGeneratePin,
  onUpdatePin,
  onUnlockPin,
  student,
  assignment
}) => {
  const [action, setAction] = useState<PinAction>('generate');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [unlockPin, setUnlockPin] = useState('');
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 모달이 열릴 때마다 초기화
  useEffect(() => {
    if (isOpen) {
      resetForm();
      // PIN이 있으면 변경/잠금해제, 없으면 생성
      if (assignment?.pin) {
        setAction(assignment.isPinLocked ? 'unlock' : 'change');
      } else {
        setAction('generate');
      }
    }
  }, [isOpen, assignment]);

  const resetForm = () => {
    setNewPin('');
    setConfirmPin('');
    setUnlockPin('');
    setGeneratedPin(null);
    setError(null);
    setSuccess(null);
  };

  const validatePin = (pin: string): boolean => {
    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN은 4~6자리 숫자여야 합니다.');
      return false;
    }
    return true;
  };

  const handleGeneratePin = async () => {
    if (!student) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const pin = await onGeneratePin(student.id);
      setGeneratedPin(pin);
      setSuccess(`PIN이 생성되었습니다: ${pin}`);
    } catch (err: any) {
      setError(err.message || 'PIN 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePin = async () => {
    if (!student) return;

    if (!validatePin(newPin)) return;

    if (newPin !== confirmPin) {
      setError('PIN이 일치하지 않습니다.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await onUpdatePin(student.id, newPin);
      setSuccess('PIN이 변경되었습니다.');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'PIN 변경에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlockPin = async () => {
    if (!student) return;

    if (!validatePin(unlockPin)) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await onUnlockPin(student.id, unlockPin);
      setSuccess('PIN 잠금이 해제되었습니다.');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'PIN 잠금 해제에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    switch (action) {
      case 'generate':
        handleGeneratePin();
        break;
      case 'change':
        handleChangePin();
        break;
      case 'unlock':
        handleUnlockPin();
        break;
    }
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  if (!isOpen || !student) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content modal-content--pin" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="modal-header">
          <h2 className="modal-title">PIN 관리</h2>
          <button
            type="button"
            onClick={handleCancel}
            className="modal-close"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 바디 */}
        <div className="modal-body">
          {/* 학생 정보 */}
          <div className="student-info-card">
            <div className="student-info-card__name">{student.name}</div>
            <div className="student-info-card__details">
              {student.grade} · {assignment?.seatNumber && `좌석 ${assignment.seatNumber}`}
            </div>
            {assignment?.pin && (
              <div className="student-info-card__pin-status">
                {assignment.isPinLocked ? (
                  <span className="status-badge status-badge--locked">🔒 잠김</span>
                ) : (
                  <span className="status-badge status-badge--active">🔓 활성</span>
                )}
              </div>
            )}
          </div>

          {/* 액션 선택 탭 */}
          <div className="action-tabs">
            {!assignment?.pin && (
              <button
                type="button"
                className={`action-tab ${action === 'generate' ? 'action-tab--active' : ''}`}
                onClick={() => setAction('generate')}
              >
                🔑 PIN 생성
              </button>
            )}
            {assignment?.pin && !assignment.isPinLocked && (
              <button
                type="button"
                className={`action-tab ${action === 'change' ? 'action-tab--active' : ''}`}
                onClick={() => setAction('change')}
              >
                🔄 PIN 변경
              </button>
            )}
            {assignment?.pin && assignment.isPinLocked && (
              <button
                type="button"
                className={`action-tab ${action === 'unlock' ? 'action-tab--active' : ''}`}
                onClick={() => setAction('unlock')}
              >
                🔓 잠금 해제
              </button>
            )}
          </div>

          {/* 성공/에러 메시지 */}
          {success && (
            <div className="success-message">
              <span className="success-message__icon">✅</span>
              <span className="success-message__text">{success}</span>
            </div>
          )}
          {error && (
            <div className="error-message">
              <span className="error-message__icon">⚠️</span>
              <span className="error-message__text">{error}</span>
            </div>
          )}

          {/* 액션별 폼 */}
          <div className="pin-form">
            {action === 'generate' && (
              <div className="pin-form__section">
                <p className="pin-form__description">
                  자동으로 안전한 6자리 PIN을 생성합니다.
                  학생이 출석 체크에 사용할 수 있습니다.
                </p>
                {generatedPin && (
                  <div className="generated-pin-display">
                    <div className="generated-pin-display__label">생성된 PIN</div>
                    <div className="generated-pin-display__value">{generatedPin}</div>
                    <div className="generated-pin-display__hint">
                      이 PIN을 학생에게 안전하게 전달하세요
                    </div>
                  </div>
                )}
              </div>
            )}

            {action === 'change' && (
              <div className="pin-form__section">
                <div className="form-group">
                  <label className="form-label">새 PIN (4~6자리 숫자)</label>
                  <input
                    type="password"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="새 PIN 입력"
                    className="form-input"
                    maxLength={6}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">PIN 확인</label>
                  <input
                    type="password"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="PIN 재입력"
                    className="form-input"
                    maxLength={6}
                  />
                </div>
              </div>
            )}

            {action === 'unlock' && (
              <div className="pin-form__section">
                <p className="pin-form__description">
                  잠긴 PIN을 해제하려면 현재 PIN을 입력하세요.
                </p>
                <div className="form-group">
                  <label className="form-label">현재 PIN</label>
                  <input
                    type="password"
                    value={unlockPin}
                    onChange={(e) => setUnlockPin(e.target.value)}
                    placeholder="현재 PIN 입력"
                    className="form-input"
                    maxLength={6}
                  />
                </div>
                <div className="pin-form__hint">
                  💡 PIN 잠금은 3회 이상 틀렸을 때 자동으로 활성화됩니다
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="modal-footer">
          <button
            type="button"
            onClick={handleCancel}
            className="btn btn--secondary"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn btn--primary"
            disabled={isSubmitting || (generatedPin !== null && action === 'generate')}
          >
            {isSubmitting ? '처리 중...' :
              action === 'generate' ? 'PIN 생성' :
              action === 'change' ? 'PIN 변경' :
              '잠금 해제'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManagePinModal;
