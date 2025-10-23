# Hydra Systems — Complete Platform Migration Plan

## Executive Summary

This document outlines the complete migration strategy for Hydra Systems, transitioning from Python microservices to a unified platform combining Hydra Cloud frontend, Feather Runtime backend, and Hydra Connectors. The migration leverages our control over the agent framework to create specialized capabilities for Hydra's unique requirements while maintaining enterprise-grade security and scalability.

## Unified Platform Architecture

### Complete System Stack

The Hydra Systems platform integrates three layers into a cohesive enterprise solution:

```typescript
// Complete Hydra Systems Platform
interface HydraSystemsPlatform {
  // Frontend Layer - Hydra Cloud
  hydraCloud: {
    visualBuilder: ReactFlowEditor;
    projectManagement: ProjectDashboard;
    connectorRegistry: ConnectorManager;
    auditDashboard: TraceViewer;
    rlEvaluator: ModelComparison;
    collaborationTools: RealTimeCollaboration;
  };
  
  // Backend Layer - Feather Runtime
  featherRuntime: {
    symbolicEngine: JSONLogicInterpreter;
    auditLogger: TraceGenerator;
    jobQueue: RedisQueue;
    sandboxExecutor: DockerContainer;
    deploymentManager: DeploymentManager;
  };
  
  // Integration Layer - Hydra Connectors
  hydraConnectors: {
    restConnectors: RESTAdapter[];
    dbConnectors: DatabaseAdapter[];
    customConnectors: CustomAdapter[];
    connectorGateway: ConnectorGateway;
  };
  
  // Security & Governance Layer
  securityModel: {
    oauth2Auth: OAuth2Provider;
    jwtTokens: JWTManager;
    rbacSystem: RoleBasedAccessControl;
    auditTrail: AuditLogger;
    complianceTools: ComplianceManager;
  };
}
```

### Migration Benefits

#### Immediate Benefits
- **Unified Architecture**: Single TypeScript/JavaScript codebase instead of Python microservices
- **Visual Development**: Drag-and-drop flow builder with real-time execution feedback
- **Better Agent Orchestration**: Native agent-to-agent communication and workflows
- **Enhanced Observability**: Comprehensive telemetry and monitoring built-in
- **Improved Performance**: Intelligent caching, routing, and optimization

#### Long-term Benefits
- **Framework Customization**: Ability to enhance the agent framework for Hydra-specific needs
- **Simplified Deployment**: Single application instead of multiple microservices
- **Better Developer Experience**: TypeScript provides superior type safety and tooling
- **Easier Testing**: Unified testing framework and mocking capabilities
- **Enterprise Readiness**: Built-in security, compliance, and governance features

## Phase 1: Frontend Development & Foundation (Weeks 1-4)

### 1.1 Hydra Cloud Frontend Setup

```typescript
// Frontend Architecture Setup
interface HydraCloudFrontend {
  visualBuilder: {
    reactFlowEditor: ReactFlowEditor;
    nodeTypes: CustomNodeTypes;
    edgeTypes: CustomEdgeTypes;
    realTimeSync: RealTimeSync;
  };
  
  projectManagement: {
    projectDashboard: ProjectDashboard;
    projectStore: ProjectStore;
    versionControl: VersionManager;
    collaborationTools: CollaborationManager;
  };
  
  connectorRegistry: {
    connectorManager: ConnectorManager;
    connectorGateway: ConnectorGatewayClient;
    authManager: AuthManager;
    scopeValidator: ScopeValidator;
  };
  
  auditDashboard: {
    traceViewer: TraceViewer;
    auditLogger: AuditLogger;
    complianceTools: ComplianceManager;
    reportGenerator: ReportGenerator;
  };
}
```

### 1.2 Visual Flow Builder Implementation

```typescript
// src/components/VisualEditor.tsx
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

### 1.3 Project Management Integration

```typescript
// src/services/ProjectManagementService.ts
export class ProjectManagementService {
  private projectStore: ProjectStore;
  private versionManager: VersionManager;
  private collaborationManager: CollaborationManager;
  
  constructor() {
    this.projectStore = new ProjectStore();
    this.versionManager = new VersionManager();
    this.collaborationManager = new CollaborationManager();
  }
  
