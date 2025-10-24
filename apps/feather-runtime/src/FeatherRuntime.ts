import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import {
  RouterAgent,
  SELLMAgent,
  ProjectManagementAgent,
  AuditAgent,
  PerformanceAgent,
  ProjectSpec,
  DeploymentEnvironment
} from '@hydra/feather-agent';
import { RestConnector, DatabaseConnector } from '@hydra/connectors';
import { createLogger } from './logger';
import { JobQueue } from './jobs/JobQueue';
import { SandboxExecutor } from './runtime/SandboxExecutor';
import { TaskManager } from './runtime/TaskManager';
import { DeploymentManager } from './deployment/DeploymentManager';
import { HealthMonitor } from './deployment/HealthMonitor';
import { AuditLogService } from '@hydra/symbolic-engine';

export class FeatherRuntime {
  private app: express.Application;
  private routerAgent: RouterAgent;
  private sellmAgent: SELLMAgent;
  private projectAgent: ProjectManagementAgent;
  private auditAgent: AuditAgent;
  private performanceAgent: PerformanceAgent;
  private jobQueue: JobQueue;
  private sandboxExecutor: SandboxExecutor;
  private taskManager: TaskManager;
  private deploymentManager: DeploymentManager;
  private healthMonitor: HealthMonitor;
  private auditLog: AuditLogService;
  private logger = createLogger('FeatherRuntime');
  private connectors: Map<string, any> = new Map();

