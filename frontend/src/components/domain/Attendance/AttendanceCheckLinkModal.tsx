import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AttendanceCheckLink, CreateAttendanceCheckLinkData } from '../../../types/attendance';
import './AttendanceCheckLinkModal.css';

interface AttendanceCheckLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateLink: (data: CreateAttendanceCheckLinkData) => Promise<AttendanceCheckLink>;
  onToggleLink: (linkId: string, isActive: boolean) => Promise<void>;
  onDeleteLink: (linkId: string) => Promise<void>;
  links: AttendanceCheckLink[];
  seatLayoutId: string | null;
}

export const AttendanceCheckLinkModal: React.FC<AttendanceCheckLinkModalProps> = ({
  isOpen,
  onClose,
  onCreateLink,
  onToggleLink,
  onDeleteLink,
  links,
  seatLayoutId
}) => {
  const [linkName, setLinkName] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [showQRCode, setShowQRCode] = useState<string | null>(null);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setLinkName('');
      setLinkDescription('');
      setError(null);
      setSuccess(null);
      setCopiedLinkId(null);
      setShowQRCode(null);
    }
  }, [isOpen]);

  const getLinkUrl = (link: AttendanceCheckLink) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/attendance-check/${link.linkToken}`;
  };

  const handleCreateLink = async () => {
    if (!seatLayoutId) {
      setError('좌석 배치도를 선택해주세요.');
      return;
    }

    if (!linkName.trim()) {
      setError('링크 이름을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await onCreateLink({
        seatLayoutId,
        title: linkName.trim(),
        description: linkDescription.trim() || '출석 체크용 링크'
      });

      setSuccess('출석 체크 링크가 생성되었습니다.');
      setLinkName('');
      setLinkDescription('');
    } catch (err: any) {
      setError(err.message || '링크 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLink = async (linkId: string, currentStatus: boolean) => {
    const action = currentStatus ? '비활성화' : '활성화';
    if (!confirm(`이 링크를 ${action}하시겠습니까?`)) return;

    try {
      await onToggleLink(linkId, !currentStatus);
      setSuccess(`링크가 ${action}되었습니다.`);
    } catch (err: any) {
      setError(err.message || `링크 ${action}에 실패했습니다.`);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm('이 링크를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    try {
      await onDeleteLink(linkId);
      setSuccess('링크가 삭제되었습니다.');
    } catch (err: any) {
      setError(err.message || '링크 삭제에 실패했습니다.');
    }
  };

  const handleCopyLink = async (link: AttendanceCheckLink) => {
    const fullUrl = getLinkUrl(link);

    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedLinkId(link.id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch (err) {
      alert('링크 복사에 실패했습니다.');
    }
  };

  const handleToggleQRCode = (linkId: string) => {
    setShowQRCode(showQRCode === linkId ? null : linkId);
  };

  const formatDateTime = (date: Date | null | undefined) => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isLinkActive = (link: AttendanceCheckLink) => {
    return link.isActive;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content--link" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="modal-header">
          <h2 className="modal-title">출석 체크 링크</h2>
          <button
            type="button"
            onClick={onClose}
            className="modal-close"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 바디 */}
        <div className="modal-body">
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

          {/* 링크 생성 폼 */}
          <div className="link-form">
            <h3 className="link-form__title">새 링크 생성</h3>

            <div className="form-group">
              <label className="form-label">링크 이름 *</label>
              <input
                type="text"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                placeholder="예: 오전 출석, 오후 출석"
                className="form-input"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label">설명 (선택)</label>
              <input
                type="text"
                value={linkDescription}
                onChange={(e) => setLinkDescription(e.target.value)}
                placeholder="예: 평일 출석용"
                className="form-input"
                disabled={isSubmitting}
              />
              <div className="form-hint">
                링크에 대한 간단한 설명을 입력하세요
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateLink}
              className="btn btn--primary btn--create"
              disabled={isSubmitting || !seatLayoutId}
            >
              {isSubmitting ? '생성 중...' : '🔗 링크 생성'}
            </button>
          </div>

          {/* 링크 목록 */}
          <div className="links-section">
            <h3 className="links-section__title">
              생성된 링크 ({links.length})
            </h3>

            <div className="links-list">
              {links.length > 0 ? (
                links.map((link) => {
                  const active = isLinkActive(link);

                  return (
                    <div
                      key={link.id}
                      className={`link-card ${!active ? 'link-card--inactive' : ''}`}
                    >
                      <div className="link-card__header">
                        <div className="link-card__name">{link.title}</div>
                        <div className={`link-status ${active ? 'link-status--active' : 'link-status--inactive'}`}>
                          {active ? '활성' : '비활성'}
                        </div>
                      </div>

                      {link.description && (
                        <div className="link-card__description">
                          {link.description}
                        </div>
                      )}

                      <div className="link-card__info">
                        <div className="link-info-item">
                          <span className="link-info-item__label">생성:</span>
                          <span className="link-info-item__value">
                            {formatDateTime(link.createdAt)}
                          </span>
                        </div>
                        <div className="link-info-item">
                          <span className="link-info-item__label">사용 횟수:</span>
                          <span className="link-info-item__value">
                            {link.usageCount || 0}회
                          </span>
                        </div>
                        {link.lastUsedAt && (
                          <div className="link-info-item">
                            <span className="link-info-item__label">최근 사용:</span>
                            <span className="link-info-item__value">
                              {formatDateTime(link.lastUsedAt)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="link-card__actions">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(link)}
                          className="btn-link btn-link--copy"
                          disabled={!active}
                        >
                          {copiedLinkId === link.id ? '✓ 복사됨' : '📋 링크 복사'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleQRCode(link.id)}
                          className="btn-link btn-link--qr"
                          disabled={!active}
                        >
                          {showQRCode === link.id ? '📱 QR 닫기' : '📱 QR 코드'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleLink(link.id, active)}
                          className={`btn-link ${active ? 'btn-link--deactivate' : 'btn-link--activate'}`}
                        >
                          {active ? '🚫 비활성화' : '✅ 활성화'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLink(link.id)}
                          className="btn-link btn-link--delete"
                        >
                          🗑️ 삭제
                        </button>
                      </div>

                      {/* QR 코드 표시 */}
                      {showQRCode === link.id && active && (
                        <div className="qr-code-section">
                          <div className="qr-code-section__title">
                            모바일로 스캔하여 출석 체크
                          </div>
                          <div className="qr-code-container">
                            <QRCodeSVG
                              value={getLinkUrl(link)}
                              size={200}
                              level="H"
                              includeMargin={true}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="links-list--empty">
                  <div className="empty-icon">🔗</div>
                  <div className="empty-text">생성된 링크가 없습니다</div>
                  <div className="empty-hint">
                    위 폼에서 새 링크를 생성하세요
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn btn--secondary"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceCheckLinkModal;
