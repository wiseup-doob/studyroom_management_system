/**
 * StudentListPanel.tsx - 학생 목록 패널 컴포넌트 (검은색/하얀색 테마)
 *
 * Phase 2 구현:
 * - 학생 목록 표시
 * - 검색 기능
 * - 선택 상태 관리
 * - 기본 스타일링
 */

import React, { useState } from 'react';
import { StudentWithTimetable } from '../../../types/student';
import './StudentListPanel.css';

interface StudentListPanelProps {
  students: StudentWithTimetable[];
  selectedStudent: StudentWithTimetable | null;
  onStudentSelect: (student: StudentWithTimetable) => void;
  onStudentCreate: () => void;
  onRefresh: () => void;
}

const StudentListPanel: React.FC<StudentListPanelProps> = ({
  students,
  selectedStudent,
  onStudentSelect,
  onStudentCreate,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 검색 필터링
  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.grade.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.email && student.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 검색어 하이라이트 함수
  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="slp-search-highlight">{part}</mark>
      ) : part
    );
  };

  return (
    <div className="slp-main-panel">
      {/* 헤더 */}
      <div className="slp-panel-header">
        <h2>학생 목록</h2>
        <div className="slp-header-actions">
          <button
            className="slp-btn-refresh"
            onClick={onRefresh}
            title="새로고침"
          >
            🔄
          </button>
          <button
            className="slp-btn-add-student"
            onClick={onStudentCreate}
          >
            + 학생 추가
          </button>
        </div>
      </div>

      {/* 검색 */}
      <div className="slp-search-container">
        <input
          type="text"
          placeholder="학생 이름, 학년, 이메일로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="slp-search-input"
        />
      </div>

      {/* 학생 목록 */}
      <div className="slp-student-list">
        {students.length === 0 ? (
          <div className="slp-empty-state">
            <h3>학생이 없습니다</h3>
            <p>새로운 학생을 추가해보세요.</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="slp-empty-state">
            <h3>검색 결과가 없습니다</h3>
            <p>다른 검색어를 시도해보세요.</p>
          </div>
        ) : (
          filteredStudents.map((student) => {
            const isSelected = selectedStudent?.id === student.id;
            
            return (
              <div
                key={student.id}
                className={`slp-student-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onStudentSelect(student)}
              >
                <div className="slp-student-avatar">
                  {student.name.charAt(0).toUpperCase()}
                </div>
                <div className="slp-student-info">
                  <h3 className="slp-student-name">
                    {highlightSearchTerm(student.name, searchTerm)}
                  </h3>
                  <p className="slp-student-details">
                    {student.grade}
                    {student.email && ` • ${student.email}`}
                  </p>
                </div>
                {student.activeTimetable && (
                  <div className="slp-timetable-badge">
                    시간표 있음
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default StudentListPanel;