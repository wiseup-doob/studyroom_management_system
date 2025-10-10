import React, { useState, useEffect } from 'react';
import attendanceService from '../../../services/attendanceService';
import type { Student } from '../../../types/student';
import type { AttendanceStudentPin } from '../../../types/attendance';
import './StudentPinManagement.css';

interface StudentPinManagementProps {
  students: Student[];
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

interface StudentPinInfo {
  studentId: string;
  studentName: string;
  pin: string | null;
  actualPin?: string; // 실제 PIN 번호 (생성/변경 시 저장)
  hasPin: boolean;
  isLocked: boolean;
  failedAttempts?: number;
  lastUsedAt?: Date;
}

const StudentPinManagement: React.FC<StudentPinManagementProps> = ({
  students,
  onSuccess,
  onError
}) => {
  const [studentPins, setStudentPins] = useState<StudentPinInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 모든 학생의 PIN 정보 로드
  const loadAllStudentPins = async () => {
    setLoading(true);

    try {
      const pinsInfo: StudentPinInfo[] = await Promise.all(
        students.map(async (student) => {
          try {
            const pinData = await attendanceService.getStudentPin(student.id);

            return {
              studentId: student.id,
              studentName: student.name,
              pin: pinData?.actualPin || null, // DB에서 실제 PIN 표시
              actualPin: pinData?.actualPin,
              hasPin: !!pinData,
              isLocked: pinData?.isLocked || false,
              failedAttempts: pinData?.failedAttempts || 0,
              lastUsedAt: pinData?.lastUsedAt
            };
          } catch (error) {
            // 개별 학생 PIN 조회 실패 시
            return {
              studentId: student.id,
              studentName: student.name,
              pin: null,
              hasPin: false,
              isLocked: false
            };
          }
        })
      );

      setStudentPins(pinsInfo);
    } catch (error: any) {
      console.error('PIN 목록 로드 실패:', error);
      onError?.('PIN 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (students.length > 0) {
      loadAllStudentPins();
    }
  }, [students]);

  // 랜덤 PIN 생성 (4-6자리)
  const generateRandomPin = (): string => {
    const length = Math.floor(Math.random() * 3) + 4; // 4, 5, 6 중 랜덤
    let pin = '';
    for (let i = 0; i < length; i++) {
      pin += Math.floor(Math.random() * 10).toString();
    }
    return pin;
  };

  // PIN 생성
  const handleGeneratePin = async (studentId: string, studentName: string) => {
    if (!confirm(`${studentName} 학생의 새 PIN을 생성하시겠습니까?`)) return;

    setIsSubmitting(true);

    try {
      // 랜덤 PIN 생성
      const newPin = generateRandomPin();

      await attendanceService.generateStudentPin({
        studentId,
        pin: newPin
      });

      onSuccess?.(`${studentName} 학생의 PIN이 생성되었습니다: ${newPin}`);

      // PIN 목록 새로고침 (DB에서 actualPin 가져옴)
      await loadAllStudentPins();
    } catch (error: any) {
      onError?.(error.message || 'PIN 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // PIN 수정 시작
  const handleEditPin = (studentId: string) => {
    setEditingStudent(studentId);
    setNewPin('');
  };

  // PIN 수정 취소
  const handleCancelEdit = () => {
    setEditingStudent(null);
    setNewPin('');
  };

  // PIN 수정 제출
  const handleSubmitPin = async (studentId: string, studentName: string) => {
    if (newPin.length < 4 || newPin.length > 6) {
      onError?.('PIN은 4~6자리 숫자여야 합니다.');
      return;
    }

    if (!/^\d+$/.test(newPin)) {
      onError?.('PIN은 숫자만 입력 가능합니다.');
      return;
    }

    setIsSubmitting(true);

    try {
      await attendanceService.updateStudentPin({
        studentId,
        newPin
      });

      onSuccess?.(`${studentName} 학생의 PIN이 변경되었습니다.`);

      // 편집 모드 종료
      setEditingStudent(null);
      setNewPin('');

      // PIN 목록 새로고침 (DB에서 actualPin 가져옴)
      await loadAllStudentPins();
    } catch (error: any) {
      onError?.(error.message || 'PIN 변경에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // PIN 잠금 해제
  const handleUnlockPin = async (studentId: string, studentName: string) => {
    if (!confirm(`${studentName} 학생의 PIN 잠금을 해제하시겠습니까?`)) return;

    setIsSubmitting(true);

    try {
      await attendanceService.unlockStudentPin(studentId);
      onSuccess?.(`${studentName} 학생의 PIN 잠금이 해제되었습니다.`);

      // PIN 목록 새로고침
      await loadAllStudentPins();
    } catch (error: any) {
      onError?.(error.message || 'PIN 잠금 해제에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 검색 필터링
  const filteredStudentPins = studentPins.filter((pinInfo) =>
    pinInfo.studentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="student-pin-management">
        <h2>학생 PIN 관리</h2>
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>PIN 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="student-pin-management">
      <div className="pin-header">
        <h2>학생 PIN 관리</h2>
        <p className="pin-description">
          학생들의 출석 체크용 PIN을 관리합니다. PIN은 4~6자리 숫자입니다.
        </p>
      </div>

      {/* 검색 입력 */}
      <div className="search-box">
        <input
          type="text"
          className="search-input"
          placeholder="학생 이름으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="search-clear"
            onClick={() => setSearchQuery('')}
          >
            ✕
          </button>
        )}
      </div>

      {studentPins.length === 0 ? (
        <div className="empty-state">
          <p>등록된 학생이 없습니다.</p>
        </div>
      ) : filteredStudentPins.length === 0 ? (
        <div className="empty-state">
          <p>검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="pin-list">
          <table className="pin-table">
            <thead>
              <tr>
                <th>학생 이름</th>
                <th>PIN 번호</th>
                <th>실패 횟수</th>
                <th>마지막 사용</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudentPins.map((pinInfo) => (
                <tr key={pinInfo.studentId} className={pinInfo.isLocked ? 'locked-row' : ''}>
                  <td className="student-name-cell">
                    <strong>{pinInfo.studentName}</strong>
                  </td>
                  <td className="pin-status-cell">
                    {editingStudent === pinInfo.studentId ? (
                      <input
                        type="text"
                        className="pin-input"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        placeholder="4~6자리 숫자"
                        maxLength={6}
                        autoFocus
                      />
                    ) : (
                      <div className="pin-status">
                        {pinInfo.hasPin ? (
                          <>
                            <span className="pin-value">{pinInfo.pin}</span>
                            {pinInfo.isLocked && (
                              <span className="locked-badge">🔒 잠김</span>
                            )}
                          </>
                        ) : (
                          <span className="no-pin">PIN 없음</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="attempts-cell">
                    {pinInfo.hasPin ? (
                      <span className={pinInfo.failedAttempts && pinInfo.failedAttempts > 0 ? 'attempts-warning' : ''}>
                        {pinInfo.failedAttempts || 0} / 5
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="last-used-cell">
                    {formatDate(pinInfo.lastUsedAt)}
                  </td>
                  <td className="actions-cell">
                    {editingStudent === pinInfo.studentId ? (
                      <div className="edit-actions">
                        <button
                          className="btn-save"
                          onClick={() => handleSubmitPin(pinInfo.studentId, pinInfo.studentName)}
                          disabled={isSubmitting}
                        >
                          저장
                        </button>
                        <button
                          className="btn-cancel"
                          onClick={handleCancelEdit}
                          disabled={isSubmitting}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="pin-actions">
                        {pinInfo.hasPin ? (
                          <>
                            <button
                              className="btn-edit"
                              onClick={() => handleEditPin(pinInfo.studentId)}
                              disabled={isSubmitting}
                            >
                              변경
                            </button>
                            {pinInfo.isLocked && (
                              <button
                                className="btn-unlock"
                                onClick={() => handleUnlockPin(pinInfo.studentId, pinInfo.studentName)}
                                disabled={isSubmitting}
                              >
                                잠금해제
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            className="btn-generate"
                            onClick={() => handleGeneratePin(pinInfo.studentId, pinInfo.studentName)}
                            disabled={isSubmitting}
                          >
                            생성
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StudentPinManagement;
