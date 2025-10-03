# 등원/하원 시간 편집 기능 추가 구현 계획

## 📋 개요

현재 학생 시간표 공유 링크 편집 기능은 `detailedSchedule`(구체적인 수업 일정)만 편집 가능하고, `basicSchedule`(등원/하원 시간)은 편집할 수 없습니다. 이 기능을 확장하여 학생이 등원/하원 시간까지 포함하여 시간표를 완전히 편집할 수 있도록 구현합니다.

## 🔍 현재 시스템 분석

### 기존 데이터 구조

**실제 DB 구조 (BasicSchedule)**:
```typescript
interface BasicSchedule {
  dailySchedules: {
    [key in DayOfWeek]: {          // 월~일 각각
      arrivalTime: string;         // "09:00"
      departureTime: string;       // "18:00"  
      isActive: boolean;           // 해당 요일 활성화 여부
    };
  };
  timeSlotInterval: number;        // 30 (분 단위)
}
```

**현재 시간 제한 (실제 DB 확인)**:
- **최대 학습 시간**: 16시간 (960분)
- **최소 시간 간격**: 15분
- **최소 수업 시간**: 30분
- **시간 범위**: 00:00 ~ 23:59

**현재 편집 권한**:
```typescript
interface EditPermissions {
  canAddSlots: boolean;           // 수업 추가
  canDeleteSlots: boolean;        // 수업 삭제
  canModifySlots: boolean;        // 수업 수정
  restrictedTimeSlots?: string[]; // 제한된 시간대
}
```

### 문제점
1. `basicSchedule` 편집 권한이 없음
2. 요일별 개별 등원/하원 시간 편집 불가
3. 시간 간격 설정 편집 불가
4. 기존 UI는 관리자용으로만 설계됨

## 🎯 구현 목표

1. **등원/하원 시간 편집**: 학생이 요일별로 개별 등원/하원 시간 설정 가능
2. **시간 간격 편집**: 시간표 슬롯 간격 조정 가능
3. **요일 활성화/비활성화**: 특정 요일 학습 여부 설정 가능
4. **권한 기반 제어**: 관리자가 세부 권한 설정 가능
5. **실시간 동기화**: Firebase 기반 실시간 편집 상태 관리
6. **승인 워크플로우**: 관리자 승인 후 원본 시간표에 반영

## 📊 상세 구현 계획

### Phase 1: 백엔드 권한 시스템 확장

#### 1.1 편집 권한 타입 확장

**파일**: `functions/src/modules/personal/shareScheduleManagement.ts`

```typescript
// 확장된 편집 권한 인터페이스
interface ExtendedEditPermissions {
  // 기존 권한 (detailedSchedule)
  canAddSlots: boolean;
  canDeleteSlots: boolean;
  canModifySlots: boolean;
  restrictedTimeSlots?: string[];
  
  // 새로운 권한 (basicSchedule)
  canEditBasicSchedule: boolean;
  canEditDailySchedules: boolean;        // 요일별 스케줄 편집
  canEditTimeSlotInterval: boolean;      // 시간 간격 편집
  
  // 요일별 세부 권한 (실제 dailySchedules 구조 반영)
  dailySchedulePermissions: {
    [key in DayOfWeek]: {
      canEditArrivalTime: boolean;       // 해당 요일 등원 시간 편집
      canEditDepartureTime: boolean;     // 해당 요일 하원 시간 편집
      canToggleActive: boolean;          // 해당 요일 활성화/비활성화
    };
  };
  
  // 전역 제한사항
  timeSlotIntervalOptions?: number[];    // 허용된 시간 간격 옵션
}
```

#### 1.2 링크 생성 시 권한 설정

**파일**: `frontend/src/pages/TimeTable/components/ShareLinkModal.tsx`

```typescript
// 실제 DB 시간 제한 반영한 권한 설정
editPermissions: {
  // 기존 권한
  canAddSlots: true,
  canDeleteSlots: true,
  canModifySlots: true,
  restrictedTimeSlots: [],
  
  // 새로운 권한
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
```

#### 1.3 편집 상태 변경사항 추적 확장

