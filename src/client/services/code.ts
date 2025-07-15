import { BaseHTTPClient, SynapseResponse } from "../base";

export type FormatOptions = {
  language: string;
  indent?: number;
  useTabs?: boolean;
  semi?: boolean;
  singleQuote?: boolean;
  printWidth?: number;
};

export type LintResult = {
  errors: Array<{
    line: number;
    column: number;
    message: string;
    rule?: string;
    severity: "error" | "warning";
  }>;
  warnings: Array<{
    line: number;
    column: number;
    message: string;
    rule?: string;
    severity: "error" | "warning";
  }>;
};

export class CodeHTTPService extends BaseHTTPClient {
  constructor({ endpoint }: { endpoint: string }) {
    super({ endpoint });
  }

  /**
   * Format code
   */
  async formatCode({
    code,
    options,
  }: {
    code: string;
    options: FormatOptions;
  }): Promise<SynapseResponse<string>> {
    return this.request({
      type: "code",
      operation: "format",
      params: {
        code,
        options,
      },
    });
  }

  /**
   * Lint code
   */
  async lintCode({
    code,
    language,
  }: {
    code: string;
    language: string;
  }): Promise<SynapseResponse<LintResult>> {
    return this.request({
      type: "code",
      operation: "lint",
      params: {
        code,
        language,
      },
    });
  }
}