  // Create new project with scaffolding
  async createProject(projectSpec: ProjectSpec): Promise<Project> {
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
}
```

## Phase 2: Backend Integration & Agent Migration (Weeks 5-8)

Create specialized agent types that understand Hydra's domain:

```typescript
// src/agents/HydraAgent.ts
export abstract class HydraAgent extends Agent {
  protected teacherRegistry: TeacherRegistry;
  protected policyWatcher: PolicyWatcher;
  
  constructor(opts: HydraAgentOpts) {
    super(opts);
    this.teacherRegistry = opts.teacherRegistry;
    this.policyWatcher = opts.policyWatcher;
  }
  
  abstract executeHydraTask(input: HydraTaskInput): Promise<HydraTaskResult>;
}

// src/agents/RouterAgent.ts
export class RouterAgent extends HydraAgent {
  async executeHydraTask(input: HydraTaskInput): Promise<HydraTaskResult> {
    // Intent classification and routing logic
    const intent = await this.classifyIntent(input.query);
    const teacher = await this.findTeacher(intent);
    
    if (teacher) {
      return this.routeToTeacher(teacher, input);
    } else {
      return this.routeToSELLM(input);
    }
  }
  
  private async classifyIntent(query: string): Promise<string> {
    // Enhanced intent classification using agent planning
    const plan = await this.planner({
      sessionId: "intent-classification",
      input: { role: "user", content: `Classify intent: ${query}` },
      context: [],
      iteration: 0
    });
    
    return plan.actions[0]?.intent || "unknown";
  }
}

// src/agents/SELLMAgent.ts
export class SELLMAgent extends HydraAgent {
  async executeHydraTask(input: HydraTaskInput): Promise<HydraTaskResult> {
    // Generate new teacher using agent planning
    const spec = await this.extractTeacherSpec(input);
    const teacher = await this.generateTeacher(spec);
    const tests = await this.generateTests(teacher);
    
    return {
      status: "teacher_generated",
      teacher,
      tests,
      requiresApproval: true
    };
  }
}
```

### 1.2 Teacher Registry Integration

Enhance the framework with native teacher registry support:

```typescript
// src/registry/TeacherRegistry.ts
export class TeacherRegistry {
  private db: Database;
  private cache: Cache;
  
  async getTeacher(teacherId: string, version?: string): Promise<TeacherSpec> {
    const key = version ? `${teacherId}@${version}` : teacherId;
    
    // Check cache first
    let teacher = await this.cache.get(key);
    if (teacher) return teacher;
    
    // Load from database
    teacher = await this.db.query(
      'SELECT * FROM teachers WHERE id = $1 AND version = $2',
      [teacherId, version || 'latest']
    );
    
    // Cache for future use
    await this.cache.set(key, teacher, { ttl: 3600 });
    
    return teacher;
  }
  
  async createTeacher(spec: TeacherSpec): Promise<string> {
    const version = await this.generateVersion(spec);
    const teacherId = `${spec.domain}/${spec.teacher_id}@${version}`;
    
    await this.db.query(
      'INSERT INTO teachers (id, spec, version, created_at) VALUES ($1, $2, $3, $4)',
      [teacherId, JSON.stringify(spec), version, new Date()]
    );
    
    // Invalidate cache
    await this.cache.delete(`${spec.teacher_id}@latest`);
    
    return teacherId;
  }
  
  async updateTeacher(teacherId: string, patch: TeacherPatch): Promise<string> {
    const current = await this.getTeacher(teacherId);
    const updated = this.applyPatch(current, patch);
    return await this.createTeacher(updated);
  }
}

// src/registry/TeacherTool.ts
export function createTeacherTool(registry: TeacherRegistry): Tool {
  return {
    name: "execute_teacher",
    description: "Execute a symbolic teacher with deterministic results",
    execute: async (input: TeacherExecutionInput) => {
      const teacher = await registry.getTeacher(input.teacherId, input.version);
      
      // Validate inputs against teacher schema
      const validatedInputs = validateInputs(input.inputs, teacher.inputs_schema);
      
      // Execute teacher logic
      const result = await executeTeacherLogic(teacher, validatedInputs);
      
      return {
        verdict: result.verdict,
        outputs: result.outputs,
        trace: result.trace,
        teacher_version: teacher.version
      };
    },
    validate: (input: unknown): input is TeacherExecutionInput => {
      return TeacherExecutionInputSchema.safeParse(input).success;
    }
  };
}
```

### 1.3 Policy Watcher Integration

Add specialized policy change detection and handling:

```typescript
// src/watchers/PolicyWatcher.ts
export class PolicyWatcher {
  private watchers: Map<string, WatcherConfig> = new Map();
  private eventEmitter: EventEmitter;
  