  constructor() {
    this.app = express();
    this.routerAgent = new RouterAgent();
    this.sellmAgent = new SELLMAgent();
    this.projectAgent = new ProjectManagementAgent();
    this.auditLog = new AuditLogService();
    this.auditAgent = new AuditAgent({}, this.auditLog);
    this.performanceAgent = new PerformanceAgent();
    this.routerAgent.setAuditLogService(this.auditLog);
    this.jobQueue = new JobQueue();
    this.sandboxExecutor = new SandboxExecutor();
    this.taskManager = new TaskManager(this.jobQueue, this.sandboxExecutor);
    this.deploymentManager = new DeploymentManager(this.projectAgent);
    this.healthMonitor = new HealthMonitor(this.performanceAgent);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupConnectors();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Execute flow
    this.app.post('/execute', async (req, res) => {
      try {
        const { flowId, data, variables = {} } = req.body;
        
        const context = {
          requestId: req.headers['x-request-id'] as string || `req-${Date.now()}`,
          timestamp: new Date().toISOString(),
          data,
          variables,
          metadata: {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
          }
        };

        const result = await this.routerAgent.execute(context);
        
        res.json({
          success: true,
          result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error('Execution error', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Create symbolic rule
    this.app.post('/rules', async (req, res) => {
      try {
        const { domain, description, examples, constraints } = req.body;
        
        const context = {
          requestId: req.headers['x-request-id'] as string || `req-${Date.now()}`,
          timestamp: new Date().toISOString(),
          data: {
            operation: 'create_rule',
            input: { domain, description, examples, constraints }
          },
          variables: {},
          metadata: {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
          }
        };

        const result = await this.sellmAgent.execute(context);
        
        res.json({
          success: true,
          result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error('Rule creation error', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Get traces
    this.app.get('/traces', (req, res) => {
      try {
        const traces = this.routerAgent.getTraces();
        res.json({
          success: true,
          traces,
          count: traces.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error('Trace retrieval error', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Clear traces
    this.app.delete('/traces', (req, res) => {
      try {
        this.routerAgent.clearTraces();
        res.json({
          success: true,
          message: 'Traces cleared',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error('Trace clearing error', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Project management routes
    this.app.post('/projects', (req, res) => {
      try {
        const project = this.deploymentManager.createProject(req.body as ProjectSpec);
        res.status(201).json({ success: true, project, timestamp: new Date().toISOString() });
      } catch (error) {
        this.logger.error('Project creation failed', error);
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.patch('/projects/:projectId', (req, res) => {
      try {
        const { changes = {}, changelog } = req.body;
        const project = this.deploymentManager.updateProject(req.params.projectId, changes, changelog);
        res.json({ success: true, project, timestamp: new Date().toISOString() });
      } catch (error) {
        this.logger.error('Project update failed', error);
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.post('/projects/:projectId/deploy', (req, res) => {
      try {
        const { environment, changelog } = req.body;
        const record = this.deploymentManager.deployProject(
          req.params.projectId,
          environment as DeploymentEnvironment,
          changelog
        );
        res.json({ success: true, deployment: record, timestamp: new Date().toISOString() });
      } catch (error) {
        this.logger.error('Project deployment failed', error);
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.post('/projects/:projectId/rollback', (req, res) => {
      try {
        const record = this.deploymentManager.rollbackProject(req.params.projectId, req.body.version);
        res.json({ success: true, deployment: record, timestamp: new Date().toISOString() });
      } catch (error) {
        this.logger.error('Project rollback failed', error);
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.get('/projects/:projectId', (req, res) => {
      try {
        const summary = this.deploymentManager.getSummary(req.params.projectId);
        res.json({ success: true, summary, timestamp: new Date().toISOString() });
      } catch (error) {
        this.logger.error('Project summary failed', error);
        res.status(404).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.get('/projects/:projectId/health', (req, res) => {
      try {
        const snapshots = this.deploymentManager.getHealth(req.params.projectId, req.query.environment as string | undefined);
        res.json({ success: true, snapshots, timestamp: new Date().toISOString() });
      } catch (error) {
        res.status(404).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.post('/projects/:projectId/health', (req, res) => {
      try {
        const snapshot = this.deploymentManager.recordHealthSnapshot(
          req.params.projectId,
          req.body.environment,
          req.body.status,
          req.body.metrics,
          req.body.notes
        );
        res.status(201).json({ success: true, snapshot, timestamp: new Date().toISOString() });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Audit routes
    this.app.post('/audit/traces', (req, res) => {
      try {
        const entry = this.auditAgent.recordTrace(req.body.trace, req.body.metadata);
        res.status(201).json({ success: true, entry, timestamp: new Date().toISOString() });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.get('/audit/report', (req, res) => {
      const report = this.auditAgent.getComplianceReport();
      res.json({ success: true, report, timestamp: new Date().toISOString() });
    });

    // Performance metrics
    this.app.post('/metrics', (req, res) => {
      try {
        const metric = this.performanceAgent.recordMetric(req.body.metric, req.body.value, req.body.tags);
        res.status(201).json({ success: true, metric, timestamp: new Date().toISOString() });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.get('/metrics/:metric/summary', (req, res) => {
      const summary = this.performanceAgent.getSummary(req.params.metric);
      res.json({ success: true, summary, timestamp: new Date().toISOString() });
    });

    // Task management
    this.app.post('/runtime/tasks/sandbox', async (req, res) => {
      try {
        const task = await this.taskManager.runSandboxTask(req.body.code, req.body.language, req.body.input);
        res.status(201).json({ success: true, task, timestamp: new Date().toISOString() });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.post('/runtime/tasks/queue', async (req, res) => {
      try {
        const task = await this.taskManager.scheduleJob(req.body.type, req.body.payload);
        res.status(202).json({ success: true, task, timestamp: new Date().toISOString() });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.get('/runtime/tasks', (req, res) => {
      res.json({ success: true, tasks: this.taskManager.getTasks(), metrics: this.taskManager.getMetrics(), timestamp: new Date().toISOString() });
    });

    this.app.get('/runtime/tasks/:taskId', async (req, res) => {
      try {
        const task = await this.taskManager.refreshJob(req.params.taskId) || this.taskManager.getTask(req.params.taskId);
        if (!task) {
          return res.status(404).json({
            success: false,
            error: 'Task not found',
            timestamp: new Date().toISOString()
          });
        }
        res.json({ success: true, task, timestamp: new Date().toISOString() });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.get('/runtime/health', async (req, res) => {
      try {
        const jobCounts = await this.jobQueue.getJobCounts();
        const metrics = {
          cpu: Number(req.query.cpu || 0.35),
          memory: Number(req.query.memory || 0.42),
          queueLatency: jobCounts.waiting * 50
        };
        const snapshot = this.healthMonitor.recordSnapshot(metrics, 'Automated health check');
        res.json({ success: true, snapshot, timestamp: new Date().toISOString() });
      } catch (error) {
        this.logger.error('Health check failed', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Connector operations
    this.app.post('/connectors/:connectorId/execute', async (req, res) => {
      try {
        const { connectorId } = req.params;
        const { operation, data, parameters } = req.body;
        
        const connector = this.connectors.get(connectorId);
        if (!connector) {
          return res.status(404).json({
            success: false,
            error: `Connector ${connectorId} not found`,
            timestamp: new Date().toISOString()
          });
        }

        const result = await connector.execute({
          operation,
          data,
          parameters,
          metadata: {
            requestId: req.headers['x-request-id'] as string || `req-${Date.now()}`,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
          }
        });
        
        res.json({
          success: true,
          result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error('Connector execution error', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Error handling middleware
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.logger.error('Unhandled error', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Not found',
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupConnectors(): void {
    // Add a test REST connector
    const testRestConnector = new RestConnector({
      id: 'test-rest',
      name: 'Test REST Connector',
      type: 'rest',
      baseUrl: 'https://jsonplaceholder.typicode.com',
      enabled: true,
      timeout: 30000,
      retries: 3
    });

    this.connectors.set('test-rest', testRestConnector);

    // Add a test database connector (if configured)
    if (process.env.DATABASE_URL) {
      const dbConnector = new DatabaseConnector({
        id: 'main-db',
        name: 'Main Database',
        type: 'database',
        driver: 'postgresql',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'hydra',
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        ssl: process.env.DB_SSL === 'true',
        enabled: true,
        timeout: 30000,
        retries: 3
      });

      this.connectors.set('main-db', dbConnector);
    }
  }

  async start(port: number = 3001): Promise<void> {
    try {
      // Start job queue
      await this.jobQueue.start();
      
      // Start sandbox executor
      await this.sandboxExecutor.start();
      
      // Connect connectors
      for (const [id, connector] of this.connectors) {
        try {
          await connector.connect();
          this.logger.info(`Connected connector: ${id}`);
        } catch (error) {
          this.logger.warn(`Failed to connect connector ${id}:`, error);
        }
      }

      // Start HTTP server
      this.app.listen(port, () => {
        this.logger.info(`Feather Runtime started on port ${port}`);
      });
    } catch (error) {
      this.logger.error('Failed to start Feather Runtime', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      // Stop job queue
      await this.jobQueue.stop();
      
      // Stop sandbox executor
      await this.sandboxExecutor.stop();
      
      // Disconnect connectors
      for (const [id, connector] of this.connectors) {
        try {
          await connector.disconnect();
          this.logger.info(`Disconnected connector: ${id}`);
        } catch (error) {
          this.logger.warn(`Failed to disconnect connector ${id}:`, error);
        }
      }

      this.logger.info('Feather Runtime stopped');
    } catch (error) {
      this.logger.error('Error stopping Feather Runtime', error);
      throw error;
    }
  }

  getApp(): express.Application {
    return this.app;
  }

  getProjectAgent(): ProjectManagementAgent {
    return this.projectAgent;
  }

  getAuditAgent(): AuditAgent {
    return this.auditAgent;
  }

  getPerformanceAgent(): PerformanceAgent {
    return this.performanceAgent;
  }

  getTaskManager(): TaskManager {
    return this.taskManager;
  }
}
