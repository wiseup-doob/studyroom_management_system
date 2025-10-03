/**
 * TimetableGrid.tsx - 시간표 그리드 컴포넌트
 *
 * Phase 2 구현:
 * - 그리드 레이아웃 구성
 * - 시간 슬롯 생성 로직
 * - 요일별 표시
 * - 기본 CSS 스타일링
 */

import React, { useState } from 'react';
import { StudentTimetableData, TimeSlot, DayOfWeek } from '../../../types/student';
import { studentTimetableService } from '../../../services/backendService';
import './TimetableGrid.css';

interface TimetableGridProps {
  timetable: StudentTimetableData;
  onTimetableUpdate: (timetable: StudentTimetableData) => void;
}

const TimetableGrid: React.FC<TimetableGridProps> = ({
  timetable,
  onTimetableUpdate
}) => {
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  

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
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // 시간 슬롯 생성 (등원 시간부터 하원 시간까지)
  const generateTimeSlots = () => {
    const slots = [];
    const { timeSlotInterval } = timetable.basicSchedule;

    // 모든 활성 요일의 시간 범위를 조합하여 전체 시간 슬롯 생성
    const activeDays = Object.keys(timetable.basicSchedule.dailySchedules).filter(
      day => timetable.basicSchedule.dailySchedules[day as DayOfWeek].isActive
    );

    if (activeDays.length === 0) return [];

    // 첫 번째 활성 요일의 시간을 기준으로 사용 (모든 요일이 동일한 시간대를 사용한다고 가정)
    const firstActiveDay = activeDays[0] as DayOfWeek;
    const { arrivalTime, departureTime } = timetable.basicSchedule.dailySchedules[firstActiveDay];

    const startMinutes = timeToMinutes(arrivalTime);
    const endMinutes = timeToMinutes(departureTime);

    for (let minutes = startMinutes; minutes < endMinutes; minutes += timeSlotInterval) {
      slots.push({
        startTime: minutesToTime(minutes),
        endTime: minutesToTime(minutes + timeSlotInterval)
      });
    }

    return slots;
  };

  // 자동 자습시간 채우기
  const handleAutoFill = async () => {
    try {
      setIsAutoFilling(true);
      const updatedTimetable = await studentTimetableService.autoFillStudentTimetable(timetable.id);
      onTimetableUpdate(updatedTimetable);
    } catch (error) {
      console.error('자동 채우기 실패:', error);
      alert('자동 채우기에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsAutoFilling(false);
    }
  };


  // 시간표 데이터
  const timeSlots = generateTimeSlots();
  const activeDays = Object.keys(timetable.basicSchedule.dailySchedules).filter(
    day => timetable.basicSchedule.dailySchedules[day as DayOfWeek].isActive
  ) as DayOfWeek[];

  // 통계 계산
  const totalSlots = activeDays.length * timeSlots.length;
  const filledSlots = Object.values(timetable.detailedSchedule).reduce(
    (total, day) => total + day.timeSlots.length, 0
  );
  const fillPercentage = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

  return (
    <div className="tg-timetable-grid-container">
      {/* 도구 모음 */}
      <div className="tg-timetable-toolbar">
        <div className="tg-toolbar-left">
          <div className="tg-timetable-stats">
            <div className="tg-stat-badge">
              <span className="tg-stat-value">{filledSlots}</span>
              <span className="tg-stat-label">/ {totalSlots} 슬롯</span>
            </div>
            <div className="tg-stat-badge">
              <span className="tg-stat-value">{fillPercentage}%</span>
              <span className="tg-stat-label">채워짐</span>
            </div>
          </div>
        </div>

        <div className="tg-toolbar-right">
          <button
            onClick={handleAutoFill}
            disabled={isAutoFilling}
            className="tg-btn-auto-fill"
            title="빈 시간을 자동으로 자습시간으로 채웁니다"
          >
            {isAutoFilling ? (
              <>
                <span className="tg-btn-icon spinning">⏳</span>
                <span className="tg-btn-text">채우는 중...</span>
              </>
            ) : (
              <>
                <span className="tg-btn-icon">🔄</span>
                <span className="tg-btn-text">자동 자습시간 채우기</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 시간표 그리드 */}
      <div className="tg-timetable-grid">
        {/* 헤더: 시간 + 요일들 */}
        <div className="tg-grid-header">
          <div className="tg-time-column-header">
            <span className="tg-header-text">시간</span>
          </div>
          {activeDays.map((day: DayOfWeek) => (
            <div key={day} className="tg-day-header">
              <span className="tg-day-name">{dayNames[day as keyof typeof dayNames]}</span>
              <span className="tg-day-abbr">{day.slice(0, 3)}</span>
            </div>
          ))}
        </div>

        {/* 시간 슬롯들 */}
        <div className="tg-grid-body">
          {timeSlots.map((timeSlot, timeIndex) => (
            <div key={timeIndex} className="tg-time-row">
              {/* 시간 컬럼 */}
              <div className="tg-time-cell">
                <div className="tg-time-display">
                  <span className="tg-time-start">{timeSlot.startTime}</span>
                  <span className="tg-time-separator">-</span>
                  <span className="tg-time-end">{timeSlot.endTime}</span>
                </div>
              </div>

              {/* 각 요일별 셀 */}
              {activeDays.map((day: DayOfWeek) => {
                const daySchedule = timetable.detailedSchedule[day];
                const existingSlot = daySchedule?.timeSlots.find(slot =>
                  slot.startTime === timeSlot.startTime && slot.endTime === timeSlot.endTime
                );

                return (
                  <div
                    key={`${day}-${timeIndex}`}
                    className={`tg-schedule-cell ${existingSlot ? 'has-content' : 'empty'}`}
                  >
                    {existingSlot ? (
                      <ScheduleSlotContent slot={existingSlot} />
                    ) : (
                      <EmptySlot />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div className="tg-timetable-legend">
        <div className="tg-legend-title">범례</div>
        <div className="tg-legend-items">
          <div className="tg-legend-item">
            <div className="tg-legend-color class"></div>
            <span>수업</span>
          </div>
          <div className="tg-legend-item">
            <div className="tg-legend-color self-study"></div>
            <span>자습</span>
          </div>
          <div className="tg-legend-item">
            <div className="tg-legend-color auto-generated"></div>
            <span>자동생성</span>
          </div>
          <div className="tg-legend-item">
            <div className="tg-legend-color empty"></div>
            <span>빈 시간</span>
          </div>
        </div>
      </div>

      {/* 도움말 */}
      <div className="help-section">
        <details>
          <summary>💡 사용법</summary>
          <div className="help-content">
            <ul>
              <li>빈 시간 슬롯을 클릭하여 새 일정을 추가할 수 있습니다</li>
              <li>기존 일정을 클릭하여 편집하거나 삭제할 수 있습니다</li>
              <li>"자동 자습시간 채우기" 버튼으로 빈 시간을 자습시간으로 채울 수 있습니다</li>
              <li>과목, 강사, 장소, 색상 등을 자유롭게 설정할 수 있습니다</li>
              <li>각 시간 슬롯에 메모를 추가할 수 있습니다</li>
            </ul>
          </div>
        </details>
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
      className={`tg-slot-content ${slot.type} ${slot.isAutoGenerated ? 'auto-generated' : ''}`}
      style={{ backgroundColor: slot.color }}
    >
      <div className="tg-slot-subject">{slot.subject}</div>
      {slot.teacher && (
        <div className="tg-slot-teacher">{slot.teacher}</div>
      )}
      {slot.location && (
        <div className="tg-slot-location">{slot.location}</div>
      )}
      {slot.isAutoGenerated && (
        <div className="tg-auto-badge">자동</div>
      )}
    </div>
  );
};

// 빈 슬롯 컴포넌트
const EmptySlot: React.FC = () => {
  return (
    <div className="tg-empty-slot">
      <div className="tg-empty-icon">+</div>
      <div className="tg-empty-text">일정 추가</div>
    </div>
  );
};

export default TimetableGrid;