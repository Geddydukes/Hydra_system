# Hydra Systems — Comprehensive Testing Strategy

## Overview

This document outlines a comprehensive testing strategy for the complete Hydra Systems platform, including Hydra Cloud frontend, Feather Runtime backend, and Hydra Connectors integration. The testing strategy ensures reliability, accuracy, and performance across all platform components while maintaining enterprise-grade quality standards.

## Complete Platform Testing Architecture

### Testing Pyramid Structure

The Hydra Systems platform testing follows a comprehensive pyramid structure covering all layers:

```typescript
// Complete Testing Architecture
interface HydraTestingArchitecture {
  // Frontend Testing (40% of test coverage)
  frontendTesting: {
    unitTests: ComponentTests;
    integrationTests: ServiceIntegrationTests;
    e2eTests: UserWorkflowTests;
    visualTests: VisualRegressionTests;
  };
  
  // Backend Testing (35% of test coverage)
  backendTesting: {
    unitTests: AgentTests;
    integrationTests: ServiceIntegrationTests;
    e2eTests: WorkflowTests;
    performanceTests: LoadTests;
  };
  
  // Connector Testing (15% of test coverage)
  connectorTesting: {
    unitTests: ConnectorTests;
    integrationTests: GatewayTests;
    e2eTests: DataFlowTests;
  };
  
  // Platform Integration Testing (10% of test coverage)
  platformTesting: {
    integrationTests: CrossLayerTests;
    e2eTests: CompleteWorkflowTests;
    performanceTests: SystemLoadTests;
  };
}
```

### Frontend Testing Strategy

#### 1.1 React Component Testing

```typescript
// tests/frontend/components/VisualEditor.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HydraVisualEditor } from '../../../src/components/VisualEditor';
import { mockTeacherSpec, mockServiceResponse } from '../../fixtures/mockData';

describe('HydraVisualEditor', () => {
  let mockOnNodeClick: jest.Mock;
  let mockOnFlowChange: jest.Mock;
  
  beforeEach(() => {
    mockOnNodeClick = jest.fn();
    mockOnFlowChange = jest.fn();
  });
  
  describe('Visual Flow Generation', () => {
    it('should generate visual flow from service response', async () => {
      render(
        <HydraVisualEditor 
          onNodeClick={mockOnNodeClick}
          onFlowChange={mockOnFlowChange}
        />
      );
      
      // Simulate service response
      const serviceResponse = mockServiceResponse({
        teacher_id: 'loan_dscr_v1',
        result: { verdict: 'PASS', outputs: { dscr: 1.2 } }
      });
      
      // Generate flow from response
      await waitFor(() => {
        fireEvent.click(screen.getByTestId('generate-flow-button'));
      });
      
      // Verify nodes are created
      expect(screen.getByTestId('node-input')).toBeInTheDocument();
      expect(screen.getByTestId('node-teacher')).toBeInTheDocument();
      expect(screen.getByTestId('node-result')).toBeInTheDocument();
      
      // Verify edges are created
      expect(screen.getByTestId('edge-input-to-teacher')).toBeInTheDocument();
      expect(screen.getByTestId('edge-teacher-to-result')).toBeInTheDocument();
    });
    
    it('should handle teacher node interactions', async () => {
      render(<HydraVisualEditor onNodeClick={mockOnNodeClick} />);
      
      // Click on teacher node
      const teacherNode = screen.getByTestId('node-teacher');
      fireEvent.click(teacherNode);
      
      // Verify node details panel opens
      expect(screen.getByTestId('node-details-panel')).toBeInTheDocument();
      expect(mockOnNodeClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'loan_dscr_v1',
          type: 'teacherNode'
        })
      );
    });
    
    it('should update node status during execution', async () => {
      render(<HydraVisualEditor />);
      
      // Start execution
      fireEvent.click(screen.getByTestId('execute-flow-button'));
      
      // Verify node status updates
      await waitFor(() => {
        expect(screen.getByTestId('node-teacher')).toHaveClass('executing');
      });
      
      // Complete execution
      await waitFor(() => {
        expect(screen.getByTestId('node-teacher')).toHaveClass('completed');
      });
    });
  });
  
  describe('Real-time Collaboration', () => {
    it('should sync changes across multiple users', async () => {
      const { rerender } = render(<HydraVisualEditor />);
      
      // Simulate user 1 making changes
      fireEvent.click(screen.getByTestId('add-node-button'));
      
      // Simulate user 2 receiving changes
      rerender(<HydraVisualEditor />);
      
      // Verify changes are reflected
      expect(screen.getByTestId('node-new')).toBeInTheDocument();
    });
  });
});
```

