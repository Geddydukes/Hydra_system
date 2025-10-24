import { z } from 'zod';

// Core types for the symbolic engine
const RecoveryActionSchema = z.object({
  type: z.enum(['retry', 'fallback', 'continue', 'invoke']),
  maxRetries: z.number().default(1),
  delayMs: z.number().default(0),
  fallbackValue: z.any().optional(),
  targetRuleId: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const RuleOptimizationSchema = z.object({
  precompile: z.boolean().default(true),
  cacheKey: z.string().optional(),
  executionCost: z.number().default(1),
  timeout: z.number().optional()
});

export const RuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  condition: z.any(), // JSONLogic expression
  action: z.any().optional(), // Action to take if condition is true
  priority: z.number().default(0),
  version: z.string().default('1.0.0'),
  dependsOn: z.array(z.string()).optional(),
  continueOnFail: z.boolean().default(false),
  recovery: z
    .object({
      actions: z.array(RecoveryActionSchema).default([]),
      notifyOnFailure: z.boolean().default(false)
    })
    .optional(),
  optimization: RuleOptimizationSchema.optional(),
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
  errors: z.array(z.string()).optional(),
  actionResult: z.any().optional()
});

export type Rule = z.infer<typeof RuleSchema>;
export type Trace = z.infer<typeof TraceSchema>;
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
export type RecoveryAction = z.infer<typeof RecoveryActionSchema>;
export type RuleOptimization = z.infer<typeof RuleOptimizationSchema>;

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
  enablePrecompilation?: boolean;
  auditSecret?: string;
}

export interface RuleExecutionStep {
  ruleId: string;
  dependsOn: string[];
  depth: number;
}
