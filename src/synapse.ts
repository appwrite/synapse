import WebSocket from "ws";

export type MessagePayload = {
  type: string;
  requestId: string;
  [key: string]: string | Record<string, unknown>;
};

export type MessageHandler = (message: MessagePayload) => void;
export type ConnectionCallback = () => void;
export type ErrorCallback = (error: Error) => void;

class Synapse {
  private ws: WebSocket | null = null;
  private messageHandlers: Record<string, MessageHandler> = {};
  private connectionListeners = {
    onOpen: (() => {}) as ConnectionCallback,
    onClose: (() => {}) as ConnectionCallback,
    onError: (() => {}) as ErrorCallback,
  };
  logger: (message: string) => void = console.log;

  private send(
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
   * Sets the logger function for the Synapse instance
   * @param logger - The logger function to use
   */
  setLogger(logger: (message: string) => void): void {
    this.logger = logger;
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
        this.connectionListeners.onOpen();
        resolve(this);
      };

      this.ws.onmessage = (event: WebSocket.MessageEvent) =>
        this.handleMessage(event);

      this.ws.onerror = () => {
        this.connectionListeners.onError(new Error("WebSocket error occurred"));
        reject(new Error("WebSocket error occurred"));
      };

      this.ws.onclose = () => {
        this.connectionListeners.onClose();
      };
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
   * Closes the WebSocket connection
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}

export { Synapse };
