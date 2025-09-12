import { Request, Response } from 'express';
import * as functions from 'firebase-functions';
import { createDatabaseManager, validateAcademyId } from './DatabaseManager';
import { validateAuth } from '../utils/auth';
import { createSuccessResponse } from '../utils/response';
import { 
  CreateStudentRequest, 
  UpdateStudentRequest, 
  CreateAttendanceRequest,
  AssignSeatRequest,
  CreateSeatLayoutRequest
} from '../../types/database';

// ===== 학생 관리 Functions =====

/**
 * 학생 생성
 */
export const createStudentFunction = functions.https.onRequest(async (req: Request, res: Response): Promise<void> => {
  try {
    // 인증 확인
    const authResult = await validateAuth(req);
    if (!authResult.success) {
      res.status(401).json({ success: false, error: authResult.error });
      return;
    }

    const { academyId, name, grade, contactInfo, parentsId } = req.body as CreateStudentRequest;
    
    // academyId 검증
    if (!validateAcademyId(academyId)) {
      res.status(400).json({ success: false, error: '잘못된 Academy ID입니다.' });
      return;
    }

    // 필수 필드 검증
    if (!name || !grade) {
      res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      return;
    }

    const db = createDatabaseManager(academyId);
    const result = await db.students.createStudent(authResult.data!.uid, {
      name,
      grade: grade as any,
      contactInfo,
      parentsId,
      status: 'active'
    });

    if (result.success) {
      res.status(201).json(createSuccessResponse({ studentId: result.data }));
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: `서버 오류: ${error}` });
  }
});

/**
 * 학생 목록 조회
 */
export const getStudentsFunction = functions.https.onRequest(async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await validateAuth(req);
    if (!authResult.success) {
      res.status(401).json({ success: false, error: authResult.error });
      return;
    }

    const { academyId } = req.query;
    if (!academyId || !validateAcademyId(academyId as string)) {
      res.status(400).json({ success: false, error: '잘못된 Academy ID입니다.' });
      return;
    }

    const db = createDatabaseManager(academyId as string);
    const result = await db.students.getAll({
      orderBy: { field: 'name', direction: 'asc' }
    });

    if (result.success) {
      res.json(createSuccessResponse(result.data));
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: `서버 오류: ${error}` });
  }
});

/**
 * 학생 정보 업데이트
 */
export const updateStudentFunction = functions.https.onRequest(async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await validateAuth(req);
    if (!authResult.success) {
      res.status(401).json({ success: false, error: authResult.error });
      return;
    }

    const { academyId, studentId, data } = req.body as UpdateStudentRequest;
    
    if (!validateAcademyId(academyId) || !studentId) {
      res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      return;
    }

    const db = createDatabaseManager(academyId);
    const result = await db.students.update(studentId, data);

    if (result.success) {
      res.json(createSuccessResponse(null, '학생 정보가 업데이트되었습니다.'));
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: `서버 오류: ${error}` });
  }
});

// ===== 출석 관리 Functions =====

/**
 * 출석 체크인
 */
export const checkInFunction = functions.https.onRequest(async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await validateAuth(req);
    if (!authResult.success) {
      res.status(401).json({ success: false, error: authResult.error });
      return;
    }

    const { academyId, studentId, seatId, notes } = req.body as CreateAttendanceRequest;
    
    if (!validateAcademyId(academyId) || !studentId) {
      res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      return;
    }

    const db = createDatabaseManager(academyId);
    
    // 학생 정보 조회
    const studentResult = await db.students.getById(studentId);
    if (!studentResult.success || !studentResult.data) {
      res.status(404).json({ success: false, error: '학생을 찾을 수 없습니다.' });
      return;
    }

    const result = await db.attendance.checkIn(studentId, studentResult.data.name, seatId, notes);

    if (result.success) {
      res.status(201).json(createSuccessResponse({ attendanceId: result.data }));
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: `서버 오류: ${error}` });
  }
});

/**
 * 출석 체크아웃
 */
export const checkOutFunction = functions.https.onRequest(async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await validateAuth(req);
    if (!authResult.success) {
      res.status(401).json({ success: false, error: authResult.error });
      return;
    }

    const { academyId, studentId } = req.body;
    
    if (!validateAcademyId(academyId) || !studentId) {
      res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      return;
    }

    const db = createDatabaseManager(academyId);
    const result = await db.attendance.checkOut(studentId);

    if (result.success) {
      res.json(createSuccessResponse(null, '체크아웃이 완료되었습니다.'));
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: `서버 오류: ${error}` });
  }
});

/**
 * 날짜별 출석 기록 조회
 */
