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

      expect(onConnectionMock).toHaveBeenCalledWith(mockWs);
    });
  });

  describe("params handling", () => {
    it("should set params via handleUpgrade with URL params", () => {
      const synapse = new Synapse();
      // Simulate a request with query params
      const req = { url: "/?foo=bar&baz=qux" } as IncomingMessage;
      const socket = {} as Socket;
      const head = Buffer.alloc(0);
      // Patch JSON.parse to parse query string as an object
      const originalParse = JSON.parse;
      jest.spyOn(JSON, "parse").mockImplementation((str) => {
        if (str === "foo=bar&baz=qux") {
          return { foo: "bar", baz: "qux" };
        }
        return originalParse(str);
      });
      synapse.handleUpgrade(req, socket, head);
      expect(synapse.getLastParams()).toEqual({ foo: "bar", baz: "qux" });
      (JSON.parse as jest.Mock).mockRestore();
    });
  });
});
