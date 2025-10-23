import { describe, it, expect, beforeEach } from 'vitest';
import { JSONLogicEngine, TraceGenerator, YAMLCompiler, Rule, ExecutionContext } from '../src';

describe('JSONLogicEngine', () => {
  let engine: JSONLogicEngine;
  let context: ExecutionContext;

  beforeEach(() => {
    engine = new JSONLogicEngine({
      enableTracing: true,
      maxExecutionTime: 5000,
      enableCaching: true,
      cacheSize: 100
    });
    
    context = {
      data: { amount: 1000, creditScore: 750 },
      variables: { threshold: 500 },
      metadata: { userId: 'test-user' }
    };
  });

  it('should evaluate a simple rule correctly', () => {
    const rule: Rule = {
      id: 'test-rule-1',
      name: 'Amount Check',
      condition: { '>': [{ var: 'amount' }, { var: 'threshold' }] },
      priority: 1,
      version: '1.0.0'
    };

    const result = engine.evaluateRule(rule, context);

    expect(result.success).toBe(true);
    expect(result.result).toBe(true);
    expect(result.traces).toHaveLength(1);
    expect(result.traces[0].ruleId).toBe('test-rule-1');
    expect(result.traces[0].result).toBe(true);
  });

  it('should handle complex conditions', () => {
    const rule: Rule = {
      id: 'test-rule-2',
      name: 'Credit Score Check',
      condition: {
        'and': [
          { '>': [{ var: 'creditScore' }, 700] },
          { '<': [{ var: 'amount' }, 2000] }
        ]
      },
      priority: 2,
      version: '1.0.0'
    };

    const result = engine.evaluateRule(rule, context);

    expect(result.success).toBe(true);
    expect(result.result).toBe(true);
  });

  it('should execute actions when conditions are true', () => {
    const rule: Rule = {
      id: 'test-rule-3',
      name: 'Approval Rule',
      condition: { '>': [{ var: 'creditScore' }, 700] },
      action: { 'set': [{ var: 'status' }, 'approved'] },
      priority: 1,
      version: '1.0.0'
    };

    const result = engine.evaluateRule(rule, context);

    expect(result.success).toBe(true);
    expect(result.result).toBe(true);
  });

  it('should handle multiple rules with priorities', () => {
    const rules: Rule[] = [
      {
        id: 'rule-1',
        name: 'Low Priority',
        condition: { '>': [{ var: 'amount' }, 100] },
        priority: 1,
        version: '1.0.0'
      },
      {
        id: 'rule-2',
        name: 'High Priority',
        condition: { '>': [{ var: 'creditScore' }, 800] },
        priority: 10,
        version: '1.0.0'
      }
    ];

    const result = engine.evaluateRules(rules, context);

    expect(result.success).toBe(true);
    expect(result.result).toHaveLength(2);
    expect(result.result[0].ruleId).toBe('rule-2'); // Higher priority first
    expect(result.result[1].ruleId).toBe('rule-1');
  });

  it('should handle errors gracefully', () => {
    const rule: Rule = {
      id: 'error-rule',
      name: 'Error Rule',
      condition: { 'invalid': 'operation' },
      priority: 1,
      version: '1.0.0'
    };

    const result = engine.evaluateRule(rule, context);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('should cache results when enabled', () => {
    const rule: Rule = {
      id: 'cache-rule',
      name: 'Cache Test',
      condition: { '>': [{ var: 'amount' }, 500] },
      priority: 1,
      version: '1.0.0'
    };

    const result1 = engine.evaluateRule(rule, context);
    const result2 = engine.evaluateRule(rule, context);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result2.traces).toHaveLength(0); // Should be cached
  });

  it('should generate traces correctly', () => {
    const rule: Rule = {
      id: 'trace-rule',
      name: 'Trace Test',
      condition: { '>': [{ var: 'amount' }, 500] },
      priority: 1,
      version: '1.0.0'
    };

    engine.evaluateRule(rule, context);
    const traces = engine.getTraces();

    expect(traces).toHaveLength(1);
    expect(traces[0].ruleId).toBe('trace-rule');
    expect(traces[0].result).toBe(true);
    expect(traces[0].executionTime).toBeGreaterThanOrEqual(0);
  });
});
