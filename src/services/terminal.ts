import * as pty from "node-pty";
import * as os from "os";
import { Synapse } from "../synapse";

export type TerminalOptions = {
  shell: string;
  cols?: number;
  rows?: number;
};

export class Terminal {
  private synapse: Synapse;
  private term: pty.IPty | null = null;
  private onDataCallback: ((success: boolean, data: string) => void) | null =
    null;
  private isAlive: boolean = false;
  private initializationError: Error | null = null;
  private lastCommand: string | null = null;

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
    },
  ) {
    this.synapse = synapse;

    try {
      this.term = pty.spawn(terminalOptions.shell, [], {
        name: "xterm-color",
        cols: terminalOptions.cols,
        rows: terminalOptions.rows,
        cwd: this.synapse.workDir,
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

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[Terminal][${timestamp}] ${message}`);
  }

  private stripAnsi(str: string): string {
    return str
      .replace(
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        "",
      ) // Remove ANSI escape sequences
      .replace(/\r/g, "") // Remove carriage returns
      .replace(/\u001b\[?[0-9;]*[A-Za-z]/g, "") // Remove cursor movements
      .replace(/\u001b\[\?[0-9;]*[A-Za-z]/g, ""); // Remove terminal mode commands
  }

  private checkTerminal(): void {
    if (!this.isAlive || !this.term) {
      throw new Error("Terminal is not alive or has been terminated");
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
   * Resizes the terminal
   * @param cols - The number of columns
   * @param rows - The number of rows
   */
  updateSize(cols: number, rows: number): void {
    try {
      this.checkTerminal();
      this.term?.resize(Math.max(cols, 1), Math.max(rows, 1));
    } catch (error) {
      console.error("Failed to update terminal size:", error);
    }
  }

  /**
   * Writes a command to the terminal
   * @param command - The command to write
   */
  createCommand(command: string): void {
    try {
      this.checkTerminal();
      this.log(`Writing command: ${command}`);

      this.lastCommand = command;

      // Ensure command ends with newline
      if (!command.endsWith("\n")) {
        command += "\n";
      }

      this.term?.write(command);
    } catch (error) {
      console.error("Failed to execute command:", error);
    }
  }

  /**
   * Sets the callback for when data is received from the terminal
   * @param callback - The callback to set
   */
  onData(callback: (success: boolean, data: string) => void): void {
    this.onDataCallback = (success: boolean, data: string) => {
      const cleanData = this.stripAnsi(data);
      const cleanCommand = this.lastCommand
        ? this.stripAnsi(this.lastCommand)
        : null;

      if (cleanCommand && cleanData === cleanCommand) {
        return;
      }

      callback(success, data);
    };

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
      this.log("Killing terminal");
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
