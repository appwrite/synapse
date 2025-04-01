import { IncomingMessage } from "http";
import { Socket } from "net";
import WebSocket, { WebSocketServer } from "ws";

export type MessagePayload = {
  type: string;
  requestId: string;
  [key: string]: string | Record<string, unknown>;
};

export type MessageHandler = (message: MessagePayload) => void;
export type ConnectionCallback = () => void;
export type ErrorCallback = (error: Error) => void;
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
  logger: Logger = console.log;
  private host: string;
  private port: number;

  constructor(host: string = "localhost", port: number = 3000) {
    this.host = host;
    this.port = port;
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on("connection", (ws: WebSocket) => {
      this.ws = ws;

      ws.onmessage = (event: WebSocket.MessageEvent) =>
        this.handleMessage(event);

      ws.onclose = () => {
        this.connectionListeners.onClose();
      };

      ws.onerror = (error: WebSocket.ErrorEvent) => {
        const errorMessage = `WebSocket error: ${error.message || "Unknown error"}. Connection to ${this.host}:${this.port} failed.`;
        this.connectionListeners.onError(new Error(errorMessage));
      };

      this.connectionListeners.onOpen();
    });
  }

  private handleMessage(event: WebSocket.MessageEvent): void {
    try {
      const message: MessagePayload = JSON.parse(event.data as string);

      if (this.messageHandlers[message.type]) {
        this.messageHandlers[message.type](message);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown parsing error";
      this.logger(
        `Message parsing error: ${errorMessage}. Raw message: ${event.data}`,
      );
    }
  }

  private buildWebSocketUrl(path: string): string {
    return `ws://${this.host}:${this.port}${path}`;
  }

  /**
   * Establishes a WebSocket connection to the specified URL and initializes the terminal
   * @param path - The WebSocket endpoint path (e.g. '/terminal')
   * @returns Promise that resolves with the Synapse instance when connected
   * @throws Error if WebSocket connection fails
   */
  connect(path: string): Promise<Synapse> {
    const url = this.buildWebSocketUrl(path);
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
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
    });
  }

  /**
   * Sets the logger function for the Synapse instance
   * @param logger - The logger function to use
   */
  setLogger(logger: Logger): void {
    this.logger = logger;
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
   */
  sendCommand(command: string): void {
    this.send("terminal", {
      operation: "createCommand",
      params: { command },
    });
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
   * Closes the WebSocket connection
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
    this.wss.close();
  }
}

export { Synapse };
