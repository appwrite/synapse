import { IncomingMessage, Server, ServerResponse, createServer } from "http";
import { json, send, serve } from "micro";
import { Socket } from "net";
import { URL } from "url";
import WebSocket, { WebSocketServer } from "ws";

export type MessagePayload = {
  type: string;
  requestId: string;
  [key: string]: string | Record<string, unknown>;
};

export type MessageHandler = (message: MessagePayload) => Promise<any>;
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

  private isReconnecting = false;
  private maxReconnectAttempts = 5;
  private reconnectAttempts = 0;
  private reconnectInterval = 3000;
  private lastPath: string | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private server: Server | null = null;

  private host: string;
  private port: number;

  public workDir: string;

  constructor(
    host: string = "localhost",
    port: number = 3000,
    workDir: string = process.cwd(),
  ) {
    this.host = host;
    this.port = port;
    this.workDir = workDir;

    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on("connection", (ws: WebSocket) => {
      this.setupWebSocket(ws);
    });

    const handler = serve(async (req: IncomingMessage, res: ServerResponse) => {
      this.log(`HTTP Request received: ${req.method} ${req.url}`);

      // Handle WebSocket upgrade requests
      if (req.headers.upgrade?.toLowerCase() === "websocket" && req.socket) {
        this.handleUpgrade(req, req.socket, Buffer.alloc(0));
        return;
      }

      try {
        // Handle HTTP requests
        if (req.url) {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const path = url.pathname;

          const pathParts = path.split("/").filter((part) => part);

          if (pathParts.length >= 2) {
            const service = pathParts[0];
            const operation = pathParts[1];

            if (this.messageHandlers[service]) {
              if (req.method === "POST") {
                // For POST requests, get the body data
                const body = await json(req);

                const message: MessagePayload = {
                  type: service,
                  requestId: Date.now().toString(),
                  operation: operation,
                  params: (body || {}) as Record<string, unknown>,
                };

                try {
                  const result = await this.messageHandlers[service](message);
                  return send(res, 200, result || { success: true });
                } catch (error) {
                  const errorMessage =
                    error instanceof Error ? error.message : "Unknown error";
                  return send(res, 400, {
                    success: false,
                    error: errorMessage,
                  });
                }
              } else if (req.method === "GET") {
                // For GET requests, use query parameters
                const params: Record<string, string> = {};
                url.searchParams.forEach((value, key) => {
                  params[key] = value;
                });

                const message: MessagePayload = {
                  type: service,
                  requestId: Date.now().toString(),
                  operation: operation,
                  params: params,
                };

                try {
                  const result = await this.messageHandlers[service](message);
                  return send(res, 200, result || { success: true });
                } catch (error) {
                  const errorMessage =
                    error instanceof Error ? error.message : "Unknown error";
                  return send(res, 400, {
                    success: false,
                    error: errorMessage,
                  });
                }
              } else {
                return send(res, 405, {
                  success: false,
                  error: "Method not allowed",
                });
              }
            }
          }
        }

        return send(res, 404, { success: false, error: "Not found" });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        this.log(`HTTP error: ${errorMessage}`);
        return send(res, 500, {
          success: false,
          error: "Internal server error",
        });
      }
    });

    this.server = createServer(handler);

    if (this.server) {
      this.server.on("connection", (socket: Socket) => {
        this.log(`New connection from ${socket.remoteAddress}`);
      });
    }
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

  /**
   * Cancels the reconnection process
   */
  public cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.isReconnecting = false;
    this.reconnectAttempts = this.maxReconnectAttempts;
  }

  private async handleMessage(event: WebSocket.MessageEvent): Promise<void> {
    try {
      const data = event.data as string;

      if (data === "ping" && this.ws) {
        this.ws.send("pong");
        return;
      }

      const message: MessagePayload = JSON.parse(data);

      if (this.messageHandlers[message.type]) {
        const result = await this.messageHandlers[message.type](message);
        if (result !== null && this.ws) {
          this.ws.send(
            JSON.stringify({
              type: `${message.type}Response`,
              requestId: message.requestId,
              ...result,
            }),
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown parsing error";
      this.log(
        `Message parsing error: ${errorMessage}. Raw message: ${event.data}`,
      );

      if (this.ws) {
        try {
          const message = JSON.parse(event.data as string);
          this.ws.send(
            JSON.stringify({
              type: `${message.type}Response`,
              requestId: message.requestId,
              success: false,
              error: errorMessage,
            }),
          );
        } catch {
          // If we can't parse the original message, we can't send a proper response
        }
      }
    }
  }

  private buildWebSocketUrl(path: string): string {
    return `ws://${this.host}:${this.port}${path}`;
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
   * Registers a handler for specific message types received through WebSocket and HTTP
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
   * Starts the HTTP/WebSocket server
   * @returns Promise that resolves when the server is listening
   */
  public listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        reject(new Error("Server not initialized"));
        return;
      }

      this.server
        .listen(this.port, this.host, () => {
          this.log(`Server running on ${this.host}:${this.port}`);
          resolve();
        })
        .on("error", (error) => {
          reject(error);
        });
    });
  }

  /**
   * Stops the HTTP/WebSocket server and closes all connections
   */
  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        this.server = null;
        resolve();
      });
    });
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
    this.close().catch((error) => {
      this.log(`Error closing server: ${error.message}`);
    });
    this.wss.close();
  }
}

export { Synapse };