**파일**: `functions/src/modules/personal/shareScheduleManagement.ts`

```typescript
// 확장된 변경사항 추적 인터페이스
interface ExtendedChanges {
  // 기존 변경사항
  addedSlots: TimeSlot[];
  modifiedSlots: string[];
  deletedSlots: string[];
  
  // 새로운 변경사항 (실제 dailySchedules 구조 반영)
  basicScheduleChanges: {
    dailyScheduleChanges: {
      [key in DayOfWeek]?: {
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
  } | null;
}
```

#### 1.4 편집 상태 업데이트 로직 수정

**파일**: `functions/src/modules/personal/shareScheduleManagement.ts`

```typescript
// updateEditState 함수 수정 - 실제 DB 시간 제한 반영
export const updateEditState = functions.https.onRequest(async (req, res) => {
  // basicSchedule 변경사항 처리 (실제 dailySchedules 구조 반영)
  if (data.basicScheduleChanges) {
    const { dailyScheduleChanges, timeSlotIntervalChanged } = data.basicScheduleChanges;
    
    // 권한 검증
    if (!permissions.canEditBasicSchedule) {
      res.status(403).json({ error: "기본 스케줄 편집 권한이 없습니다." });
      return;
    }
    
    // 요일별 권한 및 시간 제한 검증 (실제 DB 구조 반영)
    for (const [day, changes] of Object.entries(dailyScheduleChanges || {})) {
      const dayPermissions = permissions.dailySchedulePermissions[day as DayOfWeek];
      
      if (changes.arrivalTimeChanged && !dayPermissions.canEditArrivalTime) {
        res.status(403).json({ error: `${day} 등원 시간 편집 권한이 없습니다.` });
        return;
      }
      
      if (changes.departureTimeChanged && !dayPermissions.canEditDepartureTime) {
        res.status(403).json({ error: `${day} 하원 시간 편집 권한이 없습니다.` });
        return;
      }
      
      // 실제 DB 시간 제한 검증
      const { updatedSchedule } = changes;
      
      // 등원/하원 시간 순서 검증
      if (updatedSchedule.arrivalTime >= updatedSchedule.departureTime) {
        res.status(400).json({ error: `${day}의 하원 시간은 등원 시간보다 늦어야 합니다.` });
        return;
      }
      
      // 16시간 제한 검증 (실제 DB 제한 반영)
      const startMinutes = timeToMinutes(updatedSchedule.arrivalTime);
      const endMinutes = timeToMinutes(updatedSchedule.departureTime);
      if (endMinutes - startMinutes > 16 * 60) {
        res.status(400).json({ error: `${day}은 하루 16시간을 초과할 수 없습니다.` });
        return;
      }
    }
    
    // 시간 간격 검증 (실제 DB 제한 반영)
    if (timeSlotIntervalChanged) {
      const newInterval = data.basicScheduleChanges.updatedTimeSlotInterval;
      if (newInterval < 15) {
        res.status(400).json({ error: "시간 간격은 최소 15분 이상이어야 합니다." });
        return;
      }
    }
    
    // 편집 상태 업데이트 (실제 dailySchedules 구조 반영)
    await editStateDoc.ref.update({
      "currentTimetable.basicSchedule": data.updatedBasicSchedule,
      "changes.basicScheduleChanges": data.basicScheduleChanges,
      updatedAt: admin.firestore.Timestamp.now()
    });
  }
});
```

### Phase 2: 프론트엔드 UI 확장

#### 2.1 학생용 기본 스케줄 편집 컴포넌트 생성

**신규 파일**: `frontend/src/pages/StudentTimetableSharedEdit/components/BasicScheduleEditModal.tsx`

