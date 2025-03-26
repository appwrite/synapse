import * as pty from "node-pty";
import { Terminal } from "../../src/services/terminal";
import { Synapse } from "../../src/synapse";

jest.mock("node-pty");

describe("Terminal", () => {
  let terminal: Terminal;
  let mockSynapse: Synapse;
  let mockPty: jest.Mocked<pty.IPty>;

  beforeEach(() => {
    mockSynapse = new Synapse();

    // Setup mock PTY
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
      terminal = new Terminal(mockSynapse);

      expect(pty.spawn).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.objectContaining({
          name: "xterm-color",
          cols: 80,
          rows: 24,
          cwd: expect.any(String),
          env: expect.any(Object),
        }),
      );
    });

    it("should create terminal with custom options", () => {
      terminal = new Terminal(mockSynapse, {
        shell: "zsh",
        cols: 100,
        rows: 30,
        workdir: "/custom/path",
      });

      expect(pty.spawn).toHaveBeenCalledWith(
        "zsh",
        [],
        expect.objectContaining({
          name: "xterm-color",
          cols: 100,
          rows: 30,
          cwd: "/custom/path",
          env: expect.any(Object),
        }),
      );
    });
  });

  describe("terminal operations", () => {
    beforeEach(() => {
      terminal = new Terminal(mockSynapse);
    });

    it("should handle resize operation", () => {
      terminal.resize(100, 50);
      expect(mockPty.resize).toHaveBeenCalledWith(100, 50);
    });

    it("should handle write operation", () => {
      terminal.write("ls -la\n");
      expect(mockPty.write).toHaveBeenCalledWith("ls -la\n");
    });

    it("should handle data callback", () => {
      const mockCallback = jest.fn();
      terminal.onData(mockCallback);

      // Get the callback that was registered with mockPty.onData
      const registeredCallback = (mockPty.onData as jest.Mock).mock.calls[0][0];

      // Simulate data coming from the terminal
      registeredCallback("test output");

      expect(mockCallback).toHaveBeenCalledWith("test output");
    });

    it("should handle kill operation", () => {
      terminal.kill();
      expect(mockPty.kill).toHaveBeenCalled();
    });
  });
});
