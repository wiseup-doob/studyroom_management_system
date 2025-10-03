import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { backendService } from '../../services/backendService';
import type { Student, CreateStudentRequest } from '../../types/student';
import './Student.css';

const Student: React.FC = () => {
  const { userProfile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newStudent, setNewStudent] = useState<CreateStudentRequest>({
    name: '',
    email: '',
    grade: '',
    phone: '',
    parentName: '',
    parentPhone: '',
    address: ''
  });

  // 학생 목록 로드
  const loadStudents = async () => {
    if (!userProfile) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // 실제 API 호출
      const studentsData = await backendService.getStudents();
      setStudents(studentsData);
      console.log('학생 목록 로드 성공:', studentsData.length);
    } catch (err) {
      console.error('학생 목록 로드 실패:', err);
      setError(err instanceof Error ? err.message : '학생 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 학생 추가
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    
          if (!newStudent.name || !newStudent.grade) {
            setError('이름, 학년은 필수 입력 항목입니다.');
            return;
          }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // 실제 API 호출
      const createdStudent = await backendService.createStudent(newStudent);
      setStudents(prev => [...prev, createdStudent]);
      setNewStudent({
        name: '',
        email: '',
        grade: '',
        phone: '',
        parentName: '',
        parentPhone: '',
        address: ''
      });
      setShowAddForm(false);
      setSuccess(`${createdStudent.name} 학생이 성공적으로 추가되었습니다.`);
      
      console.log('학생 추가 성공:', createdStudent);
    } catch (err) {
      console.error('학생 추가 실패:', err);
      setError(err instanceof Error ? err.message : '학생 추가에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 학생 수정 시작
  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setShowEditForm(true);
  };

  // 학생 수정
  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingStudent) return;

    if (!editingStudent.name || !editingStudent.grade) {
      setError('이름, 학년은 필수 입력 항목입니다.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // 실제 API 호출
      const updatedStudent = await backendService.updateStudent(editingStudent.id, {
        name: editingStudent.name,
        email: editingStudent.email,
        grade: editingStudent.grade,
        phone: editingStudent.phone,
        parentName: editingStudent.parentName,
        parentPhone: editingStudent.parentPhone,
        address: editingStudent.address
      });
      
      setStudents(prev => prev.map(student => 
        student.id === editingStudent.id ? updatedStudent : student
      ));
      
      setEditingStudent(null);
      setShowEditForm(false);
      setSuccess(`${updatedStudent.name} 학생 정보가 성공적으로 수정되었습니다.`);
      
      console.log('학생 수정 성공:', updatedStudent);
    } catch (err) {
      console.error('학생 수정 실패:', err);
      setError(err instanceof Error ? err.message : '학생 수정에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 학생 삭제
  const handleDeleteStudent = async (id: string) => {
    if (!confirm('정말로 이 학생을 삭제하시겠습니까?')) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 실제 API 호출
      await backendService.deleteStudent(id);
      const deletedStudent = students.find(s => s.id === id);
      setStudents(prev => prev.filter(student => student.id !== id));
      setSuccess(`${deletedStudent?.name || '학생'}이 성공적으로 삭제되었습니다.`);
      console.log('학생 삭제 성공:', id);
    } catch (err) {
      console.error('학생 삭제 실패:', err);
      setError(err instanceof Error ? err.message : '학생 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile) {
      loadStudents();
    }
  }, [userProfile]);

  // 성공 메시지 자동 제거
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000); // 5초 후 자동 제거

      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <div className="student-container">
      <div className="student-header">
        <h1>학생 관리</h1>
        <button 
          className="add-student-btn"
          onClick={() => setShowAddForm(true)}
        >
          + 학생 추가
        </button>
      </div>

      {loading && (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>처리 중입니다...</p>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <div className="error-icon">⚠️</div>
          <div className="error-content">
            <h3>오류가 발생했습니다</h3>
            <p>{error}</p>
            <button className="retry-btn" onClick={loadStudents}>
              다시 시도
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="success-message">
          <div className="success-icon">✅</div>
          <div className="success-content">
            <p>{success}</p>
            <button 
              className="close-btn" 
              onClick={() => setSuccess(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="add-student-form">
          <h2>새 학생 추가</h2>
          <form onSubmit={handleAddStudent}>
            <div className="form-row">
              <div className="form-group">
                <label>이름 *</label>
                <input
                  type="text"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                  required
                />
              </div>
                    <div className="form-group">
                      <label>이메일</label>
                      <input
                        type="email"
                        value={newStudent.email}
                        onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                      />
                    </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>학년 *</label>
                <select
                  value={newStudent.grade}
                  onChange={(e) => setNewStudent({...newStudent, grade: e.target.value})}
                  required
                >
                  <option value="">선택하세요</option>
                  <optgroup label="초등학교">
                    <option value="초1">초1</option>
                    <option value="초2">초2</option>
                    <option value="초3">초3</option>
                    <option value="초4">초4</option>
                    <option value="초5">초5</option>
                    <option value="초6">초6</option>
                  </optgroup>
                  <optgroup label="중학교">
                    <option value="중1">중1</option>
                    <option value="중2">중2</option>
                    <option value="중3">중3</option>
                  </optgroup>
                  <optgroup label="고등학교">
                    <option value="고1">고1</option>
                    <option value="고2">고2</option>
                    <option value="고3">고3</option>
                  </optgroup>
                </select>
              </div>
              <div className="form-group">
                <label>전화번호</label>
                <input
                  type="tel"
                  value={newStudent.phone}
                  onChange={(e) => setNewStudent({...newStudent, phone: e.target.value})}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>보호자 이름</label>
                <input
                  type="text"
                  value={newStudent.parentName}
                  onChange={(e) => setNewStudent({...newStudent, parentName: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>보호자 전화번호</label>
                <input
                  type="tel"
                  value={newStudent.parentPhone}
                  onChange={(e) => setNewStudent({...newStudent, parentPhone: e.target.value})}
                />
              </div>
            </div>

            <div className="form-group">
              <label>주소</label>
              <input
                type="text"
                value={newStudent.address}
                onChange={(e) => setNewStudent({...newStudent, address: e.target.value})}
              />
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? '추가 중...' : '추가'}
              </button>
              <button 
                type="button" 
                className="cancel-btn"
                onClick={() => setShowAddForm(false)}
                disabled={isSubmitting}
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {showEditForm && editingStudent && (
        <div className="add-student-form">
          <h2>학생 정보 수정</h2>
          <form onSubmit={handleUpdateStudent}>
            <div className="form-row">
              <div className="form-group">
                <label>이름 *</label>
                <input
                  type="text"
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({...editingStudent, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>이메일</label>
                <input
                  type="email"
                  value={editingStudent.email}
                  onChange={(e) => setEditingStudent({...editingStudent, email: e.target.value})}
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>학년 *</label>
                <select
                  value={editingStudent.grade}
                  onChange={(e) => setEditingStudent({...editingStudent, grade: e.target.value})}
                  required
                >
                  <option value="">선택하세요</option>
                  <optgroup label="초등학교">
                    <option value="초1">초1</option>
                    <option value="초2">초2</option>
                    <option value="초3">초3</option>
                    <option value="초4">초4</option>
                    <option value="초5">초5</option>
                    <option value="초6">초6</option>
                  </optgroup>
                  <optgroup label="중학교">
                    <option value="중1">중1</option>
                    <option value="중2">중2</option>
                    <option value="중3">중3</option>
                  </optgroup>
                  <optgroup label="고등학교">
                    <option value="고1">고1</option>
                    <option value="고2">고2</option>
                    <option value="고3">고3</option>
                  </optgroup>
                </select>
              </div>
              <div className="form-group">
                <label>전화번호</label>
                <input
                  type="tel"
                  value={editingStudent.phone || ''}
                  onChange={(e) => setEditingStudent({...editingStudent, phone: e.target.value})}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>보호자 이름</label>
                <input
                  type="text"
                  value={editingStudent.parentName || ''}
                  onChange={(e) => setEditingStudent({...editingStudent, parentName: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>보호자 전화번호</label>
                <input
                  type="tel"
                  value={editingStudent.parentPhone || ''}
                  onChange={(e) => setEditingStudent({...editingStudent, parentPhone: e.target.value})}
                />
              </div>
            </div>

            <div className="form-group">
              <label>주소</label>
              <input
                type="text"
                value={editingStudent.address || ''}
                onChange={(e) => setEditingStudent({...editingStudent, address: e.target.value})}
              />
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? '수정 중...' : '수정'}
              </button>
              <button 
                type="button" 
                className="cancel-btn"
                onClick={() => {
                  setEditingStudent(null);
                  setShowEditForm(false);
                }}
                disabled={isSubmitting}
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="students-list">
        <h2>학생 목록 ({students.length}명)</h2>
        {students.length === 0 ? (
          <div className="empty-state">
            <p>등록된 학생이 없습니다.</p>
          </div>
        ) : (
          <div className="students-grid">
            {students.map((student) => (
              <div key={student.id} className="student-card">
                <div className="student-info">
                  <h3>{student.name}</h3>
                  <p className="student-grade">{student.grade}</p>
                  <p className="student-email">{student.email}</p>
                  {student.phone && <p className="student-phone">{student.phone}</p>}
                  {student.parentName && (
                    <p className="student-parent">보호자: {student.parentName}</p>
                  )}
                </div>
                <div className="student-actions">
                  <button 
                    className="edit-btn"
                    onClick={() => handleEditStudent(student)}
                  >
                    수정
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={() => handleDeleteStudent(student.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Student;
