import { z } from 'zod';

// Base connector configuration schema
export const ConnectorConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['rest', 'database', 'custom']),
  enabled: z.boolean().default(true),
  timeout: z.number().default(30000),
  retries: z.number().default(3),
  metadata: z.record(z.any()).optional()
});

// REST connector configuration
export const RestConnectorConfigSchema = ConnectorConfigSchema.extend({
  type: z.literal('rest'),
  baseUrl: z.string().url(),
  headers: z.record(z.string()).optional(),
  auth: z.object({
    type: z.enum(['bearer', 'basic', 'api-key']),
    token: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    apiKey: z.string().optional(),
    apiKeyHeader: z.string().optional()
  }).optional()
});

// Database connector configuration
export const DatabaseConnectorConfigSchema = ConnectorConfigSchema.extend({
  type: z.literal('database'),
  driver: z.enum(['postgresql', 'mysql', 'redis']),
  host: z.string(),
  port: z.number(),
  database: z.string(),
  username: z.string(),
  password: z.string(),
  ssl: z.boolean().default(false),
  pool: z.object({
    min: z.number().default(2),
    max: z.number().default(10),
    idleTimeoutMillis: z.number().default(30000)
  }).optional()
});

// Custom connector configuration
export const CustomConnectorConfigSchema = ConnectorConfigSchema.extend({
  type: z.literal('custom'),
  module: z.string(),
  config: z.record(z.any())
});

// Connector execution context
export const ConnectorContextSchema = z.object({
  operation: z.string(),
  data: z.record(z.any()).optional(),
  parameters: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional()
});

// Connector execution result
export const ConnectorResultSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  executionTime: z.number(),
  metadata: z.record(z.any()).optional()
});

export type ConnectorConfig = z.infer<typeof ConnectorConfigSchema>;
export type RestConnectorConfig = z.infer<typeof RestConnectorConfigSchema>;
export type DatabaseConnectorConfig = z.infer<typeof DatabaseConnectorConfigSchema>;
export type CustomConnectorConfig = z.infer<typeof CustomConnectorConfigSchema>;
export type ConnectorContext = z.infer<typeof ConnectorContextSchema>;
export type ConnectorResult = z.infer<typeof ConnectorResultSchema>;

// Connector interface
export interface IConnector {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly enabled: boolean;
  
  execute(context: ConnectorContext): Promise<ConnectorResult>;
  validate(context: ConnectorContext): boolean;
  getConfig(): ConnectorConfig;
  updateConfig(config: Partial<ConnectorConfig>): void;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;
}
