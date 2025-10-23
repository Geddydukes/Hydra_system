# Hydra Systems — Unified Compatibility Layer & Frontend Integration

## Overview

This document outlines the comprehensive compatibility layer that enables seamless migration from Python microservices to the unified Hydra Systems platform, combining the TypeScript feather-agent framework with Hydra Cloud frontend, Feather Runtime, and Hydra Connectors. The system maintains API compatibility while enabling gradual migration and providing a complete enterprise-ready solution.

## System Architecture Integration

### Unified Platform Components

The Hydra Systems platform consists of three integrated layers:

1. **Hydra Cloud** — SaaS control plane and visual builder (Next.js + ReactFlow)
2. **Feather Runtime** — Customer-side execution engine (Node.js / Docker) 
3. **Hydra Connectors** — Secure adapters for APIs, databases, and systems

### Frontend-Backend Integration

The compatibility layer bridges the existing Python microservices with the new unified platform:

```typescript
// Frontend Integration Architecture
interface HydraCloudIntegration {
  visualBuilder: ReactFlowEditor;
  projectManagement: ProjectDashboard;
  connectorRegistry: ConnectorManager;
  auditDashboard: TraceViewer;
  rlEvaluator: ModelComparison;
}

interface FeatherRuntimeIntegration {
  symbolicEngine: JSONLogicInterpreter;
  auditLogger: TraceGenerator;
  jobQueue: RedisQueue;
  sandboxExecutor: DockerContainer;
}
```

## 1. Frontend Integration Layer

### 1.1 Hydra Cloud Visual Builder Integration

```typescript
// src/frontend/HydraCloudAdapter.ts
export class HydraCloudAdapter {
  private reactFlowEditor: ReactFlowEditor;
  private projectManager: ProjectManager;
  private connectorRegistry: ConnectorRegistry;
  
  constructor() {
    this.reactFlowEditor = new ReactFlowEditor();
    this.projectManager = new ProjectManager();
    this.connectorRegistry = new ConnectorRegistry();
  }
  
  // Convert Python service responses to frontend-compatible format
  async adaptServiceResponse(serviceName: string, response: any): Promise<FrontendResponse> {
    switch (serviceName) {
      case 'router':
        return this.adaptRouterResponse(response);
      case 'teachers':
        return this.adaptTeacherResponse(response);
      case 'sellm':
        return this.adaptSELLMResponse(response);
      default:
        return response;
    }
  }
  
  private adaptRouterResponse(response: RouterResponse): FrontendResponse {
    return {
      routing_decision: response.routing_decision,
      teacher_id: response.teacher_id,
      normalized_input: response.normalized_input,
      result: response.result,
      explanation: response.explanation,
      // Frontend-specific additions
      visualTrace: this.generateVisualTrace(response.trace),
      executionMetrics: this.calculateMetrics(response),
      auditHash: this.generateAuditHash(response)
    };
  }
  
  private generateVisualTrace(trace: Trace[]): VisualTraceNode[] {
    return trace.map(t => ({
      id: t.rule_id,
      type: t.passed ? 'success' : 'failure',
      label: t.explanation,
      value: t.value,
      threshold: t.threshold,
      position: this.calculateNodePosition(t)
    }));
  }
}
```

### 1.2 ReactFlow Visual Editor Integration

