/**
 * TimetableNotifications.tsx - 시간표 기여 알림 시스템
 * Phase 4 구현: 실시간 기여 알림 컴포넌트
 */

import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import './TimetableNotifications.css';

interface ContributionNotification {
  id: string;
  contributionType: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  studentId: string;
  originalTimetableId: string;
  submittedAt: Timestamp;
  submissionNotes?: string;
  metadata?: {
    studentName?: string;
    timetableName?: string;
  };
}

interface TimetableNotificationsProps {
  onNotificationClick?: (notification: ContributionNotification) => void;
  onViewAllClick?: () => void;
  showBadge?: boolean;
  maxVisible?: number;
}

export const TimetableNotifications: React.FC<TimetableNotificationsProps> = ({
  onNotificationClick,
  onViewAllClick,
  showBadge = true,
  maxVisible = 5
}) => {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState<ContributionNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // 실시간 기여 알림을 위한 Firestore 리스너
  useEffect(() => {
    if (!userProfile?.uid) {
      setLoading(false);
      return;
    }

    const contributionsRef = collection(db, `users/${userProfile.uid}/schedule_contributions`);
    const notificationQuery = query(
      contributionsRef,
      where('status', '==', 'pending'),
      where('contributionType', '==', 'student_timetable_edit'),
      orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      notificationQuery,
      (snapshot) => {
        const newNotifications: ContributionNotification[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          newNotifications.push({
            id: doc.id,
            ...data
          } as ContributionNotification);
        });

        setNotifications(newNotifications);
        setLoading(false);

        // 새로운 알림이 있을 때 자동으로 열기
        if (newNotifications.length > 0 && !isOpen) {
          // 선택적: 새 알림 사운드나 더 강한 알림 표시
          console.log(`새로운 시간표 편집 요청 ${newNotifications.length}개가 접수되었습니다.`);
        }
      },
      (error) => {
        console.error('기여 알림 조회 오류:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [userProfile?.uid, isOpen]);

  const handleNotificationClick = useCallback((notification: ContributionNotification) => {
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    setIsOpen(false);
  }, [onNotificationClick]);

  const formatTimeAgo = useCallback((timestamp: Timestamp) => {
    const now = new Date();
    const submittedTime = timestamp.toDate();
    const diffInMinutes = Math.floor((now.getTime() - submittedTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return '방금 전';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}분 전`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}시간 전`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days}일 전`;
    }
  }, []);

  const pendingCount = notifications.length;
  const visibleNotifications = notifications.slice(0, maxVisible);

  if (loading) {
    return (
      <div className="tn-container">
        <button className="tn-bell-button" disabled>
          <span className="tn-bell-icon">🔔</span>
        </button>
      </div>
    );
  }

  return (
    <div className="tn-container">
      <button
        className={`tn-bell-button ${pendingCount > 0 ? 'has-notifications' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={`${pendingCount}개의 새로운 시간표 편집 요청`}
      >
        <span className="tn-bell-icon">🔔</span>
        {showBadge && pendingCount > 0 && (
          <span className="tn-badge">{pendingCount > 99 ? '99+' : pendingCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="tn-dropdown">
          <div className="tn-header">
            <h3>시간표 편집 요청</h3>
            {pendingCount > 0 && (
              <span className="tn-count">{pendingCount}개 대기 중</span>
            )}
          </div>

          <div className="tn-list">
            {visibleNotifications.length === 0 ? (
              <div className="tn-empty">
                <p>새로운 시간표 편집 요청이 없습니다.</p>
              </div>
            ) : (
              visibleNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="tn-item"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="tn-item-content">
                    <div className="tn-item-header">
                      <span className="tn-student-name">
                        {notification.metadata?.studentName || '학생'}
                      </span>
                      <span className="tn-time">
                        {formatTimeAgo(notification.submittedAt)}
                      </span>
                    </div>

                    <div className="tn-item-body">
                      <p className="tn-message">
                        시간표 편집을 제출했습니다.
                      </p>
                      {notification.submissionNotes && (
                        <p className="tn-notes">
                          "{notification.submissionNotes}"
                        </p>
                      )}
                    </div>

                    <div className="tn-item-footer">
                      <span className="tn-timetable">
                        {notification.metadata?.timetableName || '시간표'}
                      </span>
                      <span className="tn-status pending">검토 대기</span>
                    </div>
                  </div>
                </div>
              ))
            )}

            {notifications.length > maxVisible && (
              <div className="tn-more">
                <button
                  className="tn-more-button"
                  onClick={() => setIsOpen(false)}
                >
                  {notifications.length - maxVisible}개 더 보기...
                </button>
              </div>
            )}
          </div>

          {pendingCount > 0 && (
            <div className="tn-footer">
              <button
                className="tn-view-all-button"
                onClick={() => {
                  setIsOpen(false);
                  if (onViewAllClick) {
                    onViewAllClick();
                  }
                }}
              >
                모든 요청 보기
              </button>
            </div>
          )}
        </div>
      )}

      {/* 클릭 외부 영역으로 닫기 */}
      {isOpen && (
        <div
          className="tn-overlay"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default TimetableNotifications;