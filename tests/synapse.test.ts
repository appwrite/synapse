import WebSocket from "ws";
import { Synapse } from "../src/synapse";

jest.mock("ws");

describe("Synapse", () => {
  let synapse: Synapse;

  beforeEach(() => {
    synapse = new Synapse();
    jest.clearAllMocks();
  });

  describe("connect", () => {
    it("should establish websocket connection successfully", async () => {
      const mockWs = {
        onopen: null as unknown as (event: WebSocket.Event) => void,
        onmessage: null as unknown as (event: WebSocket.MessageEvent) => void,
        onerror: null as unknown as (event: WebSocket.ErrorEvent) => void,
        onclose: null as unknown as (event: WebSocket.CloseEvent) => void,
        readyState: WebSocket.OPEN,
        send: jest.fn(),
      };

      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

      const connectPromise = synapse.connect("ws://localhost:8080");
      mockWs.onopen!({} as WebSocket.Event);

      await expect(connectPromise).resolves.toBe(synapse);
    });

    it("should reject on connection error", async () => {
      const mockWs = {
        onopen: null as unknown as (event: WebSocket.Event) => void,
        onmessage: null as unknown as (event: WebSocket.MessageEvent) => void,
        onerror: null as unknown as (event: WebSocket.ErrorEvent) => void,
        onclose: null as unknown as (event: WebSocket.CloseEvent) => void,
      };

      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

      const connectPromise = synapse.connect("ws://localhost:8080");
      mockWs.onerror!({
        error: new Error("Connection failed"),
      } as WebSocket.ErrorEvent);

      await expect(connectPromise).rejects.toThrow("WebSocket error occurred");
    });
  });

  describe("message handling", () => {
    it("should handle incoming messages correctly", async () => {
      const handler = jest.fn();
      synapse.onMessageType("test", handler);

      const mockWs = {
        onopen: null as unknown as (event: WebSocket.Event) => void,
        onmessage: null as unknown as (event: WebSocket.MessageEvent) => void,
        onerror: null as unknown as (event: WebSocket.ErrorEvent) => void,
        onclose: null as unknown as (event: WebSocket.CloseEvent) => void,
        readyState: WebSocket.OPEN,
        send: jest.fn(),
      };

      (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);
      const connectPromise = synapse.connect("ws://localhost:8080");
      mockWs.onopen!({} as WebSocket.Event);
      await connectPromise;

      const testMessage = { type: "test", requestId: "123", data: "test-data" };
      mockWs.onmessage!({
        data: JSON.stringify(testMessage),
      } as WebSocket.MessageEvent);

      expect(handler).toHaveBeenCalledWith(testMessage);
    }, 10000);
  });
});
