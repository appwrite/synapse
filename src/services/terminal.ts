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
  private term: pty.IPty | null = null;
  private synapse: Synapse;
  private onDataCallback: ((data: string) => void) | null = null;

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
    this.term = pty.spawn(terminalOptions.shell, [], {
      name: "xterm-color",
      cols: terminalOptions.cols,
      rows: terminalOptions.rows,
      cwd: terminalOptions.workdir,
      env: process.env,
    });

    this.term.onData((data: string) => {
      if (this.onDataCallback) {
        this.onDataCallback(data);
      }
    });
  }

  /**
   * Resizes the terminal
   * @param cols - The number of columns
   * @param rows - The number of rows
   */
  resize(cols: number, rows: number): void {
    this.term?.resize(cols, rows);
  }

  /**
   * Writes a command to the terminal
   * @param command - The command to write
   */
  write(command: string): void {
    this.term?.write(command);
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
    this.term?.kill();
  }
}
