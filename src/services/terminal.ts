import * as pty from "node-pty";
import * as os from "os";
import { Synapse } from "../synapse";

export type TerminalOptions = {
  shell: string;
  cols?: number;
  rows?: number;
  workdir?: string;
};

export type TerminalData = {
  success: boolean;
  data?: string;
  error?: string;
};

export class Terminal {
  private synapse: Synapse;
  private term: pty.IPty | null = null;
  private onDataCallback: ((success: boolean, data: string) => void) | null =
    null;
  private isAlive: boolean = false;
  private initializationError: Error | null = null;
  private lastCommand: string = "";

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
          this.onDataCallback(true, data);
        }
      });

      this.term.onExit((e?: { exitCode: number; signal?: number }) => {
        this.isAlive = false;
        this.term = null;

        if (this.onDataCallback) {
          this.onDataCallback(
            false,
            `Terminal process exited with code ${e?.exitCode ?? "unknown"}`,
          );
        }
      });
    } catch (error) {
      this.initializationError =
        error instanceof Error ? error : new Error(String(error));
      console.error("Failed to spawn terminal:", error);
      this.isAlive = false;
      this.term = null;

      if (this.onDataCallback) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        this.onDataCallback(
          false,
          `Terminal initialization failed: ${errorMessage}`,
        );
      }
    }
  }

  /**
   * Get initialization error if any
   * @returns The initialization error or null
   */
  getInitializationError(): Error | null {
    return this.initializationError;
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
  updateSize(cols: number, rows: number): TerminalData {
    try {
      this.checkTerminal();
      this.term?.resize(Math.max(cols, 1), Math.max(rows, 1));
      return {
        success: true,
        data: "Terminal size updated successfully",
      };
    } catch (error) {
      console.error("Failed to update terminal size:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Writes a command to the terminal
   * @param command - The command to write
   */
  createCommand(command: string): TerminalData {
    try {
      this.checkTerminal();
      this.lastCommand = command.trim();

      // Ensure command ends with newline
      if (!command.endsWith("\n")) {
        command += "\n";
      }

      this.term?.write(command);
      return {
        success: true,
        data: "Command executed successfully",
      };
    } catch (error) {
      console.error("Failed to execute command:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Sets the callback for when data is received from the terminal
   * @param callback - The callback to set
   */
  onData(callback: (success: boolean, data: string) => void): void {
    // Wrap the callback to clean the data before sending
    this.onDataCallback = (success: boolean, data: string) => {
      callback(success, data);
    };

    // If there was an initialization error, notify the callback immediately
    if (this.initializationError && callback) {
      callback(
        false,
        `Terminal initialization failed: ${this.initializationError.message}`,
      );
    }
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
