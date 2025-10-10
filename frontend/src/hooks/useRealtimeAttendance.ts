/**
 * Real-time attendance updates using Firestore onSnapshot
 * Optional enhancement for live attendance tracking
 */

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { auth } from '../services/firebase';
import { StudentAttendanceRecord } from '../types/attendance';
import { convertToStudentAttendanceRecord } from '../utils/attendanceTypeConverters';

/**
 * 실시간 출석 기록 리스너
 * Firestore onSnapshot을 사용하여 실시간으로 출석 기록을 업데이트
 */
export function useRealtimeAttendanceRecords(seatLayoutId: string | null, enabled: boolean = true) {
  const [records, setRecords] = useState<StudentAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // 비활성화되었거나 layoutId가 없으면 리턴
    if (!enabled || !seatLayoutId) {
      setLoading(false);
      return;
    }

    // 현재 사용자 확인
    const user = auth.currentUser;
    if (!user) {
      setError(new Error('사용자가 로그인되지 않았습니다.'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // 오늘 날짜 범위 계산 (00:00:00 ~ 23:59:59)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Firestore 쿼리 설정
    const recordsRef = collection(db, `users/${user.uid}/student_attendance_records`);
    const q = query(
      recordsRef,
      where('seatLayoutId', '==', seatLayoutId),
      where('date', '>=', Timestamp.fromDate(today)),
      where('date', '<', Timestamp.fromDate(tomorrow))
    );

    // 실시간 리스너 연결
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const updatedRecords: StudentAttendanceRecord[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            updatedRecords.push(convertToStudentAttendanceRecord({
              id: doc.id,
              ...data
            }));
          });

          setRecords(updatedRecords);
          setLoading(false);
        } catch (err) {
          console.error('출석 기록 변환 오류:', err);
          setError(err as Error);
          setLoading(false);
        }
      },
      (err) => {
        console.error('실시간 출석 기록 리스너 오류:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    // 클린업: 컴포넌트 언마운트 시 리스너 해제
    return () => {
      unsubscribe();
    };
  }, [seatLayoutId, enabled]);

  return { records, loading, error };
}

/**
 * 실시간 좌석 할당 리스너
 */
export function useRealtimeSeatAssignments(seatLayoutId: string | null, enabled: boolean = true) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !seatLayoutId) {
      setLoading(false);
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setError(new Error('사용자가 로그인되지 않았습니다.'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const assignmentsRef = collection(db, `users/${user.uid}/seat_assignments`);
    const q = query(
      assignmentsRef,
      where('seatLayoutId', '==', seatLayoutId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const updatedAssignments: any[] = [];
        snapshot.forEach((doc) => {
          updatedAssignments.push({
            id: doc.id,
            ...doc.data()
          });
        });

        setAssignments(updatedAssignments);
        setLoading(false);
      },
      (err) => {
        console.error('실시간 좌석 할당 리스너 오류:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [seatLayoutId, enabled]);

  return { assignments, loading, error };
}
