/**
 * AttendanceRecords.tsx - 출결 기록 페이지
 *
 * 학생들의 출결 기록을 조회하고 통계를 확인할 수 있는 페이지
 */

import React, { useState, useEffect } from 'react';
import { Student } from '../../types/student';
import { StudentAttendanceRecord } from '../../types/attendance';
import { studentService } from '../../services/backendService';
import attendanceService from '../../services/attendanceService';
import StudentListSidebar from './components/StudentListSidebar';
import WeeklyView from './components/WeeklyView';
import MonthlyView from './components/MonthlyView';
import './AttendanceRecords.css';

type ViewTab = 'weekly' | 'monthly';

const AttendanceRecords: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('weekly');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [attendanceRecords, setAttendanceRecords] = useState<StudentAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  // TODO: 향후 출석률 계산 로직 추가
  const attendanceRates: Record<string, number> = {};

  // 학생 목록 조회
  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const data = await studentService.getStudents();
      setStudents(data);
      // 첫 번째 학생 자동 선택
      if (data.length > 0 && !selectedStudent) {
        setSelectedStudent(data[0]);
      }
    } catch (error) {
      console.error('학생 목록 조회 실패:', error);
    }
  };

  // 선택된 학생의 출석 기록 조회
  useEffect(() => {
    if (selectedStudent) {
      loadAttendanceRecords();
    }
  }, [selectedStudent, currentDate, activeTab]);

  const loadAttendanceRecords = async () => {
    if (!selectedStudent) return;

    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      const records = await attendanceService.getStudentAttendanceRecords({
        studentId: selectedStudent.id,
        startDate,
        endDate
      });
      setAttendanceRecords(records);
    } catch (error) {
      console.error('출석 기록 조회 실패:', error);
      setAttendanceRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // 조회 기간 계산
  const getDateRange = (): { startDate: string; endDate: string } => {
    if (activeTab === 'weekly') {
      // 주간: 월요일 ~ 일요일
      const weekStart = new Date(currentDate);
      const day = weekStart.getDay();
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      return {
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0]
      };
    } else {
      // 월간: 해당 월의 1일 ~ 마지막 날
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      return {
        startDate: monthStart.toISOString().split('T')[0],
        endDate: monthEnd.toISOString().split('T')[0]
      };
    }
  };

  // 주차 이동
  const handlePreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  // 월 이동
  const handlePreviousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  // 학생 선택
  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
  };

  return (
    <div className="attendance-records-page">
      <div className="ar-header">
        <h1 className="ar-title">출결 기록</h1>
        <p className="ar-subtitle">학생별 출석 기록 및 통계를 확인하세요</p>
      </div>

      <div className="ar-layout">
        {/* 좌측: 학생 목록 */}
        <StudentListSidebar
          students={students}
          selectedStudent={selectedStudent}
          onStudentSelect={handleStudentSelect}
          attendanceRates={attendanceRates}
        />

        {/* 우측: 출결 현황 */}
        <div className="ar-main">
          {!selectedStudent ? (
            <div className="ar-no-selection">
              <p>좌측에서 학생을 선택해주세요</p>
            </div>
          ) : (
            <>
              {/* 탭 헤더 */}
              <div className="ar-tabs">
                <button
                  className={`ar-tab ${activeTab === 'weekly' ? 'ar-tab--active' : ''}`}
                  onClick={() => setActiveTab('weekly')}
                >
                  주간
                </button>
                <button
                  className={`ar-tab ${activeTab === 'monthly' ? 'ar-tab--active' : ''}`}
                  onClick={() => setActiveTab('monthly')}
                >
                  월간
                </button>
              </div>

              {/* 로딩 상태 */}
              {loading ? (
                <div className="ar-loading">
                  <p>출석 기록을 불러오는 중...</p>
                </div>
              ) : (
                <>
                  {/* 주간 뷰 */}
                  {activeTab === 'weekly' && (
                    <WeeklyView
                      currentDate={currentDate}
                      attendanceRecords={attendanceRecords}
                      onPreviousWeek={handlePreviousWeek}
                      onNextWeek={handleNextWeek}
                    />
                  )}

                  {/* 월간 뷰 */}
                  {activeTab === 'monthly' && (
                    <MonthlyView
                      currentDate={currentDate}
                      attendanceRecords={attendanceRecords}
                      onPreviousMonth={handlePreviousMonth}
                      onNextMonth={handleNextMonth}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceRecords;
