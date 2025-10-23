import Queue from 'bull';
import { createLogger } from '../logger';

export interface JobData {
  type: string;
  payload: any;
  metadata?: any;
}

export class JobQueue {
  private queue: Queue.Queue;
  private logger = createLogger('JobQueue');

  constructor() {
    this.queue = new Queue('hydra-jobs', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      }
    });

    this.setupProcessors();
  }

  private setupProcessors(): void {
    this.queue.process('execute-flow', async (job) => {
      this.logger.info(`Processing flow execution job: ${job.id}`);
      
      const { flowId, data, variables } = job.data;
      
      // Simulate flow execution
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        result: { flowId, executed: true, timestamp: new Date().toISOString() }
      };
    });

    this.queue.process('create-rule', async (job) => {
      this.logger.info(`Processing rule creation job: ${job.id}`);
      
      const { domain, description, examples } = job.data;
      
      // Simulate rule creation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return {
        success: true,
        result: { 
          ruleId: `rule-${Date.now()}`,
          domain,
          created: true,
          timestamp: new Date().toISOString()
        }
      };
    });

    this.queue.process('connector-operation', async (job) => {
      this.logger.info(`Processing connector operation job: ${job.id}`);
      
      const { connectorId, operation, data } = job.data;
      
      // Simulate connector operation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        success: true,
        result: { 
          connectorId,
          operation,
          executed: true,
          timestamp: new Date().toISOString()
        }
      };
    });

    // Job event handlers
    this.queue.on('completed', (job, result) => {
      this.logger.info(`Job ${job.id} completed`, { result });
    });

    this.queue.on('failed', (job, err) => {
      this.logger.error(`Job ${job.id} failed`, err);
    });

    this.queue.on('stalled', (job) => {
      this.logger.warn(`Job ${job.id} stalled`);
    });
  }

  async addJob(type: string, data: any, options?: Queue.JobOptions): Promise<Queue.Job> {
    const job = await this.queue.add(type, data, {
      removeOnComplete: 100,
      removeOnFail: 50,
      ...options
    });

    this.logger.info(`Added job ${job.id} of type ${type}`);
    return job;
  }

  async getJob(jobId: string): Promise<Queue.Job | null> {
    return await this.queue.getJob(jobId);
  }

  async getJobs(status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' = 'waiting'): Promise<Queue.Job[]> {
    return await this.queue.getJobs([status], 0, 100);
  }

  async getJobCounts(): Promise<Queue.JobCounts> {
    return await this.queue.getJobCounts();
  }

  async pause(): Promise<void> {
    await this.queue.pause();
    this.logger.info('Job queue paused');
  }

  async resume(): Promise<void> {
    await this.queue.resume();
    this.logger.info('Job queue resumed');
  }

  async clean(grace: number = 0, status: 'completed' | 'failed' = 'completed'): Promise<void> {
    await this.queue.clean(grace, status);
    this.logger.info(`Cleaned jobs with status: ${status}`);
  }

  async start(): Promise<void> {
    this.logger.info('Job queue started');
  }

  async stop(): Promise<void> {
    await this.queue.close();
    this.logger.info('Job queue stopped');
  }
}
