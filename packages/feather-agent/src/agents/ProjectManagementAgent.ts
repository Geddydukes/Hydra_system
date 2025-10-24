import crypto from 'crypto';
import { HydraAgent } from './HydraAgent';
import {
  ExecutionContext,
  ProjectSpec,
  ProjectRecord,
  DeploymentEnvironment,
  DeploymentRecord,
  DeploymentPackage,
  HealthSnapshot,
  VersionRecord
} from '../types';

interface ProjectOperationPayload {
  operation: string;
  payload?: Record<string, any>;
}

function now(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export class ProjectManagementAgent extends HydraAgent {
  private projects = new Map<string, ProjectRecord>();
  private deploymentPackages = new Map<string, DeploymentPackage>();
  private healthSnapshots: HealthSnapshot[] = [];

  constructor(config: Partial<any> = {}) {
    super({
      name: 'ProjectManagementAgent',
      description: 'Coordinates project creation, versioning, and deployments',
      ...config
    });
  }

  protected async executeInternal(context: ExecutionContext): Promise<any> {
    const { operation, payload = {} } = context.data as ProjectOperationPayload;

    switch (operation) {
      case 'create_project':
        return this.createProject(payload as ProjectSpec);
      case 'update_project':
        return this.updateProject(payload.projectId as string, payload.changes as Partial<ProjectSpec>, payload.changelog as string | undefined);
      case 'deploy_project':
        return this.deployProject(payload.projectId, payload.environment as DeploymentEnvironment, payload.changelog as string | undefined);
      case 'rollback_project':
        return this.rollbackProject(payload.projectId, payload.targetVersion as string);
      case 'get_project':
        return this.getProject(payload.projectId as string);
      case 'list_projects':
        return this.getProjects();
      case 'record_health':
        return this.recordHealthSnapshot(payload.projectId, payload.environment, payload.status, payload.metrics, payload.notes);
      case 'get_health':
        return this.getHealthSnapshots(payload.projectId, payload.environment);
      default:
        throw new Error(`Unsupported project management operation: ${operation}`);
    }
  }

  protected validateInternal(context: ExecutionContext): boolean {
    const data = context.data as ProjectOperationPayload;
    return Boolean(data && typeof data.operation === 'string');
  }

  createProject(spec: ProjectSpec): ProjectRecord {
    const projectId = generateId('project');
    const version = '1.0.0';
    const checksum = this.calculateChecksum({ spec, version });

    const versionRecord: VersionRecord = {
      version,
      createdAt: now(),
      checksum,
      changelog: 'Initial project creation'
    };

    const project: ProjectRecord = {
      id: projectId,
      version,
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
      deploymentHistory: [],
      versionHistory: [versionRecord],
      ...spec
    };

    this.projects.set(projectId, project);
    this.deploymentPackages.set(projectId, this.createDeploymentPackage(project));

    return project;
  }

  updateProject(projectId: string, changes: Partial<ProjectSpec>, changelog?: string): ProjectRecord {
    const project = this.ensureProject(projectId);
    const version = this.bumpVersion(project.version);
    const updatedProject: ProjectRecord = {
      ...project,
      ...changes,
      version,
      updatedAt: now()
    };

    const checksum = this.calculateChecksum({ spec: updatedProject, version });
    const versionRecord: VersionRecord = {
      version,
      createdAt: now(),
      checksum,
      changelog: changelog || 'Configuration update'
    };

    updatedProject.versionHistory = [...project.versionHistory, versionRecord];
    this.projects.set(projectId, updatedProject);
    this.deploymentPackages.set(projectId, this.createDeploymentPackage(updatedProject));

    return updatedProject;
  }

  deployProject(projectId: string, environment: DeploymentEnvironment, changelog?: string): DeploymentRecord {
    const project = this.ensureProject(projectId);
    const deploymentId = generateId('deployment');
    const packageArtifact = this.createDeploymentPackage(project);

    const deploymentRecord: DeploymentRecord = {
      deploymentId,
      environment: environment.name,
      version: project.version,
      status: 'successful',
      deployedAt: now(),
      metadata: {
        url: environment.url,
        region: environment.region,
        changelog: changelog || 'Automated deployment'
      }
    };

    const updatedHistory = [...project.deploymentHistory, deploymentRecord];
    const updatedProject: ProjectRecord = {
      ...project,
      status: 'deployed',
      updatedAt: now(),
      deploymentHistory: updatedHistory
    };

    this.projects.set(projectId, updatedProject);
    this.deploymentPackages.set(`${projectId}:${deploymentId}`, packageArtifact);

    return deploymentRecord;
  }

  rollbackProject(projectId: string, targetVersion: string): DeploymentRecord {
    const project = this.ensureProject(projectId);
    const versionRecord = project.versionHistory.find(version => version.version === targetVersion);

    if (!versionRecord) {
      throw new Error(`Version ${targetVersion} not found for project ${projectId}`);
    }

    const deploymentId = generateId('rollback');
    const deploymentRecord: DeploymentRecord = {
      deploymentId,
      environment: project.deploymentHistory.at(-1)?.environment || 'unknown',
      version: targetVersion,
      status: 'rolled_back',
      deployedAt: now(),
      rolledBackAt: now(),
      metadata: {
        previousVersion: project.version,
        targetVersion
      }
    };

    const updatedProject: ProjectRecord = {
      ...project,
      version: targetVersion,
      status: 'active',
      updatedAt: now(),
      deploymentHistory: [...project.deploymentHistory, deploymentRecord]
    };

    this.projects.set(projectId, updatedProject);
    return deploymentRecord;
  }

  getProject(projectId: string): ProjectRecord {
    return this.ensureProject(projectId);
  }

  getProjects(): ProjectRecord[] {
    return Array.from(this.projects.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  getDeploymentHistory(projectId: string): DeploymentRecord[] {
    return [...this.ensureProject(projectId).deploymentHistory];
  }

  getDeploymentPackage(projectId: string, deploymentId?: string): DeploymentPackage | undefined {
    const key = deploymentId ? `${projectId}:${deploymentId}` : projectId;
    const pkg = this.deploymentPackages.get(key);
    return pkg ? { ...pkg, metadata: { ...pkg.metadata } } : undefined;
  }

  recordHealthSnapshot(
    projectId: string,
    environment: string,
    status: HealthSnapshot['status'],
    metrics: Record<string, number>,
    notes?: string
  ): HealthSnapshot {
    this.ensureProject(projectId);
    const snapshot: HealthSnapshot = {
      projectId,
      environment,
      status,
      metrics: { ...metrics },
      checkedAt: now(),
      notes
    };

    this.healthSnapshots.push(snapshot);
    if (this.healthSnapshots.length > 200) {
      this.healthSnapshots.shift();
    }

    return snapshot;
  }

  getHealthSnapshots(projectId: string, environment?: string): HealthSnapshot[] {
    return this.healthSnapshots.filter(snapshot => {
      return snapshot.projectId === projectId && (!environment || snapshot.environment === environment);
    });
  }

  private ensureProject(projectId: string): ProjectRecord {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    return project;
  }

  private createDeploymentPackage(project: ProjectRecord): DeploymentPackage {
    const artifactPayload = {
      id: project.id,
      version: project.version,
      flows: project.flows || [],
      rules: project.rules || [],
      connectors: project.connectors || [],
      metadata: project.metadata || {}
    };

    const artifactBuffer = Buffer.from(JSON.stringify(artifactPayload, null, 2));
    const checksum = this.calculateChecksum(artifactPayload);

    return {
      projectId: project.id,
      version: project.version,
      checksum,
      artifact: artifactBuffer,
      metadata: {
        generatedAt: now(),
        size: artifactBuffer.length
      }
    };
  }

  private calculateChecksum(input: any): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(input));
    return hash.digest('hex');
  }

  private bumpVersion(version: string): string {
    const [major, minor, patch] = version.split('.').map(value => parseInt(value, 10));
    const nextPatch = Number.isFinite(patch) ? patch + 1 : 0;
    return `${major || 1}.${minor || 0}.${nextPatch}`;
  }
}
