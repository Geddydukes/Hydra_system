import Docker from 'dockerode';
import { createLogger } from '../logger';

export interface SandboxConfig {
  image: string;
  memory: string;
  cpu: string;
  timeout: number;
  networkMode: string;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  executionTime: number;
}

export class SandboxExecutor {
  private docker: Docker;
  private logger = createLogger('SandboxExecutor');
  private config: SandboxConfig;

  constructor(config: Partial<SandboxConfig> = {}) {
    this.docker = new Docker();
    this.config = {
      image: 'node:20-alpine',
      memory: '512m',
      cpu: '0.5',
      timeout: 30000,
      networkMode: 'none',
      ...config
    };
  }

  async execute(
    code: string,
    language: 'javascript' | 'python' = 'javascript',
    input?: any
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      const container = await this.createContainer(code, language, input);
      const result = await this.runContainer(container);
      
      return {
        success: result.exitCode === 0,
        output: result.output,
        error: result.exitCode !== 0 ? result.output : undefined,
        exitCode: result.exitCode,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      this.logger.error('Sandbox execution error', error);
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        exitCode: -1,
        executionTime: Date.now() - startTime
      };
    }
  }

  private async createContainer(code: string, language: string, input?: any): Promise<Docker.Container> {
    const image = language === 'python' ? 'python:3.11-alpine' : this.config.image;
    
    const containerConfig = {
      Image: image,
      Cmd: this.getCommand(code, language, input),
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      OpenStdin: false,
      StdinOnce: false,
      HostConfig: {
        Memory: this.parseMemory(this.config.memory),
        CpuQuota: this.parseCpu(this.config.cpu),
        NetworkMode: this.config.networkMode,
        ReadonlyRootfs: true,
        SecurityOpt: ['no-new-privileges:true'],
        CapDrop: ['ALL'],
        CapAdd: []
      }
    };

    const container = await this.docker.createContainer(containerConfig);
    return container;
  }

  private getCommand(code: string, language: string, input?: any): string[] {
    if (language === 'python') {
      return ['python', '-c', code];
    } else {
      return ['node', '-e', code];
    }
  }

  private async runContainer(container: Docker.Container): Promise<{ output: string; exitCode: number }> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        container.kill().catch(() => {});
        reject(new Error('Execution timeout'));
      }, this.config.timeout);

      try {
        await container.start();
        
        const stream = await container.logs({
          follow: true,
          stdout: true,
          stderr: true,
          timestamps: false
        });

        let output = '';
        stream.on('data', (chunk: Buffer) => {
          output += chunk.toString();
        });

        stream.on('end', async () => {
          clearTimeout(timeout);
          try {
            const info = await container.inspect();
            const exitCode = info.State.ExitCode || 0;
            
            await container.remove({ force: true });
            resolve({ output, exitCode });
          } catch (error) {
            reject(error);
          }
        });

        stream.on('error', (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private parseMemory(memory: string): number {
    const match = memory.match(/^(\d+)([kmg]?)$/i);
    if (!match) return 512 * 1024 * 1024; // Default 512MB
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
      case 'k': return value * 1024;
      case 'm': return value * 1024 * 1024;
      case 'g': return value * 1024 * 1024 * 1024;
      default: return value;
    }
  }

  private parseCpu(cpu: string): number {
    const value = parseFloat(cpu);
    return Math.floor(value * 100000); // Convert to microseconds
  }

  async start(): Promise<void> {
    try {
      // Test Docker connection
      await this.docker.ping();
      this.logger.info('Sandbox executor started');
    } catch (error) {
      this.logger.error('Failed to start sandbox executor', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Sandbox executor stopped');
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}
