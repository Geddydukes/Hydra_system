import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { IConnector, RestConnectorConfig, ConnectorContext, ConnectorResult } from '../types';

export class RestConnector implements IConnector {
  private config: RestConnectorConfig;
  private client: AxiosInstance;
  private connected: boolean = false;

  constructor(config: RestConnectorConfig, client?: AxiosInstance) {
    this.config = config;
    this.client = client || this.createClient();
  }

  get id(): string {
    return this.config.id;
  }

  get name(): string {
    return this.config.name;
  }

  get type(): string {
    return this.config.type;
  }

  get enabled(): boolean {
    return this.config.enabled;
  }

  async execute(context: ConnectorContext): Promise<ConnectorResult> {
    if (!this.enabled) {
      return this.createErrorResult('Connector is disabled');
    }

    if (!this.validate(context)) {
      return this.createErrorResult('Context validation failed');
    }

    const startTime = Date.now();

    try {
      const { operation, data, parameters = {} } = context;
      
      let response;
      switch (operation.toLowerCase()) {
        case 'get':
          response = await this.client.get(parameters.path || '/', {
            params: parameters.query,
            ...parameters.config
          });
          break;
        case 'post':
          response = await this.client.post(parameters.path || '/', data, {
            params: parameters.query,
            ...parameters.config
          });
          break;
        case 'put':
          response = await this.client.put(parameters.path || '/', data, {
            params: parameters.query,
            ...parameters.config
          });
          break;
        case 'patch':
          response = await this.client.patch(parameters.path || '/', data, {
            params: parameters.query,
            ...parameters.config
          });
          break;
        case 'delete':
          response = await this.client.delete(parameters.path || '/', {
            params: parameters.query,
            ...parameters.config
          });
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${operation}`);
      }

      return this.createSuccessResult(response.data, Date.now() - startTime, {
        status: response.status,
        headers: response.headers,
        ...context.metadata
      });

    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : String(error),
        Date.now() - startTime
      );
    }
  }

  validate(context: ConnectorContext): boolean {
    return Boolean(context.operation && typeof context.operation === 'string');
  }

  getConfig(): RestConnectorConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<RestConnectorConfig>): void {
    this.config = { ...this.config, ...config };
    this.client = this.createClient();
  }

  async connect(): Promise<void> {
    try {
      // Test connection with a simple request
      await this.client.get('/');
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(`Failed to connect to ${this.config.baseUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      return false;
    }
  }

  private createClient(): AxiosInstance {
    const config: AxiosRequestConfig = {
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      }
    };

    // Add authentication
    if (this.config.auth) {
      switch (this.config.auth.type) {
        case 'bearer':
          if (this.config.auth.token) {
            config.headers!['Authorization'] = `Bearer ${this.config.auth.token}`;
          }
          break;
        case 'basic':
          if (this.config.auth.username && this.config.auth.password) {
            const credentials = Buffer.from(`${this.config.auth.username}:${this.config.auth.password}`).toString('base64');
            config.headers!['Authorization'] = `Basic ${credentials}`;
          }
          break;
        case 'api-key':
          if (this.config.auth.apiKey && this.config.auth.apiKeyHeader) {
            config.headers![this.config.auth.apiKeyHeader] = this.config.auth.apiKey;
          }
          break;
      }
    }

    return axios.create(config);
  }

  private createSuccessResult(data: any, executionTime: number, metadata?: any): ConnectorResult {
    return {
      success: true,
      data,
      executionTime,
      metadata: {
        connectorId: this.id,
        connectorName: this.name,
        connectorType: this.type,
        ...metadata
      }
    };
  }

  private createErrorResult(error: string, executionTime: number = 0): ConnectorResult {
    return {
      success: false,
      error,
      executionTime,
      metadata: {
        connectorId: this.id,
        connectorName: this.name,
        connectorType: this.type
      }
    };
  }
}
