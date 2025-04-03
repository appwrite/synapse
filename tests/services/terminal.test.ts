import * as pty from "node-pty";
import { Terminal, TerminalOptions } from "../../src/services/terminal";
import { Synapse } from "../../src/synapse";

jest.mock("node-pty");

describe("Terminal", () => {
  let terminal: Terminal;
  let mockSynapse: Synapse;
  let mockPty: jest.Mocked<pty.IPty>;
  let onDataHandler: (data: string) => void;
  let onExitHandler: () => void;

  beforeEach(() => {
    mockSynapse = new Synapse();
    mockPty = {
      onData: jest.fn((callback) => {
        onDataHandler = callback;
        return mockPty;
      }),
      onExit: jest.fn((callback) => {
        onExitHandler = callback;
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
  });

  describe("terminal operations", () => {
    beforeEach(() => {
      terminal = new Terminal(mockSynapse);
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
        workdir: "/custom/path",
      };

      const customTerminal = new Terminal(mockSynapse, customOptions);
      expect(customTerminal.isTerminalAlive()).toBe(true);
    });
  });
});