#### 1.2 Project Management Testing

```typescript
// tests/frontend/components/ProjectDashboard.test.tsx
describe('ProjectDashboard', () => {
  let mockProjectService: jest.Mocked<ProjectService>;
  
  beforeEach(() => {
    mockProjectService = {
      createProject: jest.fn(),
      getProjects: jest.fn(),
      deployProject: jest.fn(),
      updateProject: jest.fn()
    };
  });
  
  describe('Project Creation', () => {
    it('should create new project with scaffolding', async () => {
      const projectSpec = {
        name: 'Test Project',
        description: 'Test Description',
        domain: 'finance'
      };
      
      mockProjectService.createProject.mockResolvedValue({
        id: 'test-project-id',
        ...projectSpec,
        status: 'active',
        created_at: new Date()
      });
      
      render(<ProjectDashboard projectService={mockProjectService} />);
      
      // Fill project creation form
      fireEvent.change(screen.getByLabelText('Project Name'), {
        target: { value: projectSpec.name }
      });
      fireEvent.change(screen.getByLabelText('Description'), {
        target: { value: projectSpec.description }
      });
      fireEvent.change(screen.getByLabelText('Domain'), {
        target: { value: projectSpec.domain }
      });
      
      // Submit form
      fireEvent.click(screen.getByTestId('create-project-button'));
      
      // Verify project creation
      await waitFor(() => {
        expect(mockProjectService.createProject).toHaveBeenCalledWith(projectSpec);
      });
      
      // Verify project appears in list
      expect(screen.getByText(projectSpec.name)).toBeInTheDocument();
    });
  });
  
  describe('Project Deployment', () => {
    it('should deploy project to Feather Runtime', async () => {
      const project = {
        id: 'test-project-id',
        name: 'Test Project',
        status: 'active'
      };
      
      mockProjectService.deployProject.mockResolvedValue({
        deploymentId: 'deployment-123',
        status: 'deployed',
        environment: 'staging'
      });
      
      render(<ProjectDashboard projectService={mockProjectService} />);
      
      // Select project
      fireEvent.click(screen.getByText(project.name));
      
      // Deploy project
      fireEvent.click(screen.getByTestId('deploy-button'));
      
      // Select environment
      fireEvent.click(screen.getByTestId('environment-staging'));
      
      // Confirm deployment
      fireEvent.click(screen.getByTestId('confirm-deployment'));
      
      // Verify deployment
      await waitFor(() => {
        expect(mockProjectService.deployProject).toHaveBeenCalledWith(
          project.id,
          'staging'
        );
      });
      
      // Verify deployment status update
      expect(screen.getByText('Deployed')).toBeInTheDocument();
    });
  });
});
```

#### 1.3 Connector Registry Testing

```typescript
// tests/frontend/components/ConnectorRegistry.test.tsx
describe('ConnectorRegistry', () => {
  let mockConnectorService: jest.Mocked<ConnectorService>;
  
  beforeEach(() => {
    mockConnectorService = {
      registerConnector: jest.fn(),
      getConnectors: jest.fn(),
      testConnection: jest.fn(),
      updateConnector: jest.fn(),
      deleteConnector: jest.fn()
    };
  });
  
  describe('Connector Registration', () => {
    it('should register new connector', async () => {
      const connectorSpec = {
        name: 'Test CRM',
        type: 'rest',
        baseUrl: 'https://api.testcrm.com',
        authType: 'oauth2',
        scopes: ['read', 'write']
      };
      
      mockConnectorService.registerConnector.mockResolvedValue({
        id: 'connector-123',
        ...connectorSpec,
        status: 'registered',
        created_at: new Date()
      });
      
      render(<ConnectorRegistry connectorService={mockConnectorService} />);
      
      // Open registration modal
      fireEvent.click(screen.getByTestId('register-connector-button'));
      
      // Fill connector form
      fireEvent.change(screen.getByLabelText('Connector Name'), {
        target: { value: connectorSpec.name }
      });
      fireEvent.change(screen.getByLabelText('Base URL'), {
        target: { value: connectorSpec.baseUrl }
      });
      
      // Submit form
      fireEvent.click(screen.getByTestId('submit-connector'));
      
      // Verify registration
      await waitFor(() => {
        expect(mockConnectorService.registerConnector).toHaveBeenCalledWith(connectorSpec);
      });
      
      // Verify connector appears in registry
      expect(screen.getByText(connectorSpec.name)).toBeInTheDocument();
    });
  });
  
  describe('Connection Testing', () => {
    it('should test connector connection', async () => {
      const connector = {
        id: 'connector-123',
        name: 'Test CRM',
        status: 'registered'
      };
      
      mockConnectorService.testConnection.mockResolvedValue({
        success: true,
        latency: 150,
        timestamp: new Date()
      });
      
      render(<ConnectorRegistry connectorService={mockConnectorService} />);
      
      // Test connection
      fireEvent.click(screen.getByTestId('test-connector-123'));
      
      // Verify test execution
      await waitFor(() => {
        expect(mockConnectorService.testConnection).toHaveBeenCalledWith(connector.id);
      });
      
      // Verify status update
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });
});
```

