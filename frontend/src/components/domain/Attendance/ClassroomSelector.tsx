import React from 'react';
import { Classroom } from '../../../types/attendance';
import './ClassroomSelector.css';

interface ClassroomSelectorProps {
  classrooms: Classroom[];
  selectedClassroom: Classroom | null;
  onClassroomChange: (classroom: Classroom) => void;
  onAddClassroom?: () => void;
  onEditSeats?: () => void;
  loading?: boolean;
}

export const ClassroomSelector: React.FC<ClassroomSelectorProps> = ({
  classrooms,
  selectedClassroom,
  onClassroomChange,
  onAddClassroom,
  onEditSeats,
  loading = false
}) => {
  const handleClassroomChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const classroomId = event.target.value;
    const classroom = classrooms.find(c => c.id === classroomId);
    if (classroom) {
      onClassroomChange(classroom);
    }
  };

  return (
    <div className="classroom-selector">
      <div className="classroom-selector__main">
        <label htmlFor="classroom-select" className="classroom-selector__label">
          강의실 선택:
        </label>
        <div className="classroom-selector__input-group">
          <select
            id="classroom-select"
            value={selectedClassroom?.id || ''}
            onChange={handleClassroomChange}
            disabled={loading}
            className="classroom-selector__select"
          >
            <option value="">강의실을 선택하세요</option>
            {classrooms.map(classroom => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.name} ({classroom.rows}×{classroom.cols})
              </option>
            ))}
          </select>
          {loading && (
            <div className="classroom-selector__loading">
              <div className="spinner"></div>
            </div>
          )}
        </div>
      </div>
      
      <div className="classroom-selector__actions">
        <button
          type="button"
          onClick={onAddClassroom}
          className="classroom-selector__button classroom-selector__button--primary"
          disabled={loading}
        >
          + 강의실 추가
        </button>
        <button
          type="button"
          onClick={onEditSeats}
          className="classroom-selector__button classroom-selector__button--secondary"
          disabled={!selectedClassroom || loading}
        >
          🎯 좌석 편집
        </button>
      </div>
      
      {selectedClassroom && (
        <div className="classroom-selector__info">
          <div className="classroom-info">
            <span className="classroom-info__name">{selectedClassroom.name}</span>
            <span className="classroom-info__size">
              {selectedClassroom.rows}×{selectedClassroom.cols} ({selectedClassroom.seats.length}석)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassroomSelector;
