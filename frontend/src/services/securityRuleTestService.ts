import { securityService } from './securityService';
import { SecurityError } from '../types/security';

interface SecurityRuleTest {
  testName: string;
  description: string;
  testFunction: () => Promise<boolean>;
  expectedResult: boolean;
}

interface SecurityRuleTestResult {
  testName: string;
  passed: boolean;
  expectedResult: boolean;
  actualResult: boolean;
  error?: string;
  details?: any;
}

interface SecurityRuleTestSuite {
  suiteName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: SecurityRuleTestResult[];
  timestamp: Date;
}

class SecurityRuleTestService {
  
  // 보안 규칙 테스트 실행
  async runSecurityRuleTests(): Promise<SecurityRuleTestSuite> {
    const tests: SecurityRuleTest[] = [
      {
        testName: 'Student Access to Own Data',
        description: '학생이 본인 데이터에 접근할 수 있는지 테스트',
        testFunction: () => this.testStudentAccessToOwnData(),
        expectedResult: true
      },
      {
        testName: 'Student Access to Other Student Data',
        description: '학생이 다른 학생 데이터에 접근할 수 없는지 테스트',
        testFunction: () => this.testStudentAccessToOtherStudentData(),
        expectedResult: false
      },
      {
        testName: 'Student Access to Admin Resources',
        description: '학생이 관리자 리소스에 접근할 수 없는지 테스트',
        testFunction: () => this.testStudentAccessToAdminResources(),
        expectedResult: false
      },
      {
        testName: 'Admin Access to Student Data',
        description: '관리자가 학생 데이터에 접근할 수 있는지 테스트',
        testFunction: () => this.testAdminAccessToStudentData(),
        expectedResult: true
      },
      {
        testName: 'Admin Access to Admin Resources',
        description: '관리자가 관리자 리소스에 접근할 수 있는지 테스트',
        testFunction: () => this.testAdminAccessToAdminResources(),
        expectedResult: true
      },
      {
        testName: 'Super Admin Access to All Resources',
        description: '슈퍼 관리자가 모든 리소스에 접근할 수 있는지 테스트',
        testFunction: () => this.testSuperAdminAccessToAllResources(),
        expectedResult: true
      },
      {
        testName: 'Cross Academy Data Access Prevention',
        description: '다른 학원 데이터 접근이 차단되는지 테스트',
        testFunction: () => this.testCrossAcademyDataAccessPrevention(),
        expectedResult: false
      },
      {
        testName: 'Inactive User Access Prevention',
        description: '비활성 사용자 접근이 차단되는지 테스트',
        testFunction: () => this.testInactiveUserAccessPrevention(),
        expectedResult: false
      }
    ];

    const results: SecurityRuleTestResult[] = [];

    for (const test of tests) {
      try {
        const actualResult = await test.testFunction();
        const passed = actualResult === test.expectedResult;
        
        results.push({
          testName: test.testName,
          passed,
          expectedResult: test.expectedResult,
          actualResult,
          details: { description: test.description }
        });
      } catch (error) {
        results.push({
          testName: test.testName,
          passed: false,
          expectedResult: test.expectedResult,
          actualResult: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          details: { description: test.description }
        });
      }
    }

    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.length - passedTests;

    return {
      suiteName: 'Security Rule Test Suite',
      totalTests: results.length,
      passedTests,
      failedTests,
      results,
      timestamp: new Date()
    };
  }

  // 테스트 1: 학생이 본인 데이터에 접근할 수 있는지 테스트
  private async testStudentAccessToOwnData(): Promise<boolean> {
    try {
      // 학생 컨텍스트로 설정
      securityService.setContext({
        academyId: 'test_academy_1',
        role: 'student',
        permissions: [],
        isActive: true
      });

      const accessControl = securityService.checkStudentDataAccess('student_1', 'student_1');
      return accessControl.canRead;
    } catch (error) {
      return false;
    }
  }

  // 테스트 2: 학생이 다른 학생 데이터에 접근할 수 없는지 테스트
  private async testStudentAccessToOtherStudentData(): Promise<boolean> {
    try {
      // 학생 컨텍스트로 설정
      securityService.setContext({
        academyId: 'test_academy_1',
        role: 'student',
        permissions: [],
        isActive: true
      });

      const accessControl = securityService.checkStudentDataAccess('student_2', 'student_1');
      return !accessControl.canRead; // 접근할 수 없어야 함
    } catch (error) {
      return true; // 에러가 발생하면 차단된 것으로 간주
    }
  }

  // 테스트 3: 학생이 관리자 리소스에 접근할 수 없는지 테스트
  private async testStudentAccessToAdminResources(): Promise<boolean> {
    try {
      // 학생 컨텍스트로 설정
      securityService.setContext({
        academyId: 'test_academy_1',
        role: 'student',
        permissions: [],
        isActive: true
      });

      const accessControl = securityService.checkDataAccess('admins', 'read');
      return !accessControl.canRead; // 접근할 수 없어야 함
    } catch (error) {
      return true; // 에러가 발생하면 차단된 것으로 간주
    }
  }

  // 테스트 4: 관리자가 학생 데이터에 접근할 수 있는지 테스트
  private async testAdminAccessToStudentData(): Promise<boolean> {
    try {
      // 관리자 컨텍스트로 설정
      securityService.setContext({
        academyId: 'test_academy_1',
        role: 'admin',
        permissions: ['manage_students'],
        isActive: true
      });

      const accessControl = securityService.checkDataAccess('students', 'read');
      return accessControl.canRead;
    } catch (error) {
      return false;
    }
  }

