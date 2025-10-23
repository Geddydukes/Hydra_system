import { v4 as uuidv4 } from 'uuid';
import { Rule, Trace, EvaluationResult, ExecutionContext, RuleEngineConfig } from '../types';

export class TraceGenerator {
  private traces: Trace[] = [];

  generateTrace(
    ruleId: string,
    input: any,
    output: any,
    condition: any,
    result: boolean,
    executionTime: number,
    metadata?: Record<string, any>
  ): Trace {
    const trace: Trace = {
      id: uuidv4(),
      ruleId,
      timestamp: new Date().toISOString(),
      input,
      output,
      condition,
      result,
      executionTime,
      metadata
    };

    this.traces.push(trace);
    return trace;
  }

  getTraces(): Trace[] {
    return [...this.traces];
  }

  clearTraces(): void {
    this.traces = [];
  }

  getTracesByRule(ruleId: string): Trace[] {
    return this.traces.filter(trace => trace.ruleId === ruleId);
  }
}