  async startWatching(config: WatcherConfig): Promise<void> {
    const watcher = new ExternalWatcher(config);
    watcher.on('change', async (change: PolicyChange) => {
      await this.handlePolicyChange(change);
    });
    
    this.watchers.set(config.id, config);
    await watcher.start();
  }
  
  private async handlePolicyChange(change: PolicyChange): Promise<void> {
    // Find affected teachers
    const affectedTeachers = await this.findAffectedTeachers(change);
    
    // Generate patches for each affected teacher
    for (const teacher of affectedTeachers) {
      const patch = await this.generatePatch(teacher, change);
      const tests = await this.generateCounterfactualTests(teacher, patch);
      
      this.eventEmitter.emit('policy_change', {
        change,
        teacher,
        patch,
        tests,
        requiresApproval: true
      });
    }
  }
  
  private async generatePatch(teacher: TeacherSpec, change: PolicyChange): Promise<TeacherPatch> {
    // Use SELLM agent to generate patch
    const sellmAgent = new SELLMAgent({
      id: "patch-generator",
      planner: createJsonPlanner({
        callModel: async ({ messages }) => {
          const response = await feather.chat({
            provider: "llm",
            model: "gpt-4",
            messages,
            temperature: 0.1
          });
          return response.content;
        },
        tools: [
          { name: "analyze_policy_change", description: "Analyze policy change impact" },
          { name: "generate_patch", description: "Generate teacher patch" }
        ]
      }),
      memory: new PostgreSQLMemoryManager({
        connectionString: process.env.DATABASE_URL!
      }),
      tools: [analyzePolicyChangeTool, generatePatchTool]
    });
    
    const result = await sellmAgent.run({
      sessionId: `patch-${change.id}`,
      input: {
        role: "user",
        content: `Generate patch for teacher ${teacher.teacher_id} based on policy change: ${JSON.stringify(change)}`
      }
    });
    
    return result.output?.patch;
  }
}
```

## Phase 2: Core Service Migration (Weeks 3-4)

### 2.1 Router Service Migration

Replace the current Python router with a TypeScript RouterAgent:

```typescript
// src/services/RouterService.ts
export class RouterService {
  private routerAgent: RouterAgent;
  private feather: Feather;
  
  constructor() {
    this.feather = new Feather({
      providers: {
        llm: openai({ apiKey: process.env.OPENAI_API_KEY! }),
        teachers: createTeacherProvider()
      },
      limits: {
        "llm:gpt-4": { rps: 10, burst: 20 },
        "teachers:*": { rps: 100, burst: 200 }
      }
    });
    
    this.routerAgent = new RouterAgent({
      id: "hydra-router",
      planner: createJsonPlanner({
        callModel: async ({ messages }) => {
          const response = await this.feather.chat({
            provider: "llm",
            model: "gpt-4",
            messages,
            temperature: 0.1
          });
          return response.content;
        },
        tools: [
          { name: "execute_teacher", description: "Execute symbolic teacher" },
          { name: "create_teacher", description: "Generate new teacher" },
          { name: "llm_reasoning", description: "Use LLM for flexible reasoning" }
        ]
      }),
      memory: new PostgreSQLMemoryManager({
        connectionString: process.env.DATABASE_URL!
      }),
      tools: [
        createTeacherTool(this.teacherRegistry),
        createLLMReasoningTool(this.feather),
        createTeacherCreationTool(this.sellmAgent)
      ],
      teacherRegistry: this.teacherRegistry,
      policyWatcher: this.policyWatcher
    });
  }
  
  async route(input: RouteInput): Promise<RouteResult> {
    const result = await this.routerAgent.run({
      sessionId: input.sessionId || generateSessionId(),
      input: {
        role: "user",
        content: input.query
      },
      metadata: input.metadata
    });
    
    return {
      routing_decision: result.output?.routing_decision,
      teacher_id: result.output?.teacher_id,
      normalized_input: result.output?.normalized_input,
      result: result.output?.result,
      explanation: result.output?.explanation
    };
  }
}
```

### 2.2 Teacher Service Migration

Convert Python teachers to TypeScript tools:

```typescript
// src/teachers/DSCRTeacher.ts
export class DSCRTeacher implements Teacher {
  readonly id = "loan_dscr_v1";
  readonly version = "1.0.0";
  readonly domain = "underwriting";
  
