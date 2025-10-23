# Hydra Systems — Unified Framework Architecture & Frontend Integration

## Overview

This document outlines the comprehensive framework architecture for Hydra Systems, integrating the TypeScript feather-agent framework with Hydra Cloud frontend, Feather Runtime, and Hydra Connectors. This unified approach provides specialized capabilities for Hydra's hybrid neuro-symbolic intelligence platform while maintaining enterprise-grade security and scalability.

## Unified System Architecture

### Complete Platform Stack

The Hydra Systems platform integrates multiple layers into a cohesive enterprise solution:

```typescript
// Unified Hydra Systems Architecture
interface HydraSystemsPlatform {
  // Frontend Layer
  hydraCloud: {
    visualBuilder: ReactFlowEditor;
    projectManagement: ProjectDashboard;
    connectorRegistry: ConnectorManager;
    auditDashboard: TraceViewer;
    rlEvaluator: ModelComparison;
  };
  
  // Backend Layer
  featherRuntime: {
    symbolicEngine: JSONLogicInterpreter;
    auditLogger: TraceGenerator;
    jobQueue: RedisQueue;
    sandboxExecutor: DockerContainer;
  };
  
  // Integration Layer
  hydraConnectors: {
    restConnectors: RESTAdapter[];
    dbConnectors: DatabaseAdapter[];
    customConnectors: CustomAdapter[];
  };
  
  // Security Layer
  securityModel: {
    oauth2Auth: OAuth2Provider;
    jwtTokens: JWTManager;
    rbacSystem: RoleBasedAccessControl;
    auditTrail: AuditLogger;
  };
}
```

### Frontend-Backend Integration Points

```typescript
// Frontend-Backend Integration Architecture
export class HydraFrontendBackendIntegration {
  private hydraCloud: HydraCloudService;
  private featherRuntime: FeatherRuntimeService;
  private connectorGateway: ConnectorGateway;
  
  constructor() {
    this.hydraCloud = new HydraCloudService();
    this.featherRuntime = new FeatherRuntimeService();
    this.connectorGateway = new ConnectorGateway();
  }
  
  // Real-time flow execution with visual feedback
  async executeFlowWithVisualFeedback(flowSpec: FlowSpec): Promise<ExecutionResult> {
    // 1. Send flow to Feather Runtime
    const executionId = await this.featherRuntime.executeFlow(flowSpec);
    
    // 2. Stream execution progress to frontend
    const progressStream = this.featherRuntime.getExecutionProgress(executionId);
    
    // 3. Update visual editor in real-time
    progressStream.on('progress', (progress) => {
      this.hydraCloud.updateVisualEditor(progress);
    });
    
    // 4. Return final result with visual trace
    const result = await progressStream.waitForCompletion();
    return this.generateVisualExecutionResult(result);
  }
  
  // Convert symbolic traces to visual representations
  private generateVisualExecutionResult(result: ExecutionResult): VisualExecutionResult {
    return {
      ...result,
      visualTrace: this.convertTraceToVisualNodes(result.trace),
      executionMetrics: this.calculateExecutionMetrics(result),
      auditHash: this.generateAuditHash(result)
    };
  }
}
```

## 1. Frontend-Integrated Agent Architecture

### 1.1 Visual Builder Agent Integration

```typescript
// src/agents/VisualBuilderAgent.ts
export class VisualBuilderAgent extends HydraAgent {
  private reactFlowEditor: ReactFlowEditor;
  private projectManager: ProjectManager;
  private realTimeSync: RealTimeSync;
  
  constructor(opts: VisualBuilderAgentOpts) {
    super(opts);
    this.reactFlowEditor = new ReactFlowEditor(opts.editorConfig);
    this.projectManager = new ProjectManager(opts.projectConfig);
    this.realTimeSync = new RealTimeSync(opts.syncConfig);
  }
  
  // Convert visual flow to executable specification
  async convertVisualFlowToSpec(visualFlow: VisualFlow): Promise<FlowSpec> {
    return await this.executeDeterministically(async () => {
      // Parse ReactFlow nodes and edges
      const nodes = visualFlow.nodes;
      const edges = visualFlow.edges;
      
      // Convert to executable flow specification
      const flowSpec: FlowSpec = {
        id: visualFlow.id,
        name: visualFlow.name,
        steps: this.convertNodesToSteps(nodes, edges),
        connectors: this.extractConnectors(nodes),
        rules: this.extractRules(nodes),
        metadata: {
          created_at: new Date(),
          version: visualFlow.version,
          visual_layout: this.serializeVisualLayout(nodes, edges)
        }
      };
      
      // Validate flow specification
      await this.validateFlowSpec(flowSpec);
      
      return flowSpec;
    }, {
      operation: "visual_flow_conversion",
      input: visualFlow.id,
      metadata: { nodeCount: visualFlow.nodes.length }
    });
  }
  
  // Real-time execution with visual feedback
  async executeFlowWithVisualFeedback(flowSpec: FlowSpec): Promise<VisualExecutionResult> {
    const executionId = await this.featherRuntime.executeFlow(flowSpec);
    
    // Stream execution progress to visual editor
    const progressStream = this.featherRuntime.getExecutionProgress(executionId);
    
    progressStream.on('step_start', (step) => {
      this.reactFlowEditor.highlightNode(step.nodeId, 'executing');
    });
    
    progressStream.on('step_complete', (step) => {
      this.reactFlowEditor.updateNodeStatus(step.nodeId, step.result);
    });
    
    progressStream.on('error', (error) => {
      this.reactFlowEditor.highlightError(error.nodeId, error.message);
    });
    
    const result = await progressStream.waitForCompletion();
    
    return {
      executionId,
      result: result.finalResult,
      visualTrace: this.generateVisualTrace(result.trace),
      executionMetrics: this.calculateMetrics(result),
      auditHash: this.generateAuditHash(result)
    };
  }
  
  private convertNodesToSteps(nodes: Node[], edges: Edge[]): FlowStep[] {
    const steps: FlowStep[] = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    // Build execution order from edges
    const executionOrder = this.topologicalSort(nodes, edges);
    
    for (const nodeId of executionOrder) {
      const node = nodeMap.get(nodeId)!;
      const step = this.convertNodeToStep(node);
      steps.push(step);
    }
    
    return steps;
  }
  
  private convertNodeToStep(node: Node): FlowStep {
    switch (node.type) {
      case 'inputNode':
        return {
          type: 'input',
          id: node.id,
          config: node.data.config
        };
      case 'teacherNode':
        return {
          type: 'teacher_execution',
          id: node.id,
          teacher_id: node.data.teacher_id,
          inputs: node.data.inputs
        };
      case 'ruleNode':
        return {
          type: 'rule_evaluation',
          id: node.id,
          rule: node.data.rule
        };
      case 'decisionNode':
        return {
          type: 'decision',
          id: node.id,
          condition: node.data.condition,
          branches: node.data.branches
        };
      case 'actionNode':
        return {
          type: 'action',
          id: node.id,
          action: node.data.action,
          config: node.data.config
        };
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }
}
```

