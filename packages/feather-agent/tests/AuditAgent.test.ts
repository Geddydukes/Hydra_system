import { describe, it, expect, beforeEach } from 'vitest';
import { AuditAgent } from '../src';
import { Trace } from '@hydra/symbolic-engine';

const baseTrace: Trace = {
  id: 'trace-1',
  ruleId: 'rule-1',
  timestamp: new Date().toISOString(),
  input: { amount: 100 },
  output: true,
  condition: { '>': [{ var: 'amount' }, 50] },
  result: true,
  executionTime: 5
};

describe('AuditAgent', () => {
  let agent: AuditAgent;

  beforeEach(() => {
    agent = new AuditAgent({ name: 'AuditAgent' });
  });

  it('records and verifies signed traces', () => {
    const entry = agent.recordTrace(baseTrace, { reviewer: 'qa@hydra.ai' });
    expect(entry.signature).toHaveLength(64);
    expect(agent.verifyEntry(entry)).toBe(true);

    const tampered = { ...entry, hash: 'abc' } as any;
    expect(agent.verifyEntry(tampered)).toBe(false);
  });

  it('generates compliance reports with rule breakdown', () => {
    agent.recordTrace(baseTrace, { severity: 'info' });
    agent.recordTrace({ ...baseTrace, id: 'trace-2', result: false, executionTime: 9 }, { severity: 'warn' });

    const report = agent.getComplianceReport();
    expect(report.totalEntries).toBe(2);
    expect(report.failingEntries).toBe(1);
    expect(report.ruleBreakdown['rule-1']).toBeDefined();
    expect(report.ruleBreakdown['rule-1'].executions).toBe(2);
  });

  it('analyzes rule performance trends', () => {
    agent.recordTrace(baseTrace);
    const analysis = agent.analyzeRule('rule-1');
    expect(analysis.executions).toBe(1);
    expect(analysis.averageExecutionTime).toBeGreaterThan(0);
  });
});
