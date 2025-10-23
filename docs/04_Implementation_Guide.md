# Hydra Systems — Complete Implementation Guide

## Phase-by-Phase Implementation Strategy

This comprehensive implementation guide covers the complete Hydra Systems platform, including Hydra Cloud frontend, Feather Runtime backend, and Hydra Connectors integration. The implementation follows a phased approach that builds from foundation to full enterprise deployment.

## Complete System Overview

### Platform Components

The Hydra Systems platform consists of three integrated layers:

1. **Hydra Cloud** — SaaS control plane and visual builder (Next.js + ReactFlow)
2. **Feather Runtime** — Customer-side execution engine (Node.js / Docker) 
3. **Hydra Connectors** — Secure adapters for APIs, databases, and systems

### Implementation Phases

```typescript
// Implementation Phase Overview
interface ImplementationPhases {
  phase0: "Foundation Setup";           // Weeks 1-3
  phase1: "Frontend Development";       // Weeks 4-8  
  phase2: "Backend Integration";        // Weeks 9-14
  phase3: "Advanced Features";          // Weeks 15-20
  phase4: "Production Deployment";     // Weeks 21-28
}
```

#### 1.1 Enhanced Feather-Agent Setup
```bash
# Initialize enhanced feather-agent project
mkdir hydra-feather-agent
cd hydra-feather-agent
npm init -y
npm install feather-agent

# Install additional dependencies
npm install @types/node typescript ts-node
npm install zod pg redis ioredis
npm install express @types/express
npm install vitest @types/vitest
```

#### 1.2 Core Hydra Types
```typescript
// src/types/HydraTypes.ts
export interface TeacherSpec {
  teacher_id: string;
  domain: string;
  type: "rules" | "calculation" | "validation";
  inputs_schema: Record<string, SchemaField>;
  computed?: Record<string, string>;
  rules?: Rule[];
  explanation_fields: string[];
  jurisdictions: string[];
  effective_date: string;
  metadata?: Record<string, any>;
}

export interface TeacherExecutionInput {
  teacher_id: string;
  version?: string;
  inputs: Record<string, any>;
}

export interface TeacherResult {
  verdict: "PASS" | "FAIL" | "ERROR";
  outputs: Record<string, any>;
  trace: Trace[];
  effective_version: string;
}

export interface PolicyChange {
  id: string;
  jurisdiction: string;
  changes: ParameterChange[];
  confidence: number;
  sources: string[];
  effective_date: string;
}
```

#### 1.3 Database Schema Migration
```sql
-- Create teachers table
CREATE TABLE teachers (
  id VARCHAR(255) PRIMARY KEY,
  spec JSONB NOT NULL,
  version VARCHAR(50) NOT NULL,
  domain VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create policy_changes table
CREATE TABLE policy_changes (
  id VARCHAR(255) PRIMARY KEY,
  jurisdiction VARCHAR(100) NOT NULL,
  changes JSONB NOT NULL,
  confidence DECIMAL(3,2),
  sources JSONB,
  effective_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create training_tuples table
CREATE TABLE training_tuples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_text TEXT NOT NULL,
  normalized_inputs JSONB,
  teacher_id VARCHAR(255),
  teacher_version VARCHAR(50),
  symbolic_output JSONB,
  llm_output TEXT,
  explanation_output TEXT,
  label_type VARCHAR(50),
  approved_for_training BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Phase 1: Frontend Development (Weeks 4-8)

#### 1.1 Hydra Cloud Setup

```bash
# Initialize Hydra Cloud frontend
mkdir hydra-cloud
cd hydra-cloud
npx create-next-app@latest . --typescript --tailwind --eslint
npm install @reactflow/core @reactflow/node-toolbar @reactflow/controls
npm install zustand react-hook-form @hookform/resolvers zod
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install lucide-react clsx tailwind-merge
```

#### 1.2 Visual Flow Builder Implementation

```typescript
// src/components/VisualEditor.tsx
import ReactFlow, { 
  Node, 
  Edge, 
  useNodesState, 
  useEdgesState,
  Background,
  Controls,
  MiniMap
} from '@reactflow/core';

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
  
  // Generate visual flow from service response
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

#### 1.3 Project Management Dashboard

