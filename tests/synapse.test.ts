import { IncomingMessage } from "http";
import { Socket } from "net";
import fetch from "node-fetch";
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

      const result = await connectPromise;
      expect(result).toBe(synapse);
    });

    it("should reject on connection error", async () => {
      const mockWs = createMockWebSocket();
      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

      const connectPromise = synapse.connect("/");
      setTimeout(
        () =>
          mockWs.onerror!({
            error: new Error("Connection failed"),
          } as WebSocket.ErrorEvent),
        0,
      );

      await expect(connectPromise).rejects.toThrow("WebSocket error");
    });
  });

  describe("http server connection", () => {
    let synapse: Synapse;

    beforeAll(async () => {
      synapse = new Synapse("localhost", 8081);
      await synapse.listen();
    });

    afterAll(async () => {
      await synapse.close();
    });

    it("should respond with 404 for regular HTTP requests", async () => {
      const response = await fetch("http://localhost:8081");
      expect(response.status).toBe(404);
      expect(await response.text()).toBe(
        '{"success":false,"error":"Not found"}',
      );
    });

    it("should handle POST requests successfully", async () => {
      const handler = jest.fn().mockResolvedValue({ result: "success" });
      synapse.onMessageType("test", handler);

      const response = await fetch("http://localhost:8081/test/operation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "test" }),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toEqual({ result: "success" });
      expect(handler).toHaveBeenCalledWith({
        type: "test",
        requestId: expect.any(String),
        operation: "operation",
        params: { data: "test" },
      });
    });

    it("should handle GET requests with query parameters", async () => {
      const handler = jest.fn().mockResolvedValue({ result: "success" });
      synapse.onMessageType("test", handler);

      const response = await fetch(
        "http://localhost:8081/test/operation?param=value",
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toEqual({ result: "success" });
      expect(handler).toHaveBeenCalledWith({
        type: "test",
        requestId: expect.any(String),
        operation: "operation",
        params: { param: "value" },
      });
    });
  });

  describe("message handling", () => {
    let mockWs: ReturnType<typeof createMockWebSocket>;

    beforeEach(async () => {
      mockWs = createMockWebSocket();
      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);
      const connectPromise = synapse.connect("/");
      setTimeout(() => mockWs.onopen!({} as WebSocket.Event), 0);
      await connectPromise;
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
      expect(handler).toHaveBeenCalledWith(testMessage);
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

    beforeEach(async () => {
      mockWs = createMockWebSocket();
      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);
      const connectPromise = synapse.connect("/");
      setTimeout(() => mockWs.onopen!({} as WebSocket.Event), 0);
      await connectPromise;
    });

    it("should send messages and return payload", async () => {
      const payload = { data: "test-data" };
      const result = await synapse.send("test-type", payload);

      expect(result).toEqual({
        type: "test-type",
        requestId: expect.any(String),
        data: "test-data",
      });
    });

    it("should throw when not connected", () => {
      synapse.disconnect();
      expect(() => synapse.send("test-type")).toThrow(
        "WebSocket is not connected",
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
  });
});
