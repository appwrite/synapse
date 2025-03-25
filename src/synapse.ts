import * as pty from "node-pty";
import * as os from "os";
import WebSocket from "ws";
import Filesystem, { FileOperationResult } from "./services/filesystem";
import System, { SystemUsageData } from "./services/system";

type SynapseOptions = {
  shell?: string;
  cols?: number;
  rows?: number;
  workdir?: string;
  logger?: (message: string) => void;
};

type MessagePayload = {
  type: string;
  requestId: string;
  [key: string]: any;
};

type MessageHandler = (message: MessagePayload) => void;
type ConnectionCallback = () => void;
type ErrorCallback = (error: Error) => void;

class Synapse {
  private options: Required<SynapseOptions>;
  private ws: WebSocket | null = null;
  private term: pty.IPty | null = null;
  private messageHandlers: Record<string, MessageHandler> = {};
  private connectionListeners = {
    onOpen: (() => {}) as ConnectionCallback,
    onClose: (() => {}) as ConnectionCallback,
    onError: (() => {}) as ErrorCallback,
  };
  private filesystem: Filesystem;
  private system: System;

  constructor(options: SynapseOptions = {}) {
    const defaultLogger = (message: string): void => {
      if (options.logger) {
        options.logger(message);
      } else {
        console.log(message);
      }
    };

    this.options = {
      shell: os.platform() === "win32" ? "powershell.exe" : "bash",
      cols: 80,
      rows: 24,
      workdir: process.cwd(),
      logger: defaultLogger,
      ...options,
    };

    this.filesystem = new Filesystem(this.options.logger);
    this.system = new System(this.options.logger);
  }

  /**
   * Establishes a WebSocket connection to the specified URL and initializes the terminal
   * @param url - The WebSocket server URL to connect to
   * @returns Promise that resolves with the Synapse instance when connected
   * @throws Error if WebSocket connection fails
   */
  connect(url: string): Promise<Synapse> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.initializeTerm();
        this.connectionListeners.onOpen();
        resolve(this);
      };

      this.ws.onmessage = (event: WebSocket.MessageEvent) =>
        this.handleMessage(event);

      this.ws.onerror = (event: WebSocket.ErrorEvent) => {
        this.connectionListeners.onError(new Error("WebSocket error occurred"));
        reject(new Error("WebSocket error occurred"));
      };

      this.ws.onclose = () => {
        this.connectionListeners.onClose();
        this.term?.kill();
      };
    });
  }

  private initializeTerm(): void {
    this.term = pty.spawn(this.options.shell, [], {
      name: "xterm-color",
      cols: this.options.cols,
      rows: this.options.rows,
      cwd: this.options.workdir,
      env: process.env,
    });

    this.term.onData((data: string) => {
      this.send("terminalOutput", { data });
    });
  }

  private send(type: string, payload: Record<string, any> = {}): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }

    const message: MessagePayload = {
      type,
      requestId: Date.now().toString(),
      ...payload,
    };

    return new Promise((resolve) => {
      this.ws!.send(JSON.stringify(message));
      resolve(message);
    });
  }

  private handleMessage(event: WebSocket.MessageEvent): void {
    try {
      const message: MessagePayload = JSON.parse(event.data as string);

      if (this.messageHandlers[message.type]) {
        this.messageHandlers[message.type](message);
      }
    } catch (error) {
      console.error("Message parsing error:", error);
    }
  }

  /**
   * Resizes the terminal window to the specified dimensions
   * @param cols - Number of columns for the terminal
   * @param rows - Number of rows for the terminal
   */
  resizeTerminal(cols: number, rows: number): void {
    this.send("terminal", {
      operation: "updateSize",
      params: { cols, rows },
    });
  }

  /**
   * Sends a command to the terminal for execution
   * @param command - The command string to execute
   */
  sendCommand(command: string): void {
    this.send("terminal", {
      operation: "createCommand",
      params: { command },
    });
  }

  createFile(filepath: string, content: string): Promise<FileOperationResult> {
    return this.filesystem.createFile(filepath, content);
  }

  getFile(filepath: string): Promise<FileOperationResult> {
    return this.filesystem.getFile(filepath);
  }

  updateFile(filepath: string, content: string): Promise<FileOperationResult> {
    return this.filesystem.updateFile(filepath, content);
  }

  updateFilePath(
    filepath: string,
    newPath: string,
  ): Promise<FileOperationResult> {
    return this.filesystem.updateFilePath(filepath, newPath);
  }

  deleteFile(filepath: string): Promise<FileOperationResult> {
    return this.filesystem.deleteFile(filepath);
  }

  createFolder(folderpath: string): Promise<FileOperationResult> {
    return this.filesystem.createFolder(folderpath);
  }

  getFolder(folderpath: string): Promise<FileOperationResult> {
    return this.filesystem.getFolder(folderpath);
  }

  updateFolderName(
    folderpath: string,
    name: string,
  ): Promise<FileOperationResult> {
    return this.filesystem.updateFolderName(folderpath, name);
  }

  updateFolderPath(
    folderpath: string,
    newPath: string,
  ): Promise<FileOperationResult> {
    return this.filesystem.updateFolderPath(folderpath, newPath);
  }

  deleteFolder(folderpath: string): Promise<FileOperationResult> {
    return this.filesystem.deleteFolder(folderpath);
  }

  getSystemUsage(measurementInterval?: number): Promise<SystemUsageData> {
    return this.system.getUsage(measurementInterval);
  }

  /**
   * Registers a callback for when the WebSocket connection is established
   * @param callback - Function to be called when connection opens
   * @returns The Synapse instance for method chaining
   */
  onOpen(callback: ConnectionCallback): Synapse {
    this.connectionListeners.onOpen = callback;
    return this;
  }

  /**
   * Registers a callback for when the WebSocket connection is closed
   * @param callback - Function to be called when connection closes
   * @returns The Synapse instance for method chaining
   */
  onClose(callback: ConnectionCallback): Synapse {
    this.connectionListeners.onClose = callback;
    return this;
  }

  /**
   * Registers a callback for handling WebSocket connection errors
   * @param callback - Function to be called when an error occurs
   * @returns The Synapse instance for method chaining
   */
  onError(callback: ErrorCallback): Synapse {
    this.connectionListeners.onError = callback;
    return this;
  }

  /**
   * Registers a handler for specific message types received through WebSocket
   * @param type - The message type to handle
   * @param handler - Function to handle messages of the specified type
   * @returns The Synapse instance for method chaining
   */
  onMessageType(type: string, handler: MessageHandler): Synapse {
    this.messageHandlers[type] = handler;
    return this;
  }

  /**
   * Closes the WebSocket connection and terminates the terminal process
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.term?.kill();
    }
  }
}

export default Synapse;
