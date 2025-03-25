import * as pty from "node-pty";
import { Synapse } from "../synapse";

export type TerminalOptions = {
  shell: string;
  cols?: number;
  rows?: number;
  workdir?: string;
  logger?: (message: string) => void;
};

export class Terminal {
  private term: pty.IPty | null = null;
  private terminalOptions: TerminalOptions;
  private synapse: Synapse;
  private onDataCallback: ((data: string) => void) | null = null;

  constructor(synapse: Synapse) {
    this.synapse = synapse;
    this.terminalOptions = this.synapse.getTerminalOptions();

    this.term = pty.spawn(this.terminalOptions.shell, [], {
      name: "xterm-color",
      cols: this.terminalOptions.cols,
      rows: this.terminalOptions.rows,
      cwd: this.terminalOptions.workdir,
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
    this.synapse.disconnect();
    this.term?.kill();
  }
}
