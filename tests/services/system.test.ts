import * as os from "os";
import { System } from "../../src/services/system";
import { Synapse } from "../../src/synapse";

jest.mock("os");

describe("System", () => {
  let system: System;
  let mockSynapse: Synapse;

  beforeEach(() => {
    mockSynapse = {
      logger: jest.fn(),
    } as unknown as Synapse;

    system = new System(mockSynapse);
  });

  describe("getUsage", () => {
    it("should return system usage data", async () => {
      const mockCpus = [
        {
          times: {
            user: 100,
            nice: 0,
            sys: 50,
            idle: 200,
            irq: 0,
          },
        },
      ];

      (os.cpus as jest.Mock).mockReturnValue(mockCpus);
      (os.totalmem as jest.Mock).mockReturnValue(8000000000);
      (os.freemem as jest.Mock).mockReturnValue(4000000000);
      (os.loadavg as jest.Mock).mockReturnValue([1.5, 1.0, 0.5]);

      const result = await system.getUsage(100);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      if (result.data) {
        const data = result.data;
        expect(data.cpuCores).toBe(1);
        expect(Array.isArray(data.cpuUsagePerCore)).toBe(true);
        expect(data.cpuUsagePerCore.length).toBe(1);
        expect(typeof data.cpuUsagePercent).toBe("number");
        expect(data.cpuUsagePercent).toBeGreaterThanOrEqual(0);
        expect(data.cpuUsagePercent).toBeLessThanOrEqual(100);

        expect(data.loadAverage1m).toBe(1.5);
        expect(data.loadAverage5m).toBe(1.0);
        expect(data.loadAverage15m).toBe(0.5);

        expect(data.memoryTotalBytes).toBe(8000000000);
        expect(data.memoryFreeBytes).toBe(4000000000);
        expect(data.memoryUsedBytes).toBe(4000000000);
        expect(data.memoryUsagePercent).toBe(50);
      }
    });
  });
});
