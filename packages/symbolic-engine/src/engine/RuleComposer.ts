import { Rule, RuleExecutionStep } from '../types';

interface DependencyGraph {
  [ruleId: string]: string[];
}

export class RuleComposer {
  private rules: Map<string, Rule>;
  private dependencyGraph: DependencyGraph = {};
  private executionPlan: RuleExecutionStep[] = [];
  private priorities: Map<string, number>;

  constructor(rules: Rule[]) {
    this.rules = new Map(rules.map(rule => [rule.id, rule]));
    this.priorities = new Map(rules.map(rule => [rule.id, rule.priority || 0]));
    this.buildDependencyGraph();
    this.executionPlan = this.buildExecutionPlan();
  }

  getDependencyGraph(): DependencyGraph {
    const clone: DependencyGraph = {};
    for (const [ruleId, deps] of Object.entries(this.dependencyGraph)) {
      clone[ruleId] = [...deps];
    }
    return clone;
  }

  getExecutionPlan(): RuleExecutionStep[] {
    return this.executionPlan.map(step => ({ ...step, dependsOn: [...step.dependsOn] }));
  }

  getRule(ruleId: string): Rule | undefined {
    return this.rules.get(ruleId);
  }

  private buildDependencyGraph(): void {
    for (const rule of this.rules.values()) {
      this.dependencyGraph[rule.id] = [...(rule.dependsOn || [])];
    }
    this.detectCycles();
  }

  private buildExecutionPlan(): RuleExecutionStep[] {
    const inDegree: Record<string, number> = {};
    const adjacencyList: Record<string, Set<string>> = {};

    for (const rule of this.rules.values()) {
      inDegree[rule.id] = 0;
      adjacencyList[rule.id] = new Set();
    }

    for (const [ruleId, dependencies] of Object.entries(this.dependencyGraph)) {
      for (const dependency of dependencies) {
        if (!this.rules.has(dependency)) {
          throw new Error(`Rule ${ruleId} depends on unknown rule ${dependency}`);
        }
        adjacencyList[dependency].add(ruleId);
        inDegree[ruleId]++;
      }
    }

    const queue: Array<{ id: string; depth: number }> = [];
    for (const [ruleId, degree] of Object.entries(inDegree)) {
      if (degree === 0) {
        queue.push({ id: ruleId, depth: 0 });
      }
    }

    const executionOrder: RuleExecutionStep[] = [];
    while (queue.length > 0) {
      queue.sort((a, b) => {
        if (a.depth !== b.depth) {
          return a.depth - b.depth;
        }
        return this.getPriority(b.id) - this.getPriority(a.id);
      });
      const current = queue.shift()!;
      executionOrder.push({
        ruleId: current.id,
        dependsOn: [...(this.dependencyGraph[current.id] || [])],
        depth: current.depth
      });

      for (const neighbor of adjacencyList[current.id]) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push({ id: neighbor, depth: current.depth + 1 });
        }
      }
    }

    if (executionOrder.length !== this.rules.size) {
      throw new Error('Cycle detected in rule dependencies');
    }

    return executionOrder;
  }

  private detectCycles(): void {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const visit = (ruleId: string) => {
      if (stack.has(ruleId)) {
        throw new Error(`Cycle detected at rule ${ruleId}`);
      }

      if (visited.has(ruleId)) {
        return;
      }

      visited.add(ruleId);
      stack.add(ruleId);

      for (const dependency of this.dependencyGraph[ruleId] || []) {
        if (!this.rules.has(dependency)) {
          throw new Error(`Rule ${ruleId} depends on unknown rule ${dependency}`);
        }
        visit(dependency);
      }

      stack.delete(ruleId);
    };

    for (const ruleId of this.rules.keys()) {
      visit(ruleId);
    }
  }

  private getPriority(ruleId: string): number {
    return this.priorities.get(ruleId) ?? 0;
  }
}
