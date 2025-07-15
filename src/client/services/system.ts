import { SynapseRequest, SynapseResponse } from "../base";

export type SystemUsageData = {
  cpuCores: number;
  cpuUsagePerCore: number[];
  cpuUsagePercent: number;
  loadAverage1m: number;
  loadAverage5m: number;
  loadAverage15m: number;
  memoryTotalBytes: number;
  memoryFreeBytes: number;
  memoryUsedBytes: number;
  memoryUsagePercent: number;
};

export class SystemHTTPService {
  private endpoint: string;

  constructor({ endpoint }: { endpoint: string }) {
    this.endpoint = endpoint;
  }

  /**
   * Get system usage data
   */
  async getSystemUsage(): Promise<SynapseResponse<SystemUsageData>> {
    return this.request({
      type: "system",
      operation: "getUsage",
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
