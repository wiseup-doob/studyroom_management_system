/**
 * NotificationCenter.tsx - 알림 센터 컴포넌트
 * Phase 4 구현: 모든 대기 중인 기여 목록과 관리
 */

import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import './NotificationCenter.css';

interface ContributionNotification {
  id: string;
  contributionType: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  studentId: string;
  originalTimetableId: string;
  submittedAt: Timestamp;
  submissionNotes?: string;
  changes?: {
    modifiedSlots: string[];
    addedSlots: any[];
    deletedSlots: string[];
    basicScheduleChanges?: {
      dailyScheduleChanges: {
        [dayOfWeek: string]: {
          arrivalTimeChanged: boolean;
          departureTimeChanged: boolean;
          isActiveChanged: boolean;
          originalSchedule: {
            arrivalTime: string;
            departureTime: string;
            isActive: boolean;
          };
          updatedSchedule: {
            arrivalTime: string;
            departureTime: string;
            isActive: boolean;
          };
        };
      };
      timeSlotIntervalChanged: boolean;
      originalTimeSlotInterval: number;
      updatedTimeSlotInterval: number;
    };
  };
  metadata?: {
    studentName?: string;
    timetableName?: string;
  };
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationAction: (notificationId: string, action: 'approve' | 'reject' | 'view') => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  onNotificationAction
}) => {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState<ContributionNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'processed'>('all');

  useEffect(() => {
    if (!userProfile?.uid || !isOpen) {
      setLoading(false);
      return;
    }

    const contributionsRef = collection(db, `users/${userProfile.uid}/schedule_contributions`);
    let notificationQuery;

    if (filter === 'pending') {
      notificationQuery = query(
        contributionsRef,
        where('status', '==', 'pending'),
        where('contributionType', '==', 'student_timetable_edit'),
        orderBy('submittedAt', 'desc')
      );
    } else if (filter === 'processed') {
      notificationQuery = query(
        contributionsRef,
        where('status', 'in', ['approved', 'rejected', 'applied']),
        where('contributionType', '==', 'student_timetable_edit'),
        orderBy('submittedAt', 'desc')
      );
    } else {
      notificationQuery = query(
        contributionsRef,
        where('contributionType', '==', 'student_timetable_edit'),
        orderBy('submittedAt', 'desc')
      );
    }

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
      },
      (error) => {
        console.error('알림 센터 데이터 조회 오류:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [userProfile?.uid, isOpen, filter]);

  const formatDateTime = useCallback((timestamp: Timestamp) => {
    const date = timestamp.toDate();
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="nc-status-badge pending">검토 대기</span>;
      case 'approved':
        return <span className="nc-status-badge approved">승인됨</span>;
      case 'rejected':
        return <span className="nc-status-badge rejected">거부됨</span>;
      case 'applied':
        return <span className="nc-status-badge applied">적용됨</span>;
      default:
        return <span className="nc-status-badge">{status}</span>;
    }
  };

  const getChangesSummary = (changes: any) => {
    if (!changes) return '변경사항 없음';

    const { modifiedSlots = [], addedSlots = [], deletedSlots = [], basicScheduleChanges } = changes;
    const parts = [];

    if (addedSlots.length > 0) parts.push(`+${addedSlots.length}개 추가`);
    if (modifiedSlots.length > 0) parts.push(`${modifiedSlots.length}개 수정`);
    if (deletedSlots.length > 0) parts.push(`-${deletedSlots.length}개 삭제`);
    
    // 기본 스케줄 변경사항 추가
    if (basicScheduleChanges) {
      const { dailyScheduleChanges, timeSlotIntervalChanged } = basicScheduleChanges;
      const basicScheduleParts = [];
      
      if (timeSlotIntervalChanged) {
        basicScheduleParts.push('시간 간격 변경');
      }
      
      const changedDays = Object.keys(dailyScheduleChanges || {});
      if (changedDays.length > 0) {
        basicScheduleParts.push(`${changedDays.length}요일 등원/하원 시간 변경`);
      }
      
      if (basicScheduleParts.length > 0) {
        parts.push(`⏰ ${basicScheduleParts.join(', ')}`);
      }
    }

    return parts.length > 0 ? parts.join(', ') : '변경사항 없음';
  };

  if (!isOpen) return null;

  return (
    <div className="nc-overlay">
      <div className="nc-container">
        {/* 헤더 */}
        <div className="nc-header">
          <h2>알림 센터</h2>
          <button className="nc-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 필터 */}
        <div className="nc-filters">
          <button
            className={`nc-filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            전체
          </button>
          <button
            className={`nc-filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            대기 중
          </button>
          <button
            className={`nc-filter-btn ${filter === 'processed' ? 'active' : ''}`}
            onClick={() => setFilter('processed')}
          >
            처리됨
          </button>
        </div>

        {/* 알림 목록 */}
        <div className="nc-content">
          {loading ? (
            <div className="nc-loading">
              <div className="nc-spinner"></div>
              <p>로딩 중...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="nc-empty">
              <p>알림이 없습니다.</p>
            </div>
          ) : (
            <div className="nc-list">
              {notifications.map((notification) => (
                <div key={notification.id} className="nc-item">
                  <div className="nc-item-header">
                    <div className="nc-item-info">
                      <span className="nc-student-name">
                        {notification.metadata?.studentName || '학생'}
                      </span>
                      <span className="nc-timetable-name">
                        {notification.metadata?.timetableName || '시간표'}
                      </span>
                    </div>
                    <div className="nc-item-meta">
                      {getStatusBadge(notification.status)}
                      <span className="nc-datetime">
                        {formatDateTime(notification.submittedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="nc-item-body">
                    <div className="nc-changes-summary">
                      {getChangesSummary(notification.changes)}
                    </div>

                    {notification.submissionNotes && (
                      <div className="nc-notes">
                        <strong>제출 메모:</strong> {notification.submissionNotes}
                      </div>
                    )}
                  </div>

                  <div className="nc-item-actions">
                    <button
                      className="nc-action-btn view"
                      onClick={() => onNotificationAction(notification.id, 'view')}
                    >
                      상세보기
                    </button>

                    {notification.status === 'pending' && (
                      <>
                        <button
                          className="nc-action-btn approve"
                          onClick={() => onNotificationAction(notification.id, 'approve')}
                        >
                          승인
                        </button>
                        <button
                          className="nc-action-btn reject"
                          onClick={() => onNotificationAction(notification.id, 'reject')}
                        >
                          거부
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="nc-footer">
          <div className="nc-stats">
            총 {notifications.length}개의 알림
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;