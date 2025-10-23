import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { RouterAgent, SELLMAgent } from '@hydra/feather-agent';
import { RestConnector, DatabaseConnector } from '@hydra/connectors';
import { createLogger } from './logger';
import { JobQueue } from './jobs/JobQueue';
import { SandboxExecutor } from './runtime/SandboxExecutor';

export class FeatherRuntime {
  private app: express.Application;
  private routerAgent: RouterAgent;
  private sellmAgent: SELLMAgent;
  private jobQueue: JobQueue;
  private sandboxExecutor: SandboxExecutor;
  private logger = createLogger('FeatherRuntime');
  private connectors: Map<string, any> = new Map();

  constructor() {
    this.app = express();
    this.routerAgent = new RouterAgent();
    this.sellmAgent = new SELLMAgent();
    this.jobQueue = new JobQueue();
    this.sandboxExecutor = new SandboxExecutor();
    
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
}
