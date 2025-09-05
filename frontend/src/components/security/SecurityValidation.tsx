import React, { useState } from 'react';
import { dataIsolationService } from '../../services/dataIsolationService';
import { DataIsolationReport, IsolationTestResult } from '../../services/dataIsolationService';
import './SecurityValidation.css';

interface SecurityValidationProps {
  onValidationComplete?: (report: DataIsolationReport) => void;
}

export const SecurityValidation: React.FC<SecurityValidationProps> = ({ onValidationComplete }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<DataIsolationReport | null>(null);
  const [error, setError] = useState<string>('');

  const runValidation = async () => {
    setIsRunning(true);
    setError('');
    setReport(null);

    try {
      const validationReport = await dataIsolationService.runIsolationTests();
      setReport(validationReport);
      onValidationComplete?.(validationReport);
    } catch (err: any) {
      setError(err.message || '보안 검증 중 오류가 발생했습니다.');
    } finally {
      setIsRunning(false);
    }
  };

  const getTestStatusIcon = (passed: boolean) => {
    return passed ? '✅' : '❌';
  };

  const getTestStatusClass = (passed: boolean) => {
    return passed ? 'test-passed' : 'test-failed';
  };

  return (
    <div className="security-validation">
      <div className="validation-header">
        <h2>보안 및 데이터 격리 검증</h2>
        <p>멀티테넌트 아키텍처의 보안 설정과 데이터 격리를 검증합니다.</p>
        
        <button 
          onClick={runValidation} 
          disabled={isRunning}
          className="run-validation-button"
        >
          {isRunning ? '검증 중...' : '보안 검증 실행'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <h3>오류 발생</h3>
          <p>{error}</p>
        </div>
      )}

      {report && (
        <div className="validation-report">
          <div className="report-header">
            <h3>검증 결과</h3>
            <div className={`overall-status ${report.overallPassed ? 'passed' : 'failed'}`}>
              {report.overallPassed ? '✅ 모든 테스트 통과' : '❌ 일부 테스트 실패'}
            </div>
          </div>

          <div className="report-summary">
            <div className="summary-item">
              <span className="label">총 테스트:</span>
              <span className="value">{report.totalTests}</span>
            </div>
            <div className="summary-item">
              <span className="label">통과:</span>
              <span className="value passed">{report.passedTests}</span>
            </div>
            <div className="summary-item">
              <span className="label">실패:</span>
              <span className="value failed">{report.failedTests}</span>
            </div>
            <div className="summary-item">
              <span className="label">검증 시간:</span>
              <span className="value">{report.timestamp.toLocaleString('ko-KR')}</span>
            </div>
          </div>

          <div className="test-results">
            <h4>상세 테스트 결과</h4>
            {report.results.map((result: IsolationTestResult, index: number) => (
              <div key={index} className={`test-result ${getTestStatusClass(result.passed)}`}>
                <div className="test-header">
                  <span className="test-icon">{getTestStatusIcon(result.passed)}</span>
                  <span className="test-name">{result.testName}</span>
                </div>
                <div className="test-message">{result.message}</div>
                {result.details && (
                  <details className="test-details">
                    <summary>상세 정보</summary>
                    <pre>{JSON.stringify(result.details, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>

          <div className="recommendations">
            <h4>보안 권장사항</h4>
            <ul>
              <li>정기적으로 보안 검증을 실행하여 데이터 격리 상태를 확인하세요.</li>
              <li>실패한 테스트가 있다면 즉시 보안 설정을 점검하세요.</li>
              <li>의심스러운 활동이 감지되면 관리자에게 알려주세요.</li>
              <li>사용자 권한 변경 시 보안 검증을 다시 실행하세요.</li>
            </ul>
          </div>
        </div>
      )}

      <div className="security-info">
        <h4>보안 기능</h4>
        <div className="security-features">
          <div className="feature-item">
            <strong>학원 간 데이터 격리:</strong> 각 학원의 데이터는 완전히 분리되어 보호됩니다.
          </div>
          <div className="feature-item">
            <strong>역할 기반 접근 제어:</strong> 사용자 역할에 따라 적절한 권한이 부여됩니다.
          </div>
          <div className="feature-item">
            <strong>실시간 보안 모니터링:</strong> 의심스러운 활동을 실시간으로 감지합니다.
          </div>
          <div className="feature-item">
            <strong>감사 로그:</strong> 모든 보안 관련 활동이 기록됩니다.
          </div>
        </div>
      </div>
    </div>
  );
};
