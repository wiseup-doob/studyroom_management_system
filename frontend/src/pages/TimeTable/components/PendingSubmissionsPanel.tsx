/**
 * PendingSubmissionsPanel.tsx - 제출 대기 중인 편집 상태 관리 패널
 */

import React, { useState, useEffect } from 'react';
import { backendService } from '../../../services/backendService';
import './PendingSubmissionsPanel.css';

interface PendingSubmission {
  id: string;
  shareToken: string;
  timetableId: string;
  studentId: string;
  originalTimetable: any;
  currentTimetable: any;
  status: string;
  submissionNotes?: string;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  changes: {
    addedSlots: any[];
    modifiedSlots: string[];
    deletedSlots: string[];
  };
}

interface PendingSubmissionsPanelProps {
  onSubmissionProcessed?: () => void;
}

const PendingSubmissionsPanel: React.FC<PendingSubmissionsPanelProps> = ({ onSubmissionProcessed }) => {
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<PendingSubmission | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  // 초기 로딩
  useEffect(() => {
    loadPendingSubmissions();
  }, []);

  const loadPendingSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await backendService.getPendingEditSubmissions();
      if (response.success) {
        setSubmissions(response.data || []);
      } else {
        throw new Error(response.error || '데이터를 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('제출 대기 목록 조회 실패:', err);
      setError(err instanceof Error ? err.message : '데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 제출 승인/거부 처리
  const handleProcessSubmission = async (submissionId: string, action: 'approve' | 'reject', rejectionReason?: string) => {
    try {
      setProcessing(submissionId);

      const response = await backendService.processEditSubmission({
        editStateId: submissionId,
        action,
        rejectionReason
      });

      if (response.success) {
        // 성공 시 목록 새로고침
        await loadPendingSubmissions();
        setSelectedSubmission(null);
        setShowDetails(false);

        // 상위 컴포넌트에 알림
        if (onSubmissionProcessed) {
          onSubmissionProcessed();
        }

        alert(response.message || '처리가 완료되었습니다.');
      } else {
        throw new Error(response.error || '처리에 실패했습니다.');
      }
    } catch (err) {
      console.error('제출 처리 실패:', err);
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    } finally {
      setProcessing(null);
    }
  };

  const handleViewDetails = (submission: PendingSubmission) => {
    setSelectedSubmission(submission);
    setShowDetails(true);
  };

  const getTotalChanges = (changes: PendingSubmission['changes']) => {
    return (changes.addedSlots?.length || 0) +
           (changes.modifiedSlots?.length || 0) +
           (changes.deletedSlots?.length || 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  if (loading) {
    return (
      <div className="psp-container">
        <h3>제출 대기 목록</h3>
        <div className="psp-loading">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="psp-container">
        <h3>제출 대기 목록</h3>
        <div className="psp-error">
          <p>오류: {error}</p>
          <button onClick={loadPendingSubmissions} className="psp-retry-btn">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="psp-container">
      <div className="psp-header">
        <h3>제출 대기 목록</h3>
        <span className="psp-count">{submissions.length}건</span>
        <button onClick={loadPendingSubmissions} className="psp-refresh-btn">
          새로고침
        </button>
      </div>

      {submissions.length === 0 ? (
        <div className="psp-empty">
          제출 대기 중인 편집이 없습니다.
        </div>
      ) : (
        <div className="psp-list">
          {submissions.map(submission => (
            <div key={submission.id} className="psp-item">
              <div className="psp-item-header">
                <div className="psp-item-info">
                  <h4>{submission.currentTimetable?.studentName || '학생'}</h4>
                  <span className="psp-timetable-name">{submission.currentTimetable?.name || '시간표'}</span>
                </div>
                <div className="psp-item-meta">
                  <span className="psp-changes-count">
                    {getTotalChanges(submission.changes)}개 변경
                  </span>
                  <span className="psp-submitted-date">
                    {formatDate(submission.submittedAt)}
                  </span>
                </div>
              </div>

              {submission.submissionNotes && (
                <div className="psp-notes">
                  <strong>메모:</strong> {submission.submissionNotes}
                </div>
              )}

              <div className="psp-actions">
                <button
                  onClick={() => handleViewDetails(submission)}
                  className="psp-details-btn"
                >
                  상세보기
                </button>
                <button
                  onClick={() => handleProcessSubmission(submission.id, 'approve')}
                  disabled={processing === submission.id}
                  className="psp-approve-btn"
                >
                  {processing === submission.id ? '처리 중...' : '승인'}
                </button>
                <button
                  onClick={() => {
                    const reason = prompt('거부 사유를 입력해주세요:');
                    if (reason !== null) {
                      handleProcessSubmission(submission.id, 'reject', reason);
                    }
                  }}
                  disabled={processing === submission.id}
                  className="psp-reject-btn"
                >
                  거부
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 상세보기 모달 */}
      {showDetails && selectedSubmission && (
        <div className="psp-modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="psp-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="psp-modal-header">
              <h3>편집 내용 상세</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="psp-modal-close"
              >
                ×
              </button>
            </div>

            <div className="psp-modal-body">
              <div className="psp-modal-info">
                <div className="psp-info-row">
                  <label>학생:</label>
                  <span>{selectedSubmission.currentTimetable?.studentName || '학생'}</span>
                </div>
                <div className="psp-info-row">
                  <label>시간표:</label>
                  <span>{selectedSubmission.currentTimetable?.name || '시간표'}</span>
                </div>
                <div className="psp-info-row">
                  <label>제출일:</label>
                  <span>{formatDate(selectedSubmission.submittedAt)}</span>
                </div>
                {selectedSubmission.submissionNotes && (
                  <div className="psp-info-row">
                    <label>메모:</label>
                    <span>{selectedSubmission.submissionNotes}</span>
                  </div>
                )}
              </div>

              <div className="psp-changes-summary">
                <h4>변경사항 요약</h4>
                <ul>
                  {selectedSubmission.changes.addedSlots?.length > 0 && (
                    <li>추가된 시간: {selectedSubmission.changes.addedSlots.length}개</li>
                  )}
                  {selectedSubmission.changes.modifiedSlots?.length > 0 && (
                    <li>수정된 시간: {selectedSubmission.changes.modifiedSlots.length}개</li>
                  )}
                  {selectedSubmission.changes.deletedSlots?.length > 0 && (
                    <li>삭제된 시간: {selectedSubmission.changes.deletedSlots.length}개</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="psp-modal-actions">
              <button
                onClick={() => handleProcessSubmission(selectedSubmission.id, 'approve')}
                disabled={processing === selectedSubmission.id}
                className="psp-approve-btn"
              >
                {processing === selectedSubmission.id ? '처리 중...' : '승인'}
              </button>
              <button
                onClick={() => {
                  const reason = prompt('거부 사유를 입력해주세요:');
                  if (reason !== null) {
                    handleProcessSubmission(selectedSubmission.id, 'reject', reason);
                  }
                }}
                disabled={processing === selectedSubmission.id}
                className="psp-reject-btn"
              >
                거부
              </button>
              <button
                onClick={() => setShowDetails(false)}
                className="psp-cancel-btn"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingSubmissionsPanel;