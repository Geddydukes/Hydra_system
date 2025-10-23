import { describe, it, expect, beforeEach } from 'vitest';
import { RouterAgent, ExecutionContext } from '../src';
import { Rule, HydraFlow } from '@hydra/symbolic-engine';

describe('RouterAgent', () => {
  let router: RouterAgent;
  let context: ExecutionContext;

  beforeEach(() => {
    router = new RouterAgent();
    
    context = {
      requestId: 'test-request',
      data: { amount: 1000, creditScore: 750 },
      variables: { threshold: 500 },
      metadata: {}
    };
  });

  it('should create router agent', () => {
    expect(router.name).toBe('RouterAgent');
    expect(router.status).toBe('idle');
  });

  it('should add and execute rules', async () => {
    const rule: Rule = {
      id: 'test-rule',
      name: 'Amount Check',
      condition: { '>': [{ var: 'amount' }, { var: 'threshold' }] },
      priority: 1,
      version: '1.0.0'
    };

    router.addRule(rule);
    const result = await router.execute(context);

    expect(result.success).toBe(true);
    expect(result.result.type).toBe('rule');
    expect(result.result.result).toHaveLength(1);
    expect(result.result.result[0].ruleId).toBe('test-rule');
  });

  it('should handle multiple rules with priorities', async () => {
    const rule1: Rule = {
      id: 'low-priority',
      name: 'Low Priority Rule',
      condition: { '>': [{ var: 'amount' }, 100] },
      priority: 1,
      version: '1.0.0'
    };

    const rule2: Rule = {
      id: 'high-priority',
      name: 'High Priority Rule',
      condition: { '>': [{ var: 'creditScore' }, 700] },
      priority: 10,
      version: '1.0.0'
    };

    router.addRule(rule1);
    router.addRule(rule2);

    const result = await router.execute(context);

    expect(result.success).toBe(true);
    expect(result.result.result).toHaveLength(2);
    expect(result.result.result[0].ruleId).toBe('high-priority'); // Higher priority first
    expect(result.result.result[1].ruleId).toBe('low-priority');
  });

  it('should add and execute flows', async () => {
    const flow: HydraFlow = {
      name: 'Test Flow',
      version: '1.0.0',
      rules: [
        {
          id: 'flow-rule',
          name: 'Flow Rule',
          condition: { '>': [{ var: 'amount' }, 500] },
          priority: 1,
          version: '1.0.0'
        }
      ],
      variables: { flowVar: 'test' }
    };

    router.addFlow(flow);
    const result = await router.execute(context);

    expect(result.success).toBe(true);
    expect(result.result.type).toBe('flow');
    expect(result.result.flowId).toBe('Test Flow');
    expect(result.result.flowName).toBe('Test Flow');
  });

  it('should return no match when no rules or flows match', async () => {
    const result = await router.execute(context);

    expect(result.success).toBe(true);
    expect(result.result.type).toBe('no_match');
    expect(result.result.message).toBe('No matching rules or flows found');
  });

  it('should manage rules correctly', () => {
    const rule: Rule = {
      id: 'test-rule',
      name: 'Test Rule',
      condition: { '==': [true, true] },
      priority: 1,
      version: '1.0.0'
    };

    router.addRule(rule);
    expect(router.getRules()).toHaveLength(1);

    const removed = router.removeRule('test-rule');
    expect(removed).toBe(true);
    expect(router.getRules()).toHaveLength(0);

    const notFound = router.removeRule('non-existent');
    expect(notFound).toBe(false);
  });

  it('should manage flows correctly', () => {
    const flow: HydraFlow = {
      name: 'Test Flow',
      version: '1.0.0',
      rules: []
    };

    router.addFlow(flow);
    expect(router.getFlows()).toHaveLength(1);

    const retrievedFlow = router.getFlow('Test Flow');
    expect(retrievedFlow).toEqual(flow);

    const removed = router.removeFlow('Test Flow');
    expect(removed).toBe(true);
    expect(router.getFlows()).toHaveLength(0);

    const notFound = router.removeFlow('non-existent');
    expect(notFound).toBe(false);
  });

  it('should validate context correctly', () => {
    const validContext = { ...context, data: { test: 'value' } };
    expect(router.validate(validContext)).toBe(true);

    const invalidContext = { ...context, data: null };
    expect(router.validate(invalidContext)).toBe(false);
  });

  it('should handle traces and cache', () => {
    router.clearTraces();
    router.clearCache();
    
    const traces = router.getTraces();
    expect(traces).toHaveLength(0);
  });
});
