import React, { useState, useMemo } from 'react';
import { Student } from '../../../types/student';
import { SeatLayoutSeat, SeatAssignment } from '../../../types/attendance';
import './AssignSeatModal.css';

interface AssignSeatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (data: {
    studentId: string;
    seatId: string;
    seatNumber: string;
  }) => Promise<void>;
  students: Student[];
  seat: SeatLayoutSeat | null;
  assignments: SeatAssignment[];
}

export const AssignSeatModal: React.FC<AssignSeatModalProps> = ({
  isOpen,
  onClose,
  onAssign,
  students,
  seat,
  assignments
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 할당되지 않은 학생 목록
  const availableStudents = useMemo(() => {
    const assignedStudentIds = new Set(assignments.map(a => a.studentId));
    return students.filter(s => !assignedStudentIds.has(s.id) && s.isActive);
  }, [students, assignments]);

  // 검색 필터링
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return availableStudents;

    const query = searchQuery.toLowerCase().trim();
    return availableStudents.filter(student =>
      student.name.toLowerCase().includes(query) ||
      student.email.toLowerCase().includes(query) ||
      student.grade.includes(query)
    );
  }, [availableStudents, searchQuery]);

  // 선택된 학생 정보
  const selectedStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  const handleAssign = async () => {
    if (!selectedStudentId || !seat) {
      setError('학생과 좌석을 모두 선택해주세요.');
      return;
    }

    // TODO: 시간표 검증 로직 추가
    // const student = students.find(s => s.id === selectedStudentId);
    // if (!student.activeTimetable) {
    //   setError('해당 학생에게 활성 시간표가 없습니다. 먼저 시간표를 생성해주세요.');
    //   return;
    // }

    setIsSubmitting(true);
    setError(null);

    try {
      await onAssign({
        studentId: selectedStudentId,
        seatId: seat.id,
        seatNumber: seat.label
      });

      // 성공 시 초기화 및 닫기
      setSelectedStudentId('');
      setSearchQuery('');
      onClose();
    } catch (err: any) {
      setError(err.message || '좌석 할당에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setSelectedStudentId('');
    setSearchQuery('');
    setError(null);
    onClose();
  };

  if (!isOpen || !seat) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="modal-header">
          <h2 className="modal-title">좌석 할당</h2>
          <button
            type="button"
            onClick={handleCancel}
            className="modal-close"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 바디 */}
        <div className="modal-body">
          {/* 좌석 정보 */}
          <div className="seat-info-box">
            <div className="seat-info-box__label">선택된 좌석</div>
            <div className="seat-info-box__value">{seat.label}</div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="error-message">
              <span className="error-message__icon">⚠️</span>
              <span className="error-message__text">{error}</span>
            </div>
          )}

          {/* 학생 검색 */}
          <div className="form-group">
            <label className="form-label">학생 검색</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름, 이메일, 학년으로 검색..."
              className="form-input"
            />
          </div>

          {/* 학생 목록 */}
          <div className="form-group">
            <label className="form-label">
              학생 선택 ({filteredStudents.length}명)
            </label>
            <div className="student-list">
              {filteredStudents.length > 0 ? (
                filteredStudents.map(student => (
                  <div
                    key={student.id}
                    className={`student-item ${
                      selectedStudentId === student.id ? 'student-item--selected' : ''
                    }`}
                    onClick={() => setSelectedStudentId(student.id)}
                  >
                    <div className="student-item__info">
                      <div className="student-item__name">{student.name}</div>
                      <div className="student-item__details">
                        <span className="student-item__grade">{student.grade}</span>
                        <span className="student-item__email">{student.email}</span>
                      </div>
                    </div>
                    {selectedStudentId === student.id && (
                      <div className="student-item__check">✓</div>
                    )}
                  </div>
                ))
              ) : (
                <div className="student-list--empty">
                  <div className="empty-icon">😔</div>
                  <div className="empty-text">
                    {searchQuery ? '검색 결과가 없습니다' : '할당 가능한 학생이 없습니다'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 선택된 학생 미리보기 */}
          {selectedStudent && (
            <div className="selected-student-preview">
              <div className="preview-label">선택된 학생</div>
              <div className="preview-content">
                <div className="preview-name">{selectedStudent.name}</div>
                <div className="preview-details">
                  {selectedStudent.grade} · {selectedStudent.email}
                </div>
                {/* TODO: 시간표 정보 표시 */}
                {/* {selectedStudent.activeTimetable ? (
                  <div className="preview-timetable">
                    ✅ 시간표: {selectedStudent.activeTimetable.name}
                  </div>
                ) : (
                  <div className="preview-warning">
                    ⚠️ 활성 시간표 없음
                  </div>
                )} */}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="modal-footer">
          <button
            type="button"
            onClick={handleCancel}
            className="btn btn--secondary"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleAssign}
            className="btn btn--primary"
            disabled={!selectedStudentId || isSubmitting}
          >
            {isSubmitting ? '할당 중...' : '할당'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignSeatModal;
