import * as pty from "node-pty";
import * as os from "os";
import { Terminal, TerminalOptions } from "../../src/services/terminal";
import { Synapse } from "../../src/synapse";

jest.mock("node-pty");

describe("Terminal", () => {
  let terminal: Terminal;
  let mockSynapse: Synapse;
  let mockPty: jest.Mocked<pty.IPty>;

  beforeEach(() => {
    mockSynapse = new Synapse();
    mockPty = {
      onData: jest.fn(),
      write: jest.fn(),
      resize: jest.fn(),
      kill: jest.fn(),
      process: "test-process",
      pid: 123,
    } as unknown as jest.Mocked<pty.IPty>;

    (pty.spawn as jest.Mock).mockReturnValue(mockPty);
  });

  describe("constructor", () => {
    it("should create terminal with default options", () => {
      const defaultShell =
        os.platform() === "win32" ? "powershell.exe" : "bash";

      terminal = new Terminal(mockSynapse);

      expect(pty.spawn).toHaveBeenCalledWith(
        defaultShell,
        [],
        expect.objectContaining({
          name: "xterm-color",
          cols: 80,
          rows: 24,
          cwd: process.cwd(),
          env: process.env,
        }),
      );
    });

    it("should create terminal with custom options", () => {
      const customOptions: TerminalOptions = {
        shell: "zsh",
        cols: 100,
        rows: 30,
        workdir: "/custom/path",
      };

      terminal = new Terminal(mockSynapse, customOptions);

      expect(pty.spawn).toHaveBeenCalledWith(
        "zsh",
        [],
        expect.objectContaining({
          name: "xterm-color",
          cols: 100,
          rows: 30,
          cwd: "/custom/path",
          env: process.env,
        }),
      );
    });
  });

  describe("terminal operations", () => {
    beforeEach(() => {
      terminal = new Terminal(mockSynapse);
    });

    it("should handle resize operation with minimum values", () => {
      terminal.updateSize(0, -5);

      expect(mockPty.resize).toHaveBeenCalledWith(1, 1);
    });

    it("should handle write operation with command", () => {
      const command = "ls -la\n";

      terminal.createCommand(command);

      expect(mockPty.write).toHaveBeenCalledWith(command);
    });

    it("should handle data callback", () => {
      const mockCallback = jest.fn();

      terminal.onData(mockCallback);

      // Simulate data event by calling the onData handler
      const dataHandler = (mockPty.onData as jest.Mock).mock.calls[0][0];
      const testOutput = "test output";
      dataHandler(testOutput);

      expect(mockCallback).toHaveBeenCalledWith(testOutput);
    });

    it("should override previous data callback", () => {
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();

      terminal.onData(mockCallback1);
      terminal.onData(mockCallback2);

      // Simulate data event by calling the onData handler
      const dataHandler = (mockPty.onData as jest.Mock).mock.calls[0][0];
      const testOutput = "test output";
      dataHandler(testOutput);

      // First callback should not be called, only the second one
      expect(mockCallback1).not.toHaveBeenCalled();
      expect(mockCallback2).toHaveBeenCalledWith(testOutput);
    });

    it("should handle kill operation", () => {
      terminal.kill();

      expect(mockPty.kill).toHaveBeenCalled();
    });
  });
});
