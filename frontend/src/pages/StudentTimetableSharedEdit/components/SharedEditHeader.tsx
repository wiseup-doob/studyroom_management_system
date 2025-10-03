/**
 * SharedEditHeader.tsx - 학생용 시간표 편집 페이지 헤더
 *
 * Phase 2 구현:
 * - 학생 정보 표시
 * - 편집 상태 및 진행 상황 표시
 * - 원본/편집본 비교 토글
 * - 제출 버튼
 */

import React from 'react';
import { StudentWithTimetable, StudentTimetableData } from '../../../types/student';

interface SharedEditHeaderProps {
  student: StudentWithTimetable;
  timetable: StudentTimetableData;
  hasChanges: boolean;
  totalChanges: number;
  showComparison: boolean;
  onToggleComparison: () => void;
  onSubmit: () => void;
  isSubmitDisabled: boolean;
  onEditTimetable: () => void;
  // 새로 추가되는 props
  onEditBasicSchedule?: () => void;
}

const SharedEditHeader: React.FC<SharedEditHeaderProps> = ({
  student,
  timetable,
  hasChanges,
  totalChanges,
  showComparison,
  onToggleComparison,
  onSubmit,
  isSubmitDisabled,
  onEditTimetable,
  onEditBasicSchedule
}) => {
  return (
    <div className="seh-header">
      <div className="seh-container">
        {/* 학생 정보 */}
        <div className="seh-student-info">
          <div className="seh-student-details">
            <h1 className="seh-student-name">{student.name}</h1>
            <p className="seh-student-grade">{student.grade}</p>
            <p className="seh-timetable-name">📅 {timetable.name}</p>
          </div>
          <div className="seh-edit-status">
            {hasChanges ? (
              <div className="seh-status-modified">
                <span className="seh-status-icon">✏️</span>
                <span className="seh-status-text">수정됨</span>
                <span className="seh-changes-count">({totalChanges}건)</span>
              </div>
            ) : (
              <div className="seh-status-original">
                <span className="seh-status-icon">📋</span>
                <span className="seh-status-text">원본 (변경 없음)</span>
              </div>
            )}
          </div>
        </div>

        {/* 헤더 액션 버튼들 */}
        <div className="seh-header-actions">
          {/* 기본 스케줄 편집 버튼 (항상 표시) */}
          <button
            className="seh-btn-edit-basic"
            onClick={onEditBasicSchedule}
            title="등원/하원 시간 편집"
          >
            <span className="seh-btn-icon">⏰</span>
            <span className="seh-btn-text">등원시간 편집</span>
          </button>

          {/* 기존 시간표 편집 버튼 */}
          <button
            className="seh-btn-edit"
            onClick={onEditTimetable}
            title="시간표 편집"
          >
            <span className="seh-btn-icon">✏️</span>
            <span className="seh-btn-text">시간표 편집</span>
          </button>

          {/* 비교 토글 버튼 */}
          {hasChanges && (
            <button
              className={`seh-btn-toggle ${showComparison ? 'active' : ''}`}
              onClick={onToggleComparison}
              title={showComparison ? '편집본 보기' : '원본 보기'}
            >
              <span className="seh-btn-icon">🔄</span>
              <span className="seh-btn-text">
                {showComparison ? '편집본' : '원본 비교'}
              </span>
            </button>
          )}

          {/* 제출 버튼 */}
          <button
            className="seh-btn-submit"
            onClick={onSubmit}
            disabled={isSubmitDisabled}
            title={
              totalChanges === 0
                ? '변경사항이 없습니다'
                : isSubmitDisabled
                  ? '제출 중입니다'
                  : `${totalChanges}건의 변경사항을 제출합니다`
            }
          >
            <span className="seh-btn-icon">📤</span>
            <span className="seh-btn-text">
              제출하기 {totalChanges > 0 && `(${totalChanges})`}
            </span>
          </button>
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="seh-info-bar">
        <div className="seh-container">
          {showComparison ? (
            <div className="seh-info-comparison">
              <span className="seh-info-icon">👀</span>
              <span className="seh-info-text">
                원본 시간표를 확인하고 있습니다. "편집본" 버튼을 클릭하여 편집본으로 돌아가세요.
              </span>
            </div>
          ) : hasChanges ? (
            <div className="seh-info-modified">
              <span className="seh-info-icon">⚠️</span>
              <span className="seh-info-text">
                시간표가 수정되었습니다. 변경사항을 확인한 후 제출해주세요.
              </span>
            </div>
          ) : (
            <div className="seh-info-default">
              <span className="seh-info-icon">ℹ️</span>
              <span className="seh-info-text">
                시간표를 편집하려면 "시간표 편집" 버튼을 클릭하세요. 변경사항은 자동으로 임시 저장됩니다.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SharedEditHeader;