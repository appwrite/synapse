import * as os from "os";
import { System } from "../../src/services/system";
import { Synapse } from "../../src/synapse";

jest.mock("os");

describe("System", () => {
  let system: System;
  let mockSynapse: jest.Mocked<Synapse>;

  beforeEach(() => {
    mockSynapse = jest.mocked({
      logger: jest.fn(),
      setLogger: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendCommand: jest.fn(),
    } as unknown as Synapse);

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

      const result = await system.getUsage(100); // Shorter interval for testing

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("cpuCores", 1);
      expect(result.data).toHaveProperty("memoryTotalBytes", 8000000000);
      expect(result.data).toHaveProperty("memoryFreeBytes", 4000000000);
      expect(result.data).toHaveProperty("memoryUsagePercent", 50);
    });
  });
});
