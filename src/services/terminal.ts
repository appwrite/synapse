import * as pty from "node-pty";
import * as os from "os";
import { Synapse } from "../synapse";

export type TerminalOptions = {
  shell: string;
  cols?: number;
  rows?: number;
  workdir?: string;
};

export class Terminal {
  private synapse: Synapse;
  private term: pty.IPty | null = null;
  private onDataCallback: ((data: string) => void) | null = null;
  private isAlive: boolean = false;

  /**
   * Creates a new Terminal instance
   * @param synapse - The Synapse instance to use
   * @param terminalOptions - The options for the terminal
   */
  constructor(
    synapse: Synapse,
    terminalOptions: TerminalOptions = {
      shell: os.platform() === "win32" ? "powershell.exe" : "bash",
      cols: 80,
      rows: 24,
      workdir: process.cwd(),
    },
  ) {
    this.synapse = synapse;
    try {
      this.term = pty.spawn(terminalOptions.shell, [], {
        name: "xterm-color",
        cols: terminalOptions.cols,
        rows: terminalOptions.rows,
        cwd: terminalOptions.workdir,
        env: process.env,
      });

      this.isAlive = true;

      this.term.onData((data: string) => {
        if (this.onDataCallback) {
          this.onDataCallback(data);
        }
      });

      this.term.onExit(() => {
        this.isAlive = false;
        this.term = null;
      });
    } catch (error) {
      console.error("Failed to spawn terminal:", error);
      this.isAlive = false;
      this.term = null;
    }
  }

  /**
   * Checks if the terminal is alive and ready
   * @throws Error if terminal is not alive
   */
  private checkTerminal(): void {
    if (!this.isAlive || !this.term) {
      throw new Error("Terminal is not alive or has been terminated");
    }
  }

  /**
   * Resizes the terminal
   * @param cols - The number of columns
   * @param rows - The number of rows
   */
  updateSize(cols: number, rows: number): void {
    try {
      this.checkTerminal();
      this.term?.resize(Math.max(cols, 1), Math.max(rows, 1));
    } catch (error) {
      if (this.onDataCallback) {
        this.onDataCallback("Failed to resize terminal");
      }
    }
  }

  /**
   * Writes a command to the terminal
   * @param command - The command to write
   */
  createCommand(command: string): void {
    try {
      this.checkTerminal();
      this.term?.write(command);
    } catch (error) {
      if (this.onDataCallback) {
        this.onDataCallback("Failed to write command to terminal");
      }
    }
  }

  /**
   * Sets the callback for when data is received from the terminal
   * @param callback - The callback to set
   */
  onData(callback: (data: string) => void): void {
    this.onDataCallback = callback;
  }

  /**
   * Kills the terminal
   */
  kill(): void {
    if (this.isAlive && this.term) {
      this.term.kill();
      this.isAlive = false;
      this.term = null;
    }
  }

  /**
   * Checks if the terminal is still alive
   * @returns boolean indicating if the terminal is alive
   */
  isTerminalAlive(): boolean {
    return this.isAlive && this.term !== null;
  }
}
