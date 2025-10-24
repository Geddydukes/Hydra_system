import {
  ProjectManagementAgent,
  ProjectSpec,
  DeploymentEnvironment,
  DeploymentRecord,
  ProjectRecord,
  DeploymentPackage,
  HealthSnapshot
} from '@hydra/feather-agent';

export interface DeploymentSummary {
  project: ProjectRecord;
  lastDeployment?: DeploymentRecord;
  healthSnapshots: HealthSnapshot[];
}

export class DeploymentManager {
  constructor(private projectAgent: ProjectManagementAgent) {}

  createProject(spec: ProjectSpec): ProjectRecord {
    return this.projectAgent.createProject(spec);
  }

  updateProject(projectId: string, changes: Partial<ProjectSpec>, changelog?: string): ProjectRecord {
    return this.projectAgent.updateProject(projectId, changes, changelog);
  }

  deployProject(projectId: string, environment: DeploymentEnvironment, changelog?: string): DeploymentRecord {
    return this.projectAgent.deployProject(projectId, environment, changelog);
  }

  rollbackProject(projectId: string, version: string): DeploymentRecord {
    return this.projectAgent.rollbackProject(projectId, version);
  }

  getProject(projectId: string): ProjectRecord {
    return this.projectAgent.getProject(projectId);
  }

  getProjects(): ProjectRecord[] {
    return this.projectAgent.getProjects();
  }

  getDeploymentPackage(projectId: string, deploymentId?: string): DeploymentPackage | undefined {
    return this.projectAgent.getDeploymentPackage(projectId, deploymentId);
  }

  getDeploymentHistory(projectId: string): DeploymentRecord[] {
    return this.projectAgent.getDeploymentHistory(projectId);
  }

  recordHealthSnapshot(
    projectId: string,
    environment: string,
    status: HealthSnapshot['status'],
    metrics: Record<string, number>,
    notes?: string
  ): HealthSnapshot {
    return this.projectAgent.recordHealthSnapshot(projectId, environment, status, metrics, notes);
  }

  getHealth(projectId: string, environment?: string): HealthSnapshot[] {
    return this.projectAgent.getHealthSnapshots(projectId, environment);
  }

  getSummary(projectId: string): DeploymentSummary {
    const project = this.projectAgent.getProject(projectId);
    const deployments = this.projectAgent.getDeploymentHistory(projectId);
    const healthSnapshots = this.getHealth(projectId);

    return {
      project,
      lastDeployment: deployments.at(-1),
      healthSnapshots
    };
  }
}
