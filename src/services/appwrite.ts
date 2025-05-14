import { Client, Account, Databases, Functions, Storage, Teams, Users } from 'node-appwrite';

export class Appwrite {
  private client: Client;
  private serviceInstances: Record<string, any> = {};
  private availableServices: Record<string, any> = {
    account: Account,
    databases: Databases,
    functions: Functions,
    storage: Storage,
    teams: Teams,
    users: Users,
  };

  constructor(
    endpoint: string,
    projectId: string,
    apiKey: string
  ) {
    // Initialize client
    this.client = new Client();
    this.client
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);
  }

  /**
   * Get the Appwrite client instance
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Call a method on an Appwrite service
   * @param serviceName The name of the service (e.g., 'users', 'databases')
   * @param methodName The name of the method to call on the service
   * @param args Arguments to pass to the method
   * @returns The result of the method call
   * @throws Error if service or method does not exist
   */
  async call(serviceName: string, methodName: string, ...args: any[]): Promise<any> {
    // Convert service name to lowercase for case-insensitive matching
    const normalizedServiceName = serviceName.toLowerCase();
    
    // Check if service exists
    if (!this.availableServices[normalizedServiceName]) {
      throw new Error(`Service '${serviceName}' does not exist in Appwrite SDK`);
    }

    // Get or create service instance
    if (!this.serviceInstances[normalizedServiceName]) {
      this.serviceInstances[normalizedServiceName] = new this.availableServices[normalizedServiceName](this.client);
    }
    
    const service = this.serviceInstances[normalizedServiceName];
    
    // Check if method exists
    if (typeof service[methodName] !== 'function') {
      throw new Error(`Method '${methodName}' does not exist in service '${serviceName}'`);
    }
    
    // Call the method with provided arguments
    return service[methodName](...args);
  }
}