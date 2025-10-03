/**
 * SimpleTimetableGrid.tsx - 간소화된 시간표 그리드 컴포넌트
 *
 * Phase 2 구현:
 * - 학생용 간소화된 시간표 그리드
 * - 편집 가능한 시간 슬롯 표시
 * - 원본/편집본 비교 모드 지원
 * - 클릭으로 편집 모달 호출
 */

import React, { useMemo } from 'react';
import { StudentTimetableData } from '../../../types/student';

// --- Helper Functions (컴포넌트 바깥으로 분리) ---
const generateTimeSlots = () => {
    const slots = [];
    const startHour = 9;
    const endHour = 24;
    const interval = 30;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let min = 0; min < 60; min += interval) {
        const timeString = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const minutes = hour * 60 + min;
        const nextMinutes = minutes + interval;

        slots.push({
          time: timeString,
          startMinutes: minutes,
          endMinutes: nextMinutes
        });
      }
    }

    return slots;
};

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// --- Component ---
interface SimpleTimetableGridProps {
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

const SimpleTimetableGrid: React.FC<SimpleTimetableGridProps> = ({
  timetable,
  permissions,
  isComparisonMode,
  originalTimetable
}) => {

  // 특정 요일의 시간 슬롯 매핑
  const getTimeSlotMapping = (day: string, targetTimetable: StudentTimetableData) => {
    const daySchedule = targetTimetable.detailedSchedule[day];
    const timeSlots = generateTimeSlots();
    const mapping: { [key: string]: any } = {};
    const occupiedSlots = new Set<number>();

    // 모든 슬롯을 매핑 (자습은 읽기 전용으로 표시)
    if (daySchedule) {
      daySchedule.timeSlots.forEach(slot => {
        const slotStartMinutes = timeToMinutes(slot.startTime);
        const slotEndMinutes = timeToMinutes(slot.endTime);

        const startSlotIndex = timeSlots.findIndex(ts =>
          ts.startMinutes <= slotStartMinutes && ts.endMinutes > slotStartMinutes
        );

        if (startSlotIndex !== -1) {
          const spanCount = Math.ceil((slotEndMinutes - slotStartMinutes) / 30);

          for (let i = 0; i < spanCount; i++) {
            occupiedSlots.add(startSlotIndex + i);
          }

          mapping[startSlotIndex] = {
            ...slot,
            spanCount: Math.max(1, spanCount),
            isReadOnly: slot.type === 'self_study' // 자습은 읽기 전용
          };
        }
      });
    }

    // 자습 슬롯은 표시하지 않음 (자동 자습 채우기 제거)

    return mapping;
  };

  // ✅ 선언 순서 수정: dailyMappings를 먼저 선언합니다.
  const timeSlots = useMemo(() => generateTimeSlots(), []);

  const dailyMappings = useMemo(() => {
    const allMappings: { [key: string]: { [key: string]: any } } = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
      allMappings[day] = getTimeSlotMapping(day, timetable);
    });
    return allMappings;
  }, [timetable]);

  const originalDailyMappings = useMemo(() => {
    const allMappings: { [key: string]: { [key: string]: any } } = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
      allMappings[day] = getTimeSlotMapping(day, originalTimetable);
    });
    return allMappings;
  }, [originalTimetable]);

  // ✅ 이제 isSlotModified는 항상 최신 dailyMappings를 사용합니다.
  const isSlotModified = (day: string, slotIndex: number): boolean => {
    if (!isComparisonMode) return false;

    const currentMapping = dailyMappings[day];
    const originalMapping = originalDailyMappings[day];
    const currentSlot = currentMapping[slotIndex];
    const originalSlot = originalMapping[slotIndex];

    if (!currentSlot && !originalSlot) return false;
    if (!currentSlot || !originalSlot) return true;

    return JSON.stringify(currentSlot) !== JSON.stringify(originalSlot);
  };

  // 슬롯이 편집 제한된 시간대인지 확인
  const isSlotRestricted = (timeSlot: string): boolean => {
    return permissions.restrictedTimeSlots?.includes(timeSlot) || false;
  };



  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayNames = ['월', '화', '수', '목', '금', '토', '일'];

  return (
    <div className="stg-container">
      <div className="stg-grid-wrapper">
        <table className="stg-grid">
          <thead>
            <tr>
              <th className="stg-time-header">시간</th>
              {daysOfWeek.map((day, index) => (
                <th key={day} className="stg-day-header">
                  {dayNames[index]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((slot, slotIndex) => (
              <tr key={slotIndex}>
                <td className="stg-time-cell">
                  {slot.time}
                </td>
                {daysOfWeek.map((day) => {
                  // 성능 최적화: 미리 계산된 결과 사용
                  const timeSlotMapping = dailyMappings[day];
                  const timeSlot = timeSlotMapping[slotIndex];
                  const isModified = isSlotModified(day, slotIndex);
                  const isRestricted = isSlotRestricted(slot.time);

                  if (timeSlot) {
                    const isReadOnly = timeSlot.isReadOnly || timeSlot.type === 'self_study';
                    const isClickable = !isComparisonMode && !isRestricted && !isReadOnly;
                    
                    return (
                      <td
                        key={`${day}-${slotIndex}`}
                        className={`stg-slot stg-slot-filled ${isModified ? 'stg-slot-modified' : ''} ${isRestricted ? 'stg-slot-restricted' : ''} ${isReadOnly ? 'stg-slot-readonly' : ''} ${isClickable ? 'stg-slot-clickable' : ''}`}
                        rowSpan={timeSlot.spanCount}
                        style={{
                          backgroundColor: timeSlot.color || '#f0f0f0',
                          borderColor: timeSlot.color || '#2196f3',
                          opacity: isReadOnly ? 0.6 : 1
                        }}
                        title={
                          isReadOnly
                            ? '자습 시간은 편집할 수 없습니다'
                            : isRestricted
                              ? '편집 제한된 시간대입니다'
                              : isComparisonMode
                                ? '비교 모드에서는 편집할 수 없습니다'
                                : '클릭하여 편집'
                        }
                      >
                        <div className="stg-slot-content">
                          {timeSlot.type !== 'self_study' && (
                            <div className="stg-slot-subject">
                              {timeSlot.subject}
                              {isModified && <span className="stg-modified-indicator">●</span>}
                            </div>
                          )}
                          <div className="stg-slot-time">
                            {timeSlot.startTime} - {timeSlot.endTime}
                          </div>
                          {timeSlot.teacher && (
                            <div className="stg-slot-teacher">{timeSlot.teacher}</div>
                          )}
                          {timeSlot.location && (
                            <div className="stg-slot-location">{timeSlot.location}</div>
                          )}
                          <div className={`stg-slot-type ${timeSlot.type}`}>
                            {timeSlot.type === 'class' ? '수업' :
                             timeSlot.type === 'self_study' ? '자습' : '외부수업'}
                          </div>
                        </div>
                      </td>
                    );
                  }

                  // 이미 다른 수업이 차지한 셀인지 확인
                  const isOccupied = Object.keys(timeSlotMapping).some(startIndex => {
                    const slot = timeSlotMapping[startIndex];
                    const startIdx = parseInt(startIndex);
                    return slotIndex > startIdx && slotIndex < startIdx + slot.spanCount;
                  });

                  if (isOccupied) {
                    return null;
                  }

                  // 빈 셀
                  return (
                    <td
                      key={`${day}-${slotIndex}`}
                      className={`stg-slot stg-slot-empty ${!isComparisonMode ? 'stg-slot-clickable' : ''}`}
                      title={
                        isComparisonMode
                          ? '비교 모드에서는 편집할 수 없습니다'
                          : '시간표 편집 버튼을 사용하여 수업을 추가하세요'
                      }
                    >
                      <div className="stg-slot-content">
                        <div className="stg-slot-placeholder">+</div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 비교 모드 안내 */}
      {isComparisonMode && (
        <div className="stg-comparison-notice">
          <span className="stg-notice-icon">👀</span>
          <span className="stg-notice-text">원본 시간표를 확인하고 있습니다. 편집하려면 편집본으로 돌아가세요.</span>
        </div>
      )}

      {/* 범례 */}
      <div className="stg-legend">
        <div className="stg-legend-item">
          <span className="stg-legend-dot stg-legend-class"></span>
          <span>수업</span>
        </div>
        <div className="stg-legend-item">
          <span className="stg-legend-dot stg-legend-external"></span>
          <span>외부수업</span>
        </div>
        <div className="stg-legend-item">
          <span className="stg-legend-dot stg-legend-self-study"></span>
          <span>자습 (읽기 전용)</span>
        </div>
        {isComparisonMode && (
          <div className="stg-legend-item">
            <span className="stg-modified-indicator">●</span>
            <span>변경됨</span>
          </div>
        )}
        {permissions.restrictedTimeSlots && permissions.restrictedTimeSlots.length > 0 && (
          <div className="stg-legend-item">
            <span className="stg-legend-dot stg-legend-restricted"></span>
            <span>편집 제한</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleTimetableGrid;