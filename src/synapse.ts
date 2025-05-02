import fs from "fs";
import { IncomingMessage } from "http";
import { Socket } from "net";
import WebSocket, { WebSocketServer } from "ws";
import { Terminal } from "./services/terminal";

export type MessagePayload = {
  type: string;
  requestId: string;
  [key: string]: string | Record<string, unknown>;
};

export type MessageHandler = (message: MessagePayload) => void;
export type ConnectionCallback = () => void;
export type ErrorCallback = (error: Error) => void;
export type ServerConnectionCallback = (ws: WebSocket) => void;
export type Logger = (message: string) => void;

class Synapse {
  private ws: WebSocket | null = null;
  private wss: WebSocketServer;
  private messageHandlers: Record<string, MessageHandler> = {};
  private connectionListeners = {
    onOpen: (() => {}) as ConnectionCallback,
    onClose: (() => {}) as ConnectionCallback,
    onError: (() => {}) as ErrorCallback,
  };

  private terminals: Set<Terminal> = new Set();

  private isReconnecting = false;
  private maxReconnectAttempts = 5;
  private reconnectAttempts = 0;
  private reconnectInterval = 3000;
  private lastPath: string | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private host: string;
  private port: number;

  public workDir: string;

  private serverConnectionListener: ServerConnectionCallback = () => {};

  constructor(
    host: string = "localhost",
    port: number = 3000,
    workDir: string = process.cwd(),
  ) {
    this.host = host;
    this.port = port;

    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }
    this.workDir = workDir;

    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on("connection", (ws: WebSocket) => {
      this.serverConnectionListener(ws);
      this.setupWebSocket(ws);
    });
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[Synapse][${timestamp}] ${message}`);
  }

  private setupWebSocket(ws: WebSocket): void {
    this.ws = ws;
    this.reconnectAttempts = 0;

    ws.onmessage = (event) => this.handleMessage(event);

    ws.onclose = () => {
      this.ws = null;
      this.connectionListeners.onClose();
      this.attemptReconnect();
    };

    ws.onerror = (error) => {
      const errorMessage = `WebSocket error: ${error.message || "Unknown error"}. Connection to ${this.host}:${this.port} failed.`;
      this.connectionListeners.onError(new Error(errorMessage));
    };

    this.connectionListeners.onOpen();
  }

  private attemptReconnect() {
    if (
      this.isReconnecting ||
      this.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.log(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
      );
      this.connect(this.lastPath || "/")
        .then(() => {
          this.isReconnecting = false;
          this.log("Reconnection successful");
        })
        .catch((error) => {
          this.isReconnecting = false;
          this.log(`Reconnection failed: ${error.message}`);
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        });
    }, this.reconnectInterval);
  }

  private handleMessage(event: WebSocket.MessageEvent): void {
    try {
      const data = event.data as string;

      if (data === "ping" && this.ws) {
        this.ws.send("pong");
        return;
      }

      const message: MessagePayload = JSON.parse(data);

      if (this.messageHandlers[message.type]) {
        this.messageHandlers[message.type](message);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown parsing error";
      this.log(
        `Message parsing error: ${errorMessage}. Raw message: ${event.data}`,
      );
    }
  }

  private buildWebSocketUrl(path: string): string {
    return `ws://${this.host}:${this.port}${path}`;
  }

  /**
   * Registers a terminal instance with Synapse
   * @param terminal - The terminal instance to register
   */
  registerTerminal(terminal: Terminal): void {
    this.terminals.add(terminal);
  }

  /**
   * Unregisters a terminal instance from Synapse
   * @param terminal - The terminal instance to unregister
   */
  unregisterTerminal(terminal: Terminal): void {
    this.terminals.delete(terminal);
  }

  /**
   * Sets the working directory for the Synapse instance
   * @param workDir - The path to the working directory
   * @returns void
   */
  updateWorkDir(workDir: string): { success: boolean; data: string } {
    if (!fs.existsSync(workDir)) {
      try {
        fs.mkdirSync(workDir, { recursive: true });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown error creating directory";
        this.log(`Failed to create work directory: ${errorMessage}`);
        return {
          success: false,
          data: `Failed to create work directory: ${errorMessage}`,
        };
      }
    }

    this.workDir = workDir;
    this.terminals.forEach((terminal) => {
      if (terminal.isTerminalAlive()) {
        terminal.updateWorkDir(workDir);
      }
    });
    return {
      success: true,
      data: "Work directory updated successfully",
    };
  }

  /**
   * Cancels the reconnection process
   * @returns void
   */
  cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.isReconnecting = false;
    this.reconnectAttempts = this.maxReconnectAttempts;
  }

  /**
   * Establishes a WebSocket connection to the specified URL and initializes the terminal
   * @param path - The WebSocket endpoint path (e.g. '/' or '/terminal')
   * @returns Promise that resolves with the Synapse instance when connected
   * @throws Error if WebSocket connection fails
   */
  connect(path: string): Promise<Synapse> {
    this.lastPath = path;
    const url = this.buildWebSocketUrl(path);

    return new Promise((resolve, reject) => {
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          resolve(this);
          return;
        }

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.connectionListeners.onOpen();
          resolve(this);
        };

        this.ws.onmessage = (event: WebSocket.MessageEvent) =>
          this.handleMessage(event);

        this.ws.onerror = (error: WebSocket.ErrorEvent) => {
          const errorMessage = `WebSocket error: ${error.message || "Unknown error"}. Failed to connect to ${url}`;
          this.connectionListeners.onError(new Error(errorMessage));
          reject(new Error(errorMessage));
        };

        this.ws.onclose = () => {
          this.connectionListeners.onClose();
        };
      } catch (error) {
        reject(
          new Error(
            `Failed to create WebSocket connection: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          ),
        );
      }
    });
  }

  /**
   * Sends a message to the WebSocket server
   * @param type - The type of message to send
   * @param payload - The payload of the message
   * @returns A promise that resolves with the message payload
   * @throws Error if WebSocket is not connected
   */
  send(
    type: string,
    payload: Record<string, unknown> = {},
  ): Promise<MessagePayload> {
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

  /**
   * Sends a command to the terminal for execution
   * @param command - The command string to execute
   * @returns A promise that resolves with the message payload
   */
  sendCommand(command: string): Promise<MessagePayload> {
    return this.send("terminal", {
      operation: "createCommand",
      params: { command },
    });
  }

  /**
   * Registers a callback for when a new WebSocket connection is established on the server side
   * @param callback - Function to be called when a new connection is established
   * @returns The Synapse instance for method chaining
   */
  onConnection(callback: ServerConnectionCallback): Synapse {
    this.serverConnectionListener = callback;
    return this;
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
   * Handles HTTP upgrade requests to upgrade the connection to WebSocket
   * @param req - The HTTP request
   * @param socket - The network socket
   * @param head - The first packet of the upgraded stream
   */
  handleUpgrade(req: IncomingMessage, socket: Socket, head: Buffer): void {
    this.wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      this.wss.emit("connection", ws, req);
    });
  }

  /**
   * Checks if the WebSocket connection is currently open and ready
   * @returns {boolean} True if the connection is open and ready
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Closes the WebSocket connection
   */
  disconnect(): void {
    this.cancelReconnect();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.wss.close();
  }
}

export { Synapse };
