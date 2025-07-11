import { IncomingMessage } from "http";
import { Socket } from "net";
import WebSocket, { WebSocketServer } from "ws";
import { Filesystem } from "./services/filesystem";
import { Ports } from "./services/ports";
import { Terminal } from "./services/terminal";

export type MessagePayload = {
  type: string;
  requestId: string;
  [key: string]: string | Record<string, unknown>;
};

export type Connection = {
  ws: WebSocket;
  id: string;
  path: string;
  params: Record<string, string> | null;
};

export type MessageHandler = (
  message: MessagePayload,
  connectionId: string,
) => void;

export type ConnectionCallback = (connectionId: string) => void;

export type ConnectionCloseCallback = (
  connectionId: string,
  code?: number,
  reason?: string,
  wasClean?: boolean,
) => void;

export type ErrorCallback = (error: Error, connectionId: string) => void;
export type ServerConnectionCallback = (connectionId: string) => void;
export type Logger = (message: string) => void;

class Synapse {
  private connections: Map<string, Connection> = new Map();
  private wss: WebSocketServer;
  private messageHandlers: Record<string, MessageHandler> = {};
  private connectionListeners = {
    onOpen: (() => {}) as ConnectionCallback,
    onClose: (() => {}) as ConnectionCloseCallback,
    onError: (() => {}) as ErrorCallback,
  };

  private terminals: Set<Terminal> = new Set();
  private filesystem: Filesystem | undefined;
  private ports: Ports | undefined;

  private host: string;
  private port: number;

  private serverConnectionListener: ServerConnectionCallback = () => {};