### 1.2 Project Management Agent

```typescript
// src/agents/ProjectManagementAgent.ts
export class ProjectManagementAgent extends HydraAgent {
  private projectStore: ProjectStore;
  private versionManager: VersionManager;
  private collaborationManager: CollaborationManager;
  
  constructor(opts: ProjectManagementAgentOpts) {
    super(opts);
    this.projectStore = new ProjectStore(opts.storageConfig);
    this.versionManager = new VersionManager(opts.versionConfig);
    this.collaborationManager = new CollaborationManager(opts.collaborationConfig);
  }
  
  // Create new project with scaffolding
  async createProject(projectSpec: ProjectSpec): Promise<Project> {
    return await this.executeDeterministically(async () => {
      // Generate project structure
      const projectStructure = this.generateProjectStructure(projectSpec);
      
      // Create project record
      const project: Project = {
        id: generateId(),
        name: projectSpec.name,
        description: projectSpec.description,
        domain: projectSpec.domain,
        structure: projectStructure,
        version: '1.0.0',
        created_at: new Date(),
        created_by: projectSpec.created_by,
        status: 'active'
      };
      
      // Store project
      await this.projectStore.createProject(project);
      
      // Initialize version control
      await this.versionManager.initializeProject(project.id);
      
      // Set up collaboration workspace
      await this.collaborationManager.createWorkspace(project.id);
      
      return project;
    }, {
      operation: "project_creation",
      input: projectSpec.name,
      metadata: { domain: projectSpec.domain }
    });
  }
  
  // Deploy project to Feather Runtime
  async deployProject(projectId: string, environment: DeploymentEnvironment): Promise<DeploymentResult> {
    const project = await this.projectStore.getProject(projectId);
    const flowSpecs = await this.projectStore.getFlowSpecs(projectId);
    
    // Package project for deployment
    const deploymentPackage = await this.packageProject(project, flowSpecs);
    
    // Deploy to Feather Runtime
    const deploymentResult = await this.featherRuntime.deployPackage(
      deploymentPackage,
      environment
    );
    
    // Update project status
    await this.projectStore.updateProjectStatus(projectId, 'deployed', {
      deployment_id: deploymentResult.deploymentId,
      environment: environment.name,
      deployed_at: new Date()
    });
    
    return deploymentResult;
  }
  
  private generateProjectStructure(spec: ProjectSpec): ProjectStructure {
    return {
      flows: {
        directory: '/flows',
        templates: this.getDomainTemplates(spec.domain)
      },
      rules: {
        directory: '/rules',
        schemas: this.getRuleSchemas(spec.domain)
      },
      connectors: {
        directory: '/connectors',
        templates: this.getConnectorTemplates(spec.domain)
      },
      tests: {
        directory: '/tests',
        fixtures: this.getTestFixtures(spec.domain)
      },
      docs: {
        directory: '/docs',
        templates: this.getDocumentationTemplates(spec.domain)
      }
    };
  }
}
```

## 2. Hydra-Specific Agent Types