### Backend Testing Strategy

```typescript
// tests/unit/agents/RouterAgent.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RouterAgent } from '../../../src/agents/RouterAgent';
import { InMemoryMemoryManager } from 'feather-agent';

describe('RouterAgent', () => {
  let routerAgent: RouterAgent;
  let mockPlanner: any;
  let mockTeacherRegistry: any;
  
  beforeEach(() => {
    mockPlanner = vi.fn();
    mockTeacherRegistry = {
      findTeacher: vi.fn(),
      getTeacher: vi.fn()
    };
    
    routerAgent = new RouterAgent({
      id: 'test-router',
      planner: mockPlanner,
      memory: new InMemoryMemoryManager(),
      tools: [],
      teacherRegistry: mockTeacherRegistry
    });
  });
  
  describe('Intent Classification', () => {
    it('should classify DSCR queries correctly', async () => {
      mockPlanner.mockResolvedValue({
        actions: [{ intent: 'underwriting_dscr' }]
      });
      
      const result = await routerAgent.executeHydraTask({
        query: 'Calculate DSCR for NOI $120k, debt service $100k',
        metadata: {}
      });
      
      expect(result.routing_decision).toBe('symbolic');
      expect(result.teacher_id).toBe('loan_dscr_v1');
    });
    
    it('should classify transfer tax queries correctly', async () => {
      mockPlanner.mockResolvedValue({
        actions: [{ intent: 'transfer_tax' }]
      });
      
      const result = await routerAgent.executeHydraTask({
        query: 'Calculate transfer tax for $500k sale',
        metadata: {}
      });
      
      expect(result.routing_decision).toBe('symbolic');
      expect(result.teacher_id).toBe('transfer_tax_v1');
    });
    
    it('should route unknown intents to SELLM', async () => {
      mockPlanner.mockResolvedValue({
        actions: [{ intent: 'unknown' }]
      });
      
      mockTeacherRegistry.findTeacher.mockResolvedValue(null);
      
      const result = await routerAgent.executeHydraTask({
        query: 'Calculate something completely new',
        metadata: {}
      });
      
      expect(result.routing_decision).toBe('create_teacher');
      expect(result.status).toBe('teacher_creation_required');
    });
  });
  
  describe('Input Normalization', () => {
    it('should normalize DSCR inputs correctly', async () => {
      mockPlanner.mockResolvedValue({
        actions: [{ intent: 'underwriting_dscr' }]
      });
      
      mockTeacherRegistry.findTeacher.mockResolvedValue({
        teacher_id: 'loan_dscr_v1',
        inputs_schema: {
          noi: { type: 'number' },
          annual_debt_service: { type: 'number' }
        }
      });
      
      const result = await routerAgent.executeHydraTask({
        query: 'NOI is $120,000 and annual debt service is $100,000',
        metadata: {}
      });
      
      expect(result.normalized_input).toEqual({
        noi: 120000,
        annual_debt_service: 100000
      });
    });
  });
});

// tests/unit/tools/DSCRTeacher.test.ts
describe('DSCRTeacher', () => {
  let dscrTool: Tool;
  
  beforeEach(() => {
    dscrTool = createDSCRTeacherTool();
  });
  
  describe('DSCR Calculation', () => {
    it('should calculate DSCR correctly', async () => {
      const inputs = {
        noi: 120000,
        annual_debt_service: 100000
      };
      
      const result = await dscrTool.execute(inputs);
      
      expect(result.verdict).toBe('PASS');
      expect(result.outputs.dscr).toBe(1.2);
      expect(result.trace[0].passed).toBe(true);
    });
    
    it('should fail when DSCR is below threshold', async () => {
      const inputs = {
        noi: 100000,
        annual_debt_service: 100000
      };
      
      const result = await dscrTool.execute(inputs);
      
      expect(result.verdict).toBe('FAIL');
      expect(result.outputs.dscr).toBe(1.0);
      expect(result.trace[0].passed).toBe(false);
    });
    
    it('should handle edge cases', async () => {
      const inputs = {
        noi: 0,
        annual_debt_service: 100000
      };
      
      const result = await dscrTool.execute(inputs);
      
      expect(result.verdict).toBe('FAIL');
      expect(result.outputs.dscr).toBe(0);
    });
  });
  
  describe('Input Validation', () => {
    it('should validate required inputs', () => {
      const validInputs = {
        noi: 120000,
        annual_debt_service: 100000
      };
      
      expect(dscrTool.validate(validInputs)).toBe(true);
    });
    
    it('should reject invalid inputs', () => {
      const invalidInputs = {
        noi: 'invalid',
        annual_debt_service: 100000
      };
      
      expect(dscrTool.validate(invalidInputs)).toBe(false);
    });
  });
});

// tests/unit/agents/SELLMAgent.test.ts
describe('SELLMAgent', () => {
  let sellmAgent: SELLMAgent;
  let mockPlanner: any;
  let mockTeacherRegistry: any;
  
  beforeEach(() => {
    mockPlanner = vi.fn();
    mockTeacherRegistry = {
      createTeacher: vi.fn()
    };
    
    sellmAgent = new SELLMAgent({
      id: 'test-sellm',
      planner: mockPlanner,
      memory: new InMemoryMemoryManager(),
      tools: [],
      teacherRegistry: mockTeacherRegistry
    });
  });
  
  describe('Teacher Generation', () => {
    it('should generate teacher from requirement', async () => {
      mockPlanner.mockResolvedValue({
        actions: [
          { tool: 'generate_teacher_spec', input: { domain: 'tax' } },
          { tool: 'generate_teacher_code', input: { spec: {} } },
          { tool: 'generate_tests', input: { code: {} } }
        ]
      });
      
      mockTeacherRegistry.createTeacher.mockResolvedValue('tax/new_teacher@1.0.0');
      
      const result = await sellmAgent.executeHydraTask({
        query: 'Create a teacher for calculating property tax',
        metadata: {
          teacher_spec: {
            teacher_id: 'property_tax_v1',
            domain: 'tax',
            inputs_schema: {
              property_value: { type: 'number' },
              tax_rate: { type: 'number' }
            }
          }
        }
      });
      
      expect(result.status).toBe('teacher_created');
      expect(result.teacher_id).toBe('tax/new_teacher@1.0.0');
    });
  });
});
```

