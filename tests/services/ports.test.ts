import { Synapse } from "../../src/synapse";
import { Ports } from "../../src/services/ports";

describe("Ports", () => {
  let synapse: Synapse;
  let ports: Ports;

  beforeEach(() => {
    synapse = new Synapse("localhost", 3000);
    ports = new Ports(synapse);

    // Mock broadcast method
    synapse.broadcast = jest.fn();
    synapse.sendToConnection = jest.fn();

    // Use fake timers for most tests
    jest.useFakeTimers();
  });

  afterEach(() => {
    ports.stopMonitoring();
    jest.useRealTimers();
  });

  describe("monitoring lifecycle", () => {
    it("should start and stop monitoring", () => {
      expect(ports.isActive()).toBe(false);

      ports.startMonitoring();
      expect(ports.isActive()).toBe(true);

      ports.stopMonitoring();
      expect(ports.isActive()).toBe(false);
    });

    it("should not start monitoring if already active", () => {
      ports.startMonitoring();
      const firstCall = ports.isActive();
      ports.startMonitoring();
      expect(ports.isActive()).toBe(firstCall);
    });
  });

  describe("integration with Synapse", () => {
    it("should be accessible through Synapse.getPorts()", () => {
      const portsInstance = synapse.getPorts();
      expect(portsInstance).toBeInstanceOf(Ports);
    });

    it("should start monitoring through Synapse.startPortMonitoring()", () => {
      synapse.startPortMonitoring();
      expect(synapse.getPorts().isActive()).toBe(true);
    });

    it("should stop monitoring through Synapse.stopPortMonitoring()", () => {
      synapse.startPortMonitoring();
      synapse.stopPortMonitoring();
      expect(synapse.getPorts().isActive()).toBe(false);
    });
  });
});