```typescript
// src/frontend/VisualEditor.tsx
export const HydraVisualEditor: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  
  // Convert Python teacher specs to ReactFlow nodes
  const convertTeacherToNode = (teacher: TeacherSpec): Node => {
    return {
      id: teacher.teacher_id,
      type: 'teacherNode',
      position: calculatePosition(teacher),
      data: {
        label: teacher.teacher_id,
        domain: teacher.domain,
        inputs: teacher.inputs_schema,
        rules: teacher.rules,
        onEdit: () => openTeacherEditor(teacher),
        onExecute: () => executeTeacher(teacher)
      }
    };
  };
  
  // Generate visual flow from Python service response
  const generateFlowFromResponse = (response: ServiceResponse) => {
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];
    
    // Add input node
    flowNodes.push({
      id: 'input',
      type: 'inputNode',
      position: { x: 100, y: 100 },
      data: { label: 'Input Data' }
    });
    
    // Add teacher execution node
    if (response.teacher_id) {
      const teacherNode = convertTeacherToNode(response.teacher_spec);
      flowNodes.push(teacherNode);
      
      flowEdges.push({
        id: 'input-to-teacher',
        source: 'input',
        target: teacherNode.id,
        animated: true
      });
    }
    
    // Add result node
    flowNodes.push({
      id: 'result',
      type: 'resultNode',
      position: { x: 500, y: 100 },
      data: {
        label: response.result?.verdict || 'Result',
        verdict: response.result?.verdict,
        outputs: response.result?.outputs
      }
    });
    
    setNodes(flowNodes);
    setEdges(flowEdges);
  };
  
  return (
    <div className="h-screen w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(event, node) => setSelectedNode(node)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
      
      {selectedNode && (
        <NodeDetailsPanel 
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
};
```

## 2. API Compatibility Layer

### 2.1 HTTP API Adapter

```typescript
// src/compatibility/HttpApiAdapter.ts
export class HttpApiAdapter {
  private app: Express;
  private hydraApp: HydraApplication;
  private pythonServices: PythonServiceClient;
  
  constructor(hydraApp: HydraApplication) {
    this.hydraApp = hydraApp;
    this.pythonServices = new PythonServiceClient();
    this.app = express();
    this.setupRoutes();
  }
  
  private setupRoutes(): void {
    // Maintain exact API compatibility with existing Python services
    
    // Router service endpoints
    this.app.post('/router/route', this.handleRoute.bind(this));
    this.app.post('/router/normalize', this.handleNormalize.bind(this));
    this.app.post('/router/run', this.handleRun.bind(this));
    
    // Teachers service endpoints
    this.app.post('/teachers/execute', this.handleTeacherExecute.bind(this));
    
    // SELLM service endpoints
    this.app.post('/sellm/create-teacher', this.handleCreateTeacher.bind(this));
    
    // Watchers service endpoints
    this.app.post('/watchers/monitor', this.handleMonitor.bind(this));
    
    // Training service endpoints
    this.app.post('/training/collect', this.handleCollectTraining.bind(this));
  }
  
  private async handleRoute(req: Request, res: Response): Promise<void> {
    try {
      const { query, metadata } = req.body;
      
      // Use feature flag to determine routing
      const useNewSystem = await this.shouldUseNewSystem(req);
      
      if (useNewSystem) {
        // Route to new TypeScript implementation
        const result = await this.hydraApp.routerAgent.executeHydraTask({
          query,
          metadata: metadata || {}
        });
        
        res.json({
          routing_decision: result.routing_decision,
          teacher_id: result.teacher_id,
          normalized_input: result.normalized_input,
          notes: result.notes
        });
      } else {
        // Route to existing Python service
        const result = await this.pythonServices.call('/router/route', {
          query,
          metadata
        });
        
        res.json(result);
      }
    } catch (error) {
      console.error('Router error:', error);
      res.status(500).json({ error: error.message });
    }
  }
  
  private async handleTeacherExecute(req: Request, res: Response): Promise<void> {
    try {
      const { teacher_id, inputs } = req.body;
      
      const useNewSystem = await this.shouldUseNewSystem(req);
      
      if (useNewSystem) {
        // Execute using new teacher tools
        const teacherTool = this.hydraApp.getTeacherTool(teacher_id);
        const result = await teacherTool.execute(inputs);
        
        res.json({
          verdict: result.verdict,
          outputs: result.outputs,
          trace: result.trace,
          effective_version: result.effective_version
        });
      } else {
        // Execute using Python service
        const result = await this.pythonServices.call('/teachers/execute', {
          teacher_id,
          inputs
        });
        
        res.json(result);
      }
    } catch (error) {
      console.error('Teacher execution error:', error);
      res.status(500).json({ error: error.message });
    }
  }
  
  private async shouldUseNewSystem(req: Request): Promise<boolean> {
    // Feature flag logic
    const userId = req.headers['x-user-id'] as string;
    const sessionId = req.headers['x-session-id'] as string;
    
    // Check feature flags
    const flags = await this.getFeatureFlags(userId, sessionId);
    
    return flags.useNewRouter || flags.useNewTeachers || flags.useNewSELLM;
  }
}
```

