import { IncomingMessage } from "http";
import { Socket } from "net";
import WebSocket, { WebSocketServer } from "ws";
import { Synapse } from "../src/synapse";

jest.mock("ws");

const createMockWebSocket = (options: { readyState?: number } = {}) => ({
  onopen: null as unknown as (event: WebSocket.Event) => void,
  onmessage: null as unknown as (event: WebSocket.MessageEvent) => void,
  onerror: null as unknown as (event: WebSocket.ErrorEvent) => void,
  onclose: null as unknown as (event: WebSocket.CloseEvent) => void,
  readyState: options.readyState ?? WebSocket.OPEN,
  send: jest.fn(),
  close: jest.fn(),
});

describe("Synapse", () => {
  let synapse: Synapse;

  beforeEach(() => {
    synapse = new Synapse("localhost", 8080);
    jest.clearAllMocks();
  });

  afterEach(() => {
    synapse.disconnect();
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("connect", () => {
    it("should establish websocket connection successfully", async () => {
      const mockWs = createMockWebSocket();

      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

      const connectPromise = synapse.connect("/terminal");
      mockWs.onopen!({} as WebSocket.Event);

      await expect(connectPromise).resolves.toBe(synapse);
      expect(WebSocket).toHaveBeenCalledWith("ws://localhost:8080/terminal");
    });

    it("should use default host and port when not provided", async () => {
      const defaultSynapse = new Synapse();
      const mockWs = createMockWebSocket();

      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

      const connectPromise = defaultSynapse.connect("/terminal");
      mockWs.onopen!({} as WebSocket.Event);

      await expect(connectPromise).resolves.toBe(defaultSynapse);
      expect(WebSocket).toHaveBeenCalledWith("ws://localhost:3000/terminal");
    });

    it("should reject on connection error", async () => {
      const mockWs = createMockWebSocket();

      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

      const connectPromise = synapse.connect("/terminal");
      mockWs.onerror!({
        error: new Error("Connection failed"),
      } as WebSocket.ErrorEvent);

      await expect(connectPromise).rejects.toThrow(
        "WebSocket error: Unknown error. Failed to connect to ws://localhost:8080/terminal",
      );
    });
  });

  describe("message handling", () => {
    it("should handle incoming messages correctly and pass exact message data", async () => {
      const handler = jest.fn();
      synapse.onMessageType("test", handler);

      const mockWs = createMockWebSocket();

      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);
      const connectPromise = synapse.connect("/terminal");
      mockWs.onopen!({} as WebSocket.Event);
      await connectPromise;

      const testMessage = {
        type: "test",
        requestId: "123",
        data: { foo: "bar", count: 42 },
      };
      mockWs.onmessage!({
        data: JSON.stringify(testMessage),
      } as WebSocket.MessageEvent);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "test",
          requestId: "123",
          data: { foo: "bar", count: 42 },
        }),
      );
    });

    it("should not trigger handlers for different message types", async () => {
      const testHandler = jest.fn();
      const otherHandler = jest.fn();
      synapse.onMessageType("test", testHandler);
      synapse.onMessageType("other", otherHandler);

      const mockWs = createMockWebSocket();

      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);
      const connectPromise = synapse.connect("/terminal");
      mockWs.onopen!({} as WebSocket.Event);
      await connectPromise;

      const testMessage = { type: "test", requestId: "123", data: "test-data" };
      mockWs.onmessage!({
        data: JSON.stringify(testMessage),
      } as WebSocket.MessageEvent);

      expect(testHandler).toHaveBeenCalledTimes(1);
      expect(otherHandler).not.toHaveBeenCalled();
    });

    it("should handle malformed JSON messages gracefully", async () => {
      const handler = jest.fn();
      synapse.onMessageType("test", handler);

      const mockWs = createMockWebSocket();

      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);
      const connectPromise = synapse.connect("/terminal");
      mockWs.onopen!({} as WebSocket.Event);
      await connectPromise;

      mockWs.onmessage!({
        data: "invalid json{",
      } as WebSocket.MessageEvent);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("send", () => {
    it("should send messages with correct format and return promise with message payload", async () => {
      const mockWs = createMockWebSocket();

      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);
      const connectPromise = synapse.connect("/terminal");
      mockWs.onopen!({} as WebSocket.Event);
      await connectPromise;

      const payload = { data: "test-data" };
      const result = await synapse.send("test-type", payload);

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentMessage).toEqual({
        type: "test-type",
        requestId: expect.any(String),
        data: "test-data",
      });
      expect(result).toEqual({
        type: "test-type",
        requestId: expect.any(String),
        data: "test-data",
      });
    });

    it("should throw error when WebSocket is not connected", () => {
      expect(() => synapse.send("test-type")).toThrow(
        "WebSocket is not connected",
      );
    });

    it("should throw error when WebSocket is not in OPEN state", async () => {
      const mockWs = createMockWebSocket({ readyState: WebSocket.CLOSED });

      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);
      const connectPromise = synapse.connect("/terminal");
      mockWs.onopen!({} as WebSocket.Event);
      await connectPromise;

      expect(() => synapse.send("test-type")).toThrow(
        "WebSocket is not connected",
      );
    });
  });

  describe("handleUpgrade", () => {
    it("should handle upgrade requests and establish WebSocket connection", () => {
      const mockReq = {
        headers: {
          upgrade: "websocket",
        },
      } as IncomingMessage;

      const mockSocket = {} as Socket;
      const mockHead = Buffer.alloc(0);
      const mockWs = createMockWebSocket();

      const mockHandleUpgrade = jest.fn((req, socket, head, cb) => {
        cb(mockWs);
      });
      const mockEmit = jest.fn();

      const mockWss = {
        handleUpgrade: mockHandleUpgrade,
        emit: mockEmit,
        on: jest.fn((event, callback) => {
          if (event === "connection") {
            callback(mockWs);
          }
        }),
        close: jest.fn(),
      } as unknown as WebSocketServer;

      jest.mocked(WebSocketServer).mockImplementation(() => mockWss);

      synapse = new Synapse(); // Recreate synapse with mocked WSS
      synapse.handleUpgrade(mockReq, mockSocket, mockHead);

      expect(mockHandleUpgrade).toHaveBeenCalledWith(
        mockReq,
        mockSocket,
        mockHead,
        expect.any(Function),
      );

      expect(mockEmit).toHaveBeenCalledWith("connection", mockWs, mockReq);
    });

    it("should set up event handlers after successful upgrade", () => {
      const mockReq = {} as IncomingMessage;
      const mockSocket = {} as Socket;
      const mockHead = Buffer.alloc(0);

      const mockWs = createMockWebSocket();

      const mockHandleUpgrade = jest.fn((req, socket, head, cb) => {
        cb(mockWs);
      });
      const mockEmit = jest.fn((event: string, ws: WebSocket) => {
        if (event === "connection") {
          // Simulate the WebSocketServer connection event handler
          const connectionHandler = (mockWss.on as jest.Mock).mock.calls.find(
            ([eventName]: [string]) => eventName === "connection",
          )?.[1];
          connectionHandler?.(ws);
        }
      });

      const mockWss = {
        handleUpgrade: mockHandleUpgrade,
        emit: mockEmit,
        on: jest.fn(),
        close: jest.fn(),
      } as unknown as WebSocketServer;

      jest.mocked(WebSocketServer).mockImplementation(() => mockWss);

      const onOpenMock = jest.fn();
      const onCloseMock = jest.fn();
      const onErrorMock = jest.fn();

      synapse = new Synapse(); // Recreate synapse with mocked WSS
      synapse.onOpen(onOpenMock);
      synapse.onClose(onCloseMock);
      synapse.onError(onErrorMock);

      synapse.handleUpgrade(mockReq, mockSocket, mockHead);

      // The onOpen callback should be triggered when the connection is established
      expect(onOpenMock).toHaveBeenCalled();

      mockWs.onclose!({} as WebSocket.CloseEvent);
      expect(onCloseMock).toHaveBeenCalled();

      mockWs.onerror!({} as WebSocket.ErrorEvent);
      expect(onErrorMock).toHaveBeenCalledWith(
        new Error(
          "WebSocket error: Unknown error. Connection to localhost:3000 failed.",
        ),
      );
    });
  });
});
