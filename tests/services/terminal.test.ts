import fs from "fs";
import * as pty from "node-pty";
import { Terminal, TerminalOptions } from "../../src/services/terminal";
import { Synapse } from "../../src/synapse";

jest.mock("node-pty");

describe("Terminal", () => {
  let terminal: Terminal;
  let mockSynapse: Synapse;
  let mockPty: jest.Mocked<pty.IPty>;
  let onDataHandler: (data: string) => void;

  beforeEach(() => {
    mockSynapse = new Synapse();
    mockPty = {
      onData: jest.fn((callback) => {
        onDataHandler = callback;
        return mockPty;
      }),
      onExit: jest.fn(() => {
        return mockPty;
      }),
      write: jest.fn(),
      resize: jest.fn(),
      kill: jest.fn(),
      process: "test-process",
      pid: 123,
    } as unknown as jest.Mocked<pty.IPty>;

    (pty.spawn as jest.Mock).mockReturnValue(mockPty);
  });

  describe("basic terminal functionality", () => {
    beforeEach(() => {
      terminal = new Terminal(mockSynapse);
      jest.spyOn(fs, "existsSync").mockReturnValue(true);
    });

    it("should initialize with correct state", () => {
      expect(terminal.isTerminalAlive()).toBe(true);
    });

    it("should handle data events", () => {
      let receivedData = "";
      terminal.onData((success, data) => {
        receivedData = data;
      });

      onDataHandler("test output");
      expect(receivedData).toBe("test output");
    });

    it("should handle terminal death", () => {
      terminal.kill();
      expect(terminal.isTerminalAlive()).toBe(false);
    });

    it("should call onExit callback on terminal exit", () => {
      let callbackCalled = false;
      let callbackArgs: any[] = [];
      terminal.onExit((success, exitCode, signal) => {
        callbackCalled = true;
        callbackArgs = [success, exitCode, signal];
      });

      // Simulate the terminal's onExit event
      // The constructor sets up: this.term.onExit((e) => { ... })
      // So we need to call the callback passed to mockPty.onExit
      const onExitMock = (mockPty.onExit as jest.Mock).mock.calls[0][0];
      onExitMock({ exitCode: 0, signal: 15 });

      expect(callbackCalled).toBe(true);
      expect(callbackArgs).toEqual([true, 0, 15]);
    });
  });

  describe("terminal operations", () => {
    beforeEach(() => {
      terminal = new Terminal(mockSynapse);
      jest.spyOn(fs, "existsSync").mockReturnValue(true);
    });

    it("should update working directory", () => {
      terminal.updateWorkDir("/new/path");
      expect(mockPty.write).toHaveBeenCalledWith('cd "/new/path"\n');
    });

    it("should not operate when terminal is dead", () => {
      terminal.kill();
      terminal.updateSize(80, 24);
      terminal.createCommand("test");

      expect(terminal.isTerminalAlive()).toBe(false);
    });

    it("should handle custom initialization", () => {
      const customOptions: TerminalOptions = {
        shell: "zsh",
        cols: 100,
        rows: 30,
        workDir: process.cwd(),
      };

      const customTerminal = new Terminal(mockSynapse, customOptions);
      expect(customTerminal.isTerminalAlive()).toBe(true);
    });
  });
});
