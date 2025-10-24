import { describe, it, expect, beforeEach } from 'vitest';
import { JSONLogicEngine, Rule, ExecutionContext, AuditLogService } from '../src';

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
    expect(result.actionResult).toBeDefined();
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

  it('should compose rules with dependencies and skip when unmet', () => {
    const rules: Rule[] = [
      {
        id: 'rule-primary',
        name: 'Primary Check',
        condition: { '>': [{ var: 'amount' }, 500] },
        priority: 5,
        version: '1.0.0'
      },
      {
        id: 'rule-dependent',
        name: 'Dependent Rule',
        condition: { '>': [{ var: 'creditScore' }, 900] },
        dependsOn: ['rule-primary'],
        priority: 1,
        version: '1.0.0'
      }
    ];

    const result = engine.evaluateRules(rules, context);
    expect(result.success).toBe(true);
    expect(result.result).toHaveLength(2);
    const dependent = result.result.find(entry => entry.ruleId === 'rule-dependent');
    expect(dependent?.skipped).toBe(true);
    expect(dependent?.reason).toBe('dependency_unsatisfied');
  });

  it('should recover from failures using fallback actions', () => {
    const rules: Rule[] = [
      {
        id: 'unstable-rule',
        name: 'Unstable Rule',
        condition: { 'invalid': 'operation' },
        recovery: {
          actions: [
            { type: 'retry', maxRetries: 1 },
            { type: 'fallback', fallbackValue: 'fallback-result' }
          ]
        },
        continueOnFail: true,
        priority: 1,
        version: '1.0.0'
      }
    ];

    const result = engine.evaluateRules(rules, context);
    expect(result.success).toBe(true);
    expect(result.result[0].result).toBe('fallback-result');
  });

  it('records signed traces when audit log service attached', () => {
    const audit = new AuditLogService();
    engine.setAuditLogService(audit);

    const rule: Rule = {
      id: 'audit-rule',
      name: 'Audit Rule',
      condition: { '>': [{ var: 'amount' }, 500] },
      priority: 1,
      version: '1.0.0'
    };

    engine.evaluateRule(rule, context);
    const entries = audit.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].trace.ruleId).toBe('audit-rule');
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
