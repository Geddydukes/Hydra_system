import { describe, it, expect, beforeEach } from 'vitest';
import { YAMLCompiler, HydraFlow } from '../src';

describe('YAMLCompiler', () => {
  let compiler: YAMLCompiler;

  beforeEach(() => {
    compiler = new YAMLCompiler();
  });

  it('should compile valid YAML to HydraFlow', () => {
    const yamlContent = `
name: "Loan Approval Flow"
description: "Automated loan approval process"
version: "1.0.0"
rules:
  - id: "credit-check"
    name: "Credit Score Check"
    description: "Check if credit score meets minimum requirement"
    condition:
      ">": 
        - {"var": "creditScore"}
        - 700
    priority: 10
    version: "1.0.0"
  - id: "amount-check"
    name: "Amount Check"
    description: "Check if loan amount is within limits"
    condition:
      "and":
        - {">": [{"var": "amount"}, 1000]}
        - {"<": [{"var": "amount"}, 100000]}
    priority: 5
    version: "1.0.0"
variables:
  minCreditScore: 700
  maxAmount: 100000
metadata:
  author: "Hydra Systems"
  createdAt: "2025-10-20T00:00:00Z"
`;

    const flow = compiler.compileFromYAML(yamlContent);

    expect(flow.name).toBe('Loan Approval Flow');
    expect(flow.description).toBe('Automated loan approval process');
    expect(flow.version).toBe('1.0.0');
    expect(flow.rules).toHaveLength(2);
    expect(flow.rules[0].id).toBe('credit-check');
    expect(flow.rules[0].name).toBe('Credit Score Check');
    expect(flow.rules[0].priority).toBe(10);
    expect(flow.variables).toEqual({ minCreditScore: 700, maxAmount: 100000 });
  });

  it('should handle YAML compilation errors', () => {
    const invalidYaml = `
name: "Test Flow"
version: "1.0.0"
rules:
  - id: "test-rule"
    # Missing name field
    condition: {">": [{"var": "amount"}, 100]}
`;

    expect(() => {
      compiler.compileFromYAML(invalidYaml);
    }).toThrow('Rule at index 0 must have a name');
  });

  it('should serialize HydraFlow to YAML', () => {
    const flow: HydraFlow = {
      name: 'Test Flow',
      description: 'A test flow',
      version: '1.0.0',
      rules: [
        {
          id: 'test-rule',
          name: 'Test Rule',
          condition: { '>': [{ var: 'amount' }, 100] },
          priority: 1,
          version: '1.0.0'
        }
      ],
      variables: { threshold: 100 },
      metadata: { author: 'test' }
    };

    const yaml = compiler.compileToYAML(flow);
    expect(yaml).toContain('name: Test Flow');
    expect(yaml).toContain('description: A test flow');
    expect(yaml).toContain('rules:');
    expect(yaml).toContain('test-rule');
  });

  it('should create simple rules correctly', () => {
    const rule = compiler.createSimpleRule(
      'test-id',
      'Test Rule',
      { '>': [{ var: 'amount' }, 100] },
      { 'set': [{ var: 'status' }, 'approved'] },
      5
    );

    expect(rule.id).toBe('test-id');
    expect(rule.name).toBe('Test Rule');
    expect(rule.priority).toBe(5);
    expect(rule.version).toBe('1.0.0');
    expect(rule.condition).toEqual({ '>': [{ var: 'amount' }, 100] });
    expect(rule.action).toEqual({ 'set': [{ var: 'status' }, 'approved'] });
  });

  it('should create flow templates correctly', () => {
    const template = compiler.createFlowTemplate('New Flow', 'A new flow');

    expect(template.name).toBe('New Flow');
    expect(template.description).toBe('A new flow');
    expect(template.version).toBe('1.0.0');
    expect(template.rules).toEqual([]);
    expect(template.variables).toEqual({});
    expect(template.metadata).toBeDefined();
    expect(template.metadata!.createdAt).toBeDefined();
    expect(template.metadata!.createdBy).toBe('hydra-systems');
  });

  it('should handle missing required fields', () => {
    const yamlWithoutName = `
version: "1.0.0"
rules: []
`;

    expect(() => {
      compiler.compileFromYAML(yamlWithoutName);
    }).toThrow('Flow name is required');

    const yamlWithoutVersion = `
name: "Test Flow"
rules: []
`;

    expect(() => {
      compiler.compileFromYAML(yamlWithoutVersion);
    }).toThrow('Flow version is required');

    const yamlWithoutRules = `
name: "Test Flow"
version: "1.0.0"
`;

    expect(() => {
      compiler.compileFromYAML(yamlWithoutRules);
    }).toThrow('Rules must be an array');
  });
});