```typescript
interface BasicScheduleEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  basicSchedule: BasicSchedule;           // 실제 dailySchedules 구조
  permissions: ExtendedEditPermissions;
  onSave: (updatedBasicSchedule: BasicSchedule) => void;
}

const BasicScheduleEditModal: React.FC<BasicScheduleEditModalProps> = ({
  isOpen,
  onClose,
  basicSchedule,
  permissions,
  onSave
}) => {
  // 실제 dailySchedules 구조에 맞는 상태 관리
  const [formData, setFormData] = useState<BasicSchedule>({
    dailySchedules: { ...basicSchedule.dailySchedules },
    timeSlotInterval: basicSchedule.timeSlotInterval
  });

  // 요일별 시간 업데이트 함수 (실제 구조 반영)
  const updateDaySchedule = (day: DayOfWeek, updates: {
    arrivalTime?: string;
    departureTime?: string;
    isActive?: boolean;
  }) => {
    setFormData(prev => ({
      ...prev,
      dailySchedules: {
        ...prev.dailySchedules,
        [day]: {
          ...prev.dailySchedules[day],
          ...updates
        }
      }
    }));
  };

  // 유효성 검사 (실제 DB 제한 반영)
  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    // 요일 이름 매핑 (실제 프로젝트 구조 반영)
    const dayNames: { [key: string]: string } = {
      monday: '월요일',
      tuesday: '화요일',
      wednesday: '수요일',
      thursday: '목요일',
      friday: '금요일',
      saturday: '토요일',
      sunday: '일요일'
    };

    // 시간을 분으로 변환하는 유틸리티 함수 (실제 프로젝트 구조 반영)
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    Object.entries(formData.dailySchedules).forEach(([day, schedule]) => {
      if (schedule.isActive) {
        const startMinutes = timeToMinutes(schedule.arrivalTime);
        const endMinutes = timeToMinutes(schedule.departureTime);
        
        // 등원/하원 시간 순서 검증
        if (startMinutes >= endMinutes) {
          errors.push(`${dayNames[day]}의 하원 시간은 등원 시간보다 늦어야 합니다.`);
        }
        
        // 16시간 제한 검증
        if (endMinutes - startMinutes > 16 * 60) {
          errors.push(`${dayNames[day]}은 하루 16시간을 초과할 수 없습니다.`);
        }
      }
    });
    
    // 시간 간격 검증
    if (formData.timeSlotInterval < 15) {
      errors.push("시간 간격은 최소 15분 이상이어야 합니다.");
    }
    
    return errors;
  };

  return (
    <div className="basic-schedule-edit-modal">
      <h3>등원/하원 시간 편집</h3>
      
      {/* 시간 간격 설정 */}
      {permissions.canEditTimeSlotInterval && (
        <div className="time-slot-interval">
          <label>시간 간격 (분)</label>
          <select 
            value={formData.timeSlotInterval}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              timeSlotInterval: parseInt(e.target.value)
            }))}
          >
            {permissions.timeSlotIntervalOptions?.map(interval => (
              <option key={interval} value={interval}>{interval}분</option>
            ))}
          </select>
        </div>
      )}

      {/* 요일별 스케줄 편집 (실제 dailySchedules 구조 반영) */}
      {Object.entries(formData.dailySchedules).map(([day, schedule]) => (
        <div key={day} className="day-schedule">
          <h4>{DAY_LABELS[day as DayOfWeek]}</h4>
          
          {/* 요일 활성화 토글 */}
          {permissions.dailySchedulePermissions[day as DayOfWeek].canToggleActive && (
            <label>
              <input
                type="checkbox"
                checked={schedule.isActive}
                onChange={(e) => updateDaySchedule(day as DayOfWeek, {
                  isActive: e.target.checked
                })}
              />
              활성화
            </label>
          )}

          {/* 등원/하원 시간 (활성화된 요일만) */}
          {schedule.isActive && (
            <div className="time-inputs">
              {/* 등원 시간 */}
              {permissions.dailySchedulePermissions[day as DayOfWeek].canEditArrivalTime && (
                <div className="arrival-time">
                  <label>등원 시간</label>
                  <input
                    type="time"
                    value={schedule.arrivalTime}
                    onChange={(e) => updateDaySchedule(day as DayOfWeek, {
                      arrivalTime: e.target.value
                    })}
                  />
                </div>
              )}

              {/* 하원 시간 */}
              {permissions.dailySchedulePermissions[day as DayOfWeek].canEditDepartureTime && (
                <div className="departure-time">
                  <label>하원 시간</label>
                  <input
                    type="time"
                    value={schedule.departureTime}
                    min={schedule.arrivalTime} // 등원 시간보다 늦어야 함
                    onChange={(e) => updateDaySchedule(day as DayOfWeek, {
                      departureTime: e.target.value
                    })}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      
      {/* 저장 버튼 */}
      <div className="modal-actions">
        <button onClick={onClose}>취소</button>
        <button onClick={() => onSave(formData)} disabled={validateForm().length > 0}>
          저장
        </button>
      </div>
    </div>
  );
};
```

