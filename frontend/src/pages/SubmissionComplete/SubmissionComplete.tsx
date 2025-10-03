/**
 * SubmissionComplete.tsx - 시간표 편집 제출 완료 페이지
 *
 * Phase 2 구현:
 * - 제출 완료 확인 페이지
 * - 간단한 안내 메시지
 */

import React from 'react';
import { useLocation } from 'react-router-dom';
import './SubmissionComplete.css';

interface SubmissionState {
  studentName: string;
  timetableName: string;
}

const SubmissionComplete: React.FC = () => {
  const location = useLocation();
  const state = location.state as SubmissionState;

  return (
    <div className="sc-container">
      <div className="sc-content">
        <div className="sc-icon">✅</div>
        <h1>제출이 완료되었습니다</h1>

        {state && (
          <div className="sc-info">
            <p><strong>{state.studentName}</strong>님의</p>
            <p><strong>{state.timetableName}</strong> 편집 내용이 성공적으로 제출되었습니다.</p>
          </div>
        )}

        <div className="sc-message">
          <h3>다음 단계:</h3>
          <ol>
            <li>관리자가 변경사항을 검토합니다</li>
            <li>승인되면 시간표에 자동으로 반영됩니다</li>
            <li>거부되면 사유와 함께 알림을 받게 됩니다</li>
          </ol>
        </div>

        <div className="sc-notice">
          <p>💡 <strong>참고:</strong> 검토 과정은 보통 1-2일 정도 소요됩니다.</p>
        </div>
      </div>
    </div>
  );
};

export default SubmissionComplete;