### 1.2 Integration Tests (20% of test coverage)

```typescript
// tests/integration/HydraApplication.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { HydraApplication } from '../../src/app';
import { Database } from '../../src/database/Database';

describe('Hydra Application Integration', () => {
  let app: HydraApplication;
  let db: Database;
  
  beforeAll(async () => {
    // Set up test database
    db = new Database(process.env.TEST_DATABASE_URL!);
    await db.migrate();
    
    // Initialize application
    app = new HydraApplication();
    await app.start();
  });
  
  afterAll(async () => {
    await app.stop();
    await db.close();
  });
  
  describe('Complete Workflow', () => {
    it('should handle DSCR calculation end-to-end', async () => {
      const response = await fetch('http://localhost:3000/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Calculate DSCR for NOI $120k, debt service $100k',
          metadata: { jurisdiction: 'CA' }
        })
      });
      
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.routing_decision).toBe('symbolic');
      expect(result.teacher_id).toBe('loan_dscr_v1');
      expect(result.result.verdict).toBe('PASS');
      expect(result.result.outputs.dscr).toBe(1.2);
    });
    
    it('should handle teacher creation workflow', async () => {
      // First, route to SELLM
      const routeResponse = await fetch('http://localhost:3000/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Calculate property tax for $500k property at 1.2% rate',
          metadata: { jurisdiction: 'CA' }
        })
      });
      
      const routeResult = await routeResponse.json();
      expect(routeResult.routing_decision).toBe('create_teacher');
      
      // Then create the teacher
      const createResponse = await fetch('http://localhost:3000/api/create-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeResult.teacher_spec)
      });
      
      expect(createResponse.status).toBe(200);
      
      const createResult = await createResponse.json();
      expect(createResult.status).toBe('teacher_created');
      expect(createResult.teacher_id).toMatch(/property_tax_v\d+@\d+\.\d+\.\d+/);
    });
  });
  
  describe('Policy Change Handling', () => {
    it('should detect and handle policy changes', async () => {
      // Simulate a policy change
      const policyChange = {
        id: 'test-policy-change',
        jurisdiction: 'CA',
        changes: [{
          param: 'dscr_threshold',
          old: 1.20,
          new: 1.25,
          effective_date: '2025-01-01'
        }],
        confidence: 0.95,
        sources: ['test-source']
      };
      
      // Trigger policy change
      const response = await fetch('http://localhost:3000/api/policy-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyChange)
      });
      
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.affected_teachers).toContain('loan_dscr_v1');
      expect(result.proposed_patches).toBeDefined();
    });
  });
});

// tests/integration/CompatibilityLayer.test.ts
describe('Compatibility Layer', () => {
  let compatibilityLayer: HttpApiAdapter;
  let pythonServices: PythonServiceClient;
  
  beforeEach(() => {
    pythonServices = new PythonServiceClient();
    compatibilityLayer = new HttpApiAdapter(new HydraApplication());
  });
  
  describe('API Compatibility', () => {
    it('should maintain exact API compatibility', async () => {
      const request = {
        query: 'Calculate DSCR for NOI $120k',
        metadata: { jurisdiction: 'CA' }
      };
      
      // Test new system response
      const newResponse = await compatibilityLayer.handleRoute(
        { body: request } as any,
        { json: vi.fn() } as any
      );
      
      // Test Python system response
      const pythonResponse = await pythonServices.call('/router/route', request);
      
      // Compare response structures
      expect(Object.keys(newResponse)).toEqual(Object.keys(pythonResponse));
    });
  });
  
  describe('Feature Flags', () => {
    it('should route based on feature flags', async () => {
      const featureFlags = new FeatureFlagManager(new Database());
      
      // Enable new system for test user
      await featureFlags.updateFlag('useNewRouter', {
        enabled: true,
        conditions: { userIds: ['test-user'] }
      });
      
      const shouldUseNew = await featureFlags.shouldUseNewSystem('useNewRouter', {
        userId: 'test-user'
      });
      
      expect(shouldUseNew).toBe(true);
    });
  });
});
```

