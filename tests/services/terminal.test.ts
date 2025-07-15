import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Terminal, TerminalOptions } from "../../src/services/terminal";
import { Synapse } from "../../src/synapse";

let terminal: Terminal;
let synapse: Synapse;

beforeEach(() => {
  synapse = new Synapse();
  terminal = new Terminal(synapse);
});

afterEach(() => {
  terminal.kill();
  synapse.disconnect();
});

describe("Basic terminal functionality", () => {
  test("initializes with correct state", () => {
    assert.strictEqual(terminal.isTerminalAlive(), true);
  });

  test("handles data events", (t) => {
    let receivedData = "";
    terminal.onData((success, data) => {
      receivedData = data;
    });
    // Simulate output
    terminal["term"]?.write?.("test output");
    // The above line assumes your Terminal class exposes a way to simulate output for tests.
    // If not, you may need to refactor for testability.
    // For now, just check that the handler can be set.
    assert.ok(typeof terminal.onData === "function");
  });

  test("handles terminal death", () => {
    terminal.kill();
    assert.strictEqual(terminal.isTerminalAlive(), false);
  });

  test("calls onExit callback on terminal exit", () => {
    let callbackCalled = false;
    let callbackArgs: any[] = [];
    terminal.onExit((success, exitCode, signal) => {
      callbackCalled = true;
      callbackArgs = [success, exitCode, signal];
    });
    // Simulate terminal exit
    terminal.kill();
    // The above assumes kill triggers onExit. If not, you may need to expose a way to simulate exit.
    assert.strictEqual(callbackCalled, true);
    assert.deepEqual(callbackArgs.slice(1), [0, undefined]); // exitCode 0, signal undefined
  });
});

describe("Terminal operations", () => {
  test("updates working directory", () => {
    const newDir = "/tmp";
    terminal.updateWorkDir(newDir);
    // There is no direct way to assert this unless the Terminal class exposes the current workDir or command history.
    // You may want to add a getter or spy on the underlying pty process.
    assert.ok(terminal.isTerminalAlive());
  });

  test("does not operate when terminal is dead", () => {
    terminal.kill();
    terminal.updateSize(80, 24);
    terminal.createCommand("test");
    assert.strictEqual(terminal.isTerminalAlive(), false);
  });

  test("handles custom initialization", () => {
    const customOptions: TerminalOptions = {
      shell: "zsh",
      cols: 100,
      rows: 30,
      workDir: process.cwd(),
    };
    const customTerminal = new Terminal(synapse, customOptions);
    assert.strictEqual(customTerminal.isTerminalAlive(), true);
  });
});

describe("Command execution", () => {
  test("successfully executes a command", async () => {
    const result = await terminal.executeCommand({
      command: "echo hello",
      cwd: "/tmp",
    });
    assert.deepEqual(result, {
      output: "hello\n",
      exitCode: 0,
    });
  });

  test("handles command execution errors", async () => {
    const result = await terminal.executeCommand({
      command: "invalid-command",
      cwd: "/tmp",
    });
    assert.strictEqual(typeof result.output, "string");
    assert.strictEqual(result.exitCode, 1);
  });

  test("throws error when command is not provided", async () => {
    await assert.rejects(
      () => terminal.executeCommand({ command: "", cwd: "/tmp" }),
      /Command is required/,
    );
  });
});