```typescript
// src/components/ProjectDashboard.tsx
export const ProjectDashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // Create new project
  const createProject = async (projectSpec: ProjectSpec) => {
    const project = await projectService.createProject(projectSpec);
    setProjects(prev => [...prev, project]);
    setSelectedProject(project);
  };
  
  // Deploy project to Feather Runtime
  const deployProject = async (projectId: string, environment: string) => {
    const deploymentResult = await projectService.deployProject(projectId, environment);
    // Update project status
    setProjects(prev => prev.map(p => 
      p.id === projectId 
        ? { ...p, status: 'deployed', deployment: deploymentResult }
        : p
    ));
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Project List */}
      <div className="lg:col-span-1">
        <ProjectList 
          projects={projects}
          onSelect={setSelectedProject}
          onCreate={createProject}
        />
      </div>
      
      {/* Project Details */}
      <div className="lg:col-span-2">
        {selectedProject ? (
          <ProjectDetails 
            project={selectedProject}
            onDeploy={deployProject}
          />
        ) : (
          <ProjectWelcome onCreate={createProject} />
        )}
      </div>
    </div>
  );
};
```

#### 1.4 Connector Registry Interface

```typescript
// src/components/ConnectorRegistry.tsx
export const ConnectorRegistry: React.FC = () => {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Register new connector
  const registerConnector = async (connectorSpec: ConnectorSpec) => {
    setIsRegistering(true);
    try {
      const connector = await connectorService.registerConnector(connectorSpec);
      setConnectors(prev => [...prev, connector]);
    } catch (error) {
      console.error('Failed to register connector:', error);
    } finally {
      setIsRegistering(false);
    }
  };
  
  // Test connector connection
  const testConnector = async (connectorId: string) => {
    const result = await connectorService.testConnection(connectorId);
    // Update connector status
    setConnectors(prev => prev.map(c => 
      c.id === connectorId 
        ? { ...c, status: result.success ? 'connected' : 'error', lastTest: result }
        : c
    ));
  };
  
  return (
    <div className="space-y-6">
      <ConnectorHeader onRegister={registerConnector} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {connectors.map(connector => (
          <ConnectorCard 
            key={connector.id}
            connector={connector}
            onTest={() => testConnector(connector.id)}
            onEdit={() => editConnector(connector)}
            onDelete={() => deleteConnector(connector.id)}
          />
        ))}
      </div>
      
      {isRegistering && <ConnectorRegistrationModal />}
    </div>
  );
};
```

### Phase 2: Backend Integration (Weeks 9-14)

#### 2.1 RouterAgent Implementation
```typescript
// src/agents/RouterAgent.ts
export class RouterAgent extends HydraAgent {
  async executeHydraTask(input: HydraTaskInput): Promise<HydraTaskResult> {
    // Intent classification using agent planning
    const intent = await this.classifyIntent(input.query);
    
    // Find matching teacher
    const teacher = await this.findTeacher(intent, input.metadata);
    
    if (teacher) {
      return await this.routeToTeacher(teacher, input);
    } else {
      return await this.routeToSELLM(intent, input);
    }
  }
  
  private async classifyIntent(query: string): Promise<string> {
    const plan = await this.planner({
      sessionId: "intent-classification",
      input: { role: "user", content: `Classify: ${query}` },
      context: [],
      iteration: 0
    });
    
    return plan.actions[0]?.intent || "unknown";
  }
}
```

#### 2.2 Teacher Tools Implementation
```typescript
// src/tools/TeacherTools.ts
export function createDSCRTeacherTool(): Tool {
  return {
    name: "dscr_calculator",
    description: "Calculate Debt Service Coverage Ratio",
    execute: async (input: DSCRInputs) => {
      const dscr = input.noi / input.annual_debt_service;
      const verdict = dscr >= 1.20 ? "PASS" : "FAIL";
      
      return {
        verdict,
        outputs: { dscr },
        trace: [{
          rule_id: "DSCR_MIN_1_20",
          passed: verdict === "PASS",
          threshold: 1.20,
          value: dscr
        }]
      };
    }
  };
}
```

### Phase 3: Advanced Features (Week 5-6)

#### 3.1 SELLM Agent Implementation
```typescript
// src/agents/SELLMAgent.ts
export class SELLMAgent extends HydraAgent {
  async executeHydraTask(input: HydraTaskInput): Promise<HydraTaskResult> {
    const { teacher_spec } = input.metadata;
    
    // Generate teacher implementation
    const implementation = await this.generateTeacherCode(teacher_spec);
    
    // Generate tests
    const tests = await this.generateTests(teacher_spec, implementation);
    
    // Validate
    const validation = await this.validateTeacher(implementation, tests);
    
    if (validation.valid) {
      const teacherId = await this.teacherRegistry.createTeacher({
        ...teacher_spec,
        implementation,
        tests
      });
      
      return {
        status: "teacher_created",
        teacher_id: teacherId,
        confidence: validation.confidence
      };
    }
    
    return {
      status: "validation_failed",
      errors: validation.errors
    };
  }
}
```

