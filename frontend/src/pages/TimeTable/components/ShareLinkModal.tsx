/**
 * ShareLinkModal.tsx - 학생 시간표 편집 링크 생성 모달
 */

import React, { useState } from 'react';
import { StudentWithTimetable, StudentTimetableData } from '../../../types/student';
import { backendService } from '../../../services/backendService';
import './ShareLinkModal.css';

interface ShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentWithTimetable;
  timetable: StudentTimetableData;
}

interface ShareLinkData {
  shareUrl: string;
  expiresAt: string;
  shareToken: string;
}

const ShareLinkModal: React.FC<ShareLinkModalProps> = ({
  isOpen,
  onClose,
  student,
  timetable
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [shareLink, setShareLink] = useState<ShareLinkData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expiresInDays, setExpiresInDays] = useState(7);

  if (!isOpen) return null;

  // 링크 생성 핸들러
  const handleCreateLink = async () => {
    if (!timetable) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await backendService.createStudentTimetableEditLink({
        studentId: student.id,
        timetableId: timetable.id,
        expiresInDays: expiresInDays,
        title: `${student.name} 시간표 편집`,
        description: `${timetable.name}를 편집해주세요.`,
        editPermissions: {
          // 기존 권한 (detailedSchedule)
          canAddSlots: true,
          canDeleteSlots: true,
          canModifySlots: true,
          restrictedTimeSlots: [],
          
          // 새로운 권한 (basicSchedule)
          canEditBasicSchedule: true,
          canEditDailySchedules: true,
          canEditTimeSlotInterval: true,
          
          // 모든 요일 편집 가능 (실제 DB 시간 제한 반영)
          dailySchedulePermissions: {
            monday: {
              canEditArrivalTime: true,
              canEditDepartureTime: true,
              canToggleActive: true
            },
            tuesday: {
              canEditArrivalTime: true,
              canEditDepartureTime: true,
              canToggleActive: true
            },
            wednesday: {
              canEditArrivalTime: true,
              canEditDepartureTime: true,
              canToggleActive: true
            },
            thursday: {
              canEditArrivalTime: true,
              canEditDepartureTime: true,
              canToggleActive: true
            },
            friday: {
              canEditArrivalTime: true,
              canEditDepartureTime: true,
              canToggleActive: true
            },
            saturday: {
              canEditArrivalTime: true,
              canEditDepartureTime: true,
              canToggleActive: true
            },
            sunday: {
              canEditArrivalTime: true,
              canEditDepartureTime: true,
              canToggleActive: true
            }
          },
          
          timeSlotIntervalOptions: [15, 30, 45, 60]  // 최소 15분부터
        }
      });

      console.log('ShareLinkModal 응답 처리:', {
        response: response,
        success: response.success,
        data: response.data
      });

      if (response.success) {
        console.log('링크 생성 성공, 데이터 설정:', response.data);
        setShareLink(response.data);
      } else {
        console.log('링크 생성 실패:', response);
        setError('링크 생성에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('링크 생성 오류:', error);
      
      if (error.code === 'unauthenticated' || error.message?.includes('인증')) {
        setError('로그인이 필요합니다. 페이지를 새로고침해주세요.');
      } else if (error.code === 'functions/not-found') {
        setError('서버 함수를 찾을 수 없습니다. 잠시 후 다시 시도해주세요.');
      } else if (error.code === 'functions/internal') {
        setError('서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError(error.message || '링크 생성 중 오류가 발생했습니다.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  // 링크 복사
  const copyToClipboard = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink.shareUrl);
      alert('링크가 클립보드에 복사되었습니다!');
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
      alert('링크 복사에 실패했습니다.');
    }
  };

  // 새 링크 생성
  const handleCreateNew = () => {
    setShareLink(null);
    setError(null);
  };

  return (
    <div className="slm-modal-overlay" onClick={onClose}>
      <div className="slm-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="slm-modal-header">
          <h2>학생 편집 링크 생성</h2>
          <button className="slm-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="slm-modal-body">
          {!shareLink ? (
            // 링크 생성 폼
            <div className="slm-create-form">
              <div className="slm-student-info">
                <h3>{student.name}</h3>
                <p>{student.grade} • {timetable.name}</p>
              </div>

              <div className="slm-form-group">
                <label htmlFor="expiresInDays">링크 유효 기간</label>
                <select
                  id="expiresInDays"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="slm-select"
                >
                  <option value={1}>1일</option>
                  <option value={3}>3일</option>
                  <option value={7}>7일 (기본)</option>
                  <option value={14}>14일</option>
                  <option value={30}>30일</option>
                </select>
              </div>

              {error && (
                <div className="slm-error">
                  {error}
                </div>
              )}

              <div className="slm-permissions-info">
                <h4>편집 권한</h4>
                <ul>
                  <li>✓ 시간 슬롯 추가</li>
                  <li>✓ 시간 슬롯 수정</li>
                  <li>✓ 시간 슬롯 삭제</li>
                </ul>
              </div>
            </div>
          ) : (
            // 생성된 링크 표시
            <div className="slm-link-result">
              <div className="slm-success">
                ✅ 편집 링크가 생성되었습니다!
              </div>

              <div className="slm-link-info">
                <div className="slm-info-item">
                  <label>학생</label>
                  <span>{student.name}</span>
                </div>
                <div className="slm-info-item">
                  <label>시간표</label>
                  <span>{timetable.name}</span>
                </div>
                <div className="slm-info-item">
                  <label>만료일</label>
                  <span>{new Date(shareLink.expiresAt).toLocaleString('ko-KR')}</span>
                </div>
              </div>

              <div className="slm-link-container">
                <label>편집 링크</label>
                <div className="slm-link-input-group">
                  <input
                    type="text"
                    value={shareLink.shareUrl}
                    readOnly
                    className="slm-link-input"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="slm-copy-btn"
                  >
                    📋 복사
                  </button>
                </div>
              </div>

              <div className="slm-usage-note">
                <h4>사용법</h4>
                <p>이 링크를 학생에게 전달하면, 학생이 직접 시간표를 편집할 수 있습니다. 편집 후 제출하면 관리자 승인 후 시간표에 반영됩니다.</p>
              </div>
            </div>
          )}
        </div>

        <div className="slm-modal-footer">
          {!shareLink ? (
            <div className="slm-footer-buttons">
              <button
                className="slm-btn-cancel"
                onClick={onClose}
                disabled={isCreating}
              >
                취소
              </button>
              <button
                className="slm-btn-create"
                onClick={handleCreateLink}
                disabled={isCreating}
              >
                {isCreating ? '생성 중...' : '링크 생성'}
              </button>
            </div>
          ) : (
            <div className="slm-footer-buttons">
              <button
                className="slm-btn-new"
                onClick={handleCreateNew}
              >
                새 링크 생성
              </button>
              <button
                className="slm-btn-done"
                onClick={onClose}
              >
                완료
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareLinkModal;