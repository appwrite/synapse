export type SynapseRequest = {
  type: string;
  operation: string;
  params?: Record<string, any>;
  requestId?: string;
};

export type SynapseResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  requestId?: string;
};

export class BaseHTTPClient {
  protected endpoint: string;

  constructor({ endpoint }: { endpoint: string }) {
    this.endpoint = endpoint;
  }

  protected async request<T = any>(
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