### 1.2 Python Service Client

```typescript
// src/compatibility/PythonServiceClient.ts
export class PythonServiceClient {
  private baseUrl: string;
  private httpClient: AxiosInstance;
  
  constructor() {
    this.baseUrl = process.env.PYTHON_SERVICES_URL || 'http://localhost:8000';
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  async call(endpoint: string, data: any): Promise<any> {
    try {
      const response = await this.httpClient.post(endpoint, data);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Python service error: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }
  
  // Health check for Python services
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
  
  // Graceful degradation
  async callWithFallback(endpoint: string, data: any, fallback: () => Promise<any>): Promise<any> {
    try {
      return await this.call(endpoint, data);
    } catch (error) {
      console.warn(`Python service ${endpoint} failed, using fallback:`, error.message);
      return await fallback();
    }
  }
}
```

## 2. Data Compatibility Layer

### 2.1 Schema Adapter

```typescript
// src/compatibility/SchemaAdapter.ts
export class SchemaAdapter {
  // Convert between Python and TypeScript data formats
  
  static pythonToTypescript(pythonData: any): any {
    // Handle Python-specific data types
    if (pythonData && typeof pythonData === 'object') {
      const converted: any = {};
      
      for (const [key, value] of Object.entries(pythonData)) {
        // Convert Python datetime to JavaScript Date
        if (typeof value === 'string' && this.isISODateString(value)) {
          converted[key] = new Date(value);
        }
        // Convert Python Decimal to JavaScript number
        else if (typeof value === 'object' && value?.__class__ === 'Decimal') {
          converted[key] = parseFloat(value.toString());
        }
        // Recursively convert nested objects
        else if (typeof value === 'object' && value !== null) {
          converted[key] = this.pythonToTypescript(value);
        }
        else {
          converted[key] = value;
        }
      }
      
      return converted;
    }
    
    return pythonData;
  }
  
  static typescriptToPython(tsData: any): any {
    // Convert TypeScript data to Python-compatible format
    if (tsData && typeof tsData === 'object') {
      const converted: any = {};
      
      for (const [key, value] of Object.entries(tsData)) {
        // Convert JavaScript Date to ISO string
        if (value instanceof Date) {
          converted[key] = value.toISOString();
        }
        // Convert JavaScript number to Python Decimal string
        else if (typeof value === 'number' && !Number.isInteger(value)) {
          converted[key] = value.toString();
        }
        // Recursively convert nested objects
        else if (typeof value === 'object' && value !== null) {
          converted[key] = this.typescriptToPython(value);
        }
        else {
          converted[key] = value;
        }
      }
      
      return converted;
    }
    
    return tsData;
  }
  
  private static isISODateString(str: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(str);
  }
}
```

### 2.2 Database Migration Helper

