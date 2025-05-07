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
  on: jest.fn(),
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
      setTimeout(() => mockWs.onopen && mockWs.onopen({} as any), 0);

      await expect(connectPromise).resolves.toBe(
        "Synapse connected successfully",
      );
    });

    it("should reject on connection error", async () => {
      const mockWs = createMockWebSocket();
      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

      const connectPromise = synapse.connect("/");
      setTimeout(
        () =>
          mockWs.onerror &&
          mockWs.onerror({
            error: new Error("Connection failed"),
            message: "Connection failed",
          } as any),
        0,
      );

      await expect(connectPromise).rejects.toThrow("WebSocket error");
    });

    it("should call onClose with code, reason, and wasClean", () => {
      const mockWs = createMockWebSocket();
      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

      const onCloseMock = jest.fn();
      synapse.onClose(onCloseMock);

      // Use the real setup method so event handlers are set
      (synapse as any).setupWebSocket(mockWs, { url: "/" }, "conn1");

      // Simulate close event
      const closeEvent = { code: 4001, reason: "Test reason", wasClean: true };
      mockWs.onclose && mockWs.onclose(closeEvent as any);

      expect(onCloseMock).toHaveBeenCalledWith(
        "conn1",
        4001,
        "Test reason",
        true,
      );
    });
  });

  describe("message handling", () => {
    let mockWs: ReturnType<typeof createMockWebSocket>;
    let connectionId: string;

    beforeEach(() => {
      mockWs = createMockWebSocket();
      connectionId = "test-conn";
      // Manually add connection for testing
      (synapse as any).connections.set(connectionId, {
        ws: mockWs,
        id: connectionId,
        path: "/",
        params: null,
        reconnectAttempts: 0,
      });
    });

    it("should handle messages correctly", () => {
      const handler = jest.fn();
      synapse.onMessageType("test", handler);

      const testMessage = {
        type: "test",
        requestId: "123",
        data: { foo: "bar" },
      };

      // Simulate message event
      (synapse as any).handleMessage(
        { data: JSON.stringify(testMessage) },
        connectionId,
      );
      expect(handler).toHaveBeenCalledWith(testMessage, connectionId);
    });

    it("should ignore malformed messages", () => {
      const handler = jest.fn();
      synapse.onMessageType("test", handler);

      (synapse as any).handleMessage({ data: "invalid json{" }, connectionId);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("send", () => {
    let mockWs: ReturnType<typeof createMockWebSocket>;
    let connectionId: string;

    beforeEach(() => {
      mockWs = createMockWebSocket();
      connectionId = "test-conn";
      (synapse as any).connections.set(connectionId, {
        ws: mockWs,
        id: connectionId,
        path: "/",
        params: null,
        reconnectAttempts: 0,
      });
    });

    it("should send messages and return payload", async () => {
      const payload = { data: "test-data" };
      const result = await synapse.send(connectionId, "test-type", payload);

      expect(result).toEqual({
        type: "test-type",
        requestId: expect.any(String),
        data: "test-data",
      });
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(result));
    });

    it("should throw when not connected", () => {
      mockWs.readyState = WebSocket.CLOSED;
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
            connectionHandler(mockWs, req);
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

      // Provide a mock IncomingMessage with a url property
      const mockReq = { url: "/test?foo=bar" } as IncomingMessage;
      synapse.handleUpgrade(mockReq, {} as Socket, Buffer.alloc(0));
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
            connectionHandler(mockWs, req);
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

      // Provide a mock IncomingMessage with a url property
      const mockReq = { url: "/test?foo=bar" } as IncomingMessage;
      synapse.handleUpgrade(mockReq, {} as Socket, Buffer.alloc(0));

      expect(onConnectionMock).toHaveBeenCalledWith(expect.any(String)); // connectionId
    });
  });

  describe("multiple connections", () => {
    it("should allow multiple connections and track them independently", () => {
      const mockWs1 = createMockWebSocket();
      const mockWs2 = createMockWebSocket();
      const mockWss = {
        handleUpgrade: jest.fn((req, socket, head, cb) => {
          if ((req as any).clientId === 1) cb(mockWs1);
          else cb(mockWs2);
          const connectionHandler = (mockWss.on as jest.Mock).mock.calls.find(
            ([eventName]: [string]) => eventName === "connection",
          )?.[1];
          if (connectionHandler) {
            connectionHandler(
              (req as any).clientId === 1 ? mockWs1 : mockWs2,
              req,
            );
          }
        }),
        emit: jest.fn(),
        on: jest.fn() as jest.Mock,
        close: jest.fn(),
      } as unknown as WebSocketServer;

      jest.mocked(WebSocketServer).mockImplementation(() => mockWss);

      synapse = new Synapse();

      const connectionIds: string[] = [];
      synapse.onConnection((id) => connectionIds.push(id));

      // Provide mock IncomingMessages with url property
      const mockReq1 = { clientId: 1, url: "/test1?foo=bar" } as any;
      const mockReq2 = { clientId: 2, url: "/test2?foo=baz" } as any;
      synapse.handleUpgrade(mockReq1, {} as Socket, Buffer.alloc(0));
      synapse.handleUpgrade(mockReq2, {} as Socket, Buffer.alloc(0));

      expect(connectionIds.length).toBe(2);
      expect(connectionIds[0]).not.toBe(connectionIds[1]);
      expect(synapse.getConnections()).toEqual(
        expect.arrayContaining([connectionIds[0], connectionIds[1]]),
      );

      synapse.disconnect(connectionIds[0]);
      expect(synapse.getConnections()).toContain(connectionIds[1]);
      expect(synapse.getConnections()).not.toContain(connectionIds[0]);
    });
  });

  describe("connection cleanup", () => {
    it("should clear all connections when disconnect is called", () => {
      const mockWs1 = createMockWebSocket();
      const mockWs2 = createMockWebSocket();
      (synapse as any).connections.set("conn1", {
        ws: mockWs1,
        id: "conn1",
        path: "/a",
        params: null,
        reconnectAttempts: 0,
      });
      (synapse as any).connections.set("conn2", {
        ws: mockWs2,
        id: "conn2",
        path: "/b",
        params: null,
        reconnectAttempts: 0,
      });
      expect(synapse.getConnections().length).toBe(2);
      synapse.disconnect();
      expect(synapse.getConnections().length).toBe(0);
    });
  });
});
