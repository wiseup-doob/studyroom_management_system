import React, { useState, useMemo } from 'react';
import { Student } from '../../../types/student';
import { SeatAssignment } from '../../../types/attendance';
import StudentSearch from './StudentSearch';
import './StudentAssignmentPanel.css';

interface StudentAssignmentPanelProps {
  students: Student[];
  assignments: SeatAssignment[];
  selectedSeatId: string | null;
  onAssignStudent: (studentId: string) => void;
  onUnassignStudent: (assignmentId: string) => void;
  onManagePin: (studentId: string) => void;
  loading?: boolean;
}

export const StudentAssignmentPanel: React.FC<StudentAssignmentPanelProps> = ({
  students,
  assignments,
  selectedSeatId,
  onAssignStudent,
  onUnassignStudent,
  onManagePin,
  loading = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // 할당되지 않은 학생 목록
  const unassignedStudents = useMemo(() => {
    const assignedStudentIds = new Set(assignments.map(a => a.studentId));
    return students.filter(s => !assignedStudentIds.has(s.id) && s.isActive);
  }, [students, assignments]);

  // 할당된 학생 목록
  const assignedStudents = useMemo(() => {
    return assignments.map(assignment => {
      const student = students.find(s => s.id === assignment.studentId);
      return {
        assignment,
        student
      };
    }).filter(item => item.student);
  }, [assignments, students]);

  // AttendanceStudent 타입으로 변환 (StudentSearch 컴포넌트 호환)
  const attendanceStudents = useMemo(() => {
    return unassignedStudents.map(s => ({
      id: s.id,
      name: s.name,
      studentId: s.email.split('@')[0] || s.id, // 이메일 앞부분을 studentId로 사용
      grade: s.grade,
      email: s.email,
      parentPhone: s.parentPhone
    }));
  }, [unassignedStudents]);

  const handleStudentSelect = (student: any) => {
    onAssignStudent(student.id);
  };

  return (
    <div className="student-assignment-panel">
      {/* 헤더 */}
      <div className="assignment-panel__header">
        <h3 className="assignment-panel__title">학생 할당</h3>
        {selectedSeatId && (
          <div className="assignment-panel__hint">
            좌석을 선택하여 학생을 배정하세요
          </div>
        )}
      </div>

      {/* 학생 검색 */}
      <div className="assignment-panel__search">
        <StudentSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          students={attendanceStudents}
          onStudentSelect={selectedSeatId ? handleStudentSelect : undefined}
          placeholder="학생 검색..."
          loading={loading}
        />
        {!selectedSeatId && (
          <div className="assignment-panel__search-hint">
            먼저 좌석을 선택해주세요
          </div>
        )}
      </div>

      {/* 할당된 학생 목록 */}
      <div className="assignment-panel__section">
        <div className="assignment-panel__section-header">
          <h4 className="assignment-panel__section-title">할당된 학생</h4>
          <span className="assignment-panel__count">{assignedStudents.length}</span>
        </div>

        <div className="assigned-students-list">
          {assignedStudents.length > 0 ? (
            assignedStudents.map(({ assignment, student }) => (
              <div key={assignment.id} className="assigned-student-card">
                <div className="assigned-student-card__info">
                  <div className="assigned-student-card__name">{student?.name}</div>
                  <div className="assigned-student-card__details">
                    <span className="assigned-student-card__seat">
                      좌석 {assignment.seatNumber}
                    </span>
                    <span className="assigned-student-card__grade">
                      {student?.grade}
                    </span>
                  </div>
                  {assignment.pin && (
                    <div className="assigned-student-card__pin-status">
                      {assignment.isPinLocked ? (
                        <span className="pin-badge pin-badge--locked">🔒 잠김</span>
                      ) : (
                        <span className="pin-badge pin-badge--active">🔓 활성</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="assigned-student-card__actions">
                  <button
                    type="button"
                    onClick={() => onManagePin(student?.id || '')}
                    className="btn-icon"
                    title="PIN 관리"
                  >
                    🔑
                  </button>
                  <button
                    type="button"
                    onClick={() => onUnassignStudent(assignment.id)}
                    className="btn-icon btn-icon--danger"
                    title="할당 해제"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="assigned-students-list--empty">
              <div className="empty-state__icon">📋</div>
              <div className="empty-state__text">할당된 학생이 없습니다</div>
              <div className="empty-state__hint">
                위 검색창에서 학생을 검색하여 배정하세요
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 할당 가능한 학생 통계 */}
      <div className="assignment-panel__stats">
        <div className="stat-item">
          <span className="stat-item__label">전체 학생:</span>
          <span className="stat-item__value">{students.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-item__label">할당 가능:</span>
          <span className="stat-item__value">{unassignedStudents.length}</span>
        </div>
      </div>
    </div>
  );
};

export default StudentAssignmentPanel;