```typescript
// src/compatibility/DatabaseMigration.ts
export class DatabaseMigration {
  private oldDb: Database;
  private newDb: Database;
  
  constructor(oldDb: Database, newDb: Database) {
    this.oldDb = oldDb;
    this.newDb = newDb;
  }
  
  async migrateTeachers(): Promise<void> {
    console.log('Migrating teachers from Python to TypeScript format...');
    
    // Read from old Python database format
    const oldTeachers = await this.oldDb.query(`
      SELECT teacher_id, spec, version, domain, created_at 
      FROM python_teachers
    `);
    
    for (const teacher of oldTeachers.rows) {
      // Convert Python spec to TypeScript format
      const tsSpec = SchemaAdapter.pythonToTypescript(teacher.spec);
      
      // Insert into new database
      await this.newDb.query(`
        INSERT INTO teachers (id, spec, version, domain, created_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          spec = EXCLUDED.spec,
          version = EXCLUDED.version,
          updated_at = NOW()
      `, [
        `${teacher.domain}/${teacher.teacher_id}@${teacher.version}`,
        JSON.stringify(tsSpec),
        teacher.version,
        teacher.domain,
        teacher.created_at
      ]);
    }
    
    console.log(`Migrated ${oldTeachers.rows.length} teachers`);
  }
  
  async migrateTrainingData(): Promise<void> {
    console.log('Migrating training data...');
    
    const oldTrainingData = await this.oldDb.query(`
      SELECT * FROM python_training_tuples
    `);
    
    for (const tuple of oldTrainingData.rows) {
      await this.newDb.query(`
        INSERT INTO training_tuples (
          input_text, normalized_inputs, teacher_id, teacher_version,
          symbolic_output, llm_output, explanation_output,
          label_type, approved_for_training, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        tuple.input_text,
        JSON.stringify(SchemaAdapter.pythonToTypescript(tuple.normalized_inputs)),
        tuple.teacher_id,
        tuple.teacher_version,
        JSON.stringify(SchemaAdapter.pythonToTypescript(tuple.symbolic_output)),
        tuple.llm_output,
        tuple.explanation_output,
        tuple.label_type,
        tuple.approved_for_training,
        tuple.created_at
      ]);
    }
    
    console.log(`Migrated ${oldTrainingData.rows.length} training tuples`);
  }
}
```

## 3. Feature Flag System

### 3.1 Feature Flag Manager

```typescript
// src/compatibility/FeatureFlagManager.ts
export class FeatureFlagManager {
  private flags: Map<string, FeatureFlag> = new Map();
  private db: Database;
  
  constructor(db: Database) {
    this.db = db;
    this.loadFlags();
  }
  
  async loadFlags(): Promise<void> {
    const result = await this.db.query(`
      SELECT name, config, enabled, rollout_percentage, conditions
      FROM feature_flags
      WHERE active = true
    `);
    
    for (const row of result.rows) {
      this.flags.set(row.name, {
        name: row.name,
        config: row.config,
        enabled: row.enabled,
        rolloutPercentage: row.rollout_percentage,
        conditions: row.conditions
      });
    }
  }
  
  async shouldUseNewSystem(flagName: string, context: FlagContext): Promise<boolean> {
    const flag = this.flags.get(flagName);
    
    if (!flag || !flag.enabled) {
      return false;
    }
    
    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const hash = this.hashContext(context);
      const percentage = hash % 100;
      
      if (percentage >= flag.rolloutPercentage) {
        return false;
      }
    }
    
    // Check conditions
    if (flag.conditions) {
      return await this.evaluateConditions(flag.conditions, context);
    }
    
    return true;
  }
  
  private hashContext(context: FlagContext): number {
    const str = JSON.stringify(context);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash);
  }
  
  private async evaluateConditions(conditions: any, context: FlagContext): Promise<boolean> {
    // Evaluate feature flag conditions
    // This could include user-based, time-based, or other conditions
    
    if (conditions.userIds && conditions.userIds.includes(context.userId)) {
      return true;
    }
    
    if (conditions.sessionIds && conditions.sessionIds.includes(context.sessionId)) {
      return true;
    }
    
    if (conditions.timeRange) {
      const now = new Date();
      const start = new Date(conditions.timeRange.start);
      const end = new Date(conditions.timeRange.end);
      
      if (now >= start && now <= end) {
        return true;
      }
    }
    
    return false;
  }
  
  async updateFlag(flagName: string, updates: Partial<FeatureFlag>): Promise<void> {
    await this.db.query(`
      UPDATE feature_flags 
      SET config = $2, enabled = $3, rollout_percentage = $4, conditions = $5
      WHERE name = $1
    `, [
      flagName,
      JSON.stringify(updates.config),
      updates.enabled,
      updates.rolloutPercentage,
      JSON.stringify(updates.conditions)
    ]);
    
    // Reload flags
    await this.loadFlags();
  }
}