  async execute(inputs: DSCRInputs): Promise<DSCRResult> {
    // Deterministic DSCR calculation
    const dscr = inputs.noi / inputs.annual_debt_service;
    
    const trace: Trace[] = [];
    const verdict = dscr >= 1.20 ? "PASS" : "FAIL";
    
    trace.push({
      rule_id: "DSCR_MIN_1_20",
      passed: verdict === "PASS",
      threshold: 1.20,
      value: dscr,
      explanation: `Debt service coverage ratio is ${dscr.toFixed(2)}, ${verdict === "PASS" ? "meets" : "below"} required minimum of 1.20`
    });
    
    return {
      verdict,
      outputs: { dscr },
      trace,
      effective_version: this.version
    };
  }
  
  validate(inputs: unknown): inputs is DSCRInputs {
    return DSCRInputsSchema.safeParse(inputs).success;
  }
}

// src/teachers/TransferTaxTeacher.ts
export class TransferTaxTeacher implements Teacher {
  readonly id = "transfer_tax_v1";
  readonly version = "1.0.0";
  readonly domain = "tax";
  
  async execute(inputs: TransferTaxInputs): Promise<TransferTaxResult> {
    const rate = inputs.rate_pct / 100.0;
    const transfer_tax = inputs.sale_price * rate;
    
    const trace: Trace[] = [];
    const verdict = transfer_tax >= 0 ? "PASS" : "FAIL";
    
    trace.push({
      rule_id: "TAX_NON_NEGATIVE",
      passed: verdict === "PASS",
      threshold: 0,
      value: transfer_tax,
      explanation: `Transfer tax calculation: $${inputs.sale_price.toLocaleString()} × ${inputs.rate_pct}% = $${transfer_tax.toLocaleString()}`
    });
    
    return {
      verdict,
      outputs: { transfer_tax, rate },
      trace,
      effective_version: this.version
    };
  }
  
  validate(inputs: unknown): inputs is TransferTaxInputs {
    return TransferTaxInputsSchema.safeParse(inputs).success;
  }
}
```

### 2.3 SELLM Service Migration

Convert the Python SELLM to a TypeScript SELLMAgent:

```typescript
// src/services/SELLMService.ts
export class SELLMService {
  private sellmAgent: SELLMAgent;
  private teacherRegistry: TeacherRegistry;
  
  constructor(teacherRegistry: TeacherRegistry) {
    this.teacherRegistry = teacherRegistry;
    
    this.sellmAgent = new SELLMAgent({
      id: "symbolic-engineer",
      planner: createJsonPlanner({
        callModel: async ({ messages }) => {
          const response = await feather.chat({
            provider: "llm",
            model: "gpt-4",
            messages,
            temperature: 0.1
          });
          return response.content;
        },
        tools: [
          { name: "analyze_requirement", description: "Analyze teacher requirement" },
          { name: "generate_teacher_spec", description: "Generate teacher specification" },
          { name: "generate_teacher_code", description: "Generate teacher implementation" },
          { name: "generate_tests", description: "Generate test cases" },
          { name: "validate_teacher", description: "Validate teacher logic" }
        ]
      }),
      memory: new PostgreSQLMemoryManager({
        connectionString: process.env.DATABASE_URL!
      }),
      tools: [
        createAnalyzeRequirementTool(),
        createGenerateTeacherSpecTool(),
        createGenerateTeacherCodeTool(),
        createGenerateTestsTool(),
        createValidateTeacherTool()
      ],
      teacherRegistry,
      policyWatcher: new PolicyWatcher()
    });
  }
  
