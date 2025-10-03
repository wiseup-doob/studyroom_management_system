/**
 * SharedTimetableGrid.tsx - 공유 편집용 시간표 그리드 컴포넌트
 *
 * TimetableGrid.tsx 방식을 기반으로 한 간소화된 버전
 * - 실제 저장된 timeSlots만 표시
 * - 자동 생성 로직 없음
 * - 편집 가능한 인터페이스
 */

import React from 'react';
import { StudentTimetableData, TimeSlot } from '../../../types/student';
import './SharedTimetableGrid.css';

interface SharedTimetableGridProps {
  timetable: StudentTimetableData;
  permissions: {
    canAddSlots: boolean;
    canDeleteSlots: boolean;
    canModifySlots: boolean;
    restrictedTimeSlots?: string[];
  };
  isComparisonMode: boolean;
  originalTimetable: StudentTimetableData;
}

const SharedTimetableGrid: React.FC<SharedTimetableGridProps> = ({
  timetable,
  permissions,
  isComparisonMode,
  originalTimetable
}) => {

  // 요일 이름 매핑
  const dayNames = {
    monday: '월요일',
    tuesday: '화요일',
    wednesday: '수요일',
    thursday: '목요일',
    friday: '금요일',
    saturday: '토요일',
    sunday: '일요일'
  };

  // 유틸리티 함수들
  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // 시간 슬롯 생성 (basicSchedule 기준)
  const generateTimeSlots = () => {
    const slots = [];
    const startHour = 9;
    const endHour = 24;
    const interval = 30; // 30분 간격

    for (let hour = startHour; hour < endHour; hour++) {
      for (let min = 0; min < 60; min += interval) {
        const startTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const endTime = minutesToTime(hour * 60 + min + interval);

        slots.push({
          startTime,
          endTime
        });
      }
    }

    return slots;
  };

  // 활성 요일 가져오기
  const getActiveDays = () => {
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  };

  const timeSlots = generateTimeSlots();
  const activeDays = getActiveDays();

  // 슬롯 변경 감지 (비교 모드용)
  const isSlotChanged = (day: string, timeSlot: { startTime: string; endTime: string }) => {
    if (!isComparisonMode) return false;

    const currentSlot = timetable.detailedSchedule[day]?.timeSlots.find(slot =>
      slot.startTime === timeSlot.startTime && slot.endTime === timeSlot.endTime
    );
    const originalSlot = originalTimetable.detailedSchedule[day]?.timeSlots.find(slot =>
      slot.startTime === timeSlot.startTime && slot.endTime === timeSlot.endTime
    );

    return JSON.stringify(currentSlot) !== JSON.stringify(originalSlot);
  };

  return (
    <div className="stg-timetable-grid-container">

      {/* 시간표 그리드 */}
      <div className="stg-timetable-grid">
        {/* 헤더: 시간 + 요일들 */}
        <div className="stg-grid-header">
          <div className="stg-time-column-header">
            <span className="stg-header-text">시간</span>
          </div>
          {activeDays.map(day => (
            <div key={day} className="stg-day-header">
              <span className="stg-day-name">{dayNames[day as keyof typeof dayNames]}</span>
              <span className="stg-day-abbr">{day.slice(0, 3)}</span>
            </div>
          ))}
        </div>

        {/* 시간 슬롯들 */}
        <div className="stg-grid-body">
          {timeSlots.map((timeSlot, timeIndex) => (
            <div key={timeIndex} className="stg-time-row">
              {/* 시간 컬럼 */}
              <div className="stg-time-cell">
                <div className="stg-time-display">
                  <span className="stg-time-start">{timeSlot.startTime}</span>
                  <span className="stg-time-separator">-</span>
                  <span className="stg-time-end">{timeSlot.endTime}</span>
                </div>
              </div>

              {/* 각 요일별 셀 */}
              {activeDays.map(day => {
                const daySchedule = timetable.detailedSchedule[day];
                const existingSlot = daySchedule?.timeSlots.find(slot =>
                  slot.startTime === timeSlot.startTime && slot.endTime === timeSlot.endTime
                );

                const isChanged = isSlotChanged(day, timeSlot);
                const isClickable = permissions.canAddSlots || (existingSlot && permissions.canModifySlots);

                return (
                  <div
                    key={`${day}-${timeIndex}`}
                    className={`stg-schedule-cell ${existingSlot ? 'has-content' : 'empty'} ${isChanged ? 'changed' : ''} ${isClickable ? 'clickable' : ''}`}
                  >
                    {existingSlot ? (
                      <ScheduleSlotContent slot={existingSlot} />
                    ) : (
                      <EmptySlot canAdd={permissions.canAddSlots} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div className="stg-timetable-legend">
        <div className="stg-legend-title">범례</div>
        <div className="stg-legend-items">
          <div className="stg-legend-item">
            <div className="stg-legend-color class"></div>
            <span>정규 수업</span>
          </div>
          <div className="stg-legend-item">
            <div className="stg-legend-color external"></div>
            <span>외부 수업</span>
          </div>
          <div className="stg-legend-item">
            <div className="stg-legend-color self-study"></div>
            <span>자습</span>
          </div>
          {isComparisonMode && (
            <div className="stg-legend-item">
              <div className="stg-legend-color changed"></div>
              <span>변경됨</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 일정 슬롯 내용 컴포넌트
interface ScheduleSlotContentProps {
  slot: TimeSlot;
}

const ScheduleSlotContent: React.FC<ScheduleSlotContentProps> = ({ slot }) => {
  return (
    <div
      className={`stg-slot-content ${slot.type} ${slot.isAutoGenerated ? 'auto-generated' : ''}`}
      style={{ backgroundColor: slot.color }}
    >
      <div className="stg-slot-subject">{slot.subject}</div>
      {slot.teacher && (
        <div className="stg-slot-teacher">{slot.teacher}</div>
      )}
      {slot.location && (
        <div className="stg-slot-location">{slot.location}</div>
      )}
      {slot.isAutoGenerated && (
        <div className="stg-auto-badge">자동</div>
      )}
    </div>
  );
};

// 빈 슬롯 컴포넌트
interface EmptySlotProps {
  canAdd: boolean;
}

const EmptySlot: React.FC<EmptySlotProps> = ({ canAdd }) => {
  return (
    <div className={`stg-empty-slot ${canAdd ? 'can-add' : ''}`}>
      {canAdd && (
        <>
          <div className="stg-empty-icon">+</div>
          <div className="stg-empty-text">일정 추가</div>
        </>
      )}
    </div>
  );
};

export default SharedTimetableGrid;