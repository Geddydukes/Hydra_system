import * as jsonLogic from 'json-logic-js';
import { Rule, Trace, EvaluationResult, ExecutionContext, RuleEngineConfig } from '../types';
import { TraceGenerator } from '../trace/TraceGenerator';

export class JSONLogicEngine {
  private config: RuleEngineConfig;
  private traceGenerator: TraceGenerator;
  private cache: Map<string, any> = new Map();

  constructor(config: RuleEngineConfig = {
    enableTracing: true,
    maxExecutionTime: 5000,
    enableCaching: true,
    cacheSize: 1000
  }) {
    this.config = config;
    this.traceGenerator = new TraceGenerator();
  }

  evaluateRule(rule: Rule, context: ExecutionContext): EvaluationResult {
    const startTime = Date.now();
    const traces: Trace[] = [];

    try {
      // Merge context data and variables
      const evaluationContext = {
        ...context.data,
        ...context.variables,
        ...context.metadata
      };

      // Check cache if enabled
      const cacheKey = this.generateCacheKey(rule, evaluationContext);
      if (this.config.enableCaching && this.cache.has(cacheKey)) {
        const cachedResult = this.cache.get(cacheKey);
        return {
          success: true,
          result: cachedResult,
          traces: [],
          executionTime: Date.now() - startTime
        };
      }

      // Evaluate the rule condition
      const conditionResult = jsonLogic.apply(rule.condition, evaluationContext);
      
      // Generate trace if enabled
      if (this.config.enableTracing) {
        const trace = this.traceGenerator.generateTrace(
          rule.id,
          evaluationContext,
          conditionResult,
          rule.condition,
          !!conditionResult,
          Date.now() - startTime,
          {
            ruleName: rule.name,
            ruleVersion: rule.version,
            rulePriority: rule.priority
          }
        );
        traces.push(trace);
      }

      // Cache result if enabled
      if (this.config.enableCaching) {
        this.cache.set(cacheKey, conditionResult);
        this.cleanupCache();
      }

      return {
        success: true,
        result: conditionResult,
        traces,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        result: null,
        traces,
        executionTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  evaluateRules(rules: Rule[], context: ExecutionContext): EvaluationResult {
    const startTime = Date.now();
    const allTraces: Trace[] = [];
    const results: any[] = [];

    // Sort rules by priority (higher priority first)
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const ruleResult = this.evaluateRule(rule, context);
      
      if (!ruleResult.success) {
        return {
          success: false,
          result: null,
          traces: allTraces,
          executionTime: Date.now() - startTime,
          errors: ruleResult.errors
        };
      }

      allTraces.push(...ruleResult.traces);
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        result: ruleResult.result,
        executionTime: ruleResult.executionTime
      });

      // If rule has an action and condition is true, execute action
      if (rule.action && ruleResult.result) {
        try {
          const actionResult = jsonLogic.apply(rule.action, {
            ...context.data,
            ...context.variables,
            ruleResult: ruleResult.result
          });
          results[results.length - 1].actionResult = actionResult;
        } catch (error) {
          return {
            success: false,
            result: null,
            traces: allTraces,
            executionTime: Date.now() - startTime,
            errors: [error instanceof Error ? error.message : String(error)]
          };
        }
      }
    }

    return {
      success: true,
      result: results,
      traces: allTraces,
      executionTime: Date.now() - startTime
    };
  }

  private generateCacheKey(rule: Rule, context: any): string {
    return `${rule.id}:${JSON.stringify(context)}`;
  }

  private cleanupCache(): void {
    if (this.cache.size > this.config.cacheSize) {
      const entries = Array.from(this.cache.entries());
      const toDelete = entries.slice(0, entries.length - this.config.cacheSize);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }

  getTraces(): Trace[] {
    return this.traceGenerator.getTraces();
  }

  clearTraces(): void {
    this.traceGenerator.clearTraces();
  }

  clearCache(): void {
    this.cache.clear();
  }
}