### 1.3 End-to-End Tests (10% of test coverage)

```typescript
// tests/e2e/HydraWorkflow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { HydraApplication } from '../../src/app';

describe('Hydra End-to-End Workflows', () => {
  let app: HydraApplication;
  
  beforeAll(async () => {
    app = new HydraApplication();
    await app.start();
  });
  
  afterAll(async () => {
    await app.stop();
  });
  
  describe('Loan Underwriting Workflow', () => {
    it('should complete full loan underwriting process', async () => {
      // Step 1: DSCR calculation
      const dscrResponse = await fetch('http://localhost:3000/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Calculate DSCR for NOI $120k, debt service $100k',
          metadata: { jurisdiction: 'CA' }
        })
      });
      
      const dscrResult = await dscrResponse.json();
      expect(dscrResult.result.verdict).toBe('PASS');
      
      // Step 2: LTV calculation (if needed)
      const ltvResponse = await fetch('http://localhost:3000/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Calculate LTV for loan $800k, property value $1M',
          metadata: { jurisdiction: 'CA' }
        })
      });
      
      const ltvResult = await ltvResponse.json();
      expect(ltvResult.result.verdict).toBe('PASS');
      
      // Step 3: Final underwriting decision
      const decisionResponse = await fetch('http://localhost:3000/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Make final underwriting decision based on DSCR 1.2 and LTV 0.8',
          metadata: { jurisdiction: 'CA' }
        })
      });
      
      const decisionResult = await decisionResponse.json();
      expect(decisionResult.result.verdict).toBe('PASS');
    });
  });
  
  describe('Teacher Creation Workflow', () => {
    it('should create and deploy new teacher', async () => {
      // Step 1: Request new teacher
      const requestResponse = await fetch('http://localhost:3000/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Calculate property tax for $500k property at 1.2% rate',
          metadata: { jurisdiction: 'CA' }
        })
      });
      
      const requestResult = await requestResponse.json();
      expect(requestResult.routing_decision).toBe('create_teacher');
      
      // Step 2: Create teacher
      const createResponse = await fetch('http://localhost:3000/api/create-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestResult.teacher_spec)
      });
      
      const createResult = await createResponse.json();
      expect(createResult.status).toBe('teacher_created');
      
      // Step 3: Test new teacher
      const testResponse = await fetch('http://localhost:3000/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Calculate property tax for $500k property at 1.2% rate',
          metadata: { jurisdiction: 'CA' }
        })
      });
      
      const testResult = await testResponse.json();
      expect(testResult.routing_decision).toBe('symbolic');
      expect(testResult.teacher_id).toBe(createResult.teacher_id);
      expect(testResult.result.outputs.property_tax).toBe(6000);
    });
  });
});
```

