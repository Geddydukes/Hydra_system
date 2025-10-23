import { describe, it, expect, beforeEach } from 'vitest';
import { HydraAgent, RouterAgent, SELLMAgent, ExecutionContext } from '../src';

// Test implementation of HydraAgent
class TestAgent extends HydraAgent {
  protected async executeInternal(context: ExecutionContext): Promise<any> {
    return { message: 'Hello from TestAgent', data: context.data };
  }

  protected validateInternal(context: ExecutionContext): boolean {
    return context.data && typeof context.data === 'object';
  }
}

describe('HydraAgent', () => {
  let agent: TestAgent;
  let context: ExecutionContext;

  beforeEach(() => {
    agent = new TestAgent({
      name: 'TestAgent',
      description: 'A test agent'
    });
    
    context = {
      requestId: 'test-request',
      data: { test: 'value' },
      variables: {},
      metadata: {}
    };
  });

  it('should create agent with correct properties', () => {
    expect(agent.id).toBeDefined();
    expect(agent.name).toBe('TestAgent');
    expect(agent.status).toBe('idle');
  });

  it('should execute successfully with valid context', async () => {
    const result = await agent.execute(context);

    expect(result.success).toBe(true);
    expect(result.result.message).toBe('Hello from TestAgent');
    expect(result.result.data).toEqual({ test: 'value' });
    expect(result.agentId).toBe(agent.id);
    expect(result.requestId).toBe('test-request');
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });

  it('should handle execution errors', async () => {
    const invalidContext = { ...context, data: null };
    const result = await agent.execute(invalidContext);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Context validation failed');
    expect(result.result).toBeNull();
  });

  it('should handle disabled agent', async () => {
    agent.updateConfig({ enabled: false });
    const result = await agent.execute(context);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Agent is disabled');
  });

  it('should emit events correctly', async () => {
    const events: any[] = [];
    agent.addEventListener((event) => events.push(event));

    await agent.execute(context);

    expect(events).toHaveLength(2); // execute and result events
    expect(events[0].type).toBe('execute');
    expect(events[1].type).toBe('result');
    expect(events[0].agentId).toBe(agent.id);
    expect(events[1].agentId).toBe(agent.id);
  });

  it('should start and stop correctly', async () => {
    await agent.start();
    expect(agent.status).toBe('idle');

    await agent.stop();
    expect(agent.status).toBe('disabled');
  });

  it('should update configuration', () => {
    const newConfig = { priority: 10, timeout: 60000 };
    agent.updateConfig(newConfig);
    
    const config = agent.getConfig();
    expect(config.priority).toBe(10);
    expect(config.timeout).toBe(60000);
  });
});
