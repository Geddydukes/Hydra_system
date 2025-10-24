import { JobQueue } from '../jobs/JobQueue';
import { SandboxExecutor, ExecutionResult } from './SandboxExecutor';

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface TaskRecord {
  id: string;
  type: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  payload?: any;
  result?: any;
  error?: string;
}

function now(): string {
  return new Date().toISOString();
}

export class TaskManager {
  private tasks: Map<string, TaskRecord> = new Map();

  constructor(private jobQueue: JobQueue, private sandbox: SandboxExecutor) {}

  async scheduleJob(type: string, payload: any): Promise<TaskRecord> {
    const job = await this.jobQueue.addJob(type, payload);
    const taskId = job.id?.toString() || `${type}-${Date.now()}`;
    const record: TaskRecord = {
      id: taskId,
      type,
      status: 'queued',
      createdAt: now(),
      updatedAt: now(),
      payload
    };

    this.tasks.set(taskId, record);
    return { ...record };
  }

  async runSandboxTask(code: string, language: 'javascript' | 'python' = 'javascript', input?: any): Promise<TaskRecord> {
    const taskId = `sandbox-${Date.now()}`;
    const record: TaskRecord = {
      id: taskId,
      type: `sandbox:${language}`,
      status: 'running',
      createdAt: now(),
      updatedAt: now(),
      payload: { input }
    };

    this.tasks.set(taskId, record);

    const result = await this.sandbox.execute(code, language, input);
    this.completeTask(taskId, result);
    return { ...this.tasks.get(taskId)! };
  }

  async refreshJob(taskId: string): Promise<TaskRecord | undefined> {
    const record = this.tasks.get(taskId);
    if (!record) {
      return undefined;
    }

    const job = await this.jobQueue.getJob(taskId);
    if (!job) {
      return { ...record };
    }

    const state = typeof (job as any).getState === 'function' ? await (job as any).getState() : undefined;
    if (state === 'completed') {
      record.status = 'completed';
      record.result = await (job as any).finished?.().catch(() => undefined);
    } else if (state === 'failed') {
      record.status = 'failed';
      record.error = (await (job as any).failedReason) || 'Job failed';
    }

    record.updatedAt = now();
    this.tasks.set(taskId, record);
    return { ...record };
  }

  getTask(taskId: string): TaskRecord | undefined {
    const record = this.tasks.get(taskId);
    return record ? { ...record } : undefined;
  }

  getTasks(): TaskRecord[] {
    return Array.from(this.tasks.values()).map(record => ({ ...record }));
  }

  getMetrics(): Record<TaskStatus, number> {
    const metrics: Record<TaskStatus, number> = {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0
    };

    for (const record of this.tasks.values()) {
      metrics[record.status] = (metrics[record.status] || 0) + 1;
    }

    return metrics;
  }

  private completeTask(taskId: string, result: ExecutionResult): void {
    const record = this.tasks.get(taskId);
    if (!record) {
      return;
    }

    record.status = result.success ? 'completed' : 'failed';
    record.result = result;
    record.error = result.success ? undefined : result.error;
    record.updatedAt = now();
    this.tasks.set(taskId, record);
  }
}
