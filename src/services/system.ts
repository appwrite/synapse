import * as os from "os";

export type CPUTimes = {
  user: number;
  nice: number;
  system: number;
  idle: number;
  irq: number;
};

export type SystemUsageData = {
  success: boolean;
  data: {
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
};

export class SystemService {
  private logger: (message: string) => void;

  constructor(logger: (message: string) => void = console.log) {
    this.logger = logger;
  }

  private calculateCPUUsage(startUsage: CPUTimes, endUsage: CPUTimes): number {
    const userDiff = endUsage.user - startUsage.user;
    const systemDiff = endUsage.system - startUsage.system;
    const idleDiff = endUsage.idle - startUsage.idle;
    const niceDiff = endUsage.nice - startUsage.nice;
    const irqDiff = endUsage.irq - startUsage.irq;

    const totalDiff = userDiff + systemDiff + idleDiff + niceDiff + irqDiff;

    const workDiff = totalDiff - idleDiff;

    return totalDiff === 0
      ? 0
      : Math.min(100, Math.max(0, Math.floor((workDiff / totalDiff) * 100)));
  }

  private getCPUUsage(): CPUTimes[] {
    const cpus = os.cpus();
    return cpus.map((cpu) => ({
      user: cpu.times.user,
      nice: cpu.times.nice,
      system: cpu.times.sys,
      idle: cpu.times.idle,
      irq: cpu.times.irq,
    }));
  }

  /**
   * Get comprehensive system usage statistics
   * @param measurementInterval Interval for CPU usage measurement (default: 3000ms)
   * @returns Detailed system usage information
   */
  async getUsage(measurementInterval: number = 3000): Promise<SystemUsageData> {
    try {
      this.logger("Starting system usage measurement");

      const startMeasurements = this.getCPUUsage();
      await new Promise((resolve) => setTimeout(resolve, measurementInterval));
      const endMeasurements = this.getCPUUsage();

      const cpuUsagePerCore = startMeasurements.map((start, index) => {
        const end = endMeasurements[index];
        return this.calculateCPUUsage(start, end);
      });

      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;

      const [loadAvg1m, loadAvg5m, loadAvg15m] = os.loadavg();

      this.logger("System usage measurement completed");

      return {
        success: true,
        data: {
          cpuCores: os.cpus().length,
          cpuUsagePerCore,
          cpuUsagePercent: Math.floor(
            cpuUsagePerCore.reduce((a, b) => a + b, 0) / cpuUsagePerCore.length,
          ),
          loadAverage1m: loadAvg1m,
          loadAverage5m: loadAvg5m,
          loadAverage15m: loadAvg15m,
          memoryTotalBytes: totalMemory,
          memoryFreeBytes: freeMemory,
          memoryUsedBytes: usedMemory,
          memoryUsagePercent: Math.floor((usedMemory / totalMemory) * 100),
        },
      };
    } catch (error) {
      this.logger(
        `Error in getUsage: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
