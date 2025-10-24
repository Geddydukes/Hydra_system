import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectManagementAgent, ExecutionContext, DeploymentEnvironment } from '../src';

function createContext(operation: string, payload: Record<string, any> = {}): ExecutionContext {
  return {
    requestId: `req-${operation}`,
    data: { operation, payload },
    variables: {},
    metadata: {}
  };
}

describe('ProjectManagementAgent', () => {
  let agent: ProjectManagementAgent;
  let environment: DeploymentEnvironment;

  beforeEach(() => {
    agent = new ProjectManagementAgent({ name: 'ProjectManager' });
    environment = {
      name: 'staging',
      url: 'https://staging.hydra.local',
      region: 'us-east-1'
    };
  });

  it('creates projects with version history', async () => {
    const context = createContext('create_project', {
      name: 'Underwriting',
      domain: 'finance',
      description: 'Credit underwriting flows'
    });

    const result = await agent.execute(context);
    expect(result.success).toBe(true);
    expect(result.result.version).toBe('1.0.0');
    expect(result.result.id).toMatch(/^project-/);
    expect(result.result.versionHistory).toHaveLength(1);
  });

  it('updates projects and bumps version', () => {
    const project = agent.createProject({
      name: 'Compliance',
      domain: 'governance'
    });

    const updated = agent.updateProject(project.id, { description: 'Compliance automation' }, 'Added compliance flow');
    expect(updated.version).toBe('1.0.1');
    expect(updated.versionHistory).toHaveLength(2);
    expect(updated.versionHistory[1].changelog).toBe('Added compliance flow');
  });

  it('creates deployment packages with checksums', () => {
    const project = agent.createProject({ name: 'Claims', domain: 'insurance' });
    const deployment = agent.deployProject(project.id, environment, 'Initial release');

    expect(deployment.status).toBe('successful');
    const pkg = agent.getDeploymentPackage(project.id, deployment.deploymentId);
    expect(pkg).toBeDefined();
    expect(pkg!.checksum).toHaveLength(64);
    expect(pkg!.artifact.length).toBeGreaterThan(0);
  });

  it('rolls back to previous versions', () => {
    const project = agent.createProject({ name: 'Pricing', domain: 'finance' });
    agent.updateProject(project.id, { description: 'Pricing adjustments' });
    const latest = agent.updateProject(project.id, { owner: 'analyst@hydra.ai' });

    const rollback = agent.rollbackProject(project.id, project.version);
    expect(rollback.status).toBe('rolled_back');
    const reloaded = agent.getProject(project.id);
    expect(reloaded.version).toBe(project.version);
    expect(reloaded.deploymentHistory).toHaveLength(1);
  });

  it('records health snapshots for environments', () => {
    const project = agent.createProject({ name: 'Monitoring', domain: 'platform' });
    const snapshot = agent.recordHealthSnapshot(project.id, environment.name, 'healthy', { latency_ms: 120 });

    expect(snapshot.metrics.latency_ms).toBe(120);
    const snapshots = agent.getHealthSnapshots(project.id, environment.name);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].status).toBe('healthy');
  });
});