  async createTeacher(requirement: TeacherRequirement): Promise<TeacherCreationResult> {
    const result = await this.sellmAgent.run({
      sessionId: `teacher-creation-${Date.now()}`,
      input: {
        role: "user",
        content: `Create a new teacher for: ${JSON.stringify(requirement)}`
      }
    });
    
    if (result.status === "completed" && result.output) {
      const teacherSpec = result.output.teacher_spec;
      const tests = result.output.tests;
      
      // Validate the generated teacher
      const validation = await this.validateTeacher(teacherSpec, tests);
      
      if (validation.valid) {
        // Store in registry
        const teacherId = await this.teacherRegistry.createTeacher(teacherSpec);
        
        return {
          status: "success",
          teacher_id: teacherId,
          teacher_spec: teacherSpec,
          tests,
          confidence: result.output.confidence,
          requiresApproval: true
        };
      } else {
        return {
          status: "validation_failed",
          errors: validation.errors,
          teacher_spec: teacherSpec,
          tests
        };
      }
    }
    
    return {
      status: "failed",
      error: result.error?.message
    };
  }
  
  private async validateTeacher(spec: TeacherSpec, tests: TestCase[]): Promise<ValidationResult> {
    // Run generated tests against the teacher
    const teacher = this.createTeacherFromSpec(spec);
    const results = await Promise.all(
      tests.map(async (test) => {
        try {
          const result = await teacher.execute(test.inputs);
          return {
            test_id: test.id,
            passed: result.verdict === test.expected_verdict,
            actual: result,
            expected: test.expected_result
          };
        } catch (error) {
          return {
            test_id: test.id,
            passed: false,
            error: error.message
          };
        }
      })
    );
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    return {
      valid: passed / total >= 0.9, // 90% pass rate required
      pass_rate: passed / total,
      test_results: results,
      errors: results.filter(r => !r.passed).map(r => r.error).filter(Boolean)
    };
  }
}
```

## Phase 3: Advanced Features & Integration (Weeks 5-6)

### 3.1 Policy Watcher Service Migration

```typescript
// src/services/WatcherService.ts
export class WatcherService {
  private policyWatcher: PolicyWatcher;
  private sellmAgent: SELLMAgent;
  private teacherRegistry: TeacherRegistry;
  
  constructor(teacherRegistry: TeacherRegistry, sellmAgent: SELLMAgent) {
    this.teacherRegistry = teacherRegistry;
    this.sellmAgent = sellmAgent;
    this.policyWatcher = new PolicyWatcher();
  }
  
  async startWatching(): Promise<void> {
    // Start watching for policy changes
    await this.policyWatcher.startWatching({
      id: "ca-real-estate-laws",
      source: "https://leginfo.legislature.ca.gov/",
      frequency: "daily",
      parser: "real-estate-law-parser"
    });
    
    await this.policyWatcher.startWatching({
      id: "federal-tax-changes",
      source: "https://www.irs.gov/newsroom",
      frequency: "weekly",
      parser: "tax-law-parser"
    });
    
    // Listen for policy change events
    this.policyWatcher.on('policy_change', async (event) => {
      await this.handlePolicyChange(event);
    });
  }
  
  private async handlePolicyChange(event: PolicyChangeEvent): Promise<void> {
    const { change, teacher, patch, tests } = event;
    
    // Generate counterfactual tests
    const counterfactuals = await this.generateCounterfactualTests(teacher, patch);
    
    // Run regression tests
    const regressionResults = await this.runRegressionTests(teacher, patch);
    
    // Create change report
    const changeReport = {
      policy_change: change,
      affected_teacher: teacher,
      proposed_patch: patch,
      test_results: {
        unit_tests: tests,
        counterfactual_tests: counterfactuals,
        regression_tests: regressionResults
      },
      impact_analysis: await this.analyzeImpact(teacher, patch),
      requiresApproval: true
    };
    
    // Store for human review
    await this.storeChangeReport(changeReport);
    
    // Notify reviewers
    await this.notifyReviewers(changeReport);
  }
  
  private async generateCounterfactualTests(teacher: TeacherSpec, patch: TeacherPatch): Promise<CounterfactualTest[]> {
    // Use SELLM to generate counterfactual tests
    const result = await this.sellmAgent.run({
      sessionId: `counterfactual-${Date.now()}`,
      input: {
        role: "user",
        content: `Generate counterfactual tests for teacher ${teacher.teacher_id} with patch: ${JSON.stringify(patch)}`
      }
    });
    
    return result.output?.counterfactual_tests || [];
  }
}
```

### 3.2 Training Pipeline Integration

```typescript
// src/training/TrainingPipeline.ts
export class TrainingPipeline {
  private feather: Feather;
  private teacherRegistry: TeacherRegistry;
  private trainingDataStore: TrainingDataStore;
  
