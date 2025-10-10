import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import attendanceService from '../../services/attendanceService';
import AttendanceCheckResultModal from '../../components/domain/Attendance/AttendanceCheckResultModal';
import './AttendanceCheckIn.css';

const AttendanceCheckIn: React.FC = () => {
  const { linkToken } = useParams<{ linkToken: string }>();
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalResult, setModalResult] = useState<{
    success: boolean;
    action?: 'checked_in' | 'checked_out';
    message: string;
    studentName?: string;
    timestamp?: Date;
    isLate?: boolean;
    lateMinutes?: number;
    isEarlyLeave?: boolean;
    earlyLeaveMinutes?: number;
  } | null>(null);

  const handleNumberClick = (num: number) => {
    if (pin.length < 6) {
      setPin(pin + num);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    handleClear();
    setTimeout(() => {
      setModalResult(null);
    }, 300);
  };

  // 메시지에서 학생 이름 추출 (예: "홍길동님, 등원이 완료되었습니다." -> "홍길동")
  const extractStudentName = (message: string): string | undefined => {
    const match = message.match(/^(.+?)님[,，]/);
    return match ? match[1] : undefined;
  };

  const handleSubmit = async () => {
    if (!linkToken) {
      setModalResult({
        success: false,
        message: '유효하지 않은 링크입니다.'
      });
      setShowModal(true);
      return;
    }

    if (pin.length < 4) {
      setModalResult({
        success: false,
        message: 'PIN은 최소 4자리 이상이어야 합니다.'
      });
      setShowModal(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await attendanceService.checkAttendanceByPin({
        linkToken,
        pin
      });

      // 성공 결과를 모달에 표시
      setModalResult({
        success: true,
        action: result.action,
        message: result.message,
        studentName: extractStudentName(result.message),
        timestamp: new Date(),
        isLate: result.record.isLate,
        lateMinutes: result.record.lateMinutes,
        isEarlyLeave: result.record.isEarlyLeave,
        earlyLeaveMinutes: result.record.earlyLeaveMinutes
      });
      setShowModal(true);
    } catch (err: any) {
      // 에러 결과를 모달에 표시
      setModalResult({
        success: false,
        message: err.message || '출석 체크에 실패했습니다.'
      });
      setShowModal(true);
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="attendance-checkin">
      <div className="checkin-container">
        <div className="checkin-header">
          <h1 className="checkin-title">출석 체크</h1>
          <p className="checkin-subtitle">PIN 번호를 입력하세요</p>
        </div>

        {/* PIN 디스플레이 */}
        <div className="pin-display">
          {[...Array(6)].map((_, index) => (
            <div
              key={index}
              className={`pin-dot ${index < pin.length ? 'pin-dot--filled' : ''}`}
            >
              {index < pin.length && '●'}
            </div>
          ))}
        </div>

        {/* 숫자 패드 */}
        <div className="number-pad">
          <div className="number-pad__grid">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumberClick(num)}
                className="number-button"
                disabled={isSubmitting || pin.length >= 6}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="number-button number-button--clear"
              disabled={isSubmitting}
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleNumberClick(0)}
              className="number-button"
              disabled={isSubmitting || pin.length >= 6}
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="number-button number-button--backspace"
              disabled={isSubmitting || pin.length === 0}
            >
              ⌫
            </button>
          </div>
        </div>

        {/* 확인 버튼 */}
        <button
          type="button"
          onClick={handleSubmit}
          className="btn-submit"
          disabled={isSubmitting || pin.length < 4}
        >
          {isSubmitting ? '확인 중...' : '확인'}
        </button>
      </div>

      {/* 결과 모달 */}
      <AttendanceCheckResultModal
        isOpen={showModal}
        onClose={handleCloseModal}
        result={modalResult}
      />
    </div>
  );
};

export default AttendanceCheckIn;