**신규 파일**: `frontend/src/pages/StudentTimetableSharedEdit/components/BasicScheduleEditModal.css`

```css
/* BasicScheduleEditModal.css - 기본 스케줄 편집 모달 스타일 */

.basic-schedule-edit-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 16px;
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

.time-slot-interval {
  margin-bottom: 24px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 12px;
}

.time-slot-interval label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
}

.time-slot-interval select {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
}

.day-schedule {
  margin-bottom: 20px;
  padding: 16px;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  background: #fff;
}

.day-schedule h4 {
  margin: 0 0 16px 0;
  color: #495057;
  font-size: 18px;
  font-weight: 600;
}

.day-schedule label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-weight: 500;
  color: #333;
}

.day-schedule input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #007bff;
}

.time-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.arrival-time,
.departure-time {
  display: flex;
  flex-direction: column;
}

.arrival-time label,
.departure-time label {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #666;
}

.arrival-time input,
.departure-time input {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e9ecef;
}

.modal-actions button {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-actions button:first-child {
  background: #6c757d;
  color: white;
}

.modal-actions button:first-child:hover {
  background: #5a6268;
}

.modal-actions button:last-child {
  background: #007bff;
  color: white;
}

.modal-actions button:last-child:hover:not(:disabled) {
  background: #0056b3;
}

.modal-actions button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
```

#### 2.2 기존 편집 페이지에 기본 스케줄 편집 기능 추가

**수정 파일**: `frontend/src/pages/StudentTimetableSharedEdit/StudentTimetableSharedEdit.tsx`

```typescript
const StudentTimetableSharedEdit: React.FC = () => {
  // 기존 상태들...
  const [isBasicScheduleModalOpen, setIsBasicScheduleModalOpen] = useState(false);
  
  // 기본 스케줄 편집 핸들러
  const handleEditBasicSchedule = () => {
    if (shareData?.permissions.canEditBasicSchedule) {
      setIsBasicScheduleModalOpen(true);
    }
  };
  
  // 기본 스케줄 저장 핸들러
  const handleSaveBasicSchedule = async (updatedBasicSchedule: BasicSchedule) => {
    if (!editState) return;

    try {
      // 편집 상태 업데이트
      const newEditState = {
        ...editState,
        currentTimetable: {
          ...editState.currentTimetable,
          basicSchedule: updatedBasicSchedule
        }
      };

      setEditState(newEditState);

      // Firebase 자동 저장 (기존 useEffect에서 처리됨)
      console.log('기본 스케줄이 업데이트되었습니다:', updatedBasicSchedule);

      // 사용 기록 로깅
      if (shareToken) {
        try {
          await editLinkService.recordUsage({
            shareToken: shareToken,
            action: 'edited',
            details: '등원/하원 시간을 수정했습니다.'
          });
        } catch (logError) {
          console.warn('사용 기록 저장 실패:', logError);
        }
      }
    } catch (error) {
      console.error('기본 스케줄 저장 실패:', error);
      throw error;
    }
  };

  return (
    <div className="ste-container">
      {/* 헤더 - 기존 SharedEditHeader에 새로운 props 추가 */}
      <SharedEditHeader
        student={shareData.student}
        timetable={shareData.timetable}
        hasChanges={hasChanges}
        totalChanges={totalChanges}
        showComparison={showComparison}
        onToggleComparison={toggleComparison}
        onSubmit={handleSubmit}
        isSubmitDisabled={totalChanges === 0 || isSubmitting}
        onEditTimetable={handleEditTimetable}
        onEditBasicSchedule={handleEditBasicSchedule}
        canEditBasicSchedule={shareData?.permissions.canEditBasicSchedule}
      />

      {/* 시간표 그리드 */}
      <div className="ste-main-content">
        {displayTimetable && (
          <SimpleTimetableGrid
            timetable={displayTimetable}
            permissions={shareData.permissions}
            isComparisonMode={showComparison}
            originalTimetable={editState.originalTimetable}
          />
        )}
      </div>

      {/* 기본 스케줄 편집 모달 */}
      {isBasicScheduleModalOpen && editState && (
        <BasicScheduleEditModal
          isOpen={isBasicScheduleModalOpen}
          onClose={() => setIsBasicScheduleModalOpen(false)}
          basicSchedule={editState.currentTimetable.basicSchedule}
          permissions={shareData.permissions}
          onSave={handleSaveBasicSchedule}
        />
      )}

      {/* 시간 슬롯 편집 모달 (기존) */}
      {isEditModalOpen && editState && (
        <TimeSlotEditModal
          isOpen={isEditModalOpen}
          onClose={closeEditModal}
          onAddClass={handleAddClass}
          onDeleteClass={handleDeleteClass}
          timetable={editState.currentTimetable}
        />
      )}

      {/* 제출 확인 모달 (기존) */}
      {isSubmissionModalOpen && (
        <SubmissionConfirmModal
          isOpen={isSubmissionModalOpen}
          onClose={() => setIsSubmissionModalOpen(false)}
          onConfirm={handleConfirmSubmission}
          student={shareData.student}
          timetable={shareData.timetable}
          changes={currentChanges || { modifiedSlots: [], addedSlots: [], deletedSlots: [] }}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
};
```

