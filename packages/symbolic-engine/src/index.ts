// Export all types
export * from './types';

// Export core engine
export { JSONLogicEngine } from './engine/JSONLogicEngine';
export { RuleComposer } from './engine/RuleComposer';

// Export trace generator
export { TraceGenerator } from './trace/TraceGenerator';

// Export audit system
export { AuditLogService, AuditLogEntry, ComplianceSummary, AuditAnalysis } from './audit/AuditLogService';

// Export compiler
export { YAMLCompiler, HydraFlow } from './compiler/YAMLCompiler';

// Re-export json-logic-js for convenience
export { default as jsonLogic } from 'json-logic-js';
