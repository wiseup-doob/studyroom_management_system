/**
 * WiseUp 관리 시스템 - 타입 정의
 */

// ==================== 사용자 관련 타입 ====================

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  academyId: string;
  role: "student" | "admin" | "super_admin";
  grade?: string;
  permissions?: string[];
}

export interface SetUserRoleRequest {
  uid: string;
  academyId: string;
  role: "student" | "admin" | "super_admin";
}

export interface GetUsersRequest {
  academyId?: string;
  role: "student" | "admin" | "super_admin";
}

// ==================== 학원 관련 타입 ====================

export interface CreateAcademyRequest {
  academyId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  operatingHours?: {
    open: string;
    close: string;
  };
  settings?: {
    maxStudents: number;
    seatCapacity: number;
    attendanceCheckInTime: string;
    attendanceCheckOutTime: string;
  };
}

// ==================== 테스트 데이터 관련 타입 ====================

export interface CreateTestDataRequest {
  academyId: string;
}

// ==================== 응답 타입 ====================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface UserResponse {
  success: boolean;
  uid?: string;
  email?: string;
  customClaims?: any;
  message?: string;
}

export interface UsersListResponse {
  success: boolean;
  users: any[];
  count: number;
}

export interface AcademyResponse {
  success: boolean;
  academyId?: string;
  message?: string;
}

export interface TestDataResponse {
  success: boolean;
  message?: string;
  studentsCount?: number;
  adminsCount?: number;
}

// ==================== 커스텀 클레임 타입 ====================

export interface CustomClaims {
  academyId: string;
  role: "student" | "admin" | "super_admin";
  student?: boolean;
  admin?: boolean;
  super_admin?: boolean;
}