## 2. Performance Testing

### 2.1 Load Testing

```typescript
// tests/performance/LoadTest.test.ts
import { describe, it, expect } from 'vitest';
import { HydraApplication } from '../../src/app';

describe('Hydra Performance Tests', () => {
  let app: HydraApplication;
  
  beforeAll(async () => {
    app = new HydraApplication();
    await app.start();
  });
  
  afterAll(async () => {
    await app.stop();
  });
  
  describe('Router Performance', () => {
    it('should handle 1000 concurrent requests', async () => {
      const requests = Array.from({ length: 1000 }, (_, i) => 
        fetch('http://localhost:3000/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `Calculate DSCR for NOI $${120000 + i}k, debt service $100k`,
            metadata: { jurisdiction: 'CA' }
          })
        })
      );
      
      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      const successCount = responses.filter(r => r.status === 200).length;
      
      expect(successCount).toBe(1000);
      expect(duration).toBeLessThan(5000); // 5 seconds max
      
      console.log(`Processed 1000 requests in ${duration}ms (${1000/duration*1000} req/s)`);
    });
    
    it('should maintain response time under load', async () => {
      const responseTimes: number[] = [];
      
      for (let i = 0; i < 100; i++) {
        const startTime = Date.now();
        
        const response = await fetch('http://localhost:3000/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'Calculate DSCR for NOI $120k, debt service $100k',
            metadata: { jurisdiction: 'CA' }
          })
        });
        
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
        
        expect(response.status).toBe(200);
      }
      
      const averageResponseTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];
      
      expect(averageResponseTime).toBeLessThan(100); // 100ms average
      expect(p95ResponseTime).toBeLessThan(200); // 200ms p95
      
      console.log(`Average response time: ${averageResponseTime}ms`);
      console.log(`P95 response time: ${p95ResponseTime}ms`);
    });
  });
  
  describe('Memory Usage', () => {
    it('should not have memory leaks', async () => {
      const initialMemory = process.memoryUsage();
      
      // Run many requests
      for (let i = 0; i < 1000; i++) {
        await fetch('http://localhost:3000/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `Calculate DSCR for NOI $${120000 + i}k, debt service $100k`,
            metadata: { jurisdiction: 'CA' }
          })
        });
      }
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      console.log(`Memory increase: ${memoryIncrease / 1024 / 1024}MB`);
    });
  });
});
```

### 2.2 Stress Testing

```typescript
// tests/performance/StressTest.test.ts
describe('Hydra Stress Tests', () => {
  let app: HydraApplication;
  
  beforeAll(async () => {
    app = new HydraApplication();
    await app.start();
  });
  
  afterAll(async () => {
    await app.stop();
  });
  
  describe('High Load Stress Test', () => {
    it('should handle burst traffic', async () => {
      // Simulate burst traffic (100 requests in 1 second)
      const promises = Array.from({ length: 100 }, (_, i) => 
        fetch('http://localhost:3000/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `Calculate DSCR for NOI $${120000 + i}k, debt service $100k`,
            metadata: { jurisdiction: 'CA' }
          })
        })
      );
      
      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      
      const successCount = responses.filter(r => r.status === 200).length;
      const errorCount = responses.filter(r => r.status >= 400).length;
      
      expect(successCount).toBeGreaterThan(95); // 95% success rate
      expect(errorCount).toBeLessThan(5); // Less than 5% errors
      
      console.log(`Burst test: ${successCount} success, ${errorCount} errors in ${endTime - startTime}ms`);
    });
  });
  
  describe('Resource Exhaustion Test', () => {
    it('should handle resource exhaustion gracefully', async () => {
      // Simulate resource exhaustion by making many concurrent requests
      const promises = Array.from({ length: 10000 }, (_, i) => 
        fetch('http://localhost:3000/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `Calculate DSCR for NOI $${120000 + i}k, debt service $100k`,
            metadata: { jurisdiction: 'CA' }
          })
        }).catch(() => ({ status: 500 })) // Catch network errors
      );
      
      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.status === 200).length;
      const errorCount = responses.filter(r => r.status >= 400).length;
      
      // Should still handle some requests even under extreme load
      expect(successCount).toBeGreaterThan(0);
      
      console.log(`Resource exhaustion test: ${successCount} success, ${errorCount} errors`);
    });
  });
});
```

