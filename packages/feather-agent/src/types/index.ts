import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Base agent configuration schema
export const AgentConfigSchema = z.object({
  id: z.string().default(() => uuidv4()),
  name: z.string(),
  description: z.string().optional(),
  version: z.string().default('1.0.0'),
  enabled: z.boolean().default(true),
  priority: z.number().default(0),
  timeout: z.number().default(30000), // 30 seconds
  retries: z.number().default(3),
  metadata: z.record(z.any()).optional()
});

// Agent execution context
export const ExecutionContextSchema = z.object({
  requestId: z.string().default(() => uuidv4()),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  timestamp: z.string().default(() => new Date().toISOString()),
  data: z.record(z.any()).default({}),
  variables: z.record(z.any()).default({}),
  metadata: z.record(z.any()).default({})
});

// Agent execution result
export const AgentResultSchema = z.object({
  success: z.boolean(),
  result: z.any(),
  error: z.string().optional(),
  executionTime: z.number(),
  requestId: z.string(),
  agentId: z.string(),
  timestamp: z.string(),
  metadata: z.record(z.any()).optional()
});

// Agent status
export const AgentStatusSchema = z.enum(['idle', 'running', 'error', 'disabled']);

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type ExecutionContext = z.infer<typeof ExecutionContextSchema>;
export type AgentResult = z.infer<typeof AgentResultSchema>;
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

// Agent interface
export interface IAgent {
  readonly id: string;
  readonly name: string;
  readonly status: AgentStatus;
  
  execute(context: ExecutionContext): Promise<AgentResult>;
  validate(context: ExecutionContext): boolean;
  getConfig(): AgentConfig;
  updateConfig(config: Partial<AgentConfig>): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

// Agent event types
export interface AgentEvent {
  type: 'start' | 'stop' | 'execute' | 'error' | 'result';
  agentId: string;
  timestamp: string;
  data?: any;
}

// Agent event handler
export type AgentEventHandler = (event: AgentEvent) => void;

// Project management types
export interface ProjectSpec {
  name: string;
  description?: string;
  domain: string;
  owner?: string;
  flows?: any[];
  rules?: any[];
  connectors?: string[];
  metadata?: Record<string, any>;
}

export interface ProjectRecord extends ProjectSpec {
  id: string;
  version: string;
  status: 'draft' | 'active' | 'deployed' | 'archived' | 'failed';
  createdAt: string;
  updatedAt: string;
  deploymentHistory: DeploymentRecord[];
  versionHistory: VersionRecord[];
}

export interface VersionRecord {
  version: string;
  createdAt: string;
  changelog?: string;
  checksum: string;
}

export interface DeploymentEnvironment {
  name: string;
  url: string;
  region?: string;
  variables?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface DeploymentPackage {
  projectId: string;
  version: string;
  checksum: string;
  artifact: Buffer;
  metadata: Record<string, any>;
}

export interface DeploymentRecord {
  deploymentId: string;
  environment: string;
  version: string;
  status: 'pending' | 'successful' | 'failed' | 'rolled_back';
  deployedAt: string;
  rolledBackAt?: string;
  metadata?: Record<string, any>;
}

export interface HealthSnapshot {
  projectId: string;
  environment: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: Record<string, number>;
  checkedAt: string;
  notes?: string;
}

export interface PerformanceMetric {
  metric: string;
  value: number;
  tags?: Record<string, string>;
  recordedAt: string;
}

export interface PerformanceSummary {
  metric: string;
  count: number;
  average: number;
  min: number;
  max: number;
  p95: number;
}

export interface AuditReport {
  totalEntries: number;
  failingEntries: number;
  latestEntry?: string;
  uniqueRules: number;
  averageExecutionTime: number;
  longestExecutionTime: number;
  ruleBreakdown: Record<string, { executions: number; successRate: number }>;
}
