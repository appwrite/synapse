import { SynapseRequest, SynapseResponse } from "../base";

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

export class CodeHTTPService {
  private endpoint: string;

  constructor({ endpoint }: { endpoint: string }) {
    this.endpoint = endpoint;
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