  constructor(teacherRegistry: TeacherRegistry) {
    this.teacherRegistry = teacherRegistry;
    this.trainingDataStore = new TrainingDataStore();
    
    this.feather = new Feather({
      providers: {
        llm: openai({ apiKey: process.env.OPENAI_API_KEY! }),
        teachers: createTeacherProvider()
      }
    });
  }
  
  async collectTrainingData(sessionId: string, input: string): Promise<void> {
    // Get the conversation context
    const context = await this.getConversationContext(sessionId);
    
    // Run through router to get symbolic output
    const routerResult = await this.runRouter(input, context);
    
    // Run through LLM for comparison
    const llmResult = await this.feather.chat({
      provider: "llm",
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: input }
      ]
    });
    
    // Generate explanation
    const explanation = await this.generateExplanation(routerResult);
    
    // Store training tuple
    const trainingTuple: TrainingTuple = {
      input_text: input,
      normalized_inputs: routerResult.normalized_input,
      teacher_id: routerResult.teacher_id,
      teacher_version: routerResult.result?.effective_version,
      symbolic_output: routerResult.result,
      llm_output: llmResult.content,
      explanation_output: explanation,
      label_type: "positive",
      approved_for_training: true,
      timestamp: new Date()
    };
    
    await this.trainingDataStore.store(trainingTuple);
  }
  
  async generateTrainingDataset(): Promise<TrainingDataset> {
    const tuples = await this.trainingDataStore.getApprovedTuples();
    
    // Group by teacher for specialized training
    const groupedTuples = this.groupByTeacher(tuples);
    
    const datasets: TrainingDataset[] = [];
    
    for (const [teacherId, teacherTuples] of groupedTuples) {
      const dataset = await this.createDatasetForTeacher(teacherId, teacherTuples);
      datasets.push(dataset);
    }
    
    return {
      datasets,
      total_tuples: tuples.length,
      generated_at: new Date()
    };
  }
  
  private async createDatasetForTeacher(teacherId: string, tuples: TrainingTuple[]): Promise<TeacherTrainingDataset> {
    // Convert tuples to training format
    const trainingExamples = tuples.map(tuple => ({
      input: tuple.input_text,
      target: tuple.symbolic_output,
      explanation: tuple.explanation_output
    }));
    
    return {
      teacher_id: teacherId,
      examples: trainingExamples,
      count: trainingExamples.length,
      created_at: new Date()
    };
  }
}
```

## Phase 4: Production Deployment & Optimization (Weeks 7-8)

### 4.1 Unified Application Architecture

```typescript
// src/app.ts
export class HydraApplication {
  private routerService: RouterService;
  private sellmService: SELLMService;
  private watcherService: WatcherService;
  private trainingPipeline: TrainingPipeline;
  private teacherRegistry: TeacherRegistry;
  private feather: Feather;
  
  constructor() {
    this.teacherRegistry = new TeacherRegistry();
    this.feather = new Feather({
      providers: {
        llm: openai({ apiKey: process.env.OPENAI_API_KEY! }),
        teachers: createTeacherProvider()
      },
      limits: {
        "llm:gpt-4": { rps: 10, burst: 20 },
        "teachers:*": { rps: 100, burst: 200 }
      },
      middleware: [
        createPromptCacheMiddleware({
          cache: new PromptCache({ ttlMs: 3600000 })
        }),
        createToolCacheMiddleware({
          cache: new ToolCache({ ttlMs: 1800000 })
        }),
        createTelemetryMiddleware({
          onEvent: (event) => this.handleTelemetryEvent(event)
        })
      ]
    });
    
    this.sellmService = new SELLMService(this.teacherRegistry);
    this.routerService = new RouterService(this.teacherRegistry, this.sellmService);
    this.watcherService = new WatcherService(this.teacherRegistry, this.sellmService);
    this.trainingPipeline = new TrainingPipeline(this.teacherRegistry);
  }
  
  async start(): Promise<void> {
    // Initialize database
    await this.initializeDatabase();
    
    // Start policy watchers
    await this.watcherService.startWatching();
    
    // Start HTTP server
    await this.startHttpServer();
    
    console.log("Hydra application started successfully");
  }
  
