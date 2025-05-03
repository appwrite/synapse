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

  describe("webSocket connection", () => {
    it("should connect successfully", async () => {
      const mockWs = createMockWebSocket();
      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

      const connectPromise = synapse.connect("/terminal");
      setTimeout(() => mockWs.onopen!({} as WebSocket.Event), 0);

      const connectionId = await connectPromise;
      expect(typeof connectionId).toBe("string");
      expect(synapse.getConnections()).toContain(connectionId);
    });

    it("should reject on connection error", async () => {
      const mockWs = createMockWebSocket();
      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

      const connectPromise = synapse.connect("/");
      setTimeout(
        () =>
          mockWs.onerror!({
            error: new Error("Connection failed"),
            message: "Connection failed",
          } as WebSocket.ErrorEvent),
        0,
      );

      await expect(connectPromise).rejects.toThrow("WebSocket error");
    });
  });

  describe("message handling", () => {
    let mockWs: ReturnType<typeof createMockWebSocket>;
    let connectionId: string;

    beforeEach(async () => {
      mockWs = createMockWebSocket();
      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);
      const connectPromise = synapse.connect("/");
      setTimeout(() => mockWs.onopen!({} as WebSocket.Event), 0);
      connectionId = await connectPromise;
    });

    it("should handle messages correctly", async () => {
      const handler = jest.fn();
      synapse.onMessageType("test", handler);

      const testMessage = {
        type: "test",
        requestId: "123",
        data: { foo: "bar" },
      };

      mockWs.onmessage!({
        data: JSON.stringify(testMessage),
      } as WebSocket.MessageEvent);
      expect(handler).toHaveBeenCalledWith(testMessage, connectionId);
    });

    it("should ignore malformed messages", async () => {
      const handler = jest.fn();
      synapse.onMessageType("test", handler);

      mockWs.onmessage!({ data: "invalid json{" } as WebSocket.MessageEvent);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("send", () => {
    let mockWs: ReturnType<typeof createMockWebSocket>;
    let connectionId: string;

    beforeEach(async () => {
      mockWs = createMockWebSocket();
      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);
      const connectPromise = synapse.connect("/");
      setTimeout(() => mockWs.onopen!({} as WebSocket.Event), 0);
      connectionId = await connectPromise;
    });

    it("should send messages and return payload", async () => {
      const payload = { data: "test-data" };
      const result = await synapse.send(connectionId, "test-type", payload);

      expect(result).toEqual({
        type: "test-type",
        requestId: expect.any(String),
        data: "test-data",
      });
    });

    it("should throw when not connected", () => {
      synapse.disconnect(connectionId);
      expect(() => synapse.send(connectionId, "test-type")).toThrow(
        `WebSocket connection ${connectionId} is not connected`,
      );
    });
  });

  describe("handleUpgrade", () => {
    it("should handle upgrade and setup handlers", () => {
      const mockWs = createMockWebSocket();
      const mockWss = {
        handleUpgrade: jest.fn((req, socket, head, cb) => {
          cb(mockWs);
          const connectionHandler = (mockWss.on as jest.Mock).mock.calls.find(
            ([eventName]: [string]) => eventName === "connection",
          )?.[1];
          if (connectionHandler) {
            connectionHandler(mockWs);
          }
        }),
        emit: jest.fn(),
        on: jest.fn() as jest.Mock,
        close: jest.fn(),
      } as unknown as WebSocketServer;

      jest.mocked(WebSocketServer).mockImplementation(() => mockWss);

      const onOpenMock = jest.fn();
      synapse = new Synapse();
      synapse.onOpen(onOpenMock);

      synapse.handleUpgrade(
        {} as IncomingMessage,
        {} as Socket,
        Buffer.alloc(0),
      );
      expect(onOpenMock).toHaveBeenCalled();
    });

    it("should call onConnection callback when new connection is established", () => {
      const mockWs = createMockWebSocket();
      const mockWss = {
        handleUpgrade: jest.fn((req, socket, head, cb) => {
          cb(mockWs);
          const connectionHandler = (mockWss.on as jest.Mock).mock.calls.find(
            ([eventName]: [string]) => eventName === "connection",
          )?.[1];
          if (connectionHandler) {
            connectionHandler(mockWs);
          }
        }),
        emit: jest.fn(),
        on: jest.fn() as jest.Mock,
        close: jest.fn(),
      } as unknown as WebSocketServer;

      jest.mocked(WebSocketServer).mockImplementation(() => mockWss);

      const onConnectionMock = jest.fn();
      synapse = new Synapse();
      synapse.onConnection(onConnectionMock);

      synapse.handleUpgrade(
        {} as IncomingMessage,
        {} as Socket,
        Buffer.alloc(0),
      );

      expect(onConnectionMock).toHaveBeenCalledWith(mockWs, expect.any(String));
    });
  });

  describe("multiple connections", () => {
    it("should allow multiple connections and track them independently", async () => {
      const mockWs1 = createMockWebSocket();
      const mockWs2 = createMockWebSocket();
      let callCount = 0;
      (WebSocket as unknown as jest.Mock).mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mockWs1 : mockWs2;
      });
      const id1Promise = synapse.connect("/a");
      setTimeout(() => mockWs1.onopen!({} as WebSocket.Event), 0);
      const id2Promise = synapse.connect("/b");
      setTimeout(() => mockWs2.onopen!({} as WebSocket.Event), 0);
      const id1 = await id1Promise;
      const id2 = await id2Promise;
      expect(id1).not.toBe(id2);
      expect(synapse.getConnections()).toEqual(
        expect.arrayContaining([id1, id2]),
      );
      // Disconnect one and check the other remains
      synapse.disconnect(id1);
      expect(synapse.getConnections()).toContain(id2);
      expect(synapse.getConnections()).not.toContain(id1);
    });
  });
});