export const getAttendanceByDateFunction = functions.https.onRequest(async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await validateAuth(req);
    if (!authResult.success) {
      res.status(401).json({ success: false, error: authResult.error });
      return;
    }

    const { academyId, date } = req.query;
    
    if (!academyId || !validateAcademyId(academyId as string) || !date) {
      res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      return;
    }

    const db = createDatabaseManager(academyId as string);
    const result = await db.attendance.getByDate(date as string);

    if (result.success) {
      res.json(createSuccessResponse(result.data));
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: `서버 오류: ${error}` });
  }
});

// ===== 좌석 관리 Functions =====

/**
 * 좌석 배정
 */
export const assignSeatFunction = functions.https.onRequest(async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await validateAuth(req);
    if (!authResult.success) {
      res.status(401).json({ success: false, error: authResult.error });
      return;
    }

    const { academyId, studentId, seatId } = req.body as AssignSeatRequest;
    
    if (!validateAcademyId(academyId) || !studentId || !seatId) {
      res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      return;
    }

    const db = createDatabaseManager(academyId);
    const result = await db.seats.assignStudent(seatId, studentId);

    if (result.success) {
      res.json(createSuccessResponse(null, '좌석이 배정되었습니다.'));
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: `서버 오류: ${error}` });
  }
});

/**
 * 좌석 배정 해제
 */
export const unassignSeatFunction = functions.https.onRequest(async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await validateAuth(req);
    if (!authResult.success) {
      res.status(401).json({ success: false, error: authResult.error });
      return;
    }

    const { academyId, studentId } = req.body;
    
    if (!validateAcademyId(academyId) || !studentId) {
      res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      return;
    }

    const db = createDatabaseManager(academyId);
    const result = await db.seats.unassignStudent(studentId);

    if (result.success) {
      res.json(createSuccessResponse(null, '좌석 배정이 해제되었습니다.'));
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: `서버 오류: ${error}` });
  }
});

/**
 * 좌석 목록 조회 (배치도별)
 */
export const getSeatsByLayoutFunction = functions.https.onRequest(async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await validateAuth(req);
    if (!authResult.success) {
      res.status(401).json({ success: false, error: authResult.error });
      return;
    }

    const { academyId, layoutName } = req.query;
    
    if (!academyId || !validateAcademyId(academyId as string)) {
      res.status(400).json({ success: false, error: '잘못된 Academy ID입니다.' });
      return;
    }

    const db = createDatabaseManager(academyId as string);
    const result = layoutName 
      ? await db.seats.getByLayout(layoutName as string)
      : await db.seats.getActiveSeats();

    if (result.success) {
      res.json(createSuccessResponse(result.data));
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: `서버 오류: ${error}` });
  }
});

/**
 * 좌석 배치도 생성
 */
export const createSeatLayoutFunction = functions.https.onRequest(async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await validateAuth(req);
    if (!authResult.success) {
      res.status(401).json({ success: false, error: authResult.error });
      return;
    }

    const { academyId, name, description, gridSize } = req.body as CreateSeatLayoutRequest;
    
    if (!validateAcademyId(academyId) || !name || !gridSize) {
      res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      return;
    }

    const db = createDatabaseManager(academyId);
    const result = await db.seatLayouts.create({
      name,
      description,
      gridSize,
      isActive: true
    });

    if (result.success) {
      res.status(201).json(createSuccessResponse({ layoutId: result.data }));
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: `서버 오류: ${error}` });
  }
});

// ===== 대시보드 Functions =====

/**
 * 대시보드 데이터 조회
 */
export const getDashboardDataFunction = functions.https.onRequest(async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await validateAuth(req);
    if (!authResult.success) {
      res.status(401).json({ success: false, error: authResult.error });
      return;
    }

    const { academyId } = req.query;
    
    if (!academyId || !validateAcademyId(academyId as string)) {
      res.status(400).json({ success: false, error: '잘못된 Academy ID입니다.' });
      return;
    }

    const db = createDatabaseManager(academyId as string);
    const result = await db.getDashboardData();

    if (result.success) {
      res.json(createSuccessResponse(result.data));
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: `서버 오류: ${error}` });
  }
});

/**
 * 학생 종합 정보 조회
 */
export const getStudentCompleteInfoFunction = functions.https.onRequest(async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await validateAuth(req);
    if (!authResult.success) {
      res.status(401).json({ success: false, error: authResult.error });
      return;
    }

    const { academyId, studentId } = req.query;
    
    if (!academyId || !validateAcademyId(academyId as string) || !studentId) {
      res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      return;
    }

    const db = createDatabaseManager(academyId as string);
    const result = await db.getStudentCompleteInfo(studentId as string);

    if (result.success) {
      res.json(createSuccessResponse(result.data));
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: `서버 오류: ${error}` });
  }
});