```typescript
// src/agents/HydraAgent.ts
export abstract class HydraAgent extends Agent {
  protected teacherRegistry: TeacherRegistry;
  protected policyWatcher: PolicyWatcher;
  protected trainingPipeline: TrainingPipeline;
  
  constructor(opts: HydraAgentOpts) {
    super(opts);
    this.teacherRegistry = opts.teacherRegistry;
    this.policyWatcher = opts.policyWatcher;
    this.trainingPipeline = opts.trainingPipeline;
  }
  
  // Hydra-specific lifecycle hooks
  protected async onTeacherExecution(teacherId: string, inputs: any, result: any): Promise<void> {
    // Collect training data
    await this.trainingPipeline.collectExecution(teacherId, inputs, result);
  }
  
  protected async onPolicyChange(change: PolicyChange): Promise<void> {
    // Handle policy changes
    await this.policyWatcher.handleChange(change);
  }
  
  // Deterministic execution guarantee
  protected async executeDeterministically<T>(
    operation: () => Promise<T>,
    context: ExecutionContext
  ): Promise<T> {
    // Ensure deterministic execution with proper validation
    const startTime = Date.now();
    try {
      const result = await operation();
      
      // Validate result determinism
      await this.validateDeterminism(context, result);
      
      return result;
    } catch (error) {
      // Log execution failure
      await this.logExecutionFailure(context, error);
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      await this.logExecutionMetrics(context, duration);
    }
  }
  
  abstract executeHydraTask(input: HydraTaskInput): Promise<HydraTaskResult>;
}

export interface HydraAgentOpts extends AgentOpts {
  teacherRegistry: TeacherRegistry;
  policyWatcher: PolicyWatcher;
  trainingPipeline: TrainingPipeline;
}
```

### 1.2 RouterAgent Implementation

```typescript
// src/agents/RouterAgent.ts
export class RouterAgent extends HydraAgent {
  private intentClassifier: IntentClassifier;
  private teacherMatcher: TeacherMatcher;
  
  constructor(opts: RouterAgentOpts) {
    super(opts);
    this.intentClassifier = new IntentClassifier(opts.classifierConfig);
    this.teacherMatcher = new TeacherMatcher(opts.teacherRegistry);
  }
  
  async executeHydraTask(input: HydraTaskInput): Promise<HydraTaskResult> {
    return await this.executeDeterministically(async () => {
      // Step 1: Intent Classification
      const intent = await this.classifyIntent(input.query, input.metadata);
      
      // Step 2: Teacher Matching
      const teacher = await this.findTeacher(intent, input.metadata);
      
      if (teacher) {
        // Step 3: Route to Symbolic Teacher
        return await this.routeToTeacher(teacher, input);
      } else {
        // Step 4: Route to SELLM for Teacher Creation
        return await this.routeToSELLM(intent, input);
      }
    }, {
      operation: "router_execution",
      input: input.query,
      metadata: input.metadata
    });
  }
  
  private async classifyIntent(query: string, metadata: any): Promise<string> {
    // Use agent planning for intent classification
    const plan = await this.planner({
      sessionId: "intent-classification",
      input: { 
        role: "user", 
        content: `Classify the intent of this query: "${query}"` 
      },
      context: [],
      iteration: 0,
      metadata: { ...metadata, classification_mode: true }
    });
    
    return plan.actions[0]?.intent || "unknown";
  }
  
  private async findTeacher(intent: string, metadata: any): Promise<TeacherSpec | null> {
    return await this.teacherMatcher.findTeacher(intent, metadata);
  }
  
  private async routeToTeacher(teacher: TeacherSpec, input: HydraTaskInput): Promise<HydraTaskResult> {
    // Normalize inputs
    const normalizedInputs = await this.normalizeInputs(input.query, teacher);
    
    // Execute teacher
    const result = await this.executeTeacher(teacher, normalizedInputs);
    
    // Generate explanation
    const explanation = await this.generateExplanation(teacher, result);
    
    // Collect training data
    await this.onTeacherExecution(teacher.teacher_id, normalizedInputs, result);
    
    return {
      status: "completed",
      routing_decision: "symbolic",
      teacher_id: teacher.teacher_id,
      normalized_input: normalizedInputs,
      result,
      explanation,
      metadata: {
        execution_time: Date.now(),
        teacher_version: teacher.version
      }
    };
  }
  
  private async routeToSELLM(intent: string, input: HydraTaskInput): Promise<HydraTaskResult> {
    // Extract teacher specification from intent
    const spec = await this.extractTeacherSpec(intent, input);
    
    return {
      status: "teacher_creation_required",
      routing_decision: "create_teacher",
      teacher_spec: spec,
      metadata: {
        intent,
        extraction_time: Date.now()
      }
    };
  }
}
```

### 1.3 SELLMAgent Implementation

