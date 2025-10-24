import { PerformanceAgent } from '@hydra/feather-agent';

export interface RuntimeHealthSnapshot {
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: Record<string, number>;
  recordedAt: string;
  message?: string;
}

export class HealthMonitor {
  private snapshots: RuntimeHealthSnapshot[] = [];

  constructor(private performanceAgent: PerformanceAgent) {}

  recordSnapshot(metrics: Record<string, number>, message?: string): RuntimeHealthSnapshot {
    const status = this.evaluateStatus(metrics);
    const snapshot: RuntimeHealthSnapshot = {
      status,
      metrics: { ...metrics },
      recordedAt: new Date().toISOString(),
      message
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > 100) {
      this.snapshots.shift();
    }

    this.emitMetrics(metrics);
    return snapshot;
  }

  getLatest(): RuntimeHealthSnapshot | undefined {
    return this.snapshots.at(-1);
  }

  getHistory(): RuntimeHealthSnapshot[] {
    return [...this.snapshots];
  }

  private evaluateStatus(metrics: Record<string, number>): RuntimeHealthSnapshot['status'] {
    const cpu = metrics.cpu || 0;
    const memory = metrics.memory || 0;
    const queueLatency = metrics.queueLatency || 0;

    if (cpu < 0.7 && memory < 0.7 && queueLatency < 200) {
      return 'healthy';
    }

    if (cpu < 0.9 && memory < 0.85 && queueLatency < 500) {
      return 'degraded';
    }

    return 'unhealthy';
  }

  private emitMetrics(metrics: Record<string, number>): void {
    Object.entries(metrics).forEach(([metric, value]) => {
      this.performanceAgent.recordMetric(`runtime.${metric}`, value);
    });
  }
}
