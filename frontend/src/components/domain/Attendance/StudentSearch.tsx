import React, { useState, useMemo } from 'react';
import { AttendanceStudent } from '../../../types/attendance';
import './StudentSearch.css';

interface StudentSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  students: AttendanceStudent[];
  onStudentSelect?: (student: AttendanceStudent) => void;
  placeholder?: string;
  loading?: boolean;
}

export const StudentSearch: React.FC<StudentSearchProps> = ({
  searchQuery,
  onSearchChange,
  students,
  onStudentSelect,
  placeholder = "Q 원생을 검색하세요",
  loading = false
}) => {
  const [isFocused, setIsFocused] = useState(false);

  // 검색 결과 필터링
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase().trim();
    return students.filter(student =>
      student.name.toLowerCase().includes(query) ||
      student.studentId.toLowerCase().includes(query) ||
      student.grade.includes(query)
    );
  }, [students, searchQuery]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value);
  };

  const handleStudentClick = (student: AttendanceStudent) => {
    if (onStudentSelect) {
      onStudentSelect(student);
    }
    onSearchChange(''); // 검색어 초기화
    setIsFocused(false);
  };

  const handleClearSearch = () => {
    onSearchChange('');
    setIsFocused(false);
  };

  return (
    <div className="student-search">
      <div className="student-search__input-container">
        <div className="student-search__input-wrapper">
          <span className="student-search__icon">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              // 약간의 지연을 두어 클릭 이벤트가 처리되도록 함
              setTimeout(() => setIsFocused(false), 150);
            }}
            placeholder={placeholder}
            className="student-search__input"
            disabled={loading}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="student-search__clear"
              aria-label="검색어 지우기"
            >
              ✕
            </button>
          )}
          {loading && (
            <div className="student-search__loading">
              <div className="spinner"></div>
            </div>
          )}
        </div>
      </div>

      {/* 검색 결과 드롭다운 */}
      {isFocused && (searchQuery.trim() || filteredStudents.length > 0) && (
        <div className="student-search__results">
          {filteredStudents.length > 0 ? (
            <>
              <div className="student-search__results-header">
                <span className="student-search__results-count">
                  {filteredStudents.length}명의 학생을 찾았습니다
                </span>
              </div>
              <div className="student-search__results-list">
                {filteredStudents.map(student => (
                  <div
                    key={student.id}
                    className="student-search__result-item"
                    onClick={() => handleStudentClick(student)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleStudentClick(student);
                      }
                    }}
                  >
                    <div className="student-result">
                      <div className="student-result__info">
                        <div className="student-result__name">{student.name}</div>
                        <div className="student-result__details">
                          <span className="student-result__id">{student.studentId}</span>
                          <span className="student-result__grade">{student.grade}</span>
                        </div>
                      </div>
                      <div className="student-result__action">
                        <span className="student-result__arrow">→</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : searchQuery.trim() ? (
            <div className="student-search__no-results">
              <div className="no-results__icon">😔</div>
              <div className="no-results__text">
                <div className="no-results__title">검색 결과가 없습니다</div>
                <div className="no-results__subtitle">
                  다른 검색어를 시도해보세요
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default StudentSearch;
