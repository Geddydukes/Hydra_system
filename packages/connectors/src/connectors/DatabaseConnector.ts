import { Pool, PoolClient } from 'pg';
import { IConnector, DatabaseConnectorConfig, ConnectorContext, ConnectorResult } from '../types';

export class DatabaseConnector implements IConnector {
  private config: DatabaseConnectorConfig;
  private pool: Pool | null = null;
  private connected: boolean = false;

  constructor(config: DatabaseConnectorConfig) {
    this.config = config;
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

    if (!this.connected || !this.pool) {
      return this.createErrorResult('Database not connected');
    }

    const startTime = Date.now();

    try {
      const { operation, data, parameters = {} } = context;
      
      let result;
      switch (operation.toLowerCase()) {
        case 'query':
          result = await this.executeQuery(parameters.query, parameters.params);
          break;
        case 'insert':
          result = await this.executeInsert(parameters.table, data, parameters.returning);
          break;
        case 'update':
          result = await this.executeUpdate(parameters.table, data, parameters.where, parameters.returning);
          break;
        case 'delete':
          result = await this.executeDelete(parameters.table, parameters.where, parameters.returning);
          break;
        case 'transaction':
          result = await this.executeTransaction(parameters.queries);
          break;
        default:
          throw new Error(`Unsupported database operation: ${operation}`);
      }

      return this.createSuccessResult(result, Date.now() - startTime, {
        operation,
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

  getConfig(): DatabaseConnectorConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<DatabaseConnectorConfig>): void {
    this.config = { ...this.config, ...config };
    // Recreate pool if connection details changed
    if (this.pool) {
      this.pool.end();
      this.pool = null;
      this.connected = false;
    }
  }

  async connect(): Promise<void> {
    try {
      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl,
        min: this.config.pool?.min || 2,
        max: this.config.pool?.max || 10,
        idleTimeoutMillis: this.config.pool?.idleTimeoutMillis || 30000
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(`Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.connected = false;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.pool) {
      return false;
    }

    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      return false;
    }
  }

  private async executeQuery(query: string, params: any[] = []): Promise<any> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(query, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields.map(field => ({
          name: field.name,
          dataTypeID: field.dataTypeID
        }))
      };
    } finally {
      client.release();
    }
  }

  private async executeInsert(table: string, data: any, returning: string[] = []): Promise<any> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    
    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})${returning.length > 0 ? ` RETURNING ${returning.join(', ')}` : ''}`;
    
    return await this.executeQuery(query, values);
  }

  private async executeUpdate(table: string, data: any, where: any, returning: string[] = []): Promise<any> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, index) => `${col} = $${index + 1}`).join(', ');
    
    let whereClause = '';
    let whereParams: any[] = [];
    
    if (where) {
      const whereColumns = Object.keys(where);
      whereParams = Object.values(where);
      whereClause = ` WHERE ${whereColumns.map((col, index) => `${col} = $${values.length + index + 1}`).join(' AND ')}`;
    }
    
    const query = `UPDATE ${table} SET ${setClause}${whereClause}${returning.length > 0 ? ` RETURNING ${returning.join(', ')}` : ''}`;
    
    return await this.executeQuery(query, [...values, ...whereParams]);
  }

  private async executeDelete(table: string, where: any, returning: string[] = []): Promise<any> {
    let whereClause = '';
    let whereParams: any[] = [];
    
    if (where) {
      const whereColumns = Object.keys(where);
      whereParams = Object.values(where);
      whereClause = ` WHERE ${whereColumns.map((col, index) => `${col} = $${index + 1}`).join(' AND ')}`;
    }
    
    const query = `DELETE FROM ${table}${whereClause}${returning.length > 0 ? ` RETURNING ${returning.join(', ')}` : ''}`;
    
    return await this.executeQuery(query, whereParams);
  }

  private async executeTransaction(queries: Array<{ query: string; params?: any[] }>): Promise<any> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const results = [];
      for (const { query, params = [] } of queries) {
        const result = await client.query(query, params);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