  // 테스트 5: 관리자가 관리자 리소스에 접근할 수 있는지 테스트
  private async testAdminAccessToAdminResources(): Promise<boolean> {
    try {
      // 관리자 컨텍스트로 설정
      securityService.setContext({
        academyId: 'test_academy_1',
        role: 'admin',
        permissions: ['manage_students', 'view_reports'],
        isActive: true
      });

      const permissionCheck = securityService.validatePermission(['manage_students']);
      return permissionCheck.allowed;
    } catch (error) {
      return false;
    }
  }

  // 테스트 6: 슈퍼 관리자가 모든 리소스에 접근할 수 있는지 테스트
  private async testSuperAdminAccessToAllResources(): Promise<boolean> {
    try {
      // 슈퍼 관리자 컨텍스트로 설정
      securityService.setContext({
        academyId: 'test_academy_1',
        role: 'super_admin',
        permissions: ['manage_students', 'manage_admins', 'manage_academy'],
        isActive: true
      });

      const studentsAccess = securityService.checkDataAccess('students', 'read');
      const adminsAccess = securityService.checkDataAccess('admins', 'read');
      const permissionCheck = securityService.validatePermission(['manage_students']);

      return studentsAccess.canRead && adminsAccess.canRead && permissionCheck.allowed;
    } catch (error) {
      return false;
    }
  }

  // 테스트 7: 다른 학원 데이터 접근이 차단되는지 테스트
  private async testCrossAcademyDataAccessPrevention(): Promise<boolean> {
    try {
      // 학원 1의 관리자로 설정
      securityService.setContext({
        academyId: 'test_academy_1',
        role: 'admin',
        permissions: ['manage_students'],
        isActive: true
      });

      // 학원 2의 데이터에 접근 시도
      securityService.validateAcademyId('test_academy_2');
      return false; // 예외가 발생하지 않으면 실패
    } catch (error) {
      return error instanceof SecurityError && error.code === 'ACADEMY_MISMATCH';
    }
  }

  // 테스트 8: 비활성 사용자 접근이 차단되는지 테스트
  private async testInactiveUserAccessPrevention(): Promise<boolean> {
    try {
      // 비활성 사용자로 설정
      securityService.setContext({
        academyId: 'test_academy_1',
        role: 'student',
        permissions: [],
        isActive: false
      });

      const accessControl = securityService.checkStudentDataAccess('student_1', 'student_1');
      return !accessControl.canRead; // 접근할 수 없어야 함
    } catch (error) {
      return true; // 에러가 발생하면 차단된 것으로 간주
    }
  }

  // 권한 검증 테스트
  async testPermissionValidation(): Promise<SecurityRuleTestResult[]> {
    const results: SecurityRuleTestResult[] = [];

    // 테스트 케이스들
    const testCases = [
      {
        name: 'Student Permission Validation',
        context: { academyId: 'test_academy_1', role: 'student' as const, permissions: [], isActive: true },
        requiredPermissions: ['manage_students'],
        expectedResult: false
      },
      {
        name: 'Admin Permission Validation',
        context: { academyId: 'test_academy_1', role: 'admin' as const, permissions: ['manage_students'], isActive: true },
        requiredPermissions: ['manage_students'],
        expectedResult: true
      },
      {
        name: 'Super Admin Permission Validation',
        context: { academyId: 'test_academy_1', role: 'super_admin' as const, permissions: [], isActive: true },
        requiredPermissions: ['manage_students'],
        expectedResult: true
      }
    ];

    for (const testCase of testCases) {
      try {
        securityService.setContext(testCase.context);
        const permissionCheck = securityService.validatePermission(testCase.requiredPermissions);
        const passed = permissionCheck.allowed === testCase.expectedResult;

        results.push({
          testName: testCase.name,
          passed,
          expectedResult: testCase.expectedResult,
          actualResult: permissionCheck.allowed,
          details: { permissionCheck }
        });
      } catch (error) {
        results.push({
          testName: testCase.name,
          passed: false,
          expectedResult: testCase.expectedResult,
          actualResult: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  // 의심스러운 활동 감지 테스트
  async testSuspiciousActivityDetection(): Promise<SecurityRuleTestResult[]> {
    const results: SecurityRuleTestResult[] = [];

    const testCases = [
      {
        name: 'Student Access to Admin Resources',
        context: { academyId: 'test_academy_1', role: 'student' as const, permissions: [], isActive: true },
        action: 'access_admin_panel',
        resource: 'admins',
        expectedResult: true // 의심스러운 활동으로 감지되어야 함
      },
      {
        name: 'Normal Student Activity',
        context: { academyId: 'test_academy_1', role: 'student' as const, permissions: [], isActive: true },
        action: 'view_own_data',
        resource: 'students',
        expectedResult: false // 정상적인 활동
      },
      {
        name: 'Cross Academy Access Attempt',
        context: { academyId: 'test_academy_1', role: 'admin' as const, permissions: ['manage_students'], isActive: true },
        action: 'cross_academy_access',
        resource: 'students',
        expectedResult: true // 의심스러운 활동으로 감지되어야 함
      }
    ];

    for (const testCase of testCases) {
      try {
        securityService.setContext(testCase.context);
        const suspicious = securityService.detectSuspiciousActivity(testCase.action, testCase.resource);
        const passed = suspicious === testCase.expectedResult;

        results.push({
          testName: testCase.name,
          passed,
          expectedResult: testCase.expectedResult,
          actualResult: suspicious,
          details: { action: testCase.action, resource: testCase.resource }
        });
      } catch (error) {
        results.push({
          testName: testCase.name,
          passed: false,
          expectedResult: testCase.expectedResult,
          actualResult: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }
}

export const securityRuleTestService = new SecurityRuleTestService();