## 3. Accuracy Testing

### 3.1 Deterministic Output Testing

```typescript
// tests/accuracy/DeterministicOutput.test.ts
describe('Deterministic Output Tests', () => {
  let app: HydraApplication;
  
  beforeAll(async () => {
    app = new HydraApplication();
    await app.start();
  });
  
  afterAll(async () => {
    await app.stop();
  });
  
  describe('Teacher Output Consistency', () => {
    it('should produce identical outputs for identical inputs', async () => {
      const inputs = {
        query: 'Calculate DSCR for NOI $120k, debt service $100k',
        metadata: { jurisdiction: 'CA' }
      };
      
      // Run the same request multiple times
      const results = await Promise.all(
        Array.from({ length: 10 }, () => 
          fetch('http://localhost:3000/api/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inputs)
          }).then(r => r.json())
        )
      );
      
      // All results should be identical
      const firstResult = results[0];
      for (const result of results) {
        expect(result.routing_decision).toBe(firstResult.routing_decision);
        expect(result.teacher_id).toBe(firstResult.teacher_id);
        expect(result.result.verdict).toBe(firstResult.result.verdict);
        expect(result.result.outputs.dscr).toBe(firstResult.result.outputs.dscr);
      }
    });
    
    it('should produce consistent traces', async () => {
      const inputs = {
        query: 'Calculate DSCR for NOI $120k, debt service $100k',
        metadata: { jurisdiction: 'CA' }
      };
      
      const results = await Promise.all(
        Array.from({ length: 5 }, () => 
          fetch('http://localhost:3000/api/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inputs)
          }).then(r => r.json())
        )
      );
      
      // All traces should be identical
      const firstTrace = results[0].result.trace;
      for (const result of results) {
        expect(result.result.trace).toEqual(firstTrace);
      }
    });
  });
  
  describe('Mathematical Accuracy', () => {
    it('should calculate DSCR accurately', async () => {
      const testCases = [
        { noi: 120000, ads: 100000, expected: 1.2 },
        { noi: 150000, ads: 100000, expected: 1.5 },
        { noi: 100000, ads: 100000, expected: 1.0 },
        { noi: 80000, ads: 100000, expected: 0.8 }
      ];
      
      for (const testCase of testCases) {
        const response = await fetch('http://localhost:3000/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `Calculate DSCR for NOI $${testCase.noi}, debt service $${testCase.ads}`,
            metadata: { jurisdiction: 'CA' }
          })
        });
        
        const result = await response.json();
        expect(result.result.outputs.dscr).toBeCloseTo(testCase.expected, 2);
      }
    });
    
    it('should calculate transfer tax accurately', async () => {
      const testCases = [
        { sale_price: 500000, rate_pct: 1.2, expected: 6000 },
        { sale_price: 1000000, rate_pct: 0.5, expected: 5000 },
        { sale_price: 250000, rate_pct: 2.0, expected: 5000 }
      ];
      
      for (const testCase of testCases) {
        const response = await fetch('http://localhost:3000/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `Calculate transfer tax for $${testCase.sale_price} at ${testCase.rate_pct}%`,
            metadata: { jurisdiction: 'CA' }
          })
        });
        
        const result = await response.json();
        expect(result.result.outputs.transfer_tax).toBeCloseTo(testCase.expected, 2);
      }
    });
  });
});
```

### 3.2 Comparison Testing