  constructor(host: string = "localhost", port: number = 3000) {
    this.host = host;
    this.port = port;

    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const connectionId = this.generateConnectionId();
      this.setupWebSocket(ws, req, connectionId);
      this.serverConnectionListener(connectionId);
    });
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[Synapse][${timestamp}] ${message}`);
  }

  private setupWebSocket(
    ws: WebSocket,
    req: IncomingMessage,
    connectionId: string,
  ): void {
    const path = req.url?.split("?")[0] ?? "/";
    let params: Record<string, string> | null = null;
    const query = req.url?.split("?")[1];
    if (query) {
      try {
        params = JSON.parse(query);
      } catch {
        params = Object.fromEntries(
          query.split("&").map((kv) => {
            const [k, v] = kv.split("=");
            return [decodeURIComponent(k), decodeURIComponent(v ?? "")];
          }),
        );
      }
    }

    this.connections.set(connectionId, {
      ws,
      id: connectionId,
      path,
      params,
    });

    ws.on("ping", () => {
      ws.pong();
    });

    ws.onmessage = (event) => this.handleMessage(event, connectionId);

    ws.onclose = (event) => {
      this.connectionListeners.onClose(
        connectionId,
        event.code,
        event.reason,
        event.wasClean,
      );

      this.disconnect(connectionId);

      if (this.connections.size === 0) {
        // clean up all resources
        this.disconnect();
      }
    };

    ws.onerror = (error) => {
      const errorMessage = `WebSocket error: ${error.message || "Unknown error"}. Connection to ${this.host}:${this.port} failed.`;
      this.connectionListeners.onError(new Error(errorMessage), connectionId);
    };

    this.connectionListeners.onOpen(connectionId);
  }

  private handleMessage(
    event: WebSocket.MessageEvent,
    connectionId: string,
  ): void {
    try {
      const data = event.data as string;
      const connection = this.connections.get(connectionId);

      if (!connection) return;

      let message: MessagePayload;
      if (typeof data === "string") {
        message = JSON.parse(data);
      } else {
        this.log(`Received binary data from connection ${connectionId}`);
        return;
      }

      if (this.messageHandlers[message.type]) {
        this.messageHandlers[message.type](message, connectionId);
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
   * Sets the Filesystem instance to be managed by Synapse
   * @param filesystem - The Filesystem instance
   */
  setFilesystem(filesystem: Filesystem): void {
    this.filesystem = filesystem;
  }

  /**
   * Gets the Ports instance, creating it if needed
   */
  getPorts(): Ports {
    if (!this.ports) {
      this.ports = new Ports(this);
    }
    return this.ports;
  }

  /**
   * Start monitoring ports for HTTP servers
   */
  startPortMonitoring(): void {
    this.getPorts().startMonitoring();
  }

  /**
   * Stop monitoring ports
   */
  stopPortMonitoring(): void {
    if (this.ports) {
      this.ports.stopMonitoring();
    }
  }

  /**
   * Establishes a WebSocket connection to the specified URL
   * @param path - The WebSocket endpoint path (e.g. '/' or '/terminal')
   * @returns Promise that resolves with the connection ID when connected
   * @throws Error if WebSocket connection fails
   */
  connect(path: string): Promise<string> {
    const url = this.buildWebSocketUrl(path);

    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(url);

        ws.onopen = () => {
          resolve("Synapse connected successfully");
        };

        ws.onerror = (error: WebSocket.ErrorEvent) => {
          const errorMessage = `WebSocket error: ${error.message || "Unknown error"}. Failed to connect to ${url}`;
          reject(new Error(errorMessage));
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
   * Gets the path associated with a specific connection
   * @param connectionId - The ID of the connection
   * @returns The connection path or null if connection not found
   */
  getPath(connectionId: string): string | null {
    const connection = this.connections.get(connectionId);
    return connection ? connection.path : null;
  }

  /**
   * Gets the parameters associated with a specific connection
   * @param connectionId - The ID of the connection
   * @returns The connection parameters or null if connection not found
   */
  getParams(connectionId: string): Record<string, string> | null {
    const connection = this.connections.get(connectionId);
    return connection ? connection.params : null;
  }

  /**
   * Gets all active connection IDs
   * @returns Array of connection IDs
   */
  getConnections(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Gets connection information by ID
   * @param connectionId - The ID of the connection to get
   * @returns The connection object or null if not found
   */
  getConnection(
    connectionId: string,
  ): { path: string; params: Record<string, string> | null } | null {
    const connection = this.connections.get(connectionId);
    if (!connection) return null;

    return {
      path: connection.path,
      params: connection.params,
    };
  }

  /**
   * Sends a message to a specific WebSocket connection
   * @param connectionId - The ID of the connection to send to
   * @param type - The type of message to send
   * @param payload - The payload of the message
   * @returns A promise that resolves with the message payload
   * @throws Error if WebSocket is not connected
   */
  send(
    connectionId: string,
    type: string,
    payload: Record<string, unknown> = {},
  ): Promise<MessagePayload> {
    const connection = this.connections.get(connectionId);

    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(
        new Error(`WebSocket connection ${connectionId} is not connected`),
      );
    }

    const message: MessagePayload = {
      type,
      requestId: Date.now().toString(),
      ...payload,
    };

    return new Promise((resolve) => {
      connection.ws.send(JSON.stringify(message));
      resolve(message);
    });
  }

  /**
   * Sends a message to a specific WebSocket connection without returning a promise
   * @param connectionId - The ID of the connection to send to
   * @param type - The type of message to send
   * @param payload - The payload of the message
   * @throws Error if WebSocket is not connected
   */
  sendToConnection(
    connectionId: string,
    type: string,
    payload: Record<string, unknown> = {},
  ): void {
    const connection = this.connections.get(connectionId);

    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket connection ${connectionId} is not connected`);
    }

    const message: MessagePayload = {
      type,
      requestId: Date.now().toString(),
      ...payload,
    };

    connection.ws.send(JSON.stringify(message));
  }

  /**
   * Broadcasts a message to all connected WebSocket clients
   * @param type - The type of message to send
   * @param payload - The payload of the message
   * @returns An array of promises that resolve with the message payloads
   */
  broadcast(
    type: string,
    payload: Record<string, unknown> = {},
  ): Promise<MessagePayload>[] {
    const promises: Promise<MessagePayload>[] = [];

    this.connections.forEach((connection, connectionId) => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        promises.push(this.send(connectionId, type, payload));
      }
    });

    return promises;
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
   * Registers a callback for when a WebSocket connection is established
   * @param callback - Function to be called when connection opens
   * @returns The Synapse instance for method chaining
   */
  onOpen(callback: ConnectionCallback): Synapse {
    this.connectionListeners.onOpen = callback;
    return this;
  }

  /**
   * Registers a callback for when a WebSocket connection is closed
   * @param callback - Function to be called when connection closes. Receives (connectionId, code, reason)
   * @returns The Synapse instance for method chaining
   */
  onClose(callback: ConnectionCloseCallback): Synapse {
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
   * Registers a handler for specific message types (alias for onMessageType)
   * @param type - The message type to handle
   * @param handler - Function to handle messages of the specified type
   * @returns The Synapse instance for method chaining
   */
  on(type: string, handler: MessageHandler): Synapse {
    return this.onMessageType(type, handler);
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
   * Checks if a specific WebSocket connection is currently open and ready
   * @param connectionId - The ID of the connection to check
   * @returns {boolean} True if the connection is open and ready
   */
  isConnected(connectionId?: string): boolean {
    if (connectionId) {
      const connection = this.connections.get(connectionId);
      return !!connection && connection.ws.readyState === WebSocket.OPEN;
    }

    // Check if any connection is open
    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        return true;
      }
    }

    return false;
  }

  /**
   * Closes a specific WebSocket connection
   * @param connectionId - The ID of the connection to close, or all if not specified
   */
  disconnect(connectionId?: string): void {
    if (connectionId) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.ws.close();
        this.connections.delete(connectionId);
      }
    } else {
      // Close all connections
      this.connections.forEach((connection) => {
        connection.ws.close();
      });
      this.terminals.forEach((terminal) => {
        terminal.kill();
      });
      if (this.filesystem) {
        this.filesystem.cleanup();
      }
      if (this.ports) {
        this.ports.stopMonitoring();
      }
      this.connections.clear();
      this.wss.close();
    }
  }
}

export { Synapse };
