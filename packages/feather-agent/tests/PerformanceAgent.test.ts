import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceAgent } from '../src';

describe('PerformanceAgent', () => {
  let agent: PerformanceAgent;

  beforeEach(() => {
    agent = new PerformanceAgent();
  });

  it('records metrics and calculates summary statistics', () => {
    agent.recordMetric('latency', 120);
    agent.recordMetric('latency', 80);
    agent.recordMetric('latency', 200);

    const summary = agent.getSummary('latency');
    expect(summary.metric).toBe('latency');
    expect(summary.count).toBe(3);
    expect(summary.min).toBe(80);
    expect(summary.max).toBe(200);
    expect(summary.average).toBeCloseTo((120 + 80 + 200) / 3, 5);
    expect(summary.p95).toBeGreaterThanOrEqual(summary.min);
  });

  it('analyzes metric trend direction', () => {
    [100, 120, 140, 160, 180].forEach(value => agent.recordMetric('throughput', value));
    const trend = agent.analyzeTrend('throughput', 5);
    expect(trend.trend).toBe('upward');
    expect(trend.delta).toBeGreaterThan(0);
  });

  it('lists available metrics', () => {
    agent.recordMetric('cpu', 0.5);
    agent.recordMetric('memory', 1280);
    const metrics = agent.listMetrics();
    expect(metrics).toEqual(['cpu', 'memory']);
  });
});