export interface FeatureFlag {
  name: string;
  config: any;
  enabled: boolean;
  rolloutPercentage: number;
  conditions?: any;
}

export interface FlagContext {
  userId?: string;
  sessionId?: string;
  timestamp?: Date;
  metadata?: any;
}
```

## 4. Gradual Migration Strategy

### 4.1 Traffic Split Manager

```typescript
// src/compatibility/TrafficSplitManager.ts
export class TrafficSplitManager {
  private splitConfig: TrafficSplitConfig;
  private featureFlags: FeatureFlagManager;
  
  constructor(featureFlags: FeatureFlagManager) {
    this.featureFlags = featureFlags;
    this.splitConfig = {
      newSystemPercentage: 0,
      routingStrategy: 'random'
    };
  }
  
  async shouldRouteToNewSystem(context: RequestContext): Promise<boolean> {
    // Check feature flags first
    const useNewRouter = await this.featureFlags.shouldUseNewSystem('useNewRouter', context);
    const useNewTeachers = await this.featureFlags.shouldUseNewSystem('useNewTeachers', context);
    const useNewSELLM = await this.featureFlags.shouldUseNewSystem('useNewSELLM', context);
    
    if (useNewRouter || useNewTeachers || useNewSELLM) {
      return true;
    }
    
    // Check traffic split
    if (this.splitConfig.routingStrategy === 'random') {
      return this.randomSplit(context);
    } else if (this.splitConfig.routingStrategy === 'user_based') {
      return this.userBasedSplit(context);
    }
    
    return false;
  }
  
  private randomSplit(context: RequestContext): boolean {
    const hash = this.hashString(context.sessionId || context.userId || 'anonymous');
    const percentage = hash % 100;
    return percentage < this.splitConfig.newSystemPercentage;
  }
  
  private userBasedSplit(context: RequestContext): boolean {
    if (!context.userId) {
      return false;
    }
    
    // Use user ID hash for consistent routing
    const hash = this.hashString(context.userId);
    const percentage = hash % 100;
    return percentage < this.splitConfig.newSystemPercentage;
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  async updateTrafficSplit(config: TrafficSplitConfig): Promise<void> {
    this.splitConfig = config;
    
    // Log the change
    console.log(`Updated traffic split: ${config.newSystemPercentage}% to new system`);
  }
}

export interface TrafficSplitConfig {
  newSystemPercentage: number;
  routingStrategy: 'random' | 'user_based' | 'feature_flag';
}
```

## 5. Monitoring and Rollback

### 5.1 Migration Monitor

```typescript
// src/compatibility/MigrationMonitor.ts
export class MigrationMonitor {
  private metrics: Map<string, MigrationMetrics> = new Map();
  private alertThresholds: AlertThresholds;
  
  constructor(alertThresholds: AlertThresholds) {
    this.alertThresholds = alertThresholds;
  }
  
