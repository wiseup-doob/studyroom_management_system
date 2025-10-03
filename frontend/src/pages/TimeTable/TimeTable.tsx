/**
 * TimeTable.tsx - 시간표 페이지 메인 컴포넌트
 *
 * Phase 1 기본 구현:
 * - 좌우 패널 레이아웃 구성
 * - 학생 목록과 시간표 패널 기본 구조
 * - 상태 관리 로직 구현
 */

import React, { useState, useEffect } from 'react';
import './TimeTable.css';
import { StudentWithTimetable, StudentTimetableData } from '../../types/student';
import { backendService, studentTimetableService } from '../../services/backendService';
import StudentListPanel from './components/StudentListPanel';
import StudentTimetablePanel from './components/StudentTimetablePanel';
import CreateTimetableModal, { CreateTimetableData } from './components/CreateTimetableModal';

// 로딩 컴포넌트 (임시)
const LoadingSpinner: React.FC = () => (
  <div className="tt-loading-spinner">
    <div className="tt-spinner"></div>
    <p>로딩 중...</p>
  </div>
);

// 에러 메시지 컴포넌트 (임시)
const ErrorMessage: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => (
  <div className="tt-error-message">
    <p>{message}</p>
    <button onClick={onClose}>닫기</button>
  </div>
);

const TimeTable: React.FC = () => {
  // ==================== 상태 관리 ====================
  const [students, setStudents] = useState<StudentWithTimetable[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithTimetable | null>(null);
  const [selectedTimetable, setSelectedTimetable] = useState<StudentTimetableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 모달 상태
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // ==================== 초기 데이터 로딩 ====================
  useEffect(() => {
    loadStudentsWithTimetables();
  }, []);

  const loadStudentsWithTimetables = async () => {
    try {
      setLoading(true);
      setError(null);

      const studentsData = await backendService.getStudentsWithTimetables();
      setStudents(studentsData);

      // 첫 번째 학생 자동 선택
      if (studentsData.length > 0) {
        handleStudentSelect(studentsData[0]);
      }
    } catch (err) {
      setError('학생 목록을 불러오는데 실패했습니다.');
      console.error('Error loading students:', err);
    } finally {
      setLoading(false);
    }
  };

  // ==================== 이벤트 핸들러 ====================

  // 학생 선택 처리
  const handleStudentSelect = async (student: StudentWithTimetable) => {
    try {
      setSelectedStudent(student);
      setSelectedTimetable(student.activeTimetable || null);
    } catch (err) {
      setError('학생 정보를 불러오는데 실패했습니다.');
      console.error('Error selecting student:', err);
    }
  };


  // 시간표 업데이트
  const handleTimetableUpdate = async (updatedTimetable: StudentTimetableData) => {
    try {
      setSelectedTimetable(updatedTimetable);

      // 학생 목록도 업데이트
      setStudents(prevStudents =>
        prevStudents.map(student =>
          student.id === selectedStudent?.id
            ? { ...student, activeTimetable: updatedTimetable }
            : student
        )
      );
    } catch (err) {
      setError('시간표 업데이트에 실패했습니다.');
      console.error('Error updating timetable:', err);
    }
  };

  // 새 시간표 생성
  const handleTimetableCreate = async () => {
    if (!selectedStudent) {
      setError('학생을 먼저 선택해주세요.');
      return;
    }
    setIsCreateModalOpen(true);
  };

  // 새 시간표 저장
  const handleCreateTimetableSave = async (timetableData: CreateTimetableData) => {
    if (!selectedStudent) return;

    try {
      const newTimetable = await studentTimetableService.createStudentTimetable({
        studentId: selectedStudent.id,
        ...timetableData
      });

      // 학생 목록 업데이트 - 새 시간표를 활성 시간표로 설정
      setStudents(prevStudents =>
        prevStudents.map(student =>
          student.id === selectedStudent.id
            ? { ...student, activeTimetable: newTimetable }
            : student
        )
      );

      // 선택된 시간표 업데이트
      setSelectedTimetable(newTimetable);

      setError(null);
    } catch (error) {
      console.error('시간표 생성 오류:', error);
      throw error;
    }
  };

  // ==================== 렌더링 ====================

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="tt-main-page">
      {error && (
        <ErrorMessage
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* 왼쪽: 학생 목록 패널 */}
      <div className="tt-student-list-section">
        <StudentListPanel
          students={students}
          selectedStudent={selectedStudent}
          onStudentSelect={handleStudentSelect}
          onStudentCreate={() => {}}
          onRefresh={loadStudentsWithTimetables}
        />
      </div>

      {/* 오른쪽: 시간표 패널 */}
      <div className="tt-timetable-section">
        {selectedStudent ? (
          <StudentTimetablePanel
            student={selectedStudent}
            timetable={selectedTimetable}
            onTimetableUpdate={handleTimetableUpdate}
            onTimetableCreate={handleTimetableCreate}
          />
        ) : (
          <div className="tt-empty-state">
            <h3>학생을 선택해주세요</h3>
            <p>왼쪽에서 학생을 선택하면 해당 학생의 시간표를 확인할 수 있습니다.</p>
          </div>
        )}
      </div>

      {/* 새 시간표 생성 모달 */}
      {selectedStudent && (
        <CreateTimetableModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleCreateTimetableSave}
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
        />
      )}
    </div>
  );
};


export default TimeTable;