#### 2.3 헤더 컴포넌트 수정

**수정 파일**: `frontend/src/pages/StudentTimetableSharedEdit/components/SharedEditHeader.tsx`

```typescript
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
  canEditBasicSchedule?: boolean;
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
  onEditBasicSchedule,
  canEditBasicSchedule
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
          {/* 기본 스케줄 편집 버튼 추가 */}
          {canEditBasicSchedule && (
            <button
              className="seh-btn-edit-basic"
              onClick={onEditBasicSchedule}
              title="등원/하원 시간 편집"
            >
              <span className="seh-btn-icon">⏰</span>
              <span className="seh-btn-text">등원시간 편집</span>
            </button>
          )}

          {/* 기존 시간표 편집 버튼 */}
          <button
            className="seh-btn-edit"
            onClick={onEditTimetable}
            title="시간표 편집"
          >
            <span className="seh-btn-icon">✏️</span>
            <span className="seh-btn-text">시간표 편집</span>
          </button>

          {/* 기존 비교 토글 버튼 */}
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

          {/* 기존 제출 버튼 */}
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

      {/* 기존 안내 메시지 바... */}
    </div>
  );
};
```

### Phase 3: 승인/거부 시스템 확장

#### 3.1 관리자 승인 UI에서 기본 스케줄 변경사항 표시

**수정 파일**: `frontend/src/components/notifications/ContributionReviewModal.tsx`

