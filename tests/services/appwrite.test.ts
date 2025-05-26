import { Client, Users } from "node-appwrite";
import { Appwrite } from "../../src/services/appwrite";
import { Synapse } from "../../src/synapse";

jest.mock("node-appwrite", () => ({
  Client: jest.fn().mockImplementation(() => ({
    setEndpoint: jest.fn().mockReturnThis(),
    setProject: jest.fn().mockReturnThis(),
    setKey: jest.fn().mockReturnThis(),
    config: {},
  })),
  Users: jest.fn().mockImplementation(() => ({
    list: jest.fn(),
  })),
}));

describe("Appwrite", () => {
  let appwrite: Appwrite;
  let mockClient: jest.Mocked<Client>;
  let MockedClient: jest.MockedClass<typeof Client>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get the mocked constructors
    MockedClient = Client as jest.MockedClass<typeof Client>;

    // Create a new instance
    appwrite = new Appwrite(new Synapse());

    // Get the mocked client instance
    mockClient = MockedClient.mock.results[0].value;
  });

  describe("initialization", () => {
    it("should create a new instance without parameters", () => {
      expect(appwrite).toBeInstanceOf(Appwrite);
      expect(Client).toHaveBeenCalled();
    });
  });

  describe("configuration", () => {
    it("should properly configure the client and return instance for chaining", () => {
      const endpoint = "https://cloud.appwrite.io/v1";
      const projectId = "test-project";
      const apiKey = "test-api-key";

      const result = appwrite
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setKey(apiKey);

      expect(mockClient.setEndpoint).toHaveBeenCalledWith(endpoint);
      expect(mockClient.setProject).toHaveBeenCalledWith(projectId);
      expect(mockClient.setKey).toHaveBeenCalledWith(apiKey);
      expect(result).toBe(appwrite);
    });
  });

  describe("initialization check", () => {
    it("should return false when not properly initialized", () => {
      expect(appwrite.isInitialized()).toBe(false);
    });

    it("should return true when properly initialized", () => {
      appwrite.setEndpoint("https://cloud.appwrite.io/v1");
      appwrite.setProject("test-project");
      appwrite.setKey("test-api-key");

      // Mock the private config object
      (mockClient as any).config = {
        endpoint: "https://cloud.appwrite.io/v1",
        project: "test-project",
        key: "test-api-key",
      };

      expect(appwrite.isInitialized()).toBe(true);
    });
  });

  describe("service calls", () => {
    beforeEach(() => {
      // Setup basic initialization
      appwrite.setEndpoint("https://cloud.appwrite.io/v1");
      appwrite.setProject("test-project");
      appwrite.setKey("test-api-key");

      // Mock the private config object
      (mockClient as any).config = {
        endpoint: "https://cloud.appwrite.io/v1",
        project: "test-project",
        key: "test-api-key",
      };
    });

    it("should throw error when SDK is not initialized", async () => {
      const uninitializedAppwrite = new Appwrite(new Synapse());
      await expect(uninitializedAppwrite.call("users", "list")).rejects.toThrow(
        "Appwrite SDK is not properly initialized",
      );
    });

    it("should throw error for non-existent service", async () => {
      await expect(appwrite.call("nonexistent", "list")).rejects.toThrow(
        "Service 'nonexistent' does not exist in Appwrite SDK",
      );
    });

    it("should successfully call a service method", async () => {
      const mockUsers = new Users(mockClient);
      const mockResponse = {
        total: 1,
        users: [{ id: "1", name: "Test User" }],
      };

      // Mock the Users constructor and method
      (Users as jest.Mock).mockImplementation(() => mockUsers);
      mockUsers.list = jest.fn().mockResolvedValue(mockResponse);

      const result = await appwrite.call("users", "list", { limit: 10 });

      expect(Users).toHaveBeenCalledWith(mockClient);
      expect(mockUsers.list).toHaveBeenCalledWith({ limit: 10 });
      expect(result).toEqual(mockResponse);
    });
  });
});
