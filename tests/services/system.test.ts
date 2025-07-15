import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { System } from "../../src/services/system";
import { Synapse } from "../../src/synapse";

let system: System;
let synapse: Synapse;

beforeEach(() => {
  synapse = {
    logger: () => {},
  } as unknown as Synapse;

  system = new System(synapse);
});

describe("System usage reporting", () => {
  test("returns valid system usage data", async () => {
    const result = await system.getUsage(100);

    assert.strictEqual(result.success, true);
    assert.ok(result.data);

    if (result.data) {
      const data = result.data;
      assert.strictEqual(typeof data.cpuCores, "number");
      assert.ok(Array.isArray(data.cpuUsagePerCore));
      assert.strictEqual(data.cpuUsagePerCore.length, data.cpuCores);
      assert.strictEqual(typeof data.cpuUsagePercent, "number");
      assert.ok(data.cpuUsagePercent >= 0 && data.cpuUsagePercent <= 100);

      assert.strictEqual(typeof data.loadAverage1m, "number");
      assert.strictEqual(typeof data.loadAverage5m, "number");
      assert.strictEqual(typeof data.loadAverage15m, "number");

      assert.strictEqual(typeof data.memoryTotalBytes, "number");
      assert.strictEqual(typeof data.memoryFreeBytes, "number");
      assert.strictEqual(typeof data.memoryUsedBytes, "number");
      assert.strictEqual(typeof data.memoryUsagePercent, "number");
      assert.ok(data.memoryUsagePercent >= 0 && data.memoryUsagePercent <= 100);
    }
  });
});
