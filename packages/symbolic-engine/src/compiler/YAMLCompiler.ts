import * as yaml from 'js-yaml';
import { Rule } from '../types';

export interface HydraFlow {
  name: string;
  description?: string;
  version: string;
  rules: Rule[];
  variables?: Record<string, any>;
  metadata?: Record<string, any>;
}

export class YAMLCompiler {
  compileFromYAML(yamlContent: string): HydraFlow {
    try {
      const parsed = yaml.load(yamlContent) as any;
      return this.validateAndTransform(parsed);
    } catch (error) {
      throw new Error(`YAML compilation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  compileToYAML(flow: HydraFlow): string {
    try {
      return yaml.dump(flow, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false
      });
    } catch (error) {
      throw new Error(`YAML serialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private validateAndTransform(data: any): HydraFlow {
    if (!data.name) {
      throw new Error('Flow name is required');
    }

    if (!data.version) {
      throw new Error('Flow version is required');
    }

    if (!Array.isArray(data.rules)) {
      throw new Error('Rules must be an array');
    }

    const rules: Rule[] = data.rules.map((rule: any, index: number) => {
      if (!rule.id) {
        throw new Error(`Rule at index ${index} must have an id`);
      }

      if (!rule.name) {
        throw new Error(`Rule at index ${index} must have a name`);
      }

      if (!rule.condition) {
        throw new Error(`Rule at index ${index} must have a condition`);
      }

      return {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        condition: rule.condition,
        action: rule.action,
        priority: rule.priority || 0,
        version: rule.version || '1.0.0',
        dependsOn: rule.dependsOn,
        continueOnFail: rule.continueOnFail,
        recovery: rule.recovery,
        optimization: rule.optimization,
        metadata: rule.metadata
      };
    });

    return {
      name: data.name,
      description: data.description,
      version: data.version,
      rules,
      variables: data.variables || {},
      metadata: data.metadata || {}
    };
  }

  // Helper method to create a simple rule
  createSimpleRule(
    id: string,
    name: string,
    condition: any,
    action?: any,
    priority: number = 0
  ): Rule {
    return {
      id,
      name,
      condition,
      action,
      priority,
      version: '1.0.0'
    };
  }

  // Helper method to create a flow template
  createFlowTemplate(name: string, description?: string): HydraFlow {
    return {
      name,
      description,
      version: '1.0.0',
      rules: [],
      variables: {},
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: 'hydra-systems'
      }
    };
  }
}
