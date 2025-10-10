import React, { useState, useEffect } from 'react';
import { StudentAttendanceRecord, AttendanceStatus } from '../../../types/attendance';
import { Student } from '../../../types/student';
import './AttendanceRecordDetailModal.css';

interface AttendanceRecordDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (data: {
    recordId: string;
    status: AttendanceStatus;
    note?: string;
    isExcused?: boolean;
    isLate?: boolean;
    isEarlyLeave?: boolean;
  }) => Promise<void>;
  record: StudentAttendanceRecord | null;
  student: Student | null;
}

export const AttendanceRecordDetailModal: React.FC<AttendanceRecordDetailModalProps> = ({
  isOpen,
  onClose,
  onUpdateStatus,
  record,
  student
}) => {
  const [status, setStatus] = useState<AttendanceStatus>('checked_in');
  const [note, setNote] = useState('');
  const [isExcused, setIsExcused] = useState(false);
  const [isLate, setIsLate] = useState(false);
  const [isEarlyLeave, setIsEarlyLeave] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 모달 열릴 때 기존 데이터로 초기화
  useEffect(() => {
    if (isOpen && record) {
      setStatus(record.status);
      setNote(record.note || '');
      setIsExcused(record.isExcused || false);
      setIsLate(record.isLate || false);
      setIsEarlyLeave(record.isEarlyLeave || false);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, record]);

  const handleSubmit = async () => {
    if (!record) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await onUpdateStatus({
        recordId: record.id,
        status,
        note: note.trim() || undefined,
        isExcused,
        isLate,
        isEarlyLeave
      });

      setSuccess('출석 상태가 변경되었습니다.');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || '상태 변경에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const formatDateTime = (date: Date | null | undefined) => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (date: Date | null | undefined) => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen || !record || !student) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content modal-content--detail" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="modal-header">
          <h2 className="modal-title">출석 상세 정보</h2>
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
          <div className="detail-section">
            <h3 className="detail-section__title">학생 정보</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-item__label">이름:</span>
                <span className="info-item__value">{student.name}</span>
              </div>
              <div className="info-item">
                <span className="info-item__label">학년:</span>
                <span className="info-item__value">{student.grade}</span>
              </div>
              <div className="info-item">
                <span className="info-item__label">좌석:</span>
                <span className="info-item__value">{record.seatNumber}</span>
              </div>
              <div className="info-item">
                <span className="info-item__label">날짜:</span>
                <span className="info-item__value">
                  {formatDateTime(record.date)}
                </span>
              </div>
            </div>
          </div>

          {/* 출석 시간 정보 */}
          <div className="detail-section">
            <h3 className="detail-section__title">출석 시간</h3>
            <div className="time-grid">
              <div className="time-card">
                <div className="time-card__label">등원 시간</div>
                <div className="time-card__value">
                  {formatTime(record.checkInTime)}
                </div>
              </div>
              <div className="time-card">
                <div className="time-card__label">하원 시간</div>
                <div className="time-card__value">
                  {formatTime(record.checkOutTime)}
                </div>
              </div>
            </div>
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

          {/* 상태 변경 폼 */}
          <div className="detail-section">
            <h3 className="detail-section__title">상태 변경</h3>

            {/* 출석 상태 선택 */}
            <div className="form-group">
              <label className="form-label">출석 상태</label>
              <div className="status-buttons">
                <button
                  type="button"
                  className={`status-button ${status === 'checked_in' ? 'status-button--active status-button--checked-in' : ''}`}
                  onClick={() => setStatus('checked_in')}
                >
                  등원
                </button>
                <button
                  type="button"
                  className={`status-button ${status === 'checked_out' ? 'status-button--active status-button--checked-out' : ''}`}
                  onClick={() => setStatus('checked_out')}
                >
                  하원
                </button>
                <button
                  type="button"
                  className={`status-button ${status === 'absent' ? 'status-button--active status-button--absent' : ''}`}
                  onClick={() => setStatus('absent')}
                >
                  결석
                </button>
              </div>
            </div>

            {/* 특이사항 체크박스 */}
            <div className="form-group">
              <label className="form-label">특이사항</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isLate}
                    onChange={(e) => setIsLate(e.target.checked)}
                    className="checkbox-input"
                  />
                  <span className="checkbox-text">지각</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isEarlyLeave}
                    onChange={(e) => setIsEarlyLeave(e.target.checked)}
                    className="checkbox-input"
                  />
                  <span className="checkbox-text">조퇴</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isExcused}
                    onChange={(e) => setIsExcused(e.target.checked)}
                    className="checkbox-input"
                  />
                  <span className="checkbox-text">사유결석</span>
                </label>
              </div>
            </div>

            {/* 사유/메모 입력 */}
            <div className="form-group">
              <label className="form-label">사유/메모</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="출석 상태 변경 사유나 메모를 입력하세요..."
                className="form-textarea"
                rows={3}
              />
            </div>
          </div>

          {/* 기록 메타 정보 */}
          <div className="detail-section detail-section--meta">
            <div className="meta-info">
              <span className="meta-info__label">생성 방법:</span>
              <span className="meta-info__value">
                {record.createdBy === 'qr' ? 'QR 체크' :
                 record.createdBy === 'pin' ? 'PIN 입력' :
                 record.createdBy === 'manual' ? '수동 등록' : '자동'}
              </span>
            </div>
            {record.updatedAt && (
              <div className="meta-info">
                <span className="meta-info__label">마지막 수정:</span>
                <span className="meta-info__value">
                  {formatDateTime(record.updatedAt)}
                </span>
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
            disabled={isSubmitting}
          >
            {isSubmitting ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceRecordDetailModal;
