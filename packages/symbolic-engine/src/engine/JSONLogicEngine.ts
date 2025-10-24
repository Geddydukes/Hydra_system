import * as jsonLogic from 'json-logic-js';
import {
  Rule,
  Trace,
  EvaluationResult,
  ExecutionContext,
  RuleEngineConfig,
  RecoveryAction
} from '../types';
import { TraceGenerator } from '../trace/TraceGenerator';
import { RuleComposer } from './RuleComposer';
import { AuditLogService } from '../audit/AuditLogService';

export class JSONLogicEngine {
  private config: RuleEngineConfig;
  private traceGenerator: TraceGenerator;
  private cache: Map<string, any> = new Map();
  private precompiledConditions: Map<string, (context: any) => any> = new Map();
  private precompiledActions: Map<string, (context: any) => any> = new Map();
  private auditLog?: AuditLogService;

  constructor(config: RuleEngineConfig = {
    enableTracing: true,
    maxExecutionTime: 5000,
    enableCaching: true,
    cacheSize: 1000,
    enablePrecompilation: true
  }) {
    this.config = config;
    this.traceGenerator = new TraceGenerator();
  }

  setAuditLogService(auditLog: AuditLogService): void {
    this.auditLog = auditLog;
  }

  getAuditLogService(): AuditLogService | undefined {
    return this.auditLog;
  }

  evaluateRule(rule: Rule, context: ExecutionContext): EvaluationResult {
    const result = this.evaluateSingleRule(rule, context);
    this.recordTraces(result.traces, rule, context);
    return result;
  }

  evaluateRules(rules: Rule[], context: ExecutionContext): EvaluationResult {
    const startTime = Date.now();
    const allTraces: Trace[] = [];
    const results: any[] = [];

    if (rules.length === 0) {
      return {
        success: true,
        result: [],
        traces: [],
        executionTime: 0
      };
    }

    const composer = new RuleComposer(rules);
    const executionPlan = composer.getExecutionPlan();
    const ruleMap = new Map(rules.map(rule => [rule.id, rule]));
    const dependencyResults = new Map<string, EvaluationResult>();

    for (const step of executionPlan) {
      const rule = ruleMap.get(step.ruleId);
      if (!rule) {
        continue;
      }

      const dependencies = step.dependsOn || [];
      const dependencySnapshot: Record<string, any> = {};
      let shouldSkip = false;

      for (const dependencyId of dependencies) {
        const dependencyResult = dependencyResults.get(dependencyId);
        dependencySnapshot[dependencyId] = dependencyResult?.result;
        if (!dependencyResult || !dependencyResult.success || !dependencyResult.result) {
          shouldSkip = true;
        }
      }

      if (shouldSkip) {
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          skipped: true,
          reason: 'dependency_unsatisfied',
          dependencies: dependencySnapshot,
          actionResult: null
        });
        continue;
      }

      const enrichedContext: ExecutionContext = {
        data: {
          ...context.data,
          dependencyResults: dependencySnapshot
        },
        variables: {
          ...context.variables,
          dependencyResults: dependencySnapshot
        },
        metadata: {
          ...context.metadata,
          ruleDepth: step.depth
        }
      };

      let evaluation = this.evaluateSingleRule(rule, enrichedContext);

      if (!evaluation.success) {
        evaluation = this.recoverFromFailure(
          rule,
          enrichedContext,
          evaluation,
          dependencyResults,
          composer
        );

        if (!evaluation.success && !rule.continueOnFail) {
          this.recordTraces(evaluation.traces, rule, enrichedContext);
          allTraces.push(...evaluation.traces);
          return {
            success: false,
            result: null,
            traces: allTraces,
            executionTime: Date.now() - startTime,
            errors: evaluation.errors
          };
        }
      }

