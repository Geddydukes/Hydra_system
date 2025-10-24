import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogService, Trace } from '../src';

describe('AuditLogService', () => {
  let auditLog: AuditLogService;
  let trace: Trace;

  beforeEach(() => {
    auditLog = new AuditLogService({ secret: 'test-secret' });
    trace = {
      id: 'trace-123',
      ruleId: 'rule-abc',
      timestamp: new Date().toISOString(),
      input: { value: 10 },
      output: true,
      condition: { '>': [{ var: 'value' }, 5] },
      result: true,
      executionTime: 3
    };
  });

  it('records traces with signatures and verifies integrity', () => {
    const entry = auditLog.recordTrace(trace, { reviewer: 'qa' });
    expect(entry.hash).toHaveLength(64);
    expect(entry.signature).toHaveLength(64);
    expect(auditLog.verifyEntry(entry)).toBe(true);

    const tampered = { ...entry, hash: 'invalid' } as any;
    expect(auditLog.verifyEntry(tampered)).toBe(false);
  });

  it('produces compliance summaries with execution metrics', () => {
    auditLog.recordTrace(trace);
    auditLog.recordTrace({ ...trace, id: 'trace-456', result: false, executionTime: 15 });

    const summary = auditLog.getComplianceSummary();
    expect(summary.totalTraces).toBe(2);
    expect(summary.failingTraces).toBe(1);
    expect(summary.averageExecutionTime).toBeGreaterThan(0);
  });

  it('analyzes rule level statistics', () => {
    auditLog.recordTrace(trace);
    auditLog.recordTrace({ ...trace, id: 'trace-789', executionTime: 9 });

    const analysis = auditLog.analyzeRule('rule-abc');
    expect(analysis.executions).toBe(2);
    expect(analysis.successRate).toBe(1);
    expect(analysis.averageExecutionTime).toBeGreaterThan(0);
  });
});
