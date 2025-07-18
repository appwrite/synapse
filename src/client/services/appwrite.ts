import { SynapseResponse, BaseHTTPClient } from "../base";

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

export class AppwriteHTTPService extends BaseHTTPClient {
  constructor({ endpoint }: { endpoint: string }) {
    super({ endpoint });
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
}
