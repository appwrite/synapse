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

  resize(cols: number, rows: number): void {
    this.term?.resize(cols, rows);
  }

  write(command: string): void {
    this.term?.write(command);
  }

  onData(callback: (data: string) => void): void {
    this.onDataCallback = callback;
  }

  kill(): void {
    this.term?.kill();
  }
}