```typescript
// src/agents/SELLMAgent.ts
export class SELLMAgent extends HydraAgent {
  private codeGenerator: CodeGenerator;
  private testGenerator: TestGenerator;
  private validator: TeacherValidator;
  
  constructor(opts: SELLMAgentOpts) {
    super(opts);
    this.codeGenerator = new CodeGenerator(opts.codeGenConfig);
    this.testGenerator = new TestGenerator(opts.testGenConfig);
    this.validator = new TeacherValidator(opts.validationConfig);
  }
  
  async executeHydraTask(input: HydraTaskInput): Promise<HydraTaskResult> {
    return await this.executeDeterministically(async () => {
      const { teacher_spec } = input.metadata;
      
      // Step 1: Generate Teacher Implementation
      const teacherCode = await this.generateTeacherCode(teacher_spec);
      
      // Step 2: Generate Test Cases
      const tests = await this.generateTests(teacher_spec, teacherCode);
      
      // Step 3: Validate Teacher
      const validation = await this.validateTeacher(teacherCode, tests);
      
      if (validation.valid) {
        // Step 4: Store in Registry
        const teacherId = await this.teacherRegistry.createTeacher({
          ...teacher_spec,
          implementation: teacherCode,
          tests
        });
        
        return {
          status: "teacher_created",
          teacher_id: teacherId,
          teacher_spec: teacher_spec,
          implementation: teacherCode,
          tests,
          validation,
          metadata: {
            creation_time: Date.now(),
            confidence: validation.confidence
          }
        };
      } else {
        return {
          status: "validation_failed",
          teacher_spec: teacher_spec,
          implementation: teacherCode,
          tests,
          validation,
          errors: validation.errors
        };
      }
    }, {
      operation: "teacher_creation",
      input: teacher_spec,
      metadata: input.metadata
    });
  }
  
  private async generateTeacherCode(spec: TeacherSpec): Promise<TeacherImplementation> {
    // Use agent planning to generate teacher code
    const plan = await this.planner({
      sessionId: "teacher-generation",
      input: {
        role: "user",
        content: `Generate implementation for teacher: ${JSON.stringify(spec)}`
      },
      context: [],
      iteration: 0,
      metadata: { generation_mode: "code" }
    });
    
    return await this.codeGenerator.generate(spec, plan);
  }
  
  private async generateTests(spec: TeacherSpec, implementation: TeacherImplementation): Promise<TestCase[]> {
    const plan = await this.planner({
      sessionId: "test-generation",
      input: {
        role: "user",
        content: `Generate test cases for teacher: ${spec.teacher_id}`
      },
      context: [],
      iteration: 0,
      metadata: { generation_mode: "tests" }
    });
    
    return await this.testGenerator.generate(spec, implementation, plan);
  }
  
  private async validateTeacher(
    implementation: TeacherImplementation, 
    tests: TestCase[]
  ): Promise<ValidationResult> {
    return await this.validator.validate(implementation, tests);
  }
}
```

## 2. Teacher Registry Integration

### 2.1 Enhanced Teacher Registry

```typescript
// src/registry/TeacherRegistry.ts
export class TeacherRegistry {
  private db: Database;
  private cache: Cache;
  private versionManager: VersionManager;
  private schemaValidator: SchemaValidator;
  
  constructor(opts: TeacherRegistryOpts) {
    this.db = opts.database;
    this.cache = opts.cache;
    this.versionManager = new VersionManager();
    this.schemaValidator = new SchemaValidator();
  }
  
  async getTeacher(teacherId: string, version?: string): Promise<TeacherSpec> {
    const key = this.generateCacheKey(teacherId, version);
    
    // Check cache first
    let teacher = await this.cache.get(key);
    if (teacher) {
      await this.logCacheHit(teacherId, version);
      return teacher;
    }
    
    // Load from database
    teacher = await this.loadFromDatabase(teacherId, version);
    
    // Validate schema
    await this.schemaValidator.validate(teacher);
    
    // Cache for future use
    await this.cache.set(key, teacher, { ttl: 3600 });
    
    await this.logCacheMiss(teacherId, version);
    return teacher;
  }
  
  async createTeacher(spec: TeacherSpec): Promise<string> {
    // Validate teacher specification
    await this.schemaValidator.validate(spec);
    
    // Generate version
    const version = await this.versionManager.generateVersion(spec);
    const teacherId = `${spec.domain}/${spec.teacher_id}@${version}`;
    
    // Store in database
    await this.db.query(
      'INSERT INTO teachers (id, spec, version, created_at, metadata) VALUES ($1, $2, $3, $4, $5)',
      [teacherId, JSON.stringify(spec), version, new Date(), JSON.stringify(spec.metadata)]
    );
    
    // Invalidate cache
    await this.invalidateCache(spec.teacher_id);
    
    // Log creation
    await this.logTeacherCreation(teacherId, spec);
    
    return teacherId;
  }
  
  async updateTeacher(teacherId: string, patch: TeacherPatch): Promise<string> {
    const current = await this.getTeacher(teacherId);
    const updated = await this.applyPatch(current, patch);
    
    // Validate updated teacher
    await this.schemaValidator.validate(updated);
    
    // Create new version
    return await this.createTeacher(updated);
  }
  
  async listTeachers(domain?: string, version?: string): Promise<TeacherSpec[]> {
    let query = 'SELECT * FROM teachers WHERE 1=1';
    const params: any[] = [];
    
    if (domain) {
      query += ' AND domain = $' + (params.length + 1);
      params.push(domain);
    }
    
    if (version) {
      query += ' AND version = $' + (params.length + 1);
      params.push(version);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const results = await this.db.query(query, params);
    return results.rows.map(row => JSON.parse(row.spec));
  }
  
  private async applyPatch(teacher: TeacherSpec, patch: TeacherPatch): Promise<TeacherSpec> {
    // Apply JSON Patch operations
    const patcher = new JsonPatcher();
    return patcher.apply(teacher, patch.operations);
  }
  
  private generateCacheKey(teacherId: string, version?: string): string {
    return `teacher:${teacherId}:${version || 'latest'}`;
  }
  
  private async invalidateCache(teacherId: string): Promise<void> {
    const patterns = [
      `teacher:${teacherId}:*`,
      `teacher:${teacherId}:latest`
    ];
    
    for (const pattern of patterns) {
      await this.cache.deletePattern(pattern);
    }
  }
}
```

### 2.2 Teacher Tool Integration

