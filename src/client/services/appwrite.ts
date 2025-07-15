import { SynapseRequest, SynapseResponse } from "../base";

export type AppwriteInitParams = {
  endpoint?: string;
  projectId: string;
  jwt: string;
};

export type AppwriteCallParams = {
  service: string;
  method: string;
  args?: Record<string, any>;
};

export class AppwriteHTTPService {
  private endpoint: string;

  constructor({ endpoint }: { endpoint: string }) {
    this.endpoint = endpoint;
  }

  /**
   * Initialize Appwrite client
   */
  async initAppwrite({
    endpoint,
    projectId,
    jwt,
  }: AppwriteInitParams): Promise<SynapseResponse<any>> {
    return this.request({
      type: "appwrite",
      operation: "init",
      params: {
        endpoint,
        projectId,
        jwt,
      },
    });
  }

  /**
   * Call Appwrite service method
   */
  async callAppwrite({
    service,
    method,
    args = {},
  }: AppwriteCallParams): Promise<SynapseResponse<any>> {
    return this.request({
      type: "appwrite",
      operation: "call",
      params: {
        service,
        method,
        args,
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
