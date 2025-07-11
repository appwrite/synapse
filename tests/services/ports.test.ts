import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Ports } from "../../src/services/ports";
import { Synapse } from "../../src/synapse";

let synapse: Synapse;
let ports: Ports;

beforeEach(() => {
  synapse = new Synapse("localhost", 3000);
  ports = new Ports(synapse);
});

afterEach(() => {
  ports.stopMonitoring();
  synapse.disconnect();
});

describe("Ports monitoring lifecycle", () => {
  test("starts and stops monitoring", () => {
    assert.strictEqual(ports.isActive(), false);

    ports.startMonitoring();
    assert.strictEqual(ports.isActive(), true);

    ports.stopMonitoring();
    assert.strictEqual(ports.isActive(), false);
  });

  test("does not start monitoring if already active", () => {
    ports.startMonitoring();
    const firstActive = ports.isActive();
    ports.startMonitoring();
    assert.strictEqual(ports.isActive(), firstActive);
  });
});

describe("Ports integration with Synapse", () => {
  test("is accessible through Synapse.getPorts()", () => {
    const portsInstance = synapse.getPorts();
    assert.ok(portsInstance instanceof Ports);
  });

  test("can start monitoring through Synapse.startPortMonitoring()", () => {
    synapse.startPortMonitoring();
    assert.strictEqual(synapse.getPorts().isActive(), true);
  });

  test("can stop monitoring through Synapse.stopPortMonitoring()", () => {
    synapse.startPortMonitoring();
    synapse.stopPortMonitoring();
    assert.strictEqual(synapse.getPorts().isActive(), false);
  });
});
