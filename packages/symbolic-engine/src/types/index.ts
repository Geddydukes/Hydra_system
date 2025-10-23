import { z } from 'zod';

// Core types for the symbolic engine
export const RuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  condition: z.any(), // JSONLogic expression
  action: z.any().optional(), // Action to take if condition is true
  priority: z.number().default(0),
  version: z.string().default('1.0.0'),
  metadata: z.record(z.any()).optional()
});

export const TraceSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  timestamp: z.string(),
  input: z.any(),
  output: z.any(),
  condition: z.any(),
  result: z.boolean(),
  executionTime: z.number(),
  metadata: z.record(z.any()).optional()
});

export const EvaluationResultSchema = z.object({
  success: z.boolean(),
  result: z.any(),
  traces: z.array(TraceSchema),
  executionTime: z.number(),
  errors: z.array(z.string()).optional()
});

export type Rule = z.infer<typeof RuleSchema>;
export type Trace = z.infer<typeof TraceSchema>;
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

// Rule execution context
export interface ExecutionContext {
  data: Record<string, any>;
  variables: Record<string, any>;
  metadata: Record<string, any>;
}

// Rule engine configuration
export interface RuleEngineConfig {
  enableTracing: boolean;
  maxExecutionTime: number;
  enableCaching: boolean;
  cacheSize: number;
}
