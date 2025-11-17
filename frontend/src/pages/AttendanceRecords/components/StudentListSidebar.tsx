/**
 * StudentListSidebar.tsx - 학생 목록 사이드바
 */

import React, { useState } from 'react';
import { Student } from '../../../types/student';
import StudentCard from './StudentCard';
import './StudentListSidebar.css';

interface StudentListSidebarProps {
  students: Student[];
  selectedStudent: Student | null;
  onStudentSelect: (student: Student) => void;
  attendanceRates?: Record<string, number>;
}

const StudentListSidebar: React.FC<StudentListSidebarProps> = ({
  students,
  selectedStudent,
  onStudentSelect,
  attendanceRates = {}
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="student-list-sidebar">
      <div className="sls-header">
        <h3 className="sls-title">학생 목록</h3>
        <div className="sls-search">
          <input
            type="text"
            className="sls-search-input"
            placeholder="학생 이름 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="sls-list">
        {filteredStudents.length === 0 ? (
          <div className="sls-empty">
            <p>검색 결과가 없습니다.</p>
          </div>
        ) : (
          filteredStudents.map(student => (
            <StudentCard
              key={student.id}
              student={student}
              isSelected={selectedStudent?.id === student.id}
              onClick={() => onStudentSelect(student)}
              attendanceRate={attendanceRates[student.id]}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default StudentListSidebar;
