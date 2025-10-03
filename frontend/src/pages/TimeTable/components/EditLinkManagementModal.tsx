/**
 * EditLinkManagementModal.tsx - 편집 링크 관리 모달 컴포넌트
 * 
 * 기능:
 * - 현재 활성화된 편집 링크 표시
 * - 편집 링크 로그 표시
 * - 편집 링크 비활성화 기능
 */

import React, { useState, useEffect } from 'react';
import editLinkService, { EditLink, EditLinkLog } from '../../../services/editLinkService';
import './EditLinkManagementModal.css';

// EditLink와 EditLinkLog 타입은 editLinkService에서 import

interface EditLinkManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
}

const EditLinkManagementModal: React.FC<EditLinkManagementModalProps> = ({
  isOpen,
  onClose,
  studentId,
  studentName
}) => {
  const [activeLinks, setActiveLinks] = useState<EditLink[]>([]);
  const [linkLogs, setLinkLogs] = useState<EditLinkLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'links' | 'logs'>('links');

  // 모달이 열릴 때 데이터 로드
  useEffect(() => {
    if (isOpen) {
      loadEditLinkData();
    }
  }, [isOpen, studentId]);

  const loadEditLinkData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 실제 API 호출
      const [links, logs] = await Promise.all([
        editLinkService.getStudentEditLinks({ 
          studentId, 
          includeInactive: true 
        }),
        editLinkService.getEditLinkLogs({ 
          studentId 
        })
      ]);

      setActiveLinks(links);
      setLinkLogs(logs);
    } catch (err: any) {
      setError(err.message || '편집 링크 정보를 불러오는데 실패했습니다.');
      console.error('Error loading edit links:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateLink = async (shareToken: string) => {
    try {
      await editLinkService.deactivateEditLink(shareToken);
      
      // 로컬 상태 업데이트
      setActiveLinks(prev => 
        prev.map(link => 
          link.shareToken === shareToken ? { ...link, isActive: false } : link
        )
      );
      
      // 데이터 다시 로드하여 최신 상태 반영
      await loadEditLinkData();
    } catch (err: any) {
      setError(err.message || '링크 비활성화에 실패했습니다.');
      console.error('Error deactivating link:', err);
    }
  };

  const handleActivateLink = async (shareToken: string) => {
    try {
      await editLinkService.activateEditLink(shareToken);
      
      // 로컬 상태 업데이트
      setActiveLinks(prev => 
        prev.map(link => 
          link.shareToken === shareToken ? { ...link, isActive: true } : link
        )
      );
      
      // 데이터 다시 로드하여 최신 상태 반영
      await loadEditLinkData();
    } catch (err: any) {
      setError(err.message || '링크 재활성화에 실패했습니다.');
      console.error('Error activating link:', err);
    }
  };

  const handleDeleteLink = async (shareToken: string) => {
    if (!window.confirm('정말로 이 링크를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      await editLinkService.deleteEditLink(shareToken);
      
      // 로컬 상태에서 제거
      setActiveLinks(prev => 
        prev.filter(link => link.shareToken !== shareToken)
      );
      
      // 데이터 다시 로드하여 최신 상태 반영
      await loadEditLinkData();
    } catch (err: any) {
      setError(err.message || '링크 삭제에 실패했습니다.');
      console.error('Error deleting link:', err);
    }
  };

  const copyLinkToClipboard = (shareToken: string) => {
    const fullLink = `${window.location.origin}/student-timetable-edit/${shareToken}`;
    navigator.clipboard.writeText(fullLink).then(() => {
      alert('링크가 클립보드에 복사되었습니다.');
    }).catch(() => {
      alert('링크 복사에 실패했습니다.');
    });
  };

  if (!isOpen) return null;

  return (
    <div className="elm-modal-overlay">
      <div className="elm-modal-container">
        <div className="elm-modal-header">
          <h2>편집 링크 관리</h2>
          <p className="elm-student-name">{studentName} 학생</p>
          <button className="elm-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="elm-modal-content">
          {/* 탭 메뉴 */}
          <div className="elm-tab-menu">
            <button
              className={`elm-tab-btn ${activeTab === 'links' ? 'active' : ''}`}
              onClick={() => setActiveTab('links')}
            >
              활성 링크 ({activeLinks.filter(link => link.isActive).length})
            </button>
            <button
              className={`elm-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              링크 로그 ({linkLogs.length})
            </button>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="elm-error-message">
              {error}
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}

          {/* 로딩 상태 */}
          {loading && (
            <div className="elm-loading">
              <div className="elm-spinner"></div>
              <p>로딩 중...</p>
            </div>
          )}

          {/* 활성 링크 탭 */}
          {activeTab === 'links' && !loading && (
            <div className="elm-links-section">
              {activeLinks.length === 0 ? (
                <div className="elm-empty-state">
                  <p>편집 링크가 없습니다.</p>
                </div>
              ) : (
                <div className="elm-links-list">
                  {activeLinks.map(link => (
                    <div key={link.id} className="elm-link-item">
                      <div className="elm-link-info">
                        <div className="elm-link-header">
                          <div className="elm-link-code">
                            <span className="elm-code-label">링크 코드:</span>
                            <span className="elm-code-value">{link.shareToken.substring(0, 8)}...</span>
                            <button
                              className="elm-copy-btn"
                              onClick={() => copyLinkToClipboard(link.shareToken)}
                              title="링크 복사"
                            >
                              📋
                            </button>
                          </div>
                          <div className="elm-link-status">
                            <span 
                              className="elm-status-badge"
                              style={{ 
                                backgroundColor: editLinkService.getLinkStatusColor(link),
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '12px'
                              }}
                            >
                              {editLinkService.getLinkStatusText(link)}
                            </span>
                          </div>
                        </div>
                        <div className="elm-link-details">
                          <div className="elm-detail-row">
                            <span className="elm-detail-label">제목:</span>
                            <span className="elm-detail-value">{link.title || '제목 없음'}</span>
                          </div>
                          <div className="elm-detail-row">
                            <span className="elm-detail-label">생성일:</span>
                            <span className="elm-detail-value">{editLinkService.formatDate(link.createdAt)}</span>
                          </div>
                          {link.expiresAt && (
                            <div className="elm-detail-row">
                              <span className="elm-detail-label">만료일:</span>
                              <span className="elm-detail-value">{editLinkService.formatDate(link.expiresAt)}</span>
                            </div>
                          )}
                          {link.lastUsedAt && (
                            <div className="elm-detail-row">
                              <span className="elm-detail-label">마지막 사용:</span>
                              <span className="elm-detail-value">{editLinkService.formatDate(link.lastUsedAt)}</span>
                            </div>
                          )}
                          <div className="elm-detail-row">
                            <span className="elm-detail-label">사용 횟수:</span>
                            <span className="elm-detail-value">{link.usageCount}회</span>
                          </div>
                          <div className="elm-detail-row">
                            <span className="elm-detail-label">권한:</span>
                            <span className="elm-detail-value">
                              {link.permissions.canEdit && '편집 '}
                              {link.permissions.canView && '보기 '}
                              {link.permissions.canComment && '댓글 '}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="elm-link-actions">
                        {link.isActive ? (
                          <button
                            className="elm-deactivate-btn"
                            onClick={() => handleDeactivateLink(link.shareToken)}
                            title="링크 비활성화"
                          >
                            비활성화
                          </button>
                        ) : (
                          <button
                            className="elm-activate-btn"
                            onClick={() => handleActivateLink(link.shareToken)}
                            title="링크 재활성화"
                          >
                            재활성화
                          </button>
                        )}
                        <button
                          className="elm-delete-btn"
                          onClick={() => handleDeleteLink(link.shareToken)}
                          title="링크 삭제"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 링크 로그 탭 */}
          {activeTab === 'logs' && !loading && (
            <div className="elm-logs-section">
              {linkLogs.length === 0 ? (
                <div className="elm-empty-state">
                  <p>링크 로그가 없습니다.</p>
                </div>
              ) : (
                <div className="elm-logs-list">
                  {linkLogs.map(log => (
                    <div key={log.id} className="elm-log-item">
                      <div className="elm-log-icon">
                        {editLinkService.getActionIcon(log.action)}
                      </div>
                      <div className="elm-log-content">
                        <div className="elm-log-header">
                          <span className="elm-log-action">{editLinkService.getActionText(log.action)}</span>
                          <span className="elm-log-time">{editLinkService.formatDate(log.timestamp)}</span>
                        </div>
                        <div className="elm-log-details">{log.details}</div>
                        {log.userName && (
                          <div className="elm-log-user">by {log.userName}</div>
                        )}
                        {log.ipAddress && (
                          <div className="elm-log-meta">IP: {log.ipAddress}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="elm-modal-footer">
          <button className="elm-close-modal-btn" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditLinkManagementModal;