```typescript
// src/tools/TeacherTool.ts
export function createTeacherTool(registry: TeacherRegistry): Tool {
  return {
    name: "execute_teacher",
    description: "Execute a symbolic teacher with deterministic results",
    execute: async (input: TeacherExecutionInput) => {
      // Get teacher specification
      const teacher = await registry.getTeacher(input.teacherId, input.version);
      
      // Validate inputs against teacher schema
      const validatedInputs = await validateInputs(input.inputs, teacher.inputs_schema);
      
      // Execute teacher logic
      const result = await executeTeacherLogic(teacher, validatedInputs);
      
      // Generate trace
      const trace = await generateTrace(teacher, validatedInputs, result);
      
      return {
        verdict: result.verdict,
        outputs: result.outputs,
        trace,
        teacher_version: teacher.version,
        execution_time: Date.now()
      };
    },
    validate: (input: unknown): input is TeacherExecutionInput => {
      return TeacherExecutionInputSchema.safeParse(input).success;
    }
  };
}

async function executeTeacherLogic(teacher: TeacherSpec, inputs: any): Promise<TeacherResult> {
  // Create teacher instance from specification
  const teacherInstance = await createTeacherInstance(teacher);
  
  // Execute with deterministic guarantees
  const result = await teacherInstance.execute(inputs);
  
  // Validate result structure
  await validateTeacherResult(result, teacher);
  
  return result;
}

async function generateTrace(teacher: TeacherSpec, inputs: any, result: TeacherResult): Promise<Trace[]> {
  const trace: Trace[] = [];
  
  // Add computed values to trace
  if (teacher.computed) {
    for (const [key, expression] of Object.entries(teacher.computed)) {
      const value = evaluateExpression(expression, inputs);
      trace.push({
        rule_id: `COMPUTED_${key}`,
        passed: true,
        value,
        explanation: `Computed ${key} = ${value}`
      });
    }
  }
  
  // Add rule evaluations to trace
  if (teacher.rules) {
    for (const rule of teacher.rules) {
      const passed = evaluateRule(rule, inputs, result.outputs);
      trace.push({
        rule_id: rule.id,
        passed,
        threshold: rule.threshold,
        value: result.outputs[rule.field],
        explanation: rule.explanation || `Rule ${rule.id}: ${passed ? 'PASSED' : 'FAILED'}`
      });
    }
  }
  
  return trace;
}
```

## 3. Policy Watcher Integration

### 3.1 Enhanced Policy Watcher

```typescript
// src/watchers/PolicyWatcher.ts
export class PolicyWatcher {
  private watchers: Map<string, WatcherInstance> = new Map();
  private eventEmitter: EventEmitter;
  private teacherRegistry: TeacherRegistry;
  private sellmAgent: SELLMAgent;
  
  constructor(opts: PolicyWatcherOpts) {
    this.eventEmitter = opts.eventEmitter;
    this.teacherRegistry = opts.teacherRegistry;
    this.sellmAgent = opts.sellmAgent;
  }
  
  async startWatching(config: WatcherConfig): Promise<void> {
    const watcher = new ExternalWatcher(config);
    
    watcher.on('change', async (change: PolicyChange) => {
      await this.handlePolicyChange(change);
    });
    
    watcher.on('error', async (error: Error) => {
      await this.handleWatcherError(config.id, error);
    });
    
    this.watchers.set(config.id, watcher);
    await watcher.start();
    
    console.log(`Started watching ${config.source} for ${config.id}`);
  }
  
  private async handlePolicyChange(change: PolicyChange): Promise<void> {
    console.log(`Policy change detected: ${change.id}`);
    
    // Find affected teachers
    const affectedTeachers = await this.findAffectedTeachers(change);
    
    if (affectedTeachers.length === 0) {
      console.log(`No teachers affected by policy change ${change.id}`);
      return;
    }
    
    // Process each affected teacher
    for (const teacher of affectedTeachers) {
      await this.processAffectedTeacher(teacher, change);
    }
  }
  
  private async findAffectedTeachers(change: PolicyChange): Promise<TeacherSpec[]> {
    // Use SELLM to analyze policy change impact
    const result = await this.sellmAgent.run({
      sessionId: `policy-analysis-${change.id}`,
      input: {
        role: "user",
        content: `Analyze policy change impact: ${JSON.stringify(change)}`
      }
    });
    
    const affectedTeacherIds = result.output?.affected_teachers || [];
    
    // Load affected teachers
    const teachers: TeacherSpec[] = [];
    for (const teacherId of affectedTeacherIds) {
      try {
        const teacher = await this.teacherRegistry.getTeacher(teacherId);
        teachers.push(teacher);
      } catch (error) {
        console.warn(`Could not load teacher ${teacherId}:`, error);
      }
    }
    
    return teachers;
  }
  
  private async processAffectedTeacher(teacher: TeacherSpec, change: PolicyChange): Promise<void> {
    try {
      // Generate patch
      const patch = await this.generatePatch(teacher, change);
      
      // Generate counterfactual tests
      const counterfactuals = await this.generateCounterfactualTests(teacher, patch);
      
      // Run regression tests
      const regressionResults = await this.runRegressionTests(teacher, patch);
      
      // Create change report
      const changeReport: PolicyChangeReport = {
        policy_change: change,
        affected_teacher: teacher,
        proposed_patch: patch,
        test_results: {
          counterfactual_tests: counterfactuals,
          regression_tests: regressionResults
        },
        impact_analysis: await this.analyzeImpact(teacher, patch),
        requiresApproval: true,
        created_at: new Date()
      };
      
      // Store for human review
      await this.storeChangeReport(changeReport);
      
      // Notify reviewers
      await this.notifyReviewers(changeReport);
      
    } catch (error) {
      console.error(`Error processing teacher ${teacher.teacher_id}:`, error);
      await this.logProcessingError(teacher, change, error);
    }
  }
  
  private async generatePatch(teacher: TeacherSpec, change: PolicyChange): Promise<TeacherPatch> {
    const result = await this.sellmAgent.run({
      sessionId: `patch-generation-${change.id}`,
      input: {
        role: "user",
        content: `Generate patch for teacher ${teacher.teacher_id} based on policy change: ${JSON.stringify(change)}`
      }
    });
    
    return result.output?.patch;
  }
  
  private async generateCounterfactualTests(teacher: TeacherSpec, patch: TeacherPatch): Promise<CounterfactualTest[]> {
    const result = await this.sellmAgent.run({
      sessionId: `counterfactual-generation-${Date.now()}`,
      input: {
        role: "user",
        content: `Generate counterfactual tests for teacher ${teacher.teacher_id} with patch: ${JSON.stringify(patch)}`
      }
    });
    
    return result.output?.counterfactual_tests || [];
  }
  
  private async runRegressionTests(teacher: TeacherSpec, patch: TeacherPatch): Promise<RegressionTestResult[]> {
    // Get existing test cases
    const existingTests = teacher.tests || [];
    
    // Apply patch to create updated teacher
    const updatedTeacher = await this.applyPatch(teacher, patch);
    
    // Run tests against both versions
    const results: RegressionTestResult[] = [];
    
    for (const test of existingTests) {
      const originalResult = await this.runTest(teacher, test);
      const updatedResult = await this.runTest(updatedTeacher, test);
      
      results.push({
        test_id: test.id,
        original_result: originalResult,
        updated_result: updatedResult,
        changed: !this.resultsEqual(originalResult, updatedResult)
      });
    }
    
    return results;
  }
  
  private async analyzeImpact(teacher: TeacherSpec, patch: TeacherPatch): Promise<ImpactAnalysis> {
    // Analyze the impact of the patch on teacher behavior
    const analysis = await this.sellmAgent.run({
      sessionId: `impact-analysis-${Date.now()}`,
      input: {
        role: "user",
        content: `Analyze the impact of patch ${JSON.stringify(patch)} on teacher ${teacher.teacher_id}`
      }
    });
    
    return analysis.output?.impact_analysis;
  }
}
```

## 4. Training Pipeline Integration

### 4.1 Enhanced Training Pipeline

```typescript
// src/training/TrainingPipeline.ts
export class TrainingPipeline {
  private feather: Feather;
  private teacherRegistry: TeacherRegistry;
  private trainingDataStore: TrainingDataStore;
  private dataProcessor: DataProcessor;
  
  constructor(opts: TrainingPipelineOpts) {
    this.feather = opts.feather;
    this.teacherRegistry = opts.teacherRegistry;
    this.trainingDataStore = new TrainingDataStore(opts.database);
    this.dataProcessor = new DataProcessor(opts.processingConfig);
  }
  
  async collectTrainingData(sessionId: string, input: string, context: any): Promise<void> {
    try {
      // Get conversation context
      const conversationContext = await this.getConversationContext(sessionId);
      
      // Run through router to get symbolic output
      const routerResult = await this.runRouter(input, conversationContext);
      
      // Run through LLM for comparison
      const llmResult = await this.runLLM(input, conversationContext);
      
      // Generate explanation
      const explanation = await this.generateExplanation(routerResult);
      
      // Process and validate data
      const trainingTuple = await this.dataProcessor.process({
        input_text: input,
        normalized_inputs: routerResult.normalized_input,
        teacher_id: routerResult.teacher_id,
        teacher_version: routerResult.result?.effective_version,
        symbolic_output: routerResult.result,
        llm_output: llmResult.content,
        explanation_output: explanation,
        context: conversationContext,
        timestamp: new Date()
      });
      
      // Store training tuple
      await this.trainingDataStore.store(trainingTuple);
      
      // Log collection
      await this.logDataCollection(trainingTuple);
      
    } catch (error) {
      console.error('Error collecting training data:', error);
      await this.logCollectionError(sessionId, input, error);
    }
  }
  
  async generateTrainingDataset(): Promise<TrainingDataset> {
    // Get approved training tuples
    const tuples = await this.trainingDataStore.getApprovedTuples();
    
    // Group by teacher for specialized training
    const groupedTuples = this.groupByTeacher(tuples);
    
    const datasets: TeacherTrainingDataset[] = [];
    
    for (const [teacherId, teacherTuples] of groupedTuples) {
      const dataset = await this.createDatasetForTeacher(teacherId, teacherTuples);
      datasets.push(dataset);
    }
    
    // Create general dataset
    const generalDataset = await this.createGeneralDataset(tuples);
    
    return {
      datasets,
      general_dataset: generalDataset,
      total_tuples: tuples.length,
      generated_at: new Date(),
      metadata: {
        teachers_covered: datasets.length,
        average_tuples_per_teacher: tuples.length / datasets.length
      }
    };
  }
  
  private async createDatasetForTeacher(teacherId: string, tuples: TrainingTuple[]): Promise<TeacherTrainingDataset> {
    // Convert tuples to training format
    const trainingExamples = await Promise.all(
      tuples.map(async (tuple) => {
        const processed = await this.dataProcessor.processTuple(tuple);
        return {
          input: processed.input_text,
          target: processed.symbolic_output,
          explanation: processed.explanation_output,
          metadata: {
            teacher_version: tuple.teacher_version,
            confidence: processed.confidence,
            quality_score: processed.quality_score
          }
        };
      })
    );
    
    // Filter high-quality examples
    const highQualityExamples = trainingExamples.filter(
      ex => ex.metadata.quality_score > 0.8
    );
    
    return {
      teacher_id: teacherId,
      examples: highQualityExamples,
      count: highQualityExamples.length,
      quality_metrics: {
        average_quality_score: this.calculateAverageQuality(highQualityExamples),
        total_examples: trainingExamples.length,
        filtered_examples: highQualityExamples.length
      },
      created_at: new Date()
    };
  }
  
  private async createGeneralDataset(tuples: TrainingTuple[]): Promise<GeneralTrainingDataset> {
    // Create general training dataset for overall model improvement
    const examples = await Promise.all(
      tuples.map(async (tuple) => {
        const processed = await this.dataProcessor.processTuple(tuple);
        return {
          input: processed.input_text,
          target: processed.symbolic_output,
          explanation: processed.explanation_output,
          teacher_context: {
            teacher_id: tuple.teacher_id,
            domain: processed.domain,
            complexity: processed.complexity
          }
        };
      })
    );
    
    return {
      examples,
      count: examples.length,
      domains: this.extractDomains(examples),
      complexity_distribution: this.analyzeComplexity(examples),
      created_at: new Date()
    };
  }
  
  private groupByTeacher(tuples: TrainingTuple[]): Map<string, TrainingTuple[]> {
    const grouped = new Map<string, TrainingTuple[]>();
    
    for (const tuple of tuples) {
      const teacherId = tuple.teacher_id;
      if (!grouped.has(teacherId)) {
        grouped.set(teacherId, []);
      }
      grouped.get(teacherId)!.push(tuple);
    }
    
    return grouped;
  }
  
  private calculateAverageQuality(examples: any[]): number {
    if (examples.length === 0) return 0;
    
    const totalQuality = examples.reduce(
      (sum, ex) => sum + ex.metadata.quality_score,
      0
    );
    
    return totalQuality / examples.length;
  }
  
  private extractDomains(examples: any[]): string[] {
    const domains = new Set<string>();
    
    for (const example of examples) {
      if (example.teacher_context?.domain) {
        domains.add(example.teacher_context.domain);
      }
    }
    
    return Array.from(domains);
  }
  
  private analyzeComplexity(examples: any[]): ComplexityDistribution {
    const complexityCounts = {
      low: 0,
      medium: 0,
      high: 0
    };
    
    for (const example of examples) {
      const complexity = example.teacher_context?.complexity || 'medium';
      complexityCounts[complexity]++;
    }
    
    return complexityCounts;
  }
}
```

## 5. Enhanced Observability

### 5.1 Hydra-Specific Telemetry

```typescript
// src/telemetry/HydraTelemetry.ts
export class HydraTelemetry {
  private eventEmitter: EventEmitter;
  private metricsCollector: MetricsCollector;
  private traceCollector: TraceCollector;
  
  constructor(opts: HydraTelemetryOpts) {
    this.eventEmitter = opts.eventEmitter;
    this.metricsCollector = new MetricsCollector(opts.metricsConfig);
    this.traceCollector = new TraceCollector(opts.traceConfig);
  }
  
  async trackTeacherExecution(execution: TeacherExecution): Promise<void> {
    // Track execution metrics
    await this.metricsCollector.record('teacher_execution', {
      teacher_id: execution.teacherId,
      execution_time: execution.duration,
      verdict: execution.result.verdict,
      success: execution.success
    });
    
    // Track execution trace
    await this.traceCollector.record('teacher_execution', {
      teacher_id: execution.teacherId,
      inputs: execution.inputs,
      result: execution.result,
      trace: execution.trace
    });
    
    // Emit event
    this.eventEmitter.emit('teacher_execution', execution);
  }
  
  async trackPolicyChange(change: PolicyChange): Promise<void> {
    await this.metricsCollector.record('policy_change', {
      change_id: change.id,
      jurisdiction: change.jurisdiction,
      affected_teachers: change.affectedTeachers?.length || 0
    });
    
    await this.traceCollector.record('policy_change', change);
    
    this.eventEmitter.emit('policy_change', change);
  }
  
  async trackSELLMCreation(creation: SELLMCreation): Promise<void> {
    await this.metricsCollector.record('sellm_creation', {
      teacher_id: creation.teacherId,
      success: creation.success,
      confidence: creation.confidence,
      generation_time: creation.duration
    });
    
    await this.traceCollector.record('sellm_creation', creation);
    
    this.eventEmitter.emit('sellm_creation', creation);
  }
  
  async trackTrainingDataCollection(collection: TrainingDataCollection): Promise<void> {
    await this.metricsCollector.record('training_data_collection', {
      session_id: collection.sessionId,
      teacher_id: collection.teacherId,
      quality_score: collection.qualityScore,
      approved: collection.approved
    });
    
    this.eventEmitter.emit('training_data_collection', collection);
  }
  
  // Generate Hydra-specific dashboards
  async generateDashboards(): Promise<DashboardConfig[]> {
    return [
      {
        name: "Teacher Performance",
        widgets: [
          {
            type: "metric",
            title: "Execution Success Rate",
            query: "teacher_execution.success_rate"
          },
          {
            type: "chart",
            title: "Execution Time Distribution",
            query: "teacher_execution.duration_histogram"
          }
        ]
      },
      {
        name: "Policy Changes",
        widgets: [
          {
            type: "metric",
            title: "Changes Detected",
            query: "policy_change.count"
          },
          {
            type: "chart",
            title: "Affected Teachers",
            query: "policy_change.affected_teachers"
          }
        ]
      },
      {
        name: "SELLM Performance",
        widgets: [
          {
            type: "metric",
            title: "Creation Success Rate",
            query: "sellm_creation.success_rate"
          },
          {
            type: "chart",
            title: "Confidence Distribution",
            query: "sellm_creation.confidence_histogram"
          }
        ]
      }
    ];
  }
}
```