```typescript
const ContributionReviewModal: React.FC = () => {
  // 기본 스케줄 변경사항 비교 표시
  const renderBasicScheduleChanges = () => {
    if (!changes.basicScheduleChanges) return null;
    
    const { dailyScheduleChanges, timeSlotIntervalChanged, originalTimeSlotInterval, updatedTimeSlotInterval } = changes.basicScheduleChanges;
    
    // 요일 이름 매핑 (실제 프로젝트 구조 반영)
    const dayNames: { [key: string]: string } = {
      monday: '월요일',
      tuesday: '화요일',
      wednesday: '수요일',
      thursday: '목요일',
      friday: '금요일',
      saturday: '토요일',
      sunday: '일요일'
    };
    
    return (
      <div className="basic-schedule-changes">
        <h4>등원/하원 시간 변경사항</h4>
        
        {/* 시간 간격 변경 */}
        {timeSlotIntervalChanged && (
          <div className="interval-change">
            <h5>시간 간격</h5>
            <div className="change-comparison">
              <span className="original">
                {changes.basicScheduleChanges.originalTimeSlotInterval}분
              </span>
              <span className="arrow">→</span>
              <span className="updated">
                {changes.basicScheduleChanges.updatedTimeSlotInterval}분
              </span>
            </div>
          </div>
        )}
        
        {/* 요일별 변경사항 */}
        <div className="daily-changes">
          {Object.entries(dailyScheduleChanges || {}).map(([day, dayChanges]) => (
            <div key={day} className="day-change">
              <h5>{dayNames[day]}</h5>
              <div className="change-comparison">
                <div className="original">
                  <h6>원본</h6>
                  <p>등원: {dayChanges.originalSchedule.arrivalTime}</p>
                  <p>하원: {dayChanges.originalSchedule.departureTime}</p>
                  <p>활성: {dayChanges.originalSchedule.isActive ? '예' : '아니오'}</p>
                </div>
                <div className="arrow">→</div>
                <div className="updated">
                  <h6>변경 후</h6>
                  <p>등원: {dayChanges.updatedSchedule.arrivalTime}</p>
                  <p>하원: {dayChanges.updatedSchedule.departureTime}</p>
                  <p>활성: {dayChanges.updatedSchedule.isActive ? '예' : '아니오'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <div className="contribution-review-modal">
      {/* 기존 내용... */}
      {renderBasicScheduleChanges()}
    </div>
  );
};
```

#### 3.2 승인 시 기본 스케줄 반영

**수정 파일**: `functions/src/modules/personal/shareScheduleManagement.ts`

```typescript
// processEditSubmission 함수 수정
export const processEditSubmission = functions.https.onCall(async (data: any, context: any) => {
  // 기존 로직...
  
  if (action === "approve") {
    const timetableRef = db
      .collection("users")
      .doc(userId)
      .collection("student_timetables")
      .doc(editStateData.timetableId);
    
    const updateData: any = {
      detailedSchedule: editStateData.currentTimetable.detailedSchedule,
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    // 기본 스케줄 변경사항이 있으면 반영 (실제 dailySchedules 구조 반영)
    if (editStateData.changes.basicScheduleChanges) {
      updateData.basicSchedule = editStateData.currentTimetable.basicSchedule;
      
      // 버전 관리 업데이트
      const newVersion = admin.firestore.Timestamp.now().toMillis().toString();
      updateData.version = newVersion;
      updateData.lastUpdatedAt = admin.firestore.Timestamp.now();
      updateData.lastUpdatedBy = "student_edit";
    }
    
    await timetableRef.update(updateData);
    
    // 편집 상태를 승인됨으로 업데이트
    await editStateDoc.ref.update({
      status: "approved",
      appliedAt: admin.firestore.Timestamp.now()
    });
  }
});
```

### Phase 4: 백엔드 서비스 확장

#### 4.1 백엔드 서비스 메서드 수정

**수정 파일**: `frontend/src/services/backendService.ts`

```typescript
class BackendService {
  // 기존 메서드들...

  /**
   * 편집 상태 업데이트 (기존 메서드 확장)
   * 현재 구조: updateEditState(shareToken, currentTimetable, changes)
   */
  async updateEditState(data: {
    shareToken: string;
    currentTimetable: StudentTimetableData;
    changes: any; // ExtendedChanges 타입으로 확장 필요
  }): Promise<any> {
    try {
      const functionUrl = 'https://asia-northeast3-studyroommanagementsystemtest.cloudfunctions.net/updateEditState';
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '편집 상태 업데이트 실패');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('편집 상태 업데이트 실패:', error);
      throw error;
    }
  }
}
```

#### 4.2 변경사항 분석 함수 확장

**수정 파일**: `frontend/src/pages/StudentTimetableSharedEdit/StudentTimetableSharedEdit.tsx`

