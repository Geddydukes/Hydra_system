import { IAgent, AgentConfig, ExecutionContext, AgentResult, AgentStatus, AgentEvent, AgentEventHandler } from '../types';

export abstract class HydraAgent implements IAgent {
  protected _config: AgentConfig;
  protected _status: AgentStatus = 'idle';
  protected _eventHandlers: AgentEventHandler[] = [];

  constructor(config: Partial<AgentConfig>) {
    this._config = {
      id: config.id || this.generateId(),
      name: config.name || this.constructor.name,
      description: config.description,
      version: config.version || '1.0.0',
      enabled: config.enabled !== false,
      priority: config.priority || 0,
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      metadata: config.metadata || {}
    };
  }

  get id(): string {
    return this._config.id;
  }

  get name(): string {
    return this._config.name;
  }

  get status(): AgentStatus {
    return this._status;
  }

  async execute(context: ExecutionContext): Promise<AgentResult> {
    if (!this._config.enabled) {
      return this.createErrorResult(context, 'Agent is disabled');
    }

    if (!this.validate(context)) {
      return this.createErrorResult(context, 'Context validation failed');
    }

    const startTime = Date.now();
    this._status = 'running';
    this.emitEvent('execute', context);

    try {
      const result = await this.executeInternal(context);
      const executionTime = Date.now() - startTime;
      
      this._status = 'idle';
      const agentResult = this.createSuccessResult(context, result, executionTime);
      this.emitEvent('result', agentResult);
      
      return agentResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this._status = 'error';
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const agentResult = this.createErrorResult(context, errorMessage, executionTime);
      this.emitEvent('error', agentResult);
      
      return agentResult;
    }
  }

  validate(context: ExecutionContext): boolean {
    try {
      return this.validateInternal(context);
    } catch (error) {
      return false;
    }
  }

  getConfig(): AgentConfig {
    return { ...this._config };
  }

  updateConfig(config: Partial<AgentConfig>): void {
    this._config = { ...this._config, ...config };
  }

  async start(): Promise<void> {
    this._status = 'idle';
    this.emitEvent('start', {});
    await this.startInternal();
  }

  async stop(): Promise<void> {
    this._status = 'disabled';
    this.emitEvent('stop', {});
    await this.stopInternal();
  }

  // Event handling
  addEventListener(handler: AgentEventHandler): void {
    this._eventHandlers.push(handler);
  }

  removeEventListener(handler: AgentEventHandler): void {
    const index = this._eventHandlers.indexOf(handler);
    if (index > -1) {
      this._eventHandlers.splice(index, 1);
    }
  }

  protected emitEvent(type: AgentEvent['type'], data?: any): void {
    const event: AgentEvent = {
      type,
      agentId: this.id,
      timestamp: new Date().toISOString(),
      data
    };

    this._eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in event handler for agent ${this.id}:`, error);
      }
    });
  }

  // Abstract methods to be implemented by subclasses
  protected abstract executeInternal(context: ExecutionContext): Promise<any>;
  protected abstract validateInternal(context: ExecutionContext): boolean;

  // Optional lifecycle methods
  protected async startInternal(): Promise<void> {
    // Default implementation - do nothing
  }

  protected async stopInternal(): Promise<void> {
    // Default implementation - do nothing
  }

  // Helper methods
  protected createSuccessResult(context: ExecutionContext, result: any, executionTime: number): AgentResult {
    return {
      success: true,
      result,
      executionTime,
      requestId: context.requestId,
      agentId: this.id,
      timestamp: new Date().toISOString(),
      metadata: {
        agentName: this.name,
        agentVersion: this._config.version,
        ...context.metadata
      }
    };
  }

  protected createErrorResult(context: ExecutionContext, error: string, executionTime: number = 0): AgentResult {
    return {
      success: false,
      result: null,
      error,
      executionTime,
      requestId: context.requestId,
      agentId: this.id,
      timestamp: new Date().toISOString(),
      metadata: {
        agentName: this.name,
        agentVersion: this._config.version,
        ...context.metadata
      }
    };
  }

  protected generateId(): string {
    return `${this.constructor.name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this._config.retries,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
        }
      }
    }
    
    throw lastError!;
  }
}
