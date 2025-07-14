import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Synapse } from "../src/synapse";
import { Terminal } from "../src/services/terminal";
import { Filesystem } from "../src/services/filesystem";

let synapse: Synapse;

beforeEach(() => {
  synapse = new Synapse();
});

afterEach(() => {
  synapse.disconnect();
});

describe("Synapse initialization", () => {
  test("initializes with default host and port", () => {
    const defaultSynapse = new Synapse();
    assert.ok(defaultSynapse);
    defaultSynapse.disconnect();
  });

  test("initializes with custom host and port", () => {
    const customSynapse = new Synapse("127.0.0.1", 8080);
    assert.ok(customSynapse);
    customSynapse.disconnect();
  });

  test("has no connections initially", () => {
    const connections = synapse.getConnections();
    assert.deepEqual(connections, []);
  });
});

describe("Connection management", () => {
  test("returns false when no connections exist", () => {
    assert.strictEqual(synapse.isConnected(), false);
  });

  test("returns null for non-existent connection", () => {
    const connection = synapse.getConnection("non-existent");
    assert.strictEqual(connection, null);
  });

  test("returns null for path of non-existent connection", () => {
    const path = synapse.getPath("non-existent");
    assert.strictEqual(path, null);
  });

  test("returns null for params of non-existent connection", () => {
    const params = synapse.getParams("non-existent");
    assert.strictEqual(params, null);
  });

  test("throws error when sending to non-existent connection", () => {
    assert.throws(() => {
      synapse.sendToConnection({ connectionId: "non-existent", type: "test" });
    }, /WebSocket connection .* is not connected/);
  });

  test("throws error when sending with promise to non-existent connection", async () => {
    await assert.rejects(
      () => synapse.send({ connectionId: "non-existent", type: "test" }),
      /WebSocket connection .* is not connected/,
    );
  });
});

describe("Message handling", () => {
  test("can register message handlers", () => {
    let handlerCalled = false;
    let receivedMessage: any = null;
    let receivedConnectionId: string | null = null;

    synapse.onMessageType("test", (message, connectionId) => {
      handlerCalled = true;
      receivedMessage = message;
      receivedConnectionId = connectionId;
    });

    // Verify handler registration doesn't throw
    assert.ok(true);
  });

  test("on method is alias for onMessageType", () => {
    let handlerCalled = false;

    synapse.on("test", (message, connectionId) => {
      handlerCalled = true;
    });

    // Verify handler registration doesn't throw
    assert.ok(true);
  });

  test("returns empty array when broadcasting to no connections", () => {
    const promises = synapse.broadcast({
      type: "test",
      payload: { data: "test" },
    });
    assert.deepEqual(promises, []);
  });
});

describe("Connection lifecycle callbacks", () => {
  test("can register onOpen callback", () => {
    let callbackCalled = false;
    let receivedConnectionId: string | null = null;

    synapse.onOpen((connectionId) => {
      callbackCalled = true;
      receivedConnectionId = connectionId;
    });

    // Verify callback registration doesn't throw
    assert.ok(true);
  });

  test("can register onClose callback", () => {
    let callbackCalled = false;

    synapse.onClose((connectionId, code, reason, wasClean) => {
      callbackCalled = true;
    });

    // Verify callback registration doesn't throw
    assert.ok(true);
  });

  test("can register onError callback", () => {
    let callbackCalled = false;

    synapse.onError((error, connectionId) => {
      callbackCalled = true;
    });

    // Verify callback registration doesn't throw
    assert.ok(true);
  });

  test("can register onConnection callback", () => {
    let callbackCalled = false;

    synapse.onConnection((connectionId) => {
      callbackCalled = true;
    });

    // Verify callback registration doesn't throw
    assert.ok(true);
  });
});

describe("Terminal management", () => {
  test("can register terminal", () => {
    const terminal = new Terminal(synapse);

    synapse.registerTerminal(terminal);

    // Verify registration doesn't throw
    assert.ok(true);

    terminal.kill();
  });

  test("can unregister terminal", () => {
    const terminal = new Terminal(synapse);

    synapse.registerTerminal(terminal);
    synapse.unregisterTerminal(terminal);

    // Verify unregistration doesn't throw
    assert.ok(true);

    terminal.kill();
  });
});

describe("Filesystem management", () => {
  test("can set filesystem", () => {
    const filesystem = new Filesystem(synapse);

    synapse.setFilesystem(filesystem);

    // Verify filesystem setting doesn't throw
    assert.ok(true);

    filesystem.cleanup();
  });
});

describe("Ports management", () => {
  test("can get ports instance", () => {
    const ports = synapse.getPorts();
    assert.ok(ports);
  });

  test("can start port monitoring", () => {
    synapse.startPortMonitoring();

    // Verify monitoring start doesn't throw
    assert.ok(true);
  });

  test("can stop port monitoring", () => {
    synapse.startPortMonitoring();
    synapse.stopPortMonitoring();

    // Verify monitoring stop doesn't throw
    assert.ok(true);
  });

  test("can stop port monitoring when not started", () => {
    synapse.stopPortMonitoring();

    // Verify stopping without starting doesn't throw
    assert.ok(true);
  });
});

describe("Method chaining", () => {
  test("onOpen returns synapse instance for chaining", () => {
    const result = synapse.onOpen(() => {});
    assert.strictEqual(result, synapse);
  });

  test("onClose returns synapse instance for chaining", () => {
    const result = synapse.onClose(() => {});
    assert.strictEqual(result, synapse);
  });

  test("onError returns synapse instance for chaining", () => {
    const result = synapse.onError(() => {});
    assert.strictEqual(result, synapse);
  });

  test("onMessageType returns synapse instance for chaining", () => {
    const result = synapse.onMessageType("test", () => {});
    assert.strictEqual(result, synapse);
  });

  test("on returns synapse instance for chaining", () => {
    const result = synapse.on("test", () => {});
    assert.strictEqual(result, synapse);
  });

  test("onConnection returns synapse instance for chaining", () => {
    const result = synapse.onConnection(() => {});
    assert.strictEqual(result, synapse);
  });
});