```typescript
// 기본 스케줄 변경사항 분석 함수 추가
const analyzeBasicScheduleChanges = (original: BasicSchedule, current: BasicSchedule) => {
  const dailyScheduleChanges: any = {};
  let timeSlotIntervalChanged = false;
  
  // 시간 간격 변경 확인
  if (original.timeSlotInterval !== current.timeSlotInterval) {
    timeSlotIntervalChanged = true;
  }
  
  // 요일별 변경사항 분석
  Object.keys(current.dailySchedules).forEach(day => {
    const originalSchedule = original.dailySchedules[day as DayOfWeek];
    const currentSchedule = current.dailySchedules[day as DayOfWeek];
    
    const hasChanges = 
      originalSchedule.arrivalTime !== currentSchedule.arrivalTime ||
      originalSchedule.departureTime !== currentSchedule.departureTime ||
      originalSchedule.isActive !== currentSchedule.isActive;
    
    if (hasChanges) {
      dailyScheduleChanges[day] = {
        arrivalTimeChanged: originalSchedule.arrivalTime !== currentSchedule.arrivalTime,
        departureTimeChanged: originalSchedule.departureTime !== currentSchedule.departureTime,
        isActiveChanged: originalSchedule.isActive !== currentSchedule.isActive,
        originalSchedule: { ...originalSchedule },
        updatedSchedule: { ...currentSchedule }
      };
    }
  });
  
  const hasBasicScheduleChanges = Object.keys(dailyScheduleChanges).length > 0 || timeSlotIntervalChanged;
  
  return {
    dailyScheduleChanges,
    timeSlotIntervalChanged,
    originalTimeSlotInterval: original.timeSlotInterval,
    updatedTimeSlotInterval: current.timeSlotInterval,
    hasChanges: hasBasicScheduleChanges
  };
};

// 기존 analyzeTimeSlotChanges 함수와 통합하여 확장된 변경사항 분석
const analyzeAllChanges = (original: StudentTimetableData, current: StudentTimetableData) => {
  // 기존 detailedSchedule 변경사항 분석
  const detailedScheduleChanges = analyzeTimeSlotChanges(original, current);
  
  // 새로운 basicSchedule 변경사항 분석
  const basicScheduleChanges = analyzeBasicScheduleChanges(original.basicSchedule, current.basicSchedule);
  
  // 통합된 변경사항 반환
  return {
    ...detailedScheduleChanges,
    basicScheduleChanges: basicScheduleChanges.hasChanges ? basicScheduleChanges : null
  };
};

// 기존 useEffect에서 사용하는 변경사항 분석 로직 수정
useEffect(() => {
  if (!editState || !shareToken) return;

  console.log('%c[Firebase Auto Save] 실행됨', 'color: orange;');
  console.log('현재 editState:', editState);

  // 확장된 변경사항 감지 (detailedSchedule + basicSchedule)
  const changes = analyzeAllChanges(editState.originalTimetable, editState.currentTimetable);
  
  // 전체 변경사항 개수 계산 (기존 로직과 동일하게 유지)
  const detailedChanges = changes.addedSlots.length + changes.modifiedSlots.length + changes.deletedSlots.length;
  const basicChanges = changes.basicScheduleChanges ? 1 : 0; // basicSchedule 변경은 1건으로 계산
  const totalChanges = detailedChanges + basicChanges;
  const hasChanged = totalChanges > 0;

  console.log('변경사항 감지:', hasChanged, '총 변경 건수:', totalChanges);
  console.log('detailedSchedule 변경:', detailedChanges, 'basicSchedule 변경:', basicChanges);

  // 실제 변경사항이 있을 때만 Firebase에 저장
  if (hasChanged) {
    const saveToFirebase = async () => {
      try {
        await backendService.updateEditState({
          shareToken,
          currentTimetable: editState.currentTimetable,
          changes: changes
        });
        console.log('%c[Firebase] 실제 변경사항 감지! 데이터를 저장했습니다.', 'color: violet;');
        console.log('저장된 변경사항:', changes);
      } catch (error) {
        console.error('Firebase 저장 실패:', error);
      }
    };

    // 디바운싱 적용 (500ms 후 저장)
    const timeoutId = setTimeout(saveToFirebase, 500);
    return () => clearTimeout(timeoutId);
  } else {
    console.log('%c[Firebase] 실제 변경사항 없음 - 저장 안함', 'color: gray;');
  }
}, [editState, shareToken]);
```

