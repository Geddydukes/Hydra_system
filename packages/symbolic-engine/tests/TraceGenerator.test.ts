import { describe, it, expect, beforeEach } from 'vitest';
import { TraceGenerator, Trace } from '../src';

describe('TraceGenerator', () => {
  let traceGenerator: TraceGenerator;

  beforeEach(() => {
    traceGenerator = new TraceGenerator();
  });

  it('should generate traces correctly', () => {
    const trace = traceGenerator.generateTrace(
      'test-rule',
      { amount: 1000 },
      true,
      { '>': [{ var: 'amount' }, 500] },
      true,
      15,
      { userId: 'test-user' }
    );

    expect(trace.id).toBeDefined();
    expect(trace.ruleId).toBe('test-rule');
    expect(trace.timestamp).toBeDefined();
    expect(trace.input).toEqual({ amount: 1000 });
    expect(trace.output).toBe(true);
    expect(trace.condition).toEqual({ '>': [{ var: 'amount' }, 500] });
    expect(trace.result).toBe(true);
    expect(trace.executionTime).toBe(15);
    expect(trace.metadata).toEqual({ userId: 'test-user' });
  });

  it('should store and retrieve traces', () => {
    traceGenerator.generateTrace('rule-1', {}, true, {}, true, 10);
    traceGenerator.generateTrace('rule-2', {}, false, {}, false, 20);

    const traces = traceGenerator.getTraces();
    expect(traces).toHaveLength(2);
    expect(traces[0].ruleId).toBe('rule-1');
    expect(traces[1].ruleId).toBe('rule-2');
  });

  it('should filter traces by rule ID', () => {
    traceGenerator.generateTrace('rule-1', {}, true, {}, true, 10);
    traceGenerator.generateTrace('rule-2', {}, false, {}, false, 20);
    traceGenerator.generateTrace('rule-1', {}, true, {}, true, 15);

    const rule1Traces = traceGenerator.getTracesByRule('rule-1');
    expect(rule1Traces).toHaveLength(2);
    expect(rule1Traces.every(trace => trace.ruleId === 'rule-1')).toBe(true);

    const rule2Traces = traceGenerator.getTracesByRule('rule-2');
    expect(rule2Traces).toHaveLength(1);
    expect(rule2Traces[0].ruleId).toBe('rule-2');
  });

  it('should clear traces', () => {
    traceGenerator.generateTrace('rule-1', {}, true, {}, true, 10);
    traceGenerator.generateTrace('rule-2', {}, false, {}, false, 20);

    expect(traceGenerator.getTraces()).toHaveLength(2);

    traceGenerator.clearTraces();
    expect(traceGenerator.getTraces()).toHaveLength(0);
  });

  it('should generate unique trace IDs', () => {
    const trace1 = traceGenerator.generateTrace('rule-1', {}, true, {}, true, 10);
    const trace2 = traceGenerator.generateTrace('rule-2', {}, false, {}, false, 20);

    expect(trace1.id).not.toBe(trace2.id);
    expect(trace1.id).toBeDefined();
    expect(trace2.id).toBeDefined();
  });

  it('should handle optional metadata', () => {
    const traceWithoutMetadata = traceGenerator.generateTrace(
      'test-rule',
      { amount: 1000 },
      true,
      { '>': [{ var: 'amount' }, 500] },
      true,
      15
    );

    expect(traceWithoutMetadata.metadata).toBeUndefined();

    const traceWithMetadata = traceGenerator.generateTrace(
      'test-rule',
      { amount: 1000 },
      true,
      { '>': [{ var: 'amount' }, 500] },
      true,
      15,
      { userId: 'test-user', sessionId: 'session-123' }
    );

    expect(traceWithMetadata.metadata).toEqual({
      userId: 'test-user',
      sessionId: 'session-123'
    });
  });
});
