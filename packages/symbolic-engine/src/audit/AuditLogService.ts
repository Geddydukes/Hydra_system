import crypto from 'crypto';
import { Trace } from '../types';

export interface AuditLogEntry {
  id: string;
  trace: Trace;
  hash: string;
  previousHash: string | null;
  signature: string;
  recordedAt: string;
  metadata: Record<string, any>;
}

export interface ComplianceSummary {
  totalTraces: number;
  uniqueRules: number;
  failingTraces: number;
  averageExecutionTime: number;
  longestExecutionTime: number;
  mostRecentTrace?: string;
}

export interface AuditAnalysis {
  ruleId: string;
  executions: number;
  successRate: number;
  averageExecutionTime: number;
  lastExecution?: string;
}

export interface AuditLogOptions {
  secret?: string;
}

export class AuditLogService {
  private entries: AuditLogEntry[] = [];
  private secret: Buffer;

  constructor(options: AuditLogOptions = {}) {
    this.secret = options.secret
      ? Buffer.from(options.secret)
      : crypto.randomBytes(32);
  }

  recordTrace(trace: Trace, metadata: Record<string, any> = {}): AuditLogEntry {
    const frozenTrace = Object.freeze({ ...trace });
    const canonicalTrace = JSON.stringify(frozenTrace);
    const previousHash = this.entries.length > 0 ? this.entries[this.entries.length - 1].hash : null;
    const hash = this.createHash(canonicalTrace, previousHash);
    const signature = this.signTrace(canonicalTrace, hash, metadata);

    const entry: AuditLogEntry = Object.freeze({
      id: trace.id,
      trace: frozenTrace,
      hash,
      previousHash,
      signature,
      recordedAt: new Date().toISOString(),
      metadata: Object.freeze({ ...metadata })
    });

    this.entries.push(entry);
    return entry;
  }

  verifyEntry(entry: AuditLogEntry): boolean {
    const canonicalTrace = JSON.stringify(entry.trace);
    const expectedHash = this.createHash(canonicalTrace, entry.previousHash);

    if (expectedHash !== entry.hash) {
      return false;
    }

    const expectedSignature = this.signTrace(canonicalTrace, entry.hash, entry.metadata);
    return expectedSignature === entry.signature;
  }

  getEntries(): readonly AuditLogEntry[] {
    return this.entries;
  }

  getComplianceSummary(): ComplianceSummary {
    if (this.entries.length === 0) {
      return {
        totalTraces: 0,
        uniqueRules: 0,
        failingTraces: 0,
        averageExecutionTime: 0,
        longestExecutionTime: 0
      };
    }

    const ruleSet = new Set<string>();
    let totalExecution = 0;
    let failingTraces = 0;
    let longestExecutionTime = 0;

    for (const entry of this.entries) {
      ruleSet.add(entry.trace.ruleId);
      totalExecution += entry.trace.executionTime;
      longestExecutionTime = Math.max(longestExecutionTime, entry.trace.executionTime);

      if (!entry.trace.result) {
        failingTraces++;
      }
    }

    return {
      totalTraces: this.entries.length,
      uniqueRules: ruleSet.size,
      failingTraces,
      averageExecutionTime: totalExecution / this.entries.length,
      longestExecutionTime,
      mostRecentTrace: this.entries[this.entries.length - 1]?.recordedAt
    };
  }

  analyzeRule(ruleId: string): AuditAnalysis {
    const matchingEntries = this.entries.filter(entry => entry.trace.ruleId === ruleId);

    if (matchingEntries.length === 0) {
      return {
        ruleId,
        executions: 0,
        successRate: 0,
        averageExecutionTime: 0
      };
    }

    const successCount = matchingEntries.filter(entry => entry.trace.result).length;
    const totalExecutionTime = matchingEntries.reduce((sum, entry) => sum + entry.trace.executionTime, 0);

    return {
      ruleId,
      executions: matchingEntries.length,
      successRate: successCount / matchingEntries.length,
      averageExecutionTime: totalExecutionTime / matchingEntries.length,
      lastExecution: matchingEntries[matchingEntries.length - 1]?.recordedAt
    };
  }

  exportImmutableLog(): readonly AuditLogEntry[] {
    return this.entries.map(entry => Object.freeze({ ...entry }));
  }

  private createHash(canonicalTrace: string, previousHash: string | null): string {
    const hash = crypto.createHash('sha256');
    hash.update(canonicalTrace);
    if (previousHash) {
      hash.update(previousHash);
    }
    return hash.digest('hex');
  }

  private signTrace(canonicalTrace: string, hash: string, metadata: Record<string, any>): string {
    const hmac = crypto.createHmac('sha256', this.secret);
    hmac.update(canonicalTrace);
    hmac.update(hash);
    hmac.update(JSON.stringify(metadata));
    return hmac.digest('hex');
  }
}
