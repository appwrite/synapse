import fs from "fs";
import * as pty from "node-pty";
import * as os from "os";
import { Synapse } from "../synapse";
import { exec } from "child_process";
import { promisify } from "util";

export type TerminalOptions = {
  shell: string;
  cols?: number;
  rows?: number;
  workDir: string;
};

export class Terminal {
  private synapse: Synapse;
  private term: pty.IPty | null = null;
  private onDataCallback: ((success: boolean, data: string) => void) | null =
    null;
  private onExitCallback:
    | ((success: boolean, exitCode: number, signal: number | undefined) => void)
    | null = null;
  private isAlive: boolean = false;
  private initializationError: Error | null = null;

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
      workDir: process.cwd(),
    },
  ) {
    this.synapse = synapse;
    this.synapse.registerTerminal(this);

    if (!fs.existsSync(terminalOptions.workDir)) {
      fs.mkdirSync(terminalOptions.workDir, { recursive: true });
    }

    try {
      this.term = pty.spawn(terminalOptions.shell, [], {
        name: "xterm-color",
        cols: terminalOptions.cols,
        rows: terminalOptions.rows,
        cwd: terminalOptions.workDir,
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

        if (
          this.onExitCallback &&
          e &&
          e.exitCode !== undefined &&
          e.signal !== undefined
        ) {
          this.onExitCallback(e.exitCode === 0, e.exitCode, e.signal);
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
      this.term?.write(command);
    } catch (error) {
      console.error("Failed to execute command:", error);
    }
  }

  async executeCommand(
    command: string,
    cwd: string,
    timeout: number = 5000,
  ): Promise<{ output: string; exitCode: number }> {
    if (!command) {
      throw new Error("Command is required");
    }

    if (!cwd) {
      throw new Error("cwd is required");
    }

    try {
      const { stdout, stderr } = await promisify(exec)(command, {
        cwd,
        encoding: "utf-8",
        timeout,
      });

      return {
        output: stdout || stderr || "",
        exitCode: 0, // Success case - error case is handled in catch block
      };
    } catch (error: any) {
      console.error("Failed to execute command:", error);
      return {
        output: `Error: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Sets the callback for when data is received from the terminal
   * @param callback - The callback to set
   */
  onData(callback: (success: boolean, data: string) => void): void {
    this.onDataCallback = (success: boolean, data: string) => {
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
   * Sets the callback for when the terminal exits
   * @param callback - The callback to set
   */
  onExit(
    callback: (
      success: boolean,
      exitCode: number,
      signal: number | undefined,
    ) => void,
  ): void {
    this.onExitCallback = (
      success: boolean,
      exitCode: number,
      signal: number | undefined,
    ) => {
      callback(success, exitCode, signal);
    };
  }

  /**
   * Updates the working directory of the terminal
   * @param workDir - The new working directory
   */
  updateWorkDir(workDir: string): void {
    try {
      if (!fs.existsSync(workDir)) {
        fs.mkdirSync(workDir, { recursive: true });
      }

      this.checkTerminal();
      this.createCommand(`cd "${workDir}"\n`);
    } catch (error) {
      console.error("Failed to update working directory:", error);
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
      this.synapse.unregisterTerminal(this);

      if (this.onExitCallback) {
        this.onExitCallback(true, 0, undefined);
      }
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
