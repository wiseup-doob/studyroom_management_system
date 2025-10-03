/**
 * StudentTimetableSharedEdit.tsx - 학생용 시간표 편집 페이지
 *
 * Phase 2 구현:
 * - 링크를 통해 접근하는 학생용 시간표 편집 페이지
 * - 토큰 검증 및 시간표 데이터 로딩
 * - 간소화된 편집 인터페이스
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StudentWithTimetable, StudentTimetableData, TimeSlot, TimeSlotType, BasicSchedule } from '../../types/student';
import { backendService } from '../../services/backendService';
import editLinkService from '../../services/editLinkService';
import SharedEditHeader from './components/SharedEditHeader';
import SimpleTimetableGrid from './components/SimpleTimetableGrid';
import TimeSlotEditModal from '../TimeTable/components/TimeSlotEditModal';
import SubmissionConfirmModal from './components/SubmissionConfirmModal';
import BasicScheduleEditModal from './components/BasicScheduleEditModal';
import './StudentTimetableSharedEdit.css';

interface ShareTokenData {
  student: StudentWithTimetable;
  timetable: StudentTimetableData;
  permissions: {
    canAddSlots: boolean;
    canDeleteSlots: boolean;
    canModifySlots: boolean;
    restrictedTimeSlots?: string[];
    // 확장된 기본 스케줄 편집 권한
    canEditBasicSchedule?: boolean;
    canEditDailySchedules?: boolean;
    canEditTimeSlotInterval?: boolean;
    dailySchedulePermissions?: {
      [key: string]: {
        canEditArrivalTime: boolean;
        canEditDepartureTime: boolean;
        canToggleActive: boolean;
      };
    };
    timeSlotIntervalOptions?: number[];
  };
  expiresAt: string;
}

interface EditState {
  originalTimetable: StudentTimetableData;
  currentTimetable: StudentTimetableData;
}

const StudentTimetableSharedEdit: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();

  // 상태 관리
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareData, setShareData] = useState<ShareTokenData | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  // 모달 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [isBasicScheduleModalOpen, setIsBasicScheduleModalOpen] = useState(false);

  // 제출 관련 상태
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // 편집 모달 핸들러 (TimeSlotEditModal 사용)
  const handleEditTimetable = () => {
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
  };

  // 기본 스케줄 편집 핸들러
  const handleEditBasicSchedule = () => {
    setIsBasicScheduleModalOpen(true);
  };

  const closeBasicScheduleModal = () => {
    setIsBasicScheduleModalOpen(false);
  };

  // 기본 스케줄 저장 핸들러
  const handleSaveBasicSchedule = async (updatedBasicSchedule: BasicSchedule) => {
    if (!editState) return;

    try {
      // 각 요일 객체까지 완전히 깊은 복사
      const newDailySchedules: any = {};
      Object.keys(updatedBasicSchedule.dailySchedules).forEach(day => {
        newDailySchedules[day] = {
          ...updatedBasicSchedule.dailySchedules[day as keyof typeof updatedBasicSchedule.dailySchedules]
        };
      });

      // 편집 상태 업데이트 (originalTimetable은 그대로 유지, currentTimetable만 업데이트)
      setEditState({
        originalTimetable: editState.originalTimetable,  // 원본은 그대로 유지
        currentTimetable: {
          ...editState.currentTimetable,
          basicSchedule: {
            timeSlotInterval: updatedBasicSchedule.timeSlotInterval,
            dailySchedules: newDailySchedules
          }
        }
      });

      // Firebase 자동 저장 (기존 useEffect에서 처리됨)
      console.log('기본 스케줄이 업데이트되었습니다:', updatedBasicSchedule);

      // 사용 기록 로깅
      if (shareToken) {
        try {
          await editLinkService.recordUsage({
            shareToken: shareToken,
            action: 'edited',
            details: '등원/하원 시간을 수정했습니다.'
          });
        } catch (logError) {
          console.warn('사용 기록 저장 실패:', logError);
        }
      }
    } catch (error) {
      console.error('기본 스케줄 저장 실패:', error);
      throw error;
    }
  };

  // 수업 추가 핸들러 (TimeSlotEditModal에서 사용)
  const handleAddClass = async (classData: {
    day: string;
    startTime: string;
    endTime: string;
    subject: string;
    teacher?: string;
    location?: string;
    type: TimeSlotType;
    color: string;
    notes?: string;
  }) => {
    if (!editState) return;

    try {
      // 새 시간표 데이터 생성
      const newTimetable = { ...editState.currentTimetable };
      const daySchedule = newTimetable.detailedSchedule[classData.day];
      
      // 요일 스케줄이 존재하지 않는 경우 초기화
      if (!daySchedule) {
        newTimetable.detailedSchedule[classData.day] = { timeSlots: [] };
      }
      
      // 새 수업 추가
      const newSlot: TimeSlot = {
        id: Date.now().toString(),
        startTime: classData.startTime,
        endTime: classData.endTime,
        subject: classData.subject,
        teacher: classData.teacher || undefined,
        location: classData.location || undefined,
        type: classData.type,
        color: classData.color,
        notes: classData.notes || undefined,
        isAutoGenerated: false
      };

      newTimetable.detailedSchedule[classData.day].timeSlots.push(newSlot);
      newTimetable.detailedSchedule[classData.day].timeSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

      // 편집 상태 업데이트 (자동 저장은 useEffect에서 처리)
      setEditState({
        ...editState,
        currentTimetable: newTimetable
      });

      // 사용 기록 로깅 (수업 추가)
      if (shareToken) {
        try {
          await editLinkService.recordUsage({
            shareToken: shareToken,
            action: 'edited',
            details: `새로운 수업을 추가했습니다: ${classData.subject} (${classData.day})`
          });
        } catch (logError) {
          console.warn('사용 기록 저장 실패:', logError);
        }
      }
    } catch (error) {
      console.error('수업 추가 실패:', error);
      throw error;
    }
  };

  // 수업 삭제 핸들러 (TimeSlotEditModal에서 사용)
  const handleDeleteClass = async (day: string, slotId: string) => {
    if (!editState) return;

    try {
      const newTimetable = { ...editState.currentTimetable };
      const daySchedule = newTimetable.detailedSchedule[day];
      
      // 요일 스케줄이 존재하지 않는 경우 처리
      if (!daySchedule) {
        throw new Error('해당 요일의 스케줄을 찾을 수 없습니다.');
      }
      
      daySchedule.timeSlots = daySchedule.timeSlots.filter(slot => slot.id !== slotId);

      // 편집 상태 업데이트 (자동 저장은 useEffect에서 처리)
      setEditState({
        ...editState,
        currentTimetable: newTimetable
      });

      // 사용 기록 로깅 (수업 삭제)
      if (shareToken) {
        try {
          await editLinkService.recordUsage({
            shareToken: shareToken,
            action: 'edited',
            details: `수업을 삭제했습니다: ${day} (${slotId})`
          });
        } catch (logError) {
          console.warn('사용 기록 저장 실패:', logError);
        }
      }
    } catch (error) {
      console.error('수업 삭제 실패:', error);
      throw error;
    }
  };



  // 컴포넌트 마운트 시 토큰 검증 및 데이터 로딩
  useEffect(() => {
    if (!shareToken) {
      setError('유효하지 않은 링크입니다.');
      setIsLoading(false);
      return;
    }

    loadShareData();
  }, [shareToken]);

  // Firebase 기반 자동 저장 (로컬스토리지 대신)
  useEffect(() => {
    if (!editState?.currentTimetable || !shareToken) return;

    console.log('%c[Firebase Auto Save] 실행됨', 'color: orange;');
    console.log('현재 currentTimetable:', editState.currentTimetable);

    // 확장된 변경사항 감지 (detailedSchedule + basicSchedule)
    const changes = analyzeAllChanges(editState.originalTimetable, editState.currentTimetable);

    // 전체 변경사항 개수 계산 (기존 로직과 동일하게 유지)
    const detailedChanges = changes.addedSlots.length + changes.modifiedSlots.length + changes.deletedSlots.length;
    const basicChanges = changes.basicScheduleChanges ? 1 : 0; // basicSchedule 변경은 1건으로 계산
    const totalChanges = detailedChanges + basicChanges;
    const hasChanged = totalChanges > 0;

    console.log('변경사항 감지:', hasChanged, '총 변경 건수:', totalChanges);
    console.log('detailedSchedule 변경:', detailedChanges, 'basicSchedule 변경:', basicChanges);

    // 실제 변경사항이 있을 때만 Firebase에 저장
    if (hasChanged) {
      const saveToFirebase = async () => {
        try {
          // 백엔드가 기대하는 파라미터 구조에 맞춰 전달
          await backendService.updateEditState({
            shareToken,
            currentTimetable: editState.currentTimetable,
            changes: {
              addedSlots: changes.addedSlots,
              modifiedSlots: changes.modifiedSlots,
              deletedSlots: changes.deletedSlots
              // basicScheduleChanges는 별도 파라미터로 전달
            },
            // 기본 스케줄 변경사항이 있으면 별도 파라미터로 전달
            updatedBasicSchedule: changes.basicScheduleChanges ? editState.currentTimetable.basicSchedule : undefined,
            basicScheduleChanges: changes.basicScheduleChanges || undefined
          });
          console.log('%c[Firebase] 실제 변경사항 감지! 데이터를 저장했습니다.', 'color: violet;');
          console.log('저장된 변경사항:', {
            detailedSchedule: { addedSlots: changes.addedSlots, modifiedSlots: changes.modifiedSlots, deletedSlots: changes.deletedSlots },
            basicScheduleChanges: changes.basicScheduleChanges
          });
        } catch (error) {
          console.error('Firebase 저장 실패:', error);
        }
      };

      // 디바운싱 적용 (500ms 후 저장)
      const timeoutId = setTimeout(saveToFirebase, 500);
      return () => clearTimeout(timeoutId);
    } else {
      console.log('%c[Firebase] 실제 변경사항 없음 - 저장 안함', 'color: gray;');
    }
  }, [editState?.currentTimetable, shareToken]);


  // 공유 데이터 로딩 (Firebase 편집 상태 기반)
  const loadShareData = async () => {
    if (!shareToken) return;

    try {
      setIsLoading(true);
      setError(null);

      // 1. 공유 링크 데이터 조회
      const shareResponse = await backendService.getSharedTimetableData({
        shareToken: shareToken
      });

      if (!shareResponse.success) {
        throw new Error(shareResponse.error || '링크 데이터를 불러올 수 없습니다.');
      }

      const shareData = shareResponse.data as ShareTokenData;

      // 2. 사용 기록 로깅 (페이지 접근)
      try {
        await editLinkService.recordUsage({
          shareToken: shareToken,
          action: 'accessed',
          details: '학생이 편집 페이지에 접근했습니다.'
        });
      } catch (logError) {
        console.warn('사용 기록 저장 실패:', logError);
        // 로그 저장 실패는 치명적이지 않으므로 계속 진행
      }

      // 만료 확인
      if (new Date(shareData.expiresAt) < new Date()) {
        throw new Error('링크가 만료되었습니다.');
      }

      setShareData(shareData);

      // 2. Firebase에서 편집 상태 조회
      try {
        const editStateResponse = await backendService.getEditState({
          shareToken: shareToken
        });

        if (editStateResponse.success) {
          // Firebase에 저장된 편집 상태가 있는 경우
          const editStateData = editStateResponse.data;

          setEditState({
            originalTimetable: editStateData.originalTimetable,
            currentTimetable: editStateData.currentTimetable
          });

          console.log('Firebase에서 편집 상태를 불러왔습니다:', editStateData);
        } else {
          throw new Error('편집 상태를 찾을 수 없습니다.');
        }
      } catch (editStateError) {
        console.warn('편집 상태 조회 실패, 원본 데이터로 초기화:', editStateError);

        // 편집 상태가 없으면 원본으로 초기화
        const originalTimetable = structuredClone(shareData.timetable);
        setEditState({
          originalTimetable: originalTimetable,
          currentTimetable: structuredClone(originalTimetable)
        });
      }

    } catch (error) {
      console.error('공유 데이터 로딩 실패:', error);
      setError(error instanceof Error ? error.message : '데이터를 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 제출 확인 모달 열기
  const handleSubmit = () => {
    setIsSubmissionModalOpen(true);
  };

  // 최종 제출 (Firebase 기반)
  const handleConfirmSubmission = async (submissionNotes?: string) => {
    if (!shareData || !editState || !shareToken) return;

    try {
      setIsSubmitting(true);

      // 백엔드에 제출 (편집 상태는 이미 Firebase에 저장되어 있음)
      const response = await backendService.submitTimetableEdit({
        shareToken: shareToken,
        submissionNotes: submissionNotes
      });

      if (!response.success) {
        throw new Error(response.error || '제출에 실패했습니다.');
      }

      // 제출 완료 페이지로 이동
      navigate('/submission-complete', {
        state: {
          studentName: shareData.student.name,
          timetableName: shareData.timetable.name,
          submissionData: response.data
        }
      });

    } catch (error) {
      console.error('제출 실패:', error);
      alert(error instanceof Error ? error.message : '제출 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
      setIsSubmissionModalOpen(false);
    }
  };

  // 실제 수업 슬롯만 비교하는 변경 감지 함수 (자동 생성 자습 제외)
  const analyzeTimeSlotChanges = (original: StudentTimetableData, current: StudentTimetableData) => {
    const changes = {
      modifiedSlots: [] as string[],
      addedSlots: [] as TimeSlot[],
      deletedSlots: [] as string[]
    };

    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    daysOfWeek.forEach(day => {
      const originalSlots = original.detailedSchedule[day]?.timeSlots || [];
      const currentSlots = current.detailedSchedule[day]?.timeSlots || [];

      // 자동 생성된 슬롯과 자습 슬롯 제외하고 실제 수업만 비교
      const originalRealSlots = originalSlots.filter(slot => 
        !slot.isAutoGenerated && slot.type !== 'self_study'
      );
      const currentRealSlots = currentSlots.filter(slot => 
        !slot.isAutoGenerated && slot.type !== 'self_study'
      );

      // 삭제된 슬롯 찾기
      originalRealSlots.forEach(originalSlot => {
        const found = currentRealSlots.find(slot => slot.id === originalSlot.id);
        if (!found) {
          changes.deletedSlots.push(originalSlot.id);
        }
      });

      // 추가되거나 수정된 슬롯 찾기
      currentRealSlots.forEach(currentSlot => {
        const originalSlot = originalRealSlots.find(slot => slot.id === currentSlot.id);

        if (!originalSlot) {
          // 새로 추가된 슬롯
          changes.addedSlots.push(currentSlot);
        } else {
          // 실제 시간표 데이터만 비교 (핵심 필드만)
          const originalCore = {
            startTime: originalSlot.startTime,
            endTime: originalSlot.endTime,
            subject: originalSlot.subject,
            type: originalSlot.type,
            teacher: originalSlot.teacher || '',
            location: originalSlot.location || '',
            color: originalSlot.color || '',
            notes: originalSlot.notes || ''
          };
          const currentCore = {
            startTime: currentSlot.startTime,
            endTime: currentSlot.endTime,
            subject: currentSlot.subject,
            type: currentSlot.type,
            teacher: currentSlot.teacher || '',
            location: currentSlot.location || '',
            color: currentSlot.color || '',
            notes: currentSlot.notes || ''
          };

          if (JSON.stringify(originalCore) !== JSON.stringify(currentCore)) {
            // 수정된 슬롯
            changes.modifiedSlots.push(currentSlot.id);
          }
        }
      });
    });

    return changes;
  };

  // 기본 스케줄 변경사항 분석 함수 추가
  const analyzeBasicScheduleChanges = (original: BasicSchedule, current: BasicSchedule) => {
    const dailyScheduleChanges: any = {};
    let timeSlotIntervalChanged = false;

    // 시간 간격 변경 확인
    if (original.timeSlotInterval !== current.timeSlotInterval) {
      timeSlotIntervalChanged = true;
    }

    // 요일별 변경사항 분석 (안전한 접근)
    if (current.dailySchedules && original.dailySchedules) {
      Object.keys(current.dailySchedules).forEach(day => {
        const originalSchedule = original.dailySchedules[day as keyof typeof original.dailySchedules];
        const currentSchedule = current.dailySchedules[day as keyof typeof current.dailySchedules];

      // originalSchedule이나 currentSchedule이 undefined일 수 있으므로 체크
      if (!originalSchedule || !currentSchedule) {
        return;
      }

      const hasChanges =
        originalSchedule.arrivalTime !== currentSchedule.arrivalTime ||
        originalSchedule.departureTime !== currentSchedule.departureTime ||
        originalSchedule.isActive !== currentSchedule.isActive;

      if (hasChanges) {
        dailyScheduleChanges[day] = {
          arrivalTimeChanged: originalSchedule.arrivalTime !== currentSchedule.arrivalTime,
          departureTimeChanged: originalSchedule.departureTime !== currentSchedule.departureTime,
          isActiveChanged: originalSchedule.isActive !== currentSchedule.isActive,
          originalSchedule: { ...originalSchedule },
          updatedSchedule: { ...currentSchedule }
        };
      }
      });
    }

    const hasBasicScheduleChanges = (dailyScheduleChanges && Object.keys(dailyScheduleChanges).length > 0) || timeSlotIntervalChanged;

    console.log('%c[analyzeBasicScheduleChanges] 분석 결과:', 'color: purple;', {
      hasBasicScheduleChanges,
      dailyScheduleChanges,
      timeSlotIntervalChanged,
      changedDays: Object.keys(dailyScheduleChanges)
    });

    return {
      dailyScheduleChanges,
      timeSlotIntervalChanged,
      originalTimeSlotInterval: original.timeSlotInterval,
      updatedTimeSlotInterval: current.timeSlotInterval,
      hasChanges: hasBasicScheduleChanges
    };
  };

  // 기존 analyzeTimeSlotChanges 함수와 통합하여 확장된 변경사항 분석
  const analyzeAllChanges = (original: StudentTimetableData, current: StudentTimetableData) => {
    // 기존 detailedSchedule 변경사항 분석
    const detailedScheduleChanges = analyzeTimeSlotChanges(original, current);
    
    // 새로운 basicSchedule 변경사항 분석
    const basicScheduleChanges = analyzeBasicScheduleChanges(original.basicSchedule, current.basicSchedule);
    
    // 통합된 변경사항 반환
    return {
      ...detailedScheduleChanges,
      basicScheduleChanges: basicScheduleChanges.hasChanges ? basicScheduleChanges : null
    };
  };

  // 원본/편집본 비교 토글
  const toggleComparison = () => {
    setShowComparison(!showComparison);
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="ste-loading-container">
        <div className="ste-loading-spinner"></div>
        <p>시간표를 불러오는 중...</p>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="ste-error-container">
        <div className="ste-error-content">
          <h2>오류가 발생했습니다</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')} className="ste-btn-home">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 데이터가 없는 경우
  if (!shareData || !editState) {
    return (
      <div className="ste-error-container">
        <div className="ste-error-content">
          <h2>데이터를 불러올 수 없습니다</h2>
          <p>링크가 유효하지 않거나 만료되었습니다.</p>
          <button onClick={() => navigate('/')} className="ste-btn-home">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 단순하게 계산 - useMemo 제거
  const displayTimetable = editState && (showComparison ? editState.originalTimetable : editState.currentTimetable);

  // 정확한 변경사항 계산 (timeSlots + basicSchedule 기준)
  const currentChanges = editState ? analyzeAllChanges(editState.originalTimetable, editState.currentTimetable) : null;
  const detailedChanges = currentChanges ? (currentChanges.addedSlots.length + currentChanges.modifiedSlots.length + currentChanges.deletedSlots.length) : 0;
  const basicChanges = currentChanges?.basicScheduleChanges ? 1 : 0;
  const totalChanges = detailedChanges + basicChanges;
  const hasChanges = totalChanges > 0;

  console.log('%c[render] 변경사항 계산:', 'color: cyan;', {
    hasDisplayTimetable: !!displayTimetable,
    totalChanges,
    hasChanges,
    showComparison,
    changes: currentChanges
  });


  return (
    <div className="ste-container">
      {/* 헤더 */}
      <SharedEditHeader
        student={shareData.student}
        timetable={shareData.timetable}
        hasChanges={hasChanges}
        totalChanges={totalChanges}
        showComparison={showComparison}
        onToggleComparison={toggleComparison}
        onSubmit={handleSubmit}
        isSubmitDisabled={totalChanges === 0 || isSubmitting}
        onEditTimetable={handleEditTimetable}
        onEditBasicSchedule={handleEditBasicSchedule}
      />

      {/* 시간표 그리드 */}
      <div className="ste-main-content">
        {displayTimetable && (
          <SimpleTimetableGrid
            timetable={displayTimetable}
            permissions={shareData.permissions}
            isComparisonMode={showComparison}
            originalTimetable={editState.originalTimetable}
          />
        )}
      </div>


      {/* 기본 스케줄 편집 모달 */}
      {isBasicScheduleModalOpen && editState && shareData && (
        <BasicScheduleEditModal
          isOpen={isBasicScheduleModalOpen}
          onClose={closeBasicScheduleModal}
          basicSchedule={editState.currentTimetable.basicSchedule}
          permissions={shareData.permissions}
          onSave={handleSaveBasicSchedule}
        />
      )}

      {/* 시간 슬롯 편집 모달 (수업 추가/삭제용) */}
      {isEditModalOpen && editState && (
        <TimeSlotEditModal
          isOpen={isEditModalOpen}
          onClose={closeEditModal}
          onAddClass={handleAddClass}
          onDeleteClass={handleDeleteClass}
          timetable={editState.currentTimetable}
        />
      )}

      {/* 제출 확인 모달 */}
      {isSubmissionModalOpen && (
        <SubmissionConfirmModal
          isOpen={isSubmissionModalOpen}
          onClose={() => setIsSubmissionModalOpen(false)}
          onConfirm={handleConfirmSubmission}
          student={shareData.student}
          timetable={shareData.timetable}
          changes={currentChanges || { modifiedSlots: [], addedSlots: [], deletedSlots: [] }}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
};

export default StudentTimetableSharedEdit;