import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { FeatherRuntime } from '../src';

// Mock dependencies
vi.mock('@hydra/feather-agent', () => ({
  RouterAgent: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      success: true,
      result: { type: 'rule', result: [{ ruleId: 'test-rule', result: true }] }
    }),
    getTraces: vi.fn().mockReturnValue([]),
    clearTraces: vi.fn()
  })),
  SELLMAgent: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      success: true,
      result: { success: true, rule: { id: 'new-rule', name: 'Test Rule' } }
    })
  }))
}));

vi.mock('@hydra/connectors', () => ({
  RestConnector: vi.fn().mockImplementation(() => ({
    id: 'test-rest',
    name: 'Test REST Connector',
    type: 'rest',
    enabled: true,
    execute: vi.fn().mockResolvedValue({
      success: true,
      data: { message: 'Hello World' },
      executionTime: 100
    }),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined)
  })),
  DatabaseConnector: vi.fn()
}));

vi.mock('bull', () => ({
  default: vi.fn().mockImplementation(() => ({
    process: vi.fn(),
    on: vi.fn(),
    add: vi.fn().mockResolvedValue({ id: 'job-123' }),
    getJob: vi.fn(),
    getJobs: vi.fn().mockResolvedValue([]),
    getJobCounts: vi.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 }),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    clean: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('dockerode', () => ({
  default: vi.fn().mockImplementation(() => ({
    ping: vi.fn().mockResolvedValue('OK'),
    createContainer: vi.fn().mockResolvedValue({
      start: vi.fn().mockResolvedValue(undefined),
      logs: vi.fn().mockResolvedValue({
        on: vi.fn(),
        end: vi.fn()
      }),
      inspect: vi.fn().mockResolvedValue({ State: { ExitCode: 0 } }),
      remove: vi.fn().mockResolvedValue(undefined),
      kill: vi.fn().mockResolvedValue(undefined)
    })
  }))
}));

describe('FeatherRuntime', () => {
  let runtime: FeatherRuntime;

  beforeEach(() => {
    runtime = new FeatherRuntime();
  });

  afterEach(async () => {
    await runtime.stop();
  });

  it('should create runtime instance', () => {
    expect(runtime).toBeDefined();
    expect(runtime.getApp()).toBeDefined();
  });

  it('should handle health check', async () => {
    const response = await request(runtime.getApp())
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('healthy');
    expect(response.body.version).toBe('1.0.0');
    expect(response.body.timestamp).toBeDefined();
  });

  it('should execute flow', async () => {
    const response = await request(runtime.getApp())
      .post('/execute')
      .send({
        flowId: 'test-flow',
        data: { amount: 1000, creditScore: 750 },
        variables: { threshold: 500 }
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.result).toBeDefined();
    expect(response.body.timestamp).toBeDefined();
  });

  it('should create symbolic rule', async () => {
    const response = await request(runtime.getApp())
      .post('/rules')
      .send({
        domain: 'finance',
        description: 'Credit score validation',
        examples: [
          { input: { creditScore: 800 }, output: true },
          { input: { creditScore: 600 }, output: false }
        ]
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.result).toBeDefined();
    expect(response.body.timestamp).toBeDefined();
  });

  it('should get traces', async () => {
    const response = await request(runtime.getApp())
      .get('/traces')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.traces).toBeDefined();
    expect(response.body.count).toBeDefined();
    expect(response.body.timestamp).toBeDefined();
  });

  it('should clear traces', async () => {
    const response = await request(runtime.getApp())
      .delete('/traces')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Traces cleared');
    expect(response.body.timestamp).toBeDefined();
  });

  it('should execute connector operation', async () => {
    const response = await request(runtime.getApp())
      .post('/connectors/test-rest/execute')
      .send({
        operation: 'GET',
        parameters: { path: '/test' }
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.result).toBeDefined();
    expect(response.body.timestamp).toBeDefined();
  });

  it('should handle connector not found', async () => {
    const response = await request(runtime.getApp())
      .post('/connectors/non-existent/execute')
      .send({
        operation: 'GET',
        parameters: { path: '/test' }
      })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Connector non-existent not found');
  });

  it('should handle 404 for unknown routes', async () => {
    const response = await request(runtime.getApp())
      .get('/unknown-route')
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Not found');
  });

  it('should handle execution errors', async () => {
    // Mock RouterAgent to throw error
    const { RouterAgent } = require('@hydra/feather-agent');
    const mockRouterAgent = {
      execute: vi.fn().mockRejectedValue(new Error('Execution failed'))
    };
    
    // Replace the router agent in the runtime
    runtime.routerAgent = mockRouterAgent as any;

    const response = await request(runtime.getApp())
      .post('/execute')
      .send({
        flowId: 'test-flow',
        data: { amount: 1000 }
      })
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Execution failed');
  });

  it('should start and stop runtime', async () => {
    const testRuntime = new FeatherRuntime();
    
    // Mock the app.listen method
    const mockListen = vi.fn().mockImplementation((port, callback) => {
      callback();
      return { close: vi.fn() };
    });
    testRuntime.getApp().listen = mockListen;

    await testRuntime.start(3002);
    expect(mockListen).toHaveBeenCalledWith(3002, expect.any(Function));

    await testRuntime.stop();
  });
});
