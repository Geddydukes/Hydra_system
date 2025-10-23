import { describe, it, expect, beforeEach } from 'vitest';
import { SELLMAgent, ExecutionContext } from '../src';

describe('SELLMAgent', () => {
  let sellmAgent: SELLMAgent;
  let context: ExecutionContext;

  beforeEach(() => {
    sellmAgent = new SELLMAgent({
      name: 'SELLMAgent',
      description: 'Symbolic Engineer LLM'
    });
  });

  it('should create SELLM agent', () => {
    expect(sellmAgent.name).toBe('SELLMAgent');
    expect(sellmAgent.status).toBe('idle');
  });

  it('should create rules from examples', async () => {
    context = {
      requestId: 'test-request',
      data: {
        operation: 'create_rule',
        input: {
          domain: 'finance',
          description: 'Credit score validation rule',
          examples: [
            { input: { creditScore: 800 }, output: true },
            { input: { creditScore: 600 }, output: false }
          ]
        }
      },
      variables: {},
      metadata: {}
    };

    const result = await sellmAgent.execute(context);

    expect(result.success).toBe(true);
    expect(result.result.success).toBe(true);
    expect(result.result.rule.id).toContain('rule-');
    expect(result.result.rule.name).toBe('finance Rule');
    expect(result.result.rule.metadata.domain).toBe('finance');
    expect(result.result.explanation).toContain('Created rule for finance domain');
  });

  it('should create flows', async () => {
    context = {
      requestId: 'test-request',
      data: {
        operation: 'create_flow',
        input: {
          name: 'Loan Approval Flow',
          description: 'Automated loan approval process',
          rules: [
            {
              id: 'rule-1',
              name: 'Credit Check',
              condition: { '>': [{ var: 'creditScore' }, 700] },
              priority: 1,
              version: '1.0.0'
            }
          ],
          variables: { minScore: 700 }
        }
      },
      variables: {},
      metadata: {}
    };

    const result = await sellmAgent.execute(context);

    expect(result.success).toBe(true);
    expect(result.result.success).toBe(true);
    expect(result.result.flow.name).toBe('Loan Approval Flow');
    expect(result.result.flow.rules).toHaveLength(1);
    expect(result.result.yaml).toContain('Loan Approval Flow');
  });

  it('should validate rules', async () => {
    context = {
      requestId: 'test-request',
      data: {
        operation: 'validate_rule',
        input: {
          rule: {
            id: 'test-rule',
            name: 'Test Rule',
            condition: { '>': [{ var: 'amount' }, 100] },
            priority: 1,
            version: '1.0.0'
          },
          testCases: [
            { amount: 200 },
            { amount: 50 }
          ]
        }
      },
      variables: {},
      metadata: {}
    };

    const result = await sellmAgent.execute(context);

    expect(result.success).toBe(true);
    expect(result.result.success).toBe(true);
    expect(result.result.validation.ruleId).toBe('test-rule');
    expect(result.result.validation.totalTests).toBe(2);
  });

  it('should optimize rules', async () => {
    context = {
      requestId: 'test-request',
      data: {
        operation: 'optimize_rule',
        input: {
          rule: {
            id: 'test-rule',
            name: 'Test Rule',
            condition: { '>': [{ var: 'amount' }, 100] },
            priority: 1,
            version: '1.0.0'
          },
          performanceData: { executionTime: 50, memoryUsage: 1024 }
        }
      },
      variables: {},
      metadata: {}
    };

    const result = await sellmAgent.execute(context);

    expect(result.success).toBe(true);
    expect(result.result.success).toBe(true);
    expect(result.result.optimizedRule.metadata.optimized).toBe(true);
    expect(result.result.improvements).toHaveLength(3);
  });

  it('should explain rules', async () => {
    context = {
      requestId: 'test-request',
      data: {
        operation: 'explain_rule',
        input: {
          rule: {
            id: 'test-rule',
            name: 'Test Rule',
            description: 'A test rule',
            condition: { '>': [{ var: 'amount' }, 100] },
            action: { 'set': [{ var: 'status' }, 'approved'] },
            priority: 1,
            version: '1.0.0'
          }
        }
      },
      variables: {},
      metadata: {}
    };

    const result = await sellmAgent.execute(context);

    expect(result.success).toBe(true);
    expect(result.result.success).toBe(true);
    expect(result.result.explanation.ruleId).toBe('test-rule');
    expect(result.result.explanation.description).toBe('A test rule');
    expect(result.result.explanation.conditionExplanation).toBeDefined();
    expect(result.result.explanation.actionExplanation).toBeDefined();
  });

  it('should handle unknown operations', async () => {
    context = {
      requestId: 'test-request',
      data: {
        operation: 'unknown_operation',
        input: {}
      },
      variables: {},
      metadata: {}
    };

    const result = await sellmAgent.execute(context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown operation: unknown_operation');
  });

  it('should validate context correctly', () => {
    const validContext = {
      requestId: 'test-request',
      data: {
        operation: 'create_rule',
        input: { domain: 'test' }
      },
      variables: {},
      metadata: {}
    };

    expect(sellmAgent.validate(validContext)).toBe(true);

    const invalidContext = {
      requestId: 'test-request',
      data: {
        operation: 'create_rule'
        // Missing input
      },
      variables: {},
      metadata: {}
    };

    expect(sellmAgent.validate(invalidContext)).toBe(false);
  });
});