      this.recordTraces(evaluation.traces, rule, enrichedContext);
      allTraces.push(...evaluation.traces);
      dependencyResults.set(rule.id, evaluation);

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        skipped: false,
        success: evaluation.success,
        result: evaluation.result,
        errors: evaluation.errors,
        executionTime: evaluation.executionTime,
        actionResult: evaluation.actionResult,
        dependencies: dependencySnapshot
      });
    }

    return {
      success: true,
      result: results,
      traces: allTraces,
      executionTime: Date.now() - startTime
    };
  }

  private evaluateSingleRule(rule: Rule, context: ExecutionContext): EvaluationResult {
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
      const evaluator = this.getCompiledCondition(rule);
      const conditionResult = evaluator(evaluationContext);

      let actionResult: any;
      if (rule.action && conditionResult) {
        const actionExecutor = this.getCompiledAction(rule);
        if (actionExecutor) {
          actionResult = actionExecutor({
            ...context.data,
            ...context.variables,
            ruleResult: conditionResult
          });
        }
      }

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

      const executionTime = Date.now() - startTime;

      if (rule.optimization?.timeout && executionTime > rule.optimization.timeout) {
        throw new Error(`Rule ${rule.id} exceeded execution time of ${rule.optimization.timeout}ms`);
      }

      return {
        success: true,
        result: conditionResult,
        traces,
        executionTime,
        actionResult
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

  private generateCacheKey(rule: Rule, context: any): string {
    const cacheKey = rule.optimization?.cacheKey || rule.id;
    return `${cacheKey}:${JSON.stringify(context)}`;
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

  private getCompiledCondition(rule: Rule): (context: any) => any {
    if (this.config.enablePrecompilation === false) {
      return (context: any) => jsonLogic.apply(rule.condition, context);
    }

    const key = `condition:${rule.optimization?.cacheKey || rule.id}`;
    const cached = this.precompiledConditions.get(key);
    if (cached) {
      return cached;
    }

    const compiled = (context: any) => jsonLogic.apply(rule.condition, context);
    this.precompiledConditions.set(key, compiled);
    return compiled;
  }

  private getCompiledAction(rule: Rule): ((context: any) => any) | undefined {
    if (!rule.action) {
      return undefined;
    }

    if (this.config.enablePrecompilation === false) {
      return (context: any) => jsonLogic.apply(rule.action!, context);
    }

    const key = `action:${rule.optimization?.cacheKey || rule.id}`;
    const cached = this.precompiledActions.get(key);
    if (cached) {
      return cached;
    }

    const compiled = (context: any) => jsonLogic.apply(rule.action!, context);
    this.precompiledActions.set(key, compiled);
    return compiled;
  }

  private recordTraces(traces: Trace[], rule: Rule, context: ExecutionContext): void {
    if (!this.auditLog || traces.length === 0) {
      return;
    }

    for (const trace of traces) {
      this.auditLog.recordTrace(trace, {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleVersion: rule.version,
        metadata: context.metadata
      });
    }
  }

  private recoverFromFailure(
    rule: Rule,
    context: ExecutionContext,
    evaluation: EvaluationResult,
    dependencyResults: Map<string, EvaluationResult>,
    composer: RuleComposer
  ): EvaluationResult {
    if (!rule.recovery || rule.recovery.actions.length === 0) {
      return evaluation;
    }

    let lastResult = evaluation;

    for (const action of rule.recovery.actions) {
      lastResult = this.applyRecoveryAction(
        rule,
        context,
        lastResult,
        action,
        dependencyResults,
        composer
      );

      if (lastResult.success) {
        return lastResult;
      }
    }

    return lastResult;
  }

  private applyRecoveryAction(
    rule: Rule,
    context: ExecutionContext,
    evaluation: EvaluationResult,
    action: RecoveryAction,
    dependencyResults: Map<string, EvaluationResult>,
    composer: RuleComposer
  ): EvaluationResult {
    switch (action.type) {
      case 'retry': {
        let attempts = 0;
        let result = evaluation;
        while (attempts < action.maxRetries) {
          attempts++;
          if (action.delayMs > 0) {
            const start = Date.now();
            while (Date.now() - start < action.delayMs) {
              // Busy wait is acceptable in tests; in production this would use async delays.
            }
          }

          result = this.evaluateSingleRule(rule, context);
          if (result.success) {
            return result;
          }
        }
        return result;
      }
      case 'fallback': {
        return {
          success: true,
          result: action.fallbackValue,
          traces: evaluation.traces,
          executionTime: evaluation.executionTime,
          errors: undefined,
          actionResult: evaluation.actionResult
        };
      }
      case 'continue': {
        return {
          success: true,
          result: false,
          traces: evaluation.traces,
          executionTime: evaluation.executionTime,
          errors: undefined,
          actionResult: evaluation.actionResult
        };
      }
      case 'invoke': {
        if (!action.targetRuleId) {
          return evaluation;
        }

        const targetResult = dependencyResults.get(action.targetRuleId);
        if (targetResult && targetResult.success) {
          return targetResult;
        }

        const targetRule = composer.getRule(action.targetRuleId);
        if (!targetRule) {
          return evaluation;
        }

        return this.evaluateSingleRule(targetRule, context);
      }
      default:
        return evaluation;
    }
  }
}
