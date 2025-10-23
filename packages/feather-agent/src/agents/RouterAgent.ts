import { HydraAgent } from './HydraAgent';
import { ExecutionContext, AgentResult } from '../types';
import { JSONLogicEngine, Rule, HydraFlow } from '@hydra/symbolic-engine';

export class RouterAgent extends HydraAgent {
  private engine: JSONLogicEngine;
  private rules: Rule[] = [];
  private flows: Map<string, HydraFlow> = new Map();

  constructor(config: Partial<any> = {}) {
    super({
      name: 'RouterAgent',
      description: 'Routes requests to appropriate symbolic rules or flows',
      ...config
    });
    this.engine = new JSONLogicEngine({
      enableTracing: true,
      enableCaching: true,
      cacheSize: 1000,
      maxExecutionTime: 5000
    });
  }

  protected async executeInternal(context: ExecutionContext): Promise<any> {
    const { data, variables } = context;
    
    // First, try to match against individual rules
    if (this.rules.length > 0) {
      const ruleResult = this.engine.evaluateRules(this.rules, {
        data: { ...data, ...variables },
        variables: {},
        metadata: context.metadata
      });

      if (ruleResult.success && ruleResult.result && ruleResult.result.length > 0) {
        return {
          type: 'rule',
          result: ruleResult.result,
          traces: ruleResult.traces
        };
      }
    }

    // If no rules match, try to find a matching flow
    for (const [flowId, flow] of this.flows) {
      const flowResult = this.engine.evaluateRules(flow.rules, {
        data: { ...data, ...variables, ...flow.variables },
        variables: {},
        metadata: { ...context.metadata, flowId }
      });

      if (flowResult.success && flowResult.result && flowResult.result.length > 0) {
        return {
          type: 'flow',
          flowId,
          flowName: flow.name,
          result: flowResult.result,
          traces: flowResult.traces
        };
      }
    }

    // No matches found
    return {
      type: 'no_match',
      result: null,
      message: 'No matching rules or flows found'
    };
  }

  protected validateInternal(context: ExecutionContext): boolean {
    return Boolean(context.data && typeof context.data === 'object');
  }

  // Rule management
  addRule(rule: Rule): void {
    this.rules.push(rule);
  }

  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(rule => rule.id === ruleId);
    if (index > -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  getRules(): Rule[] {
    return [...this.rules];
  }

  // Flow management
  addFlow(flow: HydraFlow): void {
    this.flows.set(flow.name, flow);
  }

  removeFlow(flowName: string): boolean {
    return this.flows.delete(flowName);
  }

  getFlow(flowName: string): HydraFlow | undefined {
    return this.flows.get(flowName);
  }

  getFlows(): HydraFlow[] {
    return Array.from(this.flows.values());
  }

  // Utility methods
  getTraces(): any[] {
    return this.engine.getTraces();
  }

  clearTraces(): void {
    this.engine.clearTraces();
  }

  clearCache(): void {
    this.engine.clearCache();
  }
}