  async recordRequest(
    service: string,
    useNewSystem: boolean,
    success: boolean,
    duration: number,
    error?: Error
  ): Promise<void> {
    const key = `${service}_${useNewSystem ? 'new' : 'old'}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        service,
        system: useNewSystem ? 'new' : 'old',
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageDuration: 0,
        errorRate: 0
      });
    }
    
    const metrics = this.metrics.get(key)!;
    metrics.totalRequests++;
    
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }
    
    // Update average duration
    metrics.averageDuration = 
      (metrics.averageDuration * (metrics.totalRequests - 1) + duration) / 
      metrics.totalRequests;
    
    // Update error rate
    metrics.errorRate = metrics.failedRequests / metrics.totalRequests;
    
    // Check for alerts
    await this.checkAlerts(metrics);
  }
  
  private async checkAlerts(metrics: MigrationMetrics): Promise<void> {
    // Check error rate threshold
    if (metrics.errorRate > this.alertThresholds.errorRate) {
      await this.sendAlert('HIGH_ERROR_RATE', {
        service: metrics.service,
        system: metrics.system,
        errorRate: metrics.errorRate,
        threshold: this.alertThresholds.errorRate
      });
    }
    
    // Check duration threshold
    if (metrics.averageDuration > this.alertThresholds.averageDuration) {
      await this.sendAlert('HIGH_DURATION', {
        service: metrics.service,
        system: metrics.system,
        averageDuration: metrics.averageDuration,
        threshold: this.alertThresholds.averageDuration
      });
    }
  }
  
  private async sendAlert(type: string, data: any): Promise<void> {
    console.error(`ALERT: ${type}`, data);
    
    // Send to monitoring system
    // This could be Slack, PagerDuty, or any other alerting system
  }
  
  getMetrics(): Map<string, MigrationMetrics> {
    return new Map(this.metrics);
  }
}

export interface MigrationMetrics {
  service: string;
  system: 'new' | 'old';
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageDuration: number;
  errorRate: number;
}

export interface AlertThresholds {
  errorRate: number;
  averageDuration: number;
}
```

## 6. Rollback Strategy

### 6.1 Automatic Rollback

```typescript
// src/compatibility/AutoRollback.ts
export class AutoRollback {
  private monitor: MigrationMonitor;
  private featureFlags: FeatureFlagManager;
  private rollbackThresholds: RollbackThresholds;
  
  constructor(
    monitor: MigrationMonitor,
    featureFlags: FeatureFlagManager,
    rollbackThresholds: RollbackThresholds
  ) {
    this.monitor = monitor;
    this.featureFlags = featureFlags;
    this.rollbackThresholds = rollbackThresholds;
  }
  
  async checkAndRollback(): Promise<void> {
    const metrics = this.monitor.getMetrics();
    
    for (const [key, metric] of metrics) {
      if (metric.system === 'new') {
        // Check if we need to rollback
        if (this.shouldRollback(metric)) {
          await this.executeRollback(metric.service);
        }
      }
    }
  }
  
  private shouldRollback(metric: MigrationMetrics): boolean {
    // Rollback if error rate is too high
    if (metric.errorRate > this.rollbackThresholds.errorRate) {
      return true;
    }
    
    // Rollback if average duration is too high
    if (metric.averageDuration > this.rollbackThresholds.averageDuration) {
      return true;
    }
    
    // Rollback if we have enough data points and success rate is too low
    if (metric.totalRequests > this.rollbackThresholds.minRequests) {
      const successRate = metric.successfulRequests / metric.totalRequests;
      if (successRate < this.rollbackThresholds.minSuccessRate) {
        return true;
      }
    }
    
    return false;
  }
  
  private async executeRollback(service: string): Promise<void> {
    console.log(`Executing automatic rollback for service: ${service}`);
    
    // Disable feature flag for the service
    await this.featureFlags.updateFlag(`useNew${service}`, {
      enabled: false
    });
    
    // Send alert
    await this.sendRollbackAlert(service);
  }
  
  private async sendRollbackAlert(service: string): Promise<void> {
    console.error(`AUTOMATIC ROLLBACK: Service ${service} rolled back due to poor performance`);
    
    // Send to monitoring system
  }
}

export interface RollbackThresholds {
  errorRate: number;
  averageDuration: number;
  minRequests: number;
  minSuccessRate: number;
}
```

This compatibility layer ensures a smooth migration from Python to TypeScript while maintaining API compatibility, enabling gradual rollout, and providing automatic rollback capabilities.