## 📋 구현 파일 목록

### 백엔드 수정 파일
1. `functions/src/modules/personal/shareScheduleManagement.ts`
   - `ExtendedEditPermissions` 인터페이스 추가
   - `ExtendedChanges` 인터페이스 추가
   - `createStudentTimetableEditLink` 함수 수정 (권한 확장)
   - `updateEditState` 함수 수정 (기본 스케줄 변경사항 처리)
   - `processEditSubmission` 함수 수정 (기본 스케줄 승인 반영)

### 프론트엔드 수정 파일
1. `frontend/src/pages/TimeTable/components/ShareLinkModal.tsx`
   - `editPermissions` 확장 (기본 스케줄 편집 권한 추가)

2. `frontend/src/pages/StudentTimetableSharedEdit/`
   - `components/BasicScheduleEditModal.tsx` (신규 생성)
   - `components/BasicScheduleEditModal.css` (신규 생성)
   - `components/SharedEditHeader.tsx` (기본 스케줄 편집 버튼 추가)
   - `StudentTimetableSharedEdit.tsx` (기본 스케줄 편집 기능 추가, 변경사항 분석 로직 확장)

3. `frontend/src/components/notifications/ContributionReviewModal.tsx`
   - 기본 스케줄 변경사항 표시 기능 추가

4. `frontend/src/services/backendService.ts`
   - 기존 `updateEditState` 메서드는 그대로 사용 (확장된 changes 객체 지원)

## 📊 예상 개발 일정

- **Phase 1 (백엔드 권한 시스템)**: 2일
- **Phase 2 (프론트엔드 UI)**: 3일  
- **Phase 3 (승인/거부 시스템)**: 2일
- **Phase 4 (백엔드 서비스)**: 1일
- **테스트 및 검증**: 2일
- **총 예상 기간**: 10일

## 🎯 주요 고려사항

### 1. **실제 DB 구조 반영**
- `dailySchedules` 객체 구조에 맞춘 편집 UI
- 요일별 개별 등원/하원 시간 설정 가능
- 실제 DB 시간 제한 (16시간, 15분 간격) 반영

### 2. **권한 세분화**
- 요일별로 세부 권한 제어
- 등원/하원 시간별 개별 권한 설정
- 시간 간격 편집 권한 분리

### 3. **실시간 동기화**
- Firebase 기반 실시간 편집 상태 관리
- 기본 스케줄 변경사항도 자동 저장
- 디바운싱을 통한 성능 최적화

### 4. **변경사항 추적**
- 기본 스케줄 변경사항 상세 추적
- 원본과 수정본 비교 기능
- 관리자 승인 시 변경사항 표시

### 5. **사용자 경험**
- 기존 편집 UI와 일관된 디자인
- 직관적인 요일별 편집 인터페이스
- 실시간 유효성 검사 및 피드백

### 6. **보안 및 안전성**
- 권한 기반 접근 제어
- 실제 DB 제한 반영한 검증
- 승인 기반 워크플로우로 데이터 무결성 보장

## 🚀 기대 효과

1. **완전한 시간표 편집**: 학생이 등원/하원 시간까지 포함하여 시간표를 완전히 편집 가능
2. **유연한 스케줄 관리**: 요일별로 다른 등원/하원 시간 설정으로 개인 맞춤 학습 환경 제공
3. **세밀한 권한 제어**: 관리자가 요일별, 시간별로 세부 권한 설정 가능
4. **실시간 협업**: Firebase 기반 실시간 편집 상태 동기화
5. **안전한 승인 시스템**: 관리자 승인 후에만 원본 시간표에 반영하여 데이터 무결성 보장

이 계획을 통해 학생이 등원/하원 시간까지 포함하여 시간표를 완전히 편집할 수 있게 되며, 관리자는 세부적인 권한 제어와 승인 시스템을 통해 안전하게 관리할 수 있습니다.
