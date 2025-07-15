import { Socket } from "net";
import { Synapse } from "../synapse";

export type PortNotification = {
  port: number;
  status: "occupied" | "freed";
  timestamp: number;
};

export type PortStatusRequest = {
  requestId: string;
};

export type PortStatusResponse = {
  status: "occupied" | "freed";
  timestamp: number;
  requestId: string;
};

export class Ports {
  private synapse: Synapse;
  private portOccupied: boolean = false;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private pollInterval: number = 2000; // 2 seconds
  private static readonly PORT = 5173;

  constructor(synapse: Synapse) {
    this.synapse = synapse;
    this.setupRequestHandlers();
  }

  /**
   * Set up handlers for port status requests
   */
  private setupRequestHandlers(): void {
    this.synapse.on(
      "port-status-request",
      (data: PortStatusRequest, connectionId: string) => {
        this.handlePortStatusRequest(data, connectionId);
      },
    );
  }

  /**
   * Handle port status requests
   */
  private async handlePortStatusRequest(
    request: PortStatusRequest,
    connectionId: string,
  ): Promise<void> {
    try {
      const isOccupied = await this.checkPort(Ports.PORT);
      const response: PortStatusResponse = {
        status: isOccupied ? "occupied" : "freed",
        timestamp: Date.now(),
        requestId: request.requestId,
      };

      this.synapse.sendToConnection({
        connectionId,
        type: "port-status-response",
        payload: response,
      });
    } catch (error) {
      console.error("Error handling port status request:", error);
      // Send error response
      const errorResponse: PortStatusResponse = {
        status: "freed", // Default to freed on error
        timestamp: Date.now(),
        requestId: request.requestId,
      };
      this.synapse.sendToConnection({
        connectionId,
        type: "port-status-response",
        payload: errorResponse,
      });
    }
  }

  /**
   * Start monitoring port 5173
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      await this.checkPortStatus();
    }, this.pollInterval);

    // Initial check
    this.checkPortStatus();
  }

  /**
   * Stop monitoring port 5173
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Check the status of port 5173
   */
  private async checkPortStatus(): Promise<void> {
    try {
      const currentStatus = await this.checkPort(Ports.PORT);

      // Check if status changed
      if (currentStatus !== this.portOccupied) {
        this.portOccupied = currentStatus;
        this.sendNotification(Ports.PORT, currentStatus ? "occupied" : "freed");
      }
    } catch (error) {
      console.error("Error checking port status:", error);
    }
  }

  /**
   * Check if a specific port is occupied using net.Socket
   */
  private checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new Socket();

      socket.setTimeout(1000); // 1 second timeout

      socket.on("connect", () => {
        socket.destroy();
        resolve(true); // Port is occupied
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve(false); // Port is not occupied
      });

      socket.on("error", () => {
        socket.destroy();
        resolve(false); // Port is not occupied
      });

      socket.connect(port, "localhost");
    });
  }

  /**
   * Send notification to all connections
   */
  private sendNotification(port: number, status: "occupied" | "freed"): void {
    const notification: PortNotification = {
      port,
      status,
      timestamp: Date.now(),
    };

    this.synapse.broadcast({
      type: "port-notification",
      payload: notification,
    });
  }

  /**
   * Get the current port status
   */
  getPortStatus(): { status: "occupied" | "freed" } {
    return {
      status: this.portOccupied ? "occupied" : "freed",
    };
  }

  /**
   * Check if the monitored port is currently occupied
   */
  isPortOccupied(): boolean {
    return this.portOccupied;
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Manually check port status (for external requests)
   */
  async checkPortStatusManually(): Promise<boolean> {
    return await this.checkPort(Ports.PORT);
  }
}
