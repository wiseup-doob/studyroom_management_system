/**
 * MainHeader.tsx - 메인 레이아웃 헤더 컴포넌트
 * Phase 4 구현: 알림 시스템이 포함된 헤더
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { TimetableNotifications } from '../notifications/TimetableNotifications';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { ContributionReviewModal } from '../notifications/ContributionReviewModal';
import { backendService } from '../../services/backendService';
import './MainHeader.css';

interface ContributionNotification {
  id: string;
  contributionType: string;
  status: string;
  studentId: string;
  originalTimetableId: string;
  submittedAt: any;
  submissionNotes?: string;
  metadata?: {
    studentName?: string;
    timetableName?: string;
  };
}

export const MainHeader: React.FC = () => {
  const { userProfile, logout } = useAuth();
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [reviewingContribution, setReviewingContribution] = useState<string | null>(null);

  const handleNotificationClick = (notification: ContributionNotification) => {
    console.log('알림 클릭:', notification);
    setShowNotificationCenter(true);
  };

  const handleNotificationAction = async (notificationId: string, action: 'approve' | 'reject' | 'view') => {
    try {
      if (action === 'view') {
        // 상세 검토 모달 열기
        setShowNotificationCenter(false);
        setReviewingContribution(notificationId);
        return;
      }

      // 빠른 승인/거부 처리
      const result = await backendService.processContribution({
        contributionId: notificationId,
        action
      });

      if (result.success) {
        console.log(`기여가 ${action === 'approve' ? '승인' : '거부'}되었습니다.`);

        // 성공 알림 (선택사항)
        // showToast(`기여가 ${action === 'approve' ? '승인' : '거부'}되었습니다.`, 'success');
      } else {
        console.error('처리 실패:', result.message);
        // showToast('처리 중 오류가 발생했습니다.', 'error');
      }
    } catch (error) {
      console.error('기여 처리 오류:', error);
      // showToast('처리 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleReviewComplete = (action: 'approve' | 'reject', contributionId: string) => {
    console.log(`기여 검토 완료: ${action} - ${contributionId}`);
    setReviewingContribution(null);

    // 성공 알림 (선택사항)
    // showToast(`기여가 ${action === 'approve' ? '승인' : '거부'}되었습니다.`, 'success');
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  return (
    <header className="main-header">
      <div className="mh-container">
        {/* 왼쪽: 로고/제목 */}
        <div className="mh-left">
          <h1 className="mh-title">WiseUp 관리 시스템</h1>
        </div>

        {/* 오른쪽: 알림 + 사용자 정보 */}
        <div className="mh-right">
          {/* 알림 시스템 */}
          <div className="mh-notifications">
            <TimetableNotifications
              onNotificationClick={handleNotificationClick}
              onViewAllClick={() => setShowNotificationCenter(true)}
              showBadge={true}
              maxVisible={5}
            />
          </div>

          {/* 사용자 정보 */}
          <div className="mh-user">
            <div className="mh-user-info">
              <img
                src={userProfile?.profilePicture || '/default-avatar.png'}
                alt="프로필"
                className="mh-avatar"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.name || '사용자')}&background=3b82f6&color=fff`;
                }}
              />
              <div className="mh-user-details">
                <span className="mh-username">{userProfile?.name || '사용자'}</span>
                <span className="mh-email">{userProfile?.email}</span>
              </div>
            </div>

            <div className="mh-user-actions">
              <button
                className="mh-logout-btn"
                onClick={handleLogout}
                title="로그아웃"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 알림 센터 모달 */}
      <NotificationCenter
        isOpen={showNotificationCenter}
        onClose={() => setShowNotificationCenter(false)}
        onNotificationAction={handleNotificationAction}
      />

      {/* 기여 검토 모달 */}
      <ContributionReviewModal
        isOpen={!!reviewingContribution}
        contributionId={reviewingContribution}
        onClose={() => setReviewingContribution(null)}
        onComplete={handleReviewComplete}
      />
    </header>
  );
};

export default MainHeader;