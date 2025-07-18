import { SynapseResponse, BaseHTTPClient } from "../base";

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

export class SystemHTTPService extends BaseHTTPClient {
  constructor({ endpoint }: { endpoint: string }) {
    super({ endpoint });
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
}
