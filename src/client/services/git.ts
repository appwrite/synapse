import { SynapseRequest, SynapseResponse } from "../base";

export type GitOperationResult = {
  success: boolean;
  data?: string;
  error?: string;
};

export type GitOperation =
  | "status"
  | "add"
  | "commit"
  | "push"
  | "pull"
  | "clone"
  | "branch"
  | "checkout"
  | "merge"
  | "log"
  | "diff"
  | "init";

export type GitParams = {
  operation: GitOperation;
  args?: string[];
  message?: string;
  url?: string;
  branch?: string;
  options?: Record<string, any>;
};

export class GitHTTPService {
  private endpoint: string;

  constructor({ endpoint }: { endpoint: string }) {
    this.endpoint = endpoint;
  }

  /**
   * Perform Git operations
   */
  async git({
    operation,
    args = [],
    message,
    url,
    branch,
    options = {},
  }: GitParams): Promise<SynapseResponse<GitOperationResult>> {
    return this.request({
      type: "git",
      operation,
      params: {
        args,
        message,
        url,
        branch,
        options,
      },
    });
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
