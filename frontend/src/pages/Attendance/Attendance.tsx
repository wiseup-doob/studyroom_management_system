import React, { useEffect, useMemo, useState } from 'react';
import { useAttendanceUIStore } from '../../stores/useAttendanceUIStore';
import {
  useSeatLayouts,
  useSeatAssignments,
  useTodayAttendanceRecords,
  useCreateSeatLayout,
  useAssignSeat,
  useUnassignSeat,
  useGenerateStudentPin,
  useUpdateStudentPin,
  useUnlockStudentPin,
  useUpdateAttendanceStatus,
  useAttendanceCheckLinks,
  useCreateAttendanceCheckLink,
  useDeactivateAttendanceCheckLink
} from '../../hooks/useAttendanceQueries';
import SeatingChart from '../../components/domain/Attendance/SeatingChart';
import SeatLayoutSelector from '../../components/domain/Attendance/SeatLayoutSelector';
import CreateSeatLayoutModal from '../../components/domain/Attendance/CreateSeatLayoutModal';
import AttendanceStatsCard from '../../components/domain/Attendance/AttendanceStatsCard';
import StudentAssignmentPanel from '../../components/domain/Attendance/StudentAssignmentPanel';
import AssignSeatModal from '../../components/domain/Attendance/AssignSeatModal';
import ManagePinModal from '../../components/domain/Attendance/ManagePinModal';
import AttendanceRecordsPanel from '../../components/domain/Attendance/AttendanceRecordsPanel';
import AttendanceRecordDetailModal from '../../components/domain/Attendance/AttendanceRecordDetailModal';
import AttendanceCheckLinkModal from '../../components/domain/Attendance/AttendanceCheckLinkModal';
import ManageGroupsModal from '../../components/domain/Attendance/ManageGroupsModal';
import { AttendanceStatsSummary, StudentAttendanceRecord, AttendanceCheckLink, SeatLayoutGroup } from '../../types/attendance';
import { studentService } from '../../services/studentService';
import attendanceService from '../../services/attendanceService';
import { Student } from '../../types/student';
import './Attendance.css';

