import { SynapseResponse, BaseHTTPClient } from "../base";

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

export class GitHTTPService extends BaseHTTPClient {
  constructor({ endpoint }: { endpoint: string }) {
    super({ endpoint });
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
}
