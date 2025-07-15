import * as path from "path";
import { SynapseRequest, SynapseResponse } from "../base";

export type ExecuteCommandParams = {
  command: string;
  cwd: string;
  timeout?: number;
  throwOnError?: boolean;
};

export type ExecuteCommandResult = {
  output: string;
  exitCode: number;
};

export class TerminalHTTPService {
  private endpoint: string;
  private artifactBasePath: string;
  private baseDir: string;

  constructor({
    endpoint,
    artifactBasePath,
    baseDir = "",
  }: {
    endpoint: string;
    artifactBasePath: string;
    baseDir?: string;
  }) {
    this.endpoint = endpoint;
    this.artifactBasePath = artifactBasePath;
    this.baseDir = baseDir;
  }

  /**
   * Execute a command
   */
  async executeCommand({
    command,
    cwd,
    timeout = 5000,
    throwOnError = true,
  }: ExecuteCommandParams): Promise<SynapseResponse<ExecuteCommandResult>> {
    const safeCwd = path.join(this.baseDir, this.artifactBasePath, cwd);

    const response = await this.request({
      type: "terminal",
      operation: "executeCommand",
      params: {
        command,
        cwd: safeCwd,
        timeout,
      },
    });

    if (throwOnError && response.data?.exitCode !== 0) {
      throw new Error(
        `Command "${command}" failed with exit code ${response.data.exitCode}: ${response.data.output}`,
      );
    }

    return response;
  }

  private async request<T = any>(
    body: SynapseRequest,
  ): Promise<SynapseResponse<T>> {
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as SynapseResponse<T>;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
