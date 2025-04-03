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
    console.log("Terminal constructor called with options:", terminalOptions);

    try {
      this.term = pty.spawn(terminalOptions.shell, [], {
        name: "xterm-color",
        cols: terminalOptions.cols,
        rows: terminalOptions.rows,
        cwd: terminalOptions.workdir,
        env: process.env,
      });

      console.log("Terminal spawned successfully");
      this.isAlive = true;

      this.term.onData((data: string) => {
        if (this.onDataCallback) {
          this.onDataCallback(true, data);
        }
      });

      this.term.onExit((e?: { exitCode: number; signal?: number }) => {
        console.log(
          `Terminal exited with code ${e?.exitCode ?? "unknown"} and signal ${e?.signal ?? "none"}`,
        );
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
  updateSize(cols: number, rows: number): void {
    console.log(
      `Updating terminal size to ${cols}x${rows}, isAlive=${this.isAlive}`,
    );
    try {
      this.checkTerminal();
      this.term?.resize(Math.max(cols, 1), Math.max(rows, 1));
      console.log("Terminal size updated successfully");
    } catch (error) {
      console.error("Failed to update terminal size:", error);
      if (this.onDataCallback) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        this.onDataCallback(false, errorMessage);
      }
    }
  }

  /**
   * Writes a command to the terminal
   * @param command - The command to write
   */
  createCommand(command: string): void {
    console.log(
      `Executing command: ${command.substring(0, 50)}${command.length > 50 ? "..." : ""}`,
    );
    try {
      this.checkTerminal();
      this.lastCommand = command.trim();
      this.term?.write(command);
    } catch (error) {
      console.error("Failed to execute command:", error);
      if (this.onDataCallback) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        this.onDataCallback(false, errorMessage);
      }
    }
  }

  /**
   * Cleans terminal output data by removing ANSI escape sequences, carriage returns, and extra whitespace
   * Also filters out the echoed command from the output
   * @param data - The raw terminal output data
   * @returns The cleaned data string
   */
  private cleanData(data: string): string {
    let cleaned = data
      .replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, "") // Remove ANSI escape sequences
      .replace(/\r/g, ""); // Remove carriage returns

    if (this.lastCommand && cleaned.trim().startsWith(this.lastCommand)) {
      cleaned = cleaned.slice(this.lastCommand.length);
    }

    return cleaned.trim();
  }

  /**
   * Sets the callback for when data is received from the terminal
   * @param callback - The callback to set
   */
  onData(callback: (success: boolean, data: string) => void): void {
    // Wrap the callback to clean the data before sending
    this.onDataCallback = (success: boolean, data: string) => {
      callback(success, this.cleanData(data));
    };

    // If there was an initialization error, notify the callback immediately
    if (this.initializationError && callback) {
      callback(
        false,
        this.cleanData(
          `Terminal initialization failed: ${this.initializationError.message}`,
        ),
      );
    }
  }

  /**
   * Kills the terminal
   */
  kill(): void {
    console.log("Killing terminal");
    if (this.isAlive && this.term) {
      this.term.kill();
      this.isAlive = false;
      this.term = null;
      console.log("Terminal killed successfully");
    } else {
      console.log("Terminal was already not alive, nothing to kill");
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