```typescript
// tests/accuracy/ComparisonTest.test.ts
describe('Python vs TypeScript Comparison', () => {
  let app: HydraApplication;
  let pythonClient: PythonServiceClient;
  
  beforeAll(async () => {
    app = new HydraApplication();
    await app.start();
    
    pythonClient = new PythonServiceClient();
  });
  
  afterAll(async () => {
    await app.stop();
  });
  
  describe('Output Comparison', () => {
    it('should produce identical results to Python implementation', async () => {
      const testCases = [
        'Calculate DSCR for NOI $120k, debt service $100k',
        'Calculate transfer tax for $500k at 1.2%',
        'Calculate LTV for loan $800k, property value $1M'
      ];
      
      for (const testCase of testCases) {
        // Get TypeScript result
        const tsResponse = await fetch('http://localhost:3000/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: testCase,
            metadata: { jurisdiction: 'CA' }
          })
        });
        
        const tsResult = await tsResponse.json();
        
        // Get Python result
        const pythonResult = await pythonClient.call('/router/route', {
          query: testCase,
          metadata: { jurisdiction: 'CA' }
        });
        
        // Compare results
        expect(tsResult.routing_decision).toBe(pythonResult.routing_decision);
        expect(tsResult.teacher_id).toBe(pythonResult.teacher_id);
        
        if (tsResult.result && pythonResult.result) {
          expect(tsResult.result.verdict).toBe(pythonResult.result.verdict);
          
          // Compare outputs (allowing for small floating point differences)
          for (const [key, value] of Object.entries(tsResult.result.outputs)) {
            if (typeof value === 'number' && typeof pythonResult.result.outputs[key] === 'number') {
              expect(value).toBeCloseTo(pythonResult.result.outputs[key] as number, 2);
            } else {
              expect(value).toBe(pythonResult.result.outputs[key]);
            }
          }
        }
      }
    });
  });
});
```

## 4. Test Automation and CI/CD

### 4.1 Test Configuration

```json
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
```

### 4.2 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: hydra_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/hydra_test
          REDIS_URL: redis://localhost:6379
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/hydra_test
          REDIS_URL: redis://localhost:6379
      
      - name: Run e2e tests
        run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/hydra_test
          REDIS_URL: redis://localhost:6379
      
      - name: Run performance tests
        run: npm run test:performance
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/hydra_test
          REDIS_URL: redis://localhost:6379
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

## 5. Test Data Management

### 5.1 Test Data Factory

```typescript
// tests/factories/TestDataFactory.ts
export class TestDataFactory {
  static createDSCRInputs(overrides: Partial<DSCRInputs> = {}): DSCRInputs {
    return {
      noi: 120000,
      annual_debt_service: 100000,
      ...overrides
    };
  }
  
  static createTransferTaxInputs(overrides: Partial<TransferTaxInputs> = {}): TransferTaxInputs {
    return {
      sale_price: 500000,
      rate_pct: 1.2,
      ...overrides
    };
  }
  
  static createTeacherSpec(overrides: Partial<TeacherSpec> = {}): TeacherSpec {
    return {
      teacher_id: 'test_teacher_v1',
      domain: 'test',
      type: 'rules',
      inputs_schema: {
        input1: { type: 'number' },
        input2: { type: 'string' }
      },
      rules: [
        {
          id: 'TEST_RULE',
          expr: 'input1 > 0',
          severity: 'fail',
          threshold: 0
        }
      ],
      explanation_fields: ['input1'],
      jurisdictions: ['US'],
      effective_date: '2025-01-01',
      ...overrides
    };
  }
  
  static createPolicyChange(overrides: Partial<PolicyChange> = {}): PolicyChange {
    return {
      id: 'test-policy-change',
      jurisdiction: 'CA',
      changes: [{
        param: 'test_param',
        old: 1.0,
        new: 1.5,
        effective_date: '2025-01-01',
        citations: ['test-citation']
      }],
      confidence: 0.95,
      sources: ['test-source'],
      ...overrides
    };
  }
}
```

### 5.2 Test Database Setup

```typescript
// tests/setup.ts
import { beforeAll, afterAll } from 'vitest';
import { Database } from '../src/database/Database';

let testDb: Database;

beforeAll(async () => {
  testDb = new Database(process.env.TEST_DATABASE_URL!);
  await testDb.migrate();
  await testDb.seed();
});

afterAll(async () => {
  await testDb.cleanup();
  await testDb.close();
});
```

This comprehensive testing strategy ensures the migration maintains accuracy, performance, and reliability while providing confidence in the new TypeScript implementation.
