import { HydraAgent } from './HydraAgent';
import { ExecutionContext, PerformanceMetric, PerformanceSummary } from '../types';

interface PerformanceOperationPayload {
  operation: string;
  payload?: Record<string, any>;
}

interface TrendAnalysis {
  metric: string;
  trend: 'upward' | 'downward' | 'flat';
  delta: number;
  window: number;
}

export class PerformanceAgent extends HydraAgent {
  private metrics: Map<string, PerformanceMetric[]> = new Map();

  constructor(config: Partial<any> = {}) {
    super({
      name: 'PerformanceAgent',
      description: 'Collects runtime metrics and generates performance insights',
      ...config
    });
  }

  protected async executeInternal(context: ExecutionContext): Promise<any> {
    const { operation, payload = {} } = context.data as PerformanceOperationPayload;

    switch (operation) {
      case 'record_metric':
        return this.recordMetric(payload.metric as string, payload.value as number, payload.tags as Record<string, string> | undefined);
      case 'get_summary':
        return this.getSummary(payload.metric as string);
      case 'analyze_trend':
        return this.analyzeTrend(payload.metric as string, payload.window as number | undefined);
      case 'list_metrics':
        return this.listMetrics();
      default:
        throw new Error(`Unsupported performance operation: ${operation}`);
    }
  }

  protected validateInternal(context: ExecutionContext): boolean {
    const data = context.data as PerformanceOperationPayload;
    return Boolean(data && typeof data.operation === 'string');
  }

  recordMetric(metric: string, value: number, tags?: Record<string, string>): PerformanceMetric {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new Error('Metric value must be a valid number');
    }

    const entry: PerformanceMetric = {
      metric,
      value,
      tags,
      recordedAt: new Date().toISOString()
    };

    const existing = this.metrics.get(metric) || [];
    existing.push(entry);
    if (existing.length > 500) {
      existing.shift();
    }
    this.metrics.set(metric, existing);

    return entry;
  }

  getSummary(metric: string): PerformanceSummary {
    const entries = this.metrics.get(metric) || [];
    if (entries.length === 0) {
      return {
        metric,
        count: 0,
        average: 0,
        min: 0,
        max: 0,
        p95: 0
      };
    }

    const values = entries.map(entry => entry.value);
    const sorted = [...values].sort((a, b) => a - b);
    const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));

    const sum = values.reduce((total, current) => total + current, 0);

    return {
      metric,
      count: values.length,
      average: sum / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[p95Index]
    };
  }

  analyzeTrend(metric: string, window: number = 5): TrendAnalysis {
    const entries = this.metrics.get(metric) || [];
    if (entries.length < 2) {
      return { metric, trend: 'flat', delta: 0, window: Math.min(window, entries.length) };
    }

    const windowed = entries.slice(-window);
    if (windowed.length < 2) {
      return { metric, trend: 'flat', delta: 0, window: windowed.length };
    }

    const first = windowed[0].value;
    const last = windowed[windowed.length - 1].value;
    const delta = last - first;

    let trend: TrendAnalysis['trend'] = 'flat';
    const tolerance = Math.max(Math.abs(first), 1) * 0.01;
    if (delta > tolerance) {
      trend = 'upward';
    } else if (delta < -tolerance) {
      trend = 'downward';
    }

    return { metric, trend, delta, window: windowed.length };
  }

  listMetrics(): string[] {
    return Array.from(this.metrics.keys()).sort();
  }
}