  private async startHttpServer(): Promise<void> {
    const app = express();
    
    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
    
    // Router endpoint
    app.post('/api/route', async (req, res) => {
      try {
        const result = await this.routerService.route(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // SELLM endpoint
    app.post('/api/create-teacher', async (req, res) => {
      try {
        const result = await this.sellmService.createTeacher(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Training data collection
    app.post('/api/collect-training', async (req, res) => {
      try {
        await this.trainingPipeline.collectTrainingData(req.body.sessionId, req.body.input);
        res.json({ status: 'success' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Hydra server listening on port ${port}`);
    });
  }
}
```

### 4.2 Docker & Kubernetes Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/feather.config.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S hydra -u 1001
USER hydra

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/app.js"]
```

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hydra-agent
  namespace: hydra
spec:
  replicas: 3
  selector:
    matchLabels:
      app: hydra-agent
  template:
    metadata:
      labels:
        app: hydra-agent
    spec:
      containers:
      - name: hydra-app
        image: hydra-agent:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: hydra-secrets
              key: DATABASE_URL
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: hydra-secrets
              key: OPENAI_API_KEY
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Testing Strategy

### Unit Tests
```typescript
// tests/agents/RouterAgent.test.ts
describe('RouterAgent', () => {
  it('should route to existing teacher', async () => {
    const routerAgent = new RouterAgent({
      id: "test-router",
      planner: createMockPlanner(),
      memory: new InMemoryMemoryManager(),
      tools: [createMockTeacherTool()],
      teacherRegistry: createMockRegistry()
    });
    
    const result = await routerAgent.run({
      sessionId: "test-session",
      input: { role: "user", content: "Calculate DSCR for NOI $120k, debt service $100k" }
    });
    
    expect(result.status).toBe("completed");
    expect(result.output?.teacher_id).toBe("loan_dscr_v1");
  });
});
```

### Integration Tests
```typescript
// tests/integration/HydraApplication.test.ts
describe('HydraApplication Integration', () => {
  it('should handle complete workflow', async () => {
    const app = new HydraApplication();
    await app.start();
    
    // Test router
    const routerResponse = await fetch('http://localhost:3000/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: "Does this loan meet policy?",
        metadata: { jurisdiction: "CA" }
      })
    });
    
    expect(routerResponse.status).toBe(200);
    const routerResult = await routerResponse.json();
    expect(routerResult.routing_decision).toBe("symbolic");
  });
});
```

## Migration Timeline

### Week 1-2: Framework Enhancement
- [ ] Create HydraAgent base class
- [ ] Implement TeacherRegistry
- [ ] Add PolicyWatcher integration
- [ ] Create specialized agent types

### Week 3-4: Core Service Migration
- [ ] Migrate Router service to RouterAgent
- [ ] Convert Python teachers to TypeScript tools
- [ ] Migrate SELLM service to SELLMAgent
- [ ] Implement teacher execution pipeline

### Week 5-6: Advanced Features
- [ ] Migrate Policy Watcher service
- [ ] Implement training pipeline
- [ ] Add comprehensive observability
- [ ] Create change management system

### Week 7-8: Production Deployment
- [ ] Create unified application
- [ ] Implement Docker/Kubernetes configs
- [ ] Add comprehensive testing
- [ ] Performance optimization

## Risk Mitigation

### Parallel Running Strategy
- Keep existing Python services running during migration
- Implement feature flags to switch between old and new implementations
- Gradual traffic migration (10% → 50% → 100%)

### Rollback Plan
- Maintain Python services as backup
- Database compatibility layer
- Automated rollback triggers based on error rates

### Testing Strategy
- Comprehensive unit test coverage (>90%)
- Integration tests for all workflows
- Load testing for performance validation
- A/B testing for accuracy comparison

## Success Metrics

### Performance Metrics
- Response time: < 100ms for teacher execution
- Throughput: > 1000 requests/second
- Error rate: < 0.1%
- Cache hit rate: > 80%

### Functional Metrics
- Teacher accuracy: > 99% (same as current)
- SELLM success rate: > 95%
- Policy change detection: < 24 hours
- Training data quality: > 95% approved

### Operational Metrics
- Deployment time: < 5 minutes
- Rollback time: < 2 minutes
- Monitoring coverage: 100%
- Alert response time: < 5 minutes

This migration plan leverages your control over the feather-agent framework to create a specialized solution for Hydra's unique requirements while maintaining all existing functionality and improving performance, maintainability, and scalability.