#### 3.2 Policy Watcher Implementation
```typescript
// src/watchers/PolicyWatcher.ts
export class PolicyWatcher {
  async startWatching(): Promise<void> {
    // Start external watchers
    await this.startExternalWatchers();
    
    // Listen for changes
    this.on('policy_change', async (change) => {
      await this.handlePolicyChange(change);
    });
  }
  
  private async handlePolicyChange(change: PolicyChange): Promise<void> {
    // Find affected teachers
    const affectedTeachers = await this.findAffectedTeachers(change);
    
    // Generate patches
    for (const teacher of affectedTeachers) {
      const patch = await this.generatePatch(teacher, change);
      await this.createChangeReport(teacher, change, patch);
    }
  }
}
```

### Phase 4: Production Deployment (Week 7-8)

#### 4.1 Unified Application
```typescript
// src/app.ts
export class HydraApplication {
  private routerAgent: RouterAgent;
  private sellmAgent: SELLMAgent;
  private policyWatcher: PolicyWatcher;
  
  async start(): Promise<void> {
    // Initialize agents
    this.routerAgent = new RouterAgent({
      id: "hydra-router",
      planner: createJsonPlanner({ /* config */ }),
      memory: new PostgreSQLMemoryManager({ /* config */ }),
      tools: [createDSCRTeacherTool(), createTransferTaxTool()],
      teacherRegistry: this.teacherRegistry
    });
    
    // Start services
    await this.policyWatcher.startWatching();
    await this.startHttpServer();
  }
}
```

#### 4.2 Docker Configuration
```dockerfile
FROM node:18-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/app.js"]
```

## Testing Strategy

### Unit Tests
```typescript
// tests/agents/RouterAgent.test.ts
describe('RouterAgent', () => {
  it('should route to DSCR teacher', async () => {
    const agent = new RouterAgent({ /* config */ });
    const result = await agent.executeHydraTask({
      query: "Calculate DSCR for NOI $120k",
      metadata: {}
    });
    
    expect(result.routing_decision).toBe("symbolic");
    expect(result.teacher_id).toBe("loan_dscr_v1");
  });
});
```

### Integration Tests
```typescript
// tests/integration/HydraApp.test.ts
describe('Hydra Application', () => {
  it('should handle complete workflow', async () => {
    const app = new HydraApplication();
    await app.start();
    
    const response = await fetch('/api/route', {
      method: 'POST',
      body: JSON.stringify({
        query: "Does this loan meet policy?",
        metadata: { jurisdiction: "CA" }
      })
    });
    
    expect(response.status).toBe(200);
  });
});
```

## Migration Checklist

### Week 1-2: Foundation
- [ ] Set up enhanced feather-agent project
- [ ] Create Hydra-specific types and interfaces
- [ ] Set up database schema
- [ ] Implement TeacherRegistry
- [ ] Create basic agent structure

### Week 3-4: Core Implementation
- [ ] Implement RouterAgent
- [ ] Convert Python teachers to TypeScript tools
- [ ] Implement SELLMAgent
- [ ] Create teacher execution pipeline
- [ ] Add comprehensive testing

### Week 5-6: Advanced Features
- [ ] Implement PolicyWatcher
- [ ] Add training pipeline
- [ ] Implement observability
- [ ] Create change management system
- [ ] Add performance optimizations

### Week 7-8: Production
- [ ] Create unified application
- [ ] Set up Docker/Kubernetes
- [ ] Implement monitoring and alerting
- [ ] Performance testing and optimization
- [ ] Production deployment

## Risk Mitigation

### Parallel Running
- Keep Python services running during migration
- Use feature flags to control traffic routing
- Gradual migration: 10% → 50% → 100%

### Rollback Strategy
- Maintain Python services as backup
- Database compatibility layer
- Automated rollback triggers

### Success Metrics
- Response time: < 100ms
- Error rate: < 0.1%
- Teacher accuracy: > 99%
- Cache hit rate: > 80%

This implementation plan provides a clear roadmap for migrating Hydra to the enhanced feather-agent framework while maintaining all existing functionality and improving performance.