## 6. Configuration Management

### 6.1 Hydra Configuration Schema

```typescript
// src/config/HydraConfig.ts
export interface HydraConfig {
  agents: {
    router: RouterAgentConfig;
    sellm: SELLMAgentConfig;
    watchers: WatcherAgentConfig[];
  };
  registry: TeacherRegistryConfig;
  training: TrainingPipelineConfig;
  telemetry: HydraTelemetryConfig;
  providers: ProviderConfig;
  policies: PolicyConfig;
}

export interface RouterAgentConfig {
  intent_classification: {
    model: string;
    temperature: number;
    max_tokens: number;
  };
  teacher_matching: {
    similarity_threshold: number;
    max_candidates: number;
  };
  fallback_strategy: "llm" | "create_teacher" | "error";
}

export interface SELLMAgentConfig {
  code_generation: {
    model: string;
    temperature: number;
    max_tokens: number;
  };
  test_generation: {
    coverage_threshold: number;
    max_test_cases: number;
  };
  validation: {
    min_pass_rate: number;
    max_retries: number;
  };
}

export interface TeacherRegistryConfig {
  database: {
    connection_string: string;
    pool_size: number;
    timeout_ms: number;
  };
  cache: {
    ttl_seconds: number;
    max_size: number;
    eviction_policy: "lru" | "lfu" | "ttl";
  };
  versioning: {
    strategy: "semver" | "timestamp" | "hash";
    auto_increment: boolean;
  };
}

export interface TrainingPipelineConfig {
  data_collection: {
    enabled: boolean;
    quality_threshold: number;
    approval_required: boolean;
  };
  processing: {
    batch_size: number;
    parallel_workers: number;
    retry_attempts: number;
  };
  export: {
    format: "json" | "parquet" | "csv";
    compression: "gzip" | "lz4" | "none";
    batch_size: number;
  };
}
```

## 7. Migration Utilities

### 7.1 Compatibility Layer

```typescript
// src/compatibility/PythonCompatibility.ts
export class PythonCompatibilityLayer {
  private httpClient: HttpClient;
  
  constructor(opts: CompatibilityOpts) {
    this.httpClient = new HttpClient(opts.baseUrl);
  }
  
  // Maintain compatibility with existing Python services during migration
  async callPythonService(service: string, endpoint: string, data: any): Promise<any> {
    const url = `${this.baseUrl}/${service}/${endpoint}`;
    
    try {
      const response = await this.httpClient.post(url, data);
      return response.data;
    } catch (error) {
      console.error(`Error calling Python service ${service}:`, error);
      throw new Error(`Python service ${service} unavailable: ${error.message}`);
    }
  }
  
  // Gradual migration helper
  async migrateEndpoint(
    endpoint: string,
    newImplementation: () => Promise<any>,
    fallbackToPython: boolean = true
  ): Promise<any> {
    try {
      // Try new implementation first
      return await newImplementation();
    } catch (error) {
      if (fallbackToPython) {
        console.log(`Falling back to Python for ${endpoint}`);
        return await this.callPythonService('legacy', endpoint, {});
      }
      throw error;
    }
  }
}
```

### 7.2 Migration State Manager

```typescript
// src/migration/MigrationStateManager.ts
export class MigrationStateManager {
  private stateStore: StateStore;
  
  constructor(opts: MigrationStateOpts) {
    this.stateStore = new StateStore(opts.database);
  }
  
  async getMigrationState(): Promise<MigrationState> {
    return await this.stateStore.get('migration_state');
  }
  
  async updateMigrationState(updates: Partial<MigrationState>): Promise<void> {
    const current = await this.getMigrationState();
    const updated = { ...current, ...updates };
    await this.stateStore.set('migration_state', updated);
  }
  
  async isServiceMigrated(service: string): Promise<boolean> {
    const state = await this.getMigrationState();
    return state.migrated_services.includes(service);
  }
  
  async markServiceMigrated(service: string): Promise<void> {
    const state = await this.getMigrationState();
    if (!state.migrated_services.includes(service)) {
      state.migrated_services.push(service);
      await this.updateMigrationState(state);
    }
  }
  
  async getTrafficSplit(): Promise<TrafficSplit> {
    const state = await this.getMigrationState();
    return state.traffic_split;
  }
  
  async updateTrafficSplit(split: TrafficSplit): Promise<void> {
    await this.updateMigrationState({ traffic_split: split });
  }
}

export interface MigrationState {
  phase: "planning" | "development" | "testing" | "deployment" | "complete";
  migrated_services: string[];
  traffic_split: TrafficSplit;
  rollback_points: RollbackPoint[];
  created_at: Date;
  updated_at: Date;
}

export interface TrafficSplit {
  new_system_percentage: number;
  old_system_percentage: number;
  routing_strategy: "random" | "user_based" | "feature_flag";
}
```

These customizations make the `feather-agent` framework perfectly suited for Hydra's hybrid neuro-symbolic intelligence platform, providing specialized capabilities while maintaining the framework's core strengths.
