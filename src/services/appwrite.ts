import * as fsSync from "fs";
import { Client, Databases, Sites, Storage, Teams, Users } from "node-appwrite";
import { Synapse } from "../synapse";

export class Appwrite {
  private synapse: Synapse;
  private client: Client;
  private serviceInstances: Record<string, any> = {};
  private availableServices: Record<string, any> = {
    teams: Teams,
    users: Users,
    databases: Databases,
    storage: Storage,
    sites: Sites,
  };
  private workDir: string;

  constructor(
    synapse: Synapse,
    workDir: string = process.cwd(),
    endpoint: string = "https://cloud.appwrite.io/v1",
  ) {
    this.synapse = synapse;
    this.client = new Client().setEndpoint(endpoint);
    if (workDir) {
      if (!fsSync.existsSync(workDir)) {
        fsSync.mkdirSync(workDir, { recursive: true });
      }
      this.workDir = workDir;
    } else {
      this.workDir = process.cwd();
    }
  }

  /**
   * Set the API endpoint
   * @param endpoint API endpoint
   * @returns this instance for method chaining
   */
  setEndpoint(endpoint: string): Appwrite {
    this.client.setEndpoint(endpoint);
    return this;
  }

  /**
   * Set the project ID
   * @param projectId Appwrite project ID
   * @returns this instance for method chaining
   */
  setProject(projectId: string): Appwrite {
    this.client.setProject(projectId);
    return this;
  }

  /**
   * Set the API key
   * @param apiKey Appwrite API key
   * @returns this instance for method chaining
   */
  setKey(apiKey: string): Appwrite {
    this.client.setKey(apiKey);
    return this;
  }

  /**
   * Set the JWT
   * @param jwt JWT token
   * @returns this instance for method chaining
   */
  setJWT(jwt: string): Appwrite {
    this.client.setJWT(jwt);
    return this;
  }

  /**
   * Set a session cookie
   * @param cookie Session cookie
   * @returns this instance for method chaining
   */
  setSession(cookie: string): Appwrite {
    this.client.setSession(cookie);
    return this;
  }

  /**
   * Get the Appwrite client instance
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Get the working directory
   * @returns the working directory
   */
  getWorkDir(): string {
    return this.workDir;
  }

  /**
   * Check if the SDK has been properly initialized
   * @returns boolean indicating if endpoint, project ID, and API key are all set
   */
  isInitialized(): boolean {
    // Access the private config from the client to check initialization status
    const config = (this.client as any).config;

    // Check if all required configuration values are set
    return !!(
      config?.endpoint &&
      config?.project &&
      (config?.key || config?.jwt || config?.session)
    );
  }

  /**
   * Call a method on an Appwrite service
   * @param serviceName The name of the service (e.g., 'users', 'databases')
   * @param methodName The name of the method to call on the service
   * @param args Arguments to pass to the method
   * @returns The result of the method call
   * @throws Error if service or method does not exist
   */
  async call(
    serviceName: string,
    methodName: string,
    args: object = {},
  ): Promise<any> {
    // Check if SDK is initialized before making any calls
    if (!this.isInitialized()) {
      throw new Error(
        "Appwrite SDK is not properly initialized. Please ensure endpoint, project ID, and authentication (API key, JWT, or session) are set.",
      );
    }

    // Convert service name to lowercase for case-insensitive matching
    const normalizedServiceName = serviceName.toLowerCase();

    // Check if service exists
    if (!this.availableServices[normalizedServiceName]) {
      throw new Error(
        `Service '${serviceName}' does not exist in Appwrite SDK`,
      );
    }

    // Get or create service instance
    if (!this.serviceInstances[normalizedServiceName]) {
      this.serviceInstances[normalizedServiceName] = new this.availableServices[
        normalizedServiceName
      ](this.client);
    }

    const service = this.serviceInstances[normalizedServiceName];

    // Check if method exists
    if (typeof service[methodName] !== "function") {
      throw new Error(
        `Method '${methodName}' does not exist in service '${serviceName}'`,
      );
    }

    // Call the method with provided arguments
    return service[methodName](args);
  }
}
