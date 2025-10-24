import { HydraAgent } from './HydraAgent';
import { ExecutionContext, AuditReport } from '../types';
import { AuditLogService, AuditLogEntry, AuditAnalysis } from '@hydra/symbolic-engine';
import { Trace } from '@hydra/symbolic-engine';

interface AuditOperationPayload {
  operation: string;
  payload?: Record<string, any>;
}

export class AuditAgent extends HydraAgent {
  private auditLog: AuditLogService;

  constructor(config: Partial<any> = {}, auditLog?: AuditLogService) {
    super({
      name: 'AuditAgent',
      description: 'Maintains cryptographically signed traces and compliance reports',
      ...config
    });
    this.auditLog = auditLog || new AuditLogService({ secret: config.metadata?.secret });
  }

  protected async executeInternal(context: ExecutionContext): Promise<any> {
    const { operation, payload = {} } = context.data as AuditOperationPayload;

    switch (operation) {
      case 'record_trace':
        return this.recordTrace(payload.trace as Trace, payload.metadata as Record<string, any>);
      case 'verify_entry':
        return this.verifyEntry(payload.entry as AuditLogEntry);
      case 'compliance_report':
        return this.getComplianceReport();
      case 'analyze_rule':
        return this.analyzeRule(payload.ruleId as string);
      case 'export_log':
        return this.exportImmutableLog();
      default:
        throw new Error(`Unsupported audit operation: ${operation}`);
    }
  }

  protected validateInternal(context: ExecutionContext): boolean {
    const data = context.data as AuditOperationPayload;
    return Boolean(data && typeof data.operation === 'string');
  }

  getAuditLogService(): AuditLogService {
    return this.auditLog;
  }

  recordTrace(trace: Trace, metadata: Record<string, any> = {}): AuditLogEntry {
    return this.auditLog.recordTrace(trace, metadata);
  }

  verifyEntry(entry: AuditLogEntry): boolean {
    return this.auditLog.verifyEntry(entry);
  }

  getComplianceReport(): AuditReport {
    const summary = this.auditLog.getComplianceSummary();
    const breakdownEntries = this.auditLog
      .getEntries()
      .reduce<Record<string, { executions: number; successRate: number }>>((acc, entry) => {
        if (!acc[entry.trace.ruleId]) {
          const analysis = this.auditLog.analyzeRule(entry.trace.ruleId);
          acc[entry.trace.ruleId] = {
            executions: analysis.executions,
            successRate: analysis.successRate
          };
        }
        return acc;
      }, {});

    return {
      totalEntries: summary.totalTraces,
      failingEntries: summary.failingTraces,
      latestEntry: summary.mostRecentTrace,
      uniqueRules: summary.uniqueRules,
      averageExecutionTime: summary.averageExecutionTime,
      longestExecutionTime: summary.longestExecutionTime,
      ruleBreakdown: breakdownEntries
    };
  }

  analyzeRule(ruleId: string): AuditAnalysis {
    return this.auditLog.analyzeRule(ruleId);
  }

  exportImmutableLog(): readonly AuditLogEntry[] {
    return this.auditLog.exportImmutableLog();
  }
}
