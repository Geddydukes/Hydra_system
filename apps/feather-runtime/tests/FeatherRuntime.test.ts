import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { FeatherRuntime } from '../src';

// Mock dependencies
vi.mock('@hydra/feather-agent', () => {
  const actual = vi.requireActual<typeof import('@hydra/feather-agent')>('@hydra/feather-agent');
  return {
    ...actual,
    RouterAgent: vi.fn().mockImplementation(() => ({
      execute: vi.fn().mockResolvedValue({
        success: true,
        result: { type: 'rule', result: [{ ruleId: 'test-rule', result: true }] }
      }),
      getTraces: vi.fn().mockReturnValue([]),
      clearTraces: vi.fn(),
      addEventListener: vi.fn()
    })),
    SELLMAgent: vi.fn().mockImplementation(() => ({
      execute: vi.fn().mockResolvedValue({
        success: true,
        result: { success: true, rule: { id: 'new-rule', name: 'Test Rule' } }
      })
    }))
  };
});

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
    add: vi.fn().mockResolvedValue({
      id: 'job-123',
      getState: vi.fn().mockResolvedValue('completed'),
      finished: vi.fn().mockResolvedValue({ success: true }),
      failedReason: undefined
    }),
    getJob: vi.fn().mockResolvedValue({
      id: 'job-123',
      getState: vi.fn().mockResolvedValue('completed'),
      finished: vi.fn().mockResolvedValue({ success: true })
    }),
    getJobs: vi.fn().mockResolvedValue([]),
    getJobCounts: vi.fn().mockResolvedValue({ waiting: 1, active: 0, completed: 5, failed: 0 }),
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
      logs: vi.fn().mockResolvedValue((() => {
        const stream = {
          on: vi.fn((event: string, handler: (...args: any[]) => void) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from('execution output')), 0);
            }
            if (event === 'end') {
              setTimeout(() => handler(), 0);
            }
            return stream;
          })
        } as any;
        return stream;
      })()),
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

  it('manages project lifecycles through deployment endpoints', async () => {
    const projectResponse = await request(runtime.getApp())
      .post('/projects')
      .send({ name: 'Underwriting', domain: 'finance' })
      .expect(201);

    const projectId = projectResponse.body.project.id;
    expect(projectId).toBeDefined();

    await request(runtime.getApp())
      .post(`/projects/${projectId}/deploy`)
      .send({
        environment: { name: 'staging', url: 'https://staging.hydra.systems' },
        changelog: 'Initial deployment'
      })
      .expect(200);

    await request(runtime.getApp())
      .post(`/projects/${projectId}/health`)
      .send({
        environment: 'staging',
        status: 'healthy',
        metrics: { latency: 120 }
      })
      .expect(201);

    const summaryResponse = await request(runtime.getApp())
      .get(`/projects/${projectId}`)
      .expect(200);

    expect(summaryResponse.body.summary.project.id).toBe(projectId);

    const healthResponse = await request(runtime.getApp())
      .get(`/projects/${projectId}/health?environment=staging`)
      .expect(200);

    expect(healthResponse.body.snapshots.length).toBeGreaterThan(0);
  });

  it('records audit traces and runtime metrics', async () => {
    const trace = {
      id: 'trace-test',
      ruleId: 'rule-123',
      timestamp: new Date().toISOString(),
      input: { amount: 200 },
      output: true,
      condition: { '>': [{ var: 'amount' }, 100] },
      result: true,
      executionTime: 4
    };

    await request(runtime.getApp())
      .post('/audit/traces')
      .send({ trace, metadata: { reviewer: 'qa' } })
      .expect(201);

    const reportResponse = await request(runtime.getApp())
      .get('/audit/report')
      .expect(200);

    expect(reportResponse.body.report.totalEntries).toBeGreaterThan(0);

    await request(runtime.getApp())
      .post('/metrics')
      .send({ metric: 'latency', value: 120 })
      .expect(201);

    const summaryResponse = await request(runtime.getApp())
      .get('/metrics/latency/summary')
      .expect(200);

    expect(summaryResponse.body.summary.count).toBeGreaterThan(0);
  });

  it('runs sandbox tasks and tracks task state', async () => {
    const taskResponse = await request(runtime.getApp())
      .post('/runtime/tasks/sandbox')
      .send({ code: "console.log('hello world')" })
      .expect(201);

    expect(taskResponse.body.task.status).toBe('completed');

    const queueTask = await request(runtime.getApp())
      .post('/runtime/tasks/queue')
      .send({ type: 'execute-flow', payload: { flowId: 'flow-1' } })
      .expect(202);

    const taskId = queueTask.body.task.id;

    const taskStatus = await request(runtime.getApp())
      .get(`/runtime/tasks/${taskId}`)
      .expect(200);

    expect(taskStatus.body.task.id).toBe(taskId);

    const taskList = await request(runtime.getApp())
      .get('/runtime/tasks')
      .expect(200);

    expect(taskList.body.metrics).toBeDefined();
  });

  it('provides runtime health snapshots', async () => {
    const response = await request(runtime.getApp())
      .get('/runtime/health')
      .expect(200);

    expect(response.body.snapshot.status).toBeDefined();
    expect(response.body.snapshot.metrics.queueLatency).toBeDefined();
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