const Attendance: React.FC = () => {
  // Zustand UI 상태
  const {
    selectedLayoutId,
    selectedSeatId,
    setSelectedLayoutId,
    setSelectedSeatId,
    isCreateLayoutModalOpen,
    openCreateLayoutModal,
    closeCreateLayoutModal
  } = useAttendanceUIStore();

  // React Query 서버 상태
  const { data: layouts, isLoading: layoutsLoading, error: layoutsError } = useSeatLayouts();
  const { data: assignments = [] } = useSeatAssignments(selectedLayoutId);
  const { data: attendanceRecords = [] } = useTodayAttendanceRecords(selectedLayoutId);
  const createLayoutMutation = useCreateSeatLayout();
  const assignSeatMutation = useAssignSeat();
  const unassignSeatMutation = useUnassignSeat();
  const generatePinMutation = useGenerateStudentPin();
  const updatePinMutation = useUpdateStudentPin();
  const unlockPinMutation = useUnlockStudentPin();
  const updateAttendanceStatusMutation = useUpdateAttendanceStatus();
  const { data: checkLinks = [] } = useAttendanceCheckLinks(selectedLayoutId);
  const createCheckLinkMutation = useCreateAttendanceCheckLink();
  const deactivateCheckLinkMutation = useDeactivateAttendanceCheckLink();

  // 로컬 상태
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [selectedStudentForPin, setSelectedStudentForPin] = useState<string | null>(null);
  const [isRecordDetailModalOpen, setIsRecordDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<StudentAttendanceRecord | null>(null);
  const [isCheckLinkModalOpen, setIsCheckLinkModalOpen] = useState(false);
  const [isManageGroupsModalOpen, setIsManageGroupsModalOpen] = useState(false);

  // 학생 데이터 로드
  useEffect(() => {
    const loadStudents = async () => {
      setStudentsLoading(true);
      try {
        const data = await studentService.getStudents();
        setStudents(data);
      } catch (error) {
        console.error('학생 목록 로드 실패:', error);
      } finally {
        setStudentsLoading(false);
      }
    };
    loadStudents();
  }, []);

  // 첫 번째 레이아웃 자동 선택
  useEffect(() => {
    if (layouts && layouts.length > 0 && !selectedLayoutId) {
      setSelectedLayoutId(layouts[0].id);
    }
  }, [layouts, selectedLayoutId, setSelectedLayoutId]);

  // 선택된 레이아웃 찾기
  const selectedLayout = layouts?.find(l => l.id === selectedLayoutId);

  // 통계 계산
  const stats: AttendanceStatsSummary = useMemo(() => {
    return {
      totalSeats: selectedLayout?.layout.seats.length || 0,
      assignedSeats: assignments.length,
      checkedIn: attendanceRecords.filter(r => r.status === 'checked_in').length,
      checkedOut: attendanceRecords.filter(r => r.status === 'checked_out').length,
      notArrived: attendanceRecords.filter(r => r.status === 'not_arrived').length,
      absentExcused: attendanceRecords.filter(r => r.status === 'absent_excused').length,
      absentUnexcused: attendanceRecords.filter(r => r.status === 'absent_unexcused').length,
      lateCount: attendanceRecords.filter(r => r.isLate).length,
      earlyLeaveCount: attendanceRecords.filter(r => r.isEarlyLeave).length
    };
  }, [selectedLayout, assignments, attendanceRecords]);

  // 배치도 생성 핸들러
  const handleCreateLayout = async (data: any) => {
    await createLayoutMutation.mutateAsync(data);
  };

  // 학생 할당 핸들러
  const handleAssignStudent = async (studentId: string) => {
    if (!selectedLayoutId || !selectedSeatId) return;

    const seat = selectedLayout?.layout.seats.find(s => s.id === selectedSeatId);
    if (!seat) return;

    setIsAssignModalOpen(true);
  };

  const handleAssignSeat = async (data: {
    studentId: string;
    seatId: string;
    seatNumber: string;
  }) => {
    if (!selectedLayoutId) return;

    try {
      await assignSeatMutation.mutateAsync({
        studentId: data.studentId,
        seatId: data.seatId,
        seatLayoutId: selectedLayoutId
      });
    } catch (error: any) {
      // 에러 메시지를 사용자에게 표시
      alert(error.message || '좌석 할당에 실패했습니다.');
      throw error; // 모달이 닫히지 않도록 에러 재전파
    }
  };

  const handleUnassignStudent = async (assignmentId: string) => {
    if (confirm('정말로 좌석 할당을 해제하시겠습니까?')) {
      await unassignSeatMutation.mutateAsync(assignmentId);
    }
  };

  // PIN 관리 핸들러
  const handleManagePin = (studentId: string) => {
    setSelectedStudentForPin(studentId);
    setIsPinModalOpen(true);
  };

  const handleGeneratePin = async (studentId: string): Promise<string> => {
    // 4-6자리 랜덤 PIN 자동 생성
    const pin = Math.floor(1000 + Math.random() * 900000).toString().substring(0, 6);
    const result = await generatePinMutation.mutateAsync({ studentId, pin });
    return result.pin;
  };

  const handleUpdatePin = async (studentId: string, newPin: string) => {
    await updatePinMutation.mutateAsync({ studentId, newPin });
  };

  const handleUnlockPin = async (studentId: string, unlockPin: string) => {
    await unlockPinMutation.mutateAsync(studentId);
  };

  // 좌석 클릭 핸들러
  const handleSeatClick = (seatId: string) => {
    setSelectedSeatId(seatId);
    // 좌석이 선택되면 할당 모달 열기 (할당되지 않은 좌석인 경우)
    const assignment = assignments.find(a => a.seatId === seatId);
    if (!assignment) {
      setIsAssignModalOpen(true);
    }
  };

  // 선택된 좌석 정보
  const selectedSeat = useMemo(() => {
    if (!selectedSeatId || !selectedLayout) return null;
    return selectedLayout.layout.seats.find(s => s.id === selectedSeatId) || null;
  }, [selectedSeatId, selectedLayout]);

  // PIN 관리 모달용 학생 및 할당 정보
  const selectedStudentData = useMemo(() => {
    if (!selectedStudentForPin) return { student: null, assignment: null };
    const student = students.find(s => s.id === selectedStudentForPin) || null;
    const assignment = assignments.find(a => a.studentId === selectedStudentForPin) || null;
    return { student, assignment };
  }, [selectedStudentForPin, students, assignments]);

  // 출석 기록 상세용 학생 정보
  const selectedRecordStudent = useMemo(() => {
    if (!selectedRecord) return null;
    return students.find(s => s.id === selectedRecord.studentId) || null;
  }, [selectedRecord, students]);

  // 출석 기록 핸들러
  const handleRecordClick = (record: StudentAttendanceRecord) => {
    setSelectedRecord(record);
    setIsRecordDetailModalOpen(true);
  };

  const handleUpdateAttendanceStatus = async (data: any) => {
    await updateAttendanceStatusMutation.mutateAsync(data);
  };

  // 출석 체크 링크 핸들러
  const handleCreateCheckLink = async (data: any): Promise<AttendanceCheckLink> => {
    const result = await createCheckLinkMutation.mutateAsync(data);

    // Backend 응답을 AttendanceCheckLink 형식으로 변환
    const checkLink: AttendanceCheckLink = {
      id: result.linkId,
      userId: '', // Backend에서 자동 설정됨
      linkToken: result.linkToken,
      linkUrl: result.linkUrl,
      seatLayoutId: data.seatLayoutId,
      seatLayoutName: selectedLayout?.name || '',
      title: data.title,
      description: data.description,
      isActive: true,
      usageCount: 0,
      requireConfirmation: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return checkLink;
  };

  const handleToggleCheckLink = async (linkId: string, isActive: boolean) => {
    if (isActive) {
      // 비활성화
      await attendanceService.deactivateAttendanceCheckLink(linkId);
    } else {
      // 활성화
      await attendanceService.activateAttendanceCheckLink(linkId);
    }
    // React Query 캐시 무효화
    await deactivateCheckLinkMutation.mutateAsync(linkId).catch(() => {});
  };

  const handleDeleteCheckLink = async (linkId: string) => {
    await attendanceService.deleteAttendanceCheckLink(linkId);
    // React Query 캐시 무효화
    await deactivateCheckLinkMutation.mutateAsync(linkId).catch(() => {});
  };

  // 그룹 관리 핸들러
  const handleSaveGroups = async (groups: SeatLayoutGroup[]) => {
    if (!selectedLayout) return;

    // 그룹 정보를 기반으로 좌석 재생성
    const seats = [];
    const seatWidth = 60;
    const seatHeight = 60;
    const seatGap = 10;

    for (const group of groups) {
      for (let row = 0; row < group.rows; row++) {
        for (let col = 0; col < group.cols; col++) {
          const seatNumber = row * group.cols + col + 1;
          seats.push({
            id: `${group.id}_seat_${row}_${col}`,
            position: {
              x: group.position.x + col * (seatWidth + seatGap),
              y: group.position.y + row * (seatHeight + seatGap)
            },
            size: { width: seatWidth, height: seatHeight },
            groupId: group.id,
            row,
            col,
            label: `${group.name}-${seatNumber}`
          });
        }
      }
    }

    // dimensions 계산
    const maxX = Math.max(...seats.map(s => s.position.x + s.size.width));
    const maxY = Math.max(...seats.map(s => s.position.y + s.size.height));

    const updatedLayout = {
      name: selectedLayout.name,
      layout: {
        groups,
        seats,
        dimensions: { width: maxX + 50, height: maxY + 50 }
      }
    };

    // Backend API 호출 (updateSeatLayout 필요)
    await attendanceService.updateSeatLayout(selectedLayout.id, updatedLayout);

    // React Query 캐시 무효화하여 새로고침
    window.location.reload();
  };

  // 로딩 상태
  if (layoutsLoading) {
    return (
      <div className="attendance-container">
        <div className="attendance-loading">
          <div className="spinner"></div>
          <p>좌석 배치도를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (layoutsError) {
    return (
      <div className="attendance-container">
        <div className="attendance-error">
          <h2>오류가 발생했습니다</h2>
          <p>{(layoutsError as Error).message}</p>
        </div>
      </div>
    );
  }

  // 레이아웃 없음
  if (!layouts || layouts.length === 0) {
    return (
      <div className="attendance-container">
        <div className="attendance-empty">
          <h2>좌석 배치도가 없습니다</h2>
          <p>먼저 좌석 배치도를 생성해주세요.</p>
          <button className="btn btn--primary" onClick={openCreateLayoutModal}>
            + 배치도 생성
          </button>
        </div>

        {/* 배치도 생성 모달 */}
        <CreateSeatLayoutModal
          isOpen={isCreateLayoutModalOpen}
          onClose={closeCreateLayoutModal}
          onSave={handleCreateLayout}
        />
      </div>
    );
  }

  return (
    <div className="attendance-container">
      {/* 헤더: 제목 + 배치도 선택 드롭다운 */}
      <div className="attendance-header">
        <h1 className="attendance-title">출석 관리</h1>

        <div className="attendance-header__controls">
          {/* 배치도 선택 드롭다운 */}
          <select
            className="attendance-layout-select"
            value={selectedLayoutId || ''}
            onChange={(e) => setSelectedLayoutId(e.target.value)}
          >
            {layouts.map((layout) => (
              <option key={layout.id} value={layout.id}>
                {layout.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setIsCheckLinkModalOpen(true)}
            className="btn btn--secondary"
          >
            📱 PIN 관리
          </button>

          <button
            type="button"
            onClick={openCreateLayoutModal}
            className="btn btn--primary"
          >
            + 배치도 추가
          </button>
        </div>
      </div>

      {/* 메인: 좌석 배치도만 표시 */}
      <div className="attendance-main">
        {selectedLayout ? (
          <div className="seating-chart-container">
            <SeatingChart
              layout={selectedLayout}
              assignments={assignments}
              attendanceRecords={attendanceRecords}
              students={students}
              selectedSeatId={selectedSeatId}
              onSeatClick={handleSeatClick}
            />

            {/* 그룹 편집 버튼 */}
            <div className="layout-actions">
              <button
                type="button"
                onClick={() => setIsManageGroupsModalOpen(true)}
                className="btn btn--secondary"
              >
                🏗️ 그룹 편집
              </button>
            </div>
          </div>
        ) : (
          <div className="attendance-no-selection">
            <p>배치도를 선택해주세요</p>
          </div>
        )}
      </div>

      {/* 배치도 생성 모달 */}
      <CreateSeatLayoutModal
        isOpen={isCreateLayoutModalOpen}
        onClose={closeCreateLayoutModal}
        onSave={handleCreateLayout}
      />

      {/* 좌석 할당 모달 */}
      <AssignSeatModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onAssign={handleAssignSeat}
        students={students}
        seat={selectedSeat}
        assignments={assignments}
      />

      {/* PIN 관리 모달 */}
      <ManagePinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setSelectedStudentForPin(null);
        }}
        onGeneratePin={handleGeneratePin}
        onUpdatePin={handleUpdatePin}
        onUnlockPin={handleUnlockPin}
        student={selectedStudentData.student}
        assignment={selectedStudentData.assignment}
      />

      {/* 출석 기록 상세 모달 */}
      <AttendanceRecordDetailModal
        isOpen={isRecordDetailModalOpen}
        onClose={() => {
          setIsRecordDetailModalOpen(false);
          setSelectedRecord(null);
        }}
        onUpdateStatus={handleUpdateAttendanceStatus}
        record={selectedRecord}
        student={selectedRecordStudent}
      />

      {/* 출석 체크 링크 모달 */}
      <AttendanceCheckLinkModal
        isOpen={isCheckLinkModalOpen}
        onClose={() => setIsCheckLinkModalOpen(false)}
        onCreateLink={handleCreateCheckLink}
        onToggleLink={handleToggleCheckLink}
        onDeleteLink={handleDeleteCheckLink}
        links={checkLinks}
        seatLayoutId={selectedLayoutId}
      />

      {/* 그룹 관리 모달 */}
      <ManageGroupsModal
        isOpen={isManageGroupsModalOpen}
        onClose={() => setIsManageGroupsModalOpen(false)}
        currentGroups={selectedLayout?.layout.groups || []}
        onSave={handleSaveGroups}
      />
    </div>
  );
};

export default Attendance;
