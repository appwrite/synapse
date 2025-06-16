const mockChokidar = {
  watch: jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    close: jest.fn().mockResolvedValue(undefined),
  }),
};

jest.mock("chokidar", () => mockChokidar);

import * as fsSync from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import { EmbeddingAdapter } from "../../src/adapters/embeddings";
import { Embeddings } from "../../src/services/embeddings";
import { Synapse } from "../../src/synapse";

jest.mock("fs");
jest.mock("fs/promises");
jest.mock("path", () => ({
  ...jest.requireActual("path"),
  sep: "/",
  join: jest.fn(),
  relative: jest.fn(),
  extname: jest.fn(),
  basename: jest.fn(),
}));

// Mock embedding adapter
class MockEmbeddingAdapter extends EmbeddingAdapter {
  private initialized: boolean = false;
  private mockEmbeddingFunction: jest.Mock;

  constructor(mockEmbeddingFunction: jest.Mock) {
    super();
    this.mockEmbeddingFunction = mockEmbeddingFunction;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.initialized) {
      throw new Error("Adapter not initialized");
    }
    const result = await this.mockEmbeddingFunction(text);
    return Array.from(result.data);
  }

  getName(): string {
    return "MockEmbeddingAdapter";
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

describe("Embeddings", () => {
  let embeddings: Embeddings;
  let mockSynapse: Synapse;
  let mockEmbeddingFunction: jest.Mock;
  let mockAdapter: MockEmbeddingAdapter;

  const mockWorkDir = "/test/workspace";

  beforeEach(() => {
    jest.clearAllMocks();

    mockSynapse = new Synapse();
    mockEmbeddingFunction = jest.fn().mockResolvedValue({
      data: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]),
    });
    mockAdapter = new MockEmbeddingAdapter(mockEmbeddingFunction);
    mockAdapter.initialize();

    // Mock fs operations
    (fsSync.existsSync as jest.Mock).mockReturnValue(true);
    (fsSync.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fsSync.readdirSync as jest.Mock).mockReturnValue([
      { name: "file1.ts", isDirectory: () => false, isFile: () => true },
      { name: "file2.js", isDirectory: () => false, isFile: () => true },
      { name: "node_modules", isDirectory: () => true, isFile: () => false },
    ]);
    (fsSync.readFileSync as jest.Mock).mockReturnValue("const test = 'code';");
    (fs.readFile as jest.Mock).mockResolvedValue("const test = 'code';");

    // Mock path operations
    (path.join as jest.Mock).mockImplementation((...parts: string[]) =>
      parts.join("/"),
    );
    (path.relative as jest.Mock).mockImplementation(
      (from: string, to: string) => to.replace(from + "/", ""),
    );
    (path.extname as jest.Mock).mockImplementation((filePath: string) => {
      const ext = filePath.split(".").pop();
      return ext ? `.${ext}` : "";
    });
    (path.basename as jest.Mock).mockImplementation(
      (filePath: string) => filePath.split("/").pop() || "",
    );

    embeddings = new Embeddings(mockSynapse, mockWorkDir, mockAdapter);
  });

  describe("initialization", () => {
    it("should create embeddings instance", () => {
      expect(embeddings).toBeInstanceOf(Embeddings);
      expect(fsSync.existsSync).toHaveBeenCalledWith(mockWorkDir);
    });

    it("should create work directory if it doesn't exist", () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(false);
      new Embeddings(mockSynapse, "/new/directory", mockAdapter);
      expect(fsSync.mkdirSync).toHaveBeenCalledWith("/new/directory", {
        recursive: true,
      });
    });
  });

  describe("startWatching", () => {
    it("should successfully start watching and generate initial embeddings", async () => {
      const result = await embeddings.startWatching();

      expect(result.success).toBe(true);
      expect(result.message).toContain("started successfully");
      expect(embeddings.isWatchingFiles()).toBe(true);
      expect(mockEmbeddingFunction).toHaveBeenCalled();
    });

    it("should return early if already watching", async () => {
      await embeddings.startWatching();
      const result = await embeddings.startWatching();

      expect(result.success).toBe(true);
      expect(result.message).toContain("already running");
    });

    it("should handle initialization errors", async () => {
      const mockError = new Error("Init error");
      jest.spyOn(mockAdapter, "initialize").mockRejectedValue(mockError);
      jest.spyOn(mockAdapter, "isInitialized").mockReturnValue(false);

      const result = await embeddings.startWatching();

      expect(result.success).toBe(false);
      expect(result.message).toContain("Failed to start");
      expect(result.message).toContain("Init error");
    });

    it("should skip empty and non-code files", async () => {
      (fsSync.readdirSync as jest.Mock).mockReturnValue([
        { name: "empty.ts", isDirectory: () => false, isFile: () => true },
        { name: "image.png", isDirectory: () => false, isFile: () => true },
      ]);
      (fs.readFile as jest.Mock).mockResolvedValue("");

      await embeddings.startWatching();

      expect(mockEmbeddingFunction).not.toHaveBeenCalled();
    });

    it("should truncate large files", async () => {
      const largeContent = "a".repeat(8000);
      (fs.readFile as jest.Mock).mockResolvedValue(largeContent);

      await embeddings.startWatching();

      const callArgs = mockEmbeddingFunction.mock.calls[0][0];
      expect(callArgs).toContain("...");
    });
  });

  describe("findDocuments", () => {
    beforeEach(async () => {
      await embeddings.startWatching();
    });

    it("should find relevant documents", async () => {
      const result = await embeddings.findDocuments("test query");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toHaveProperty("similarity");
    });

    it("should limit results", async () => {
      const result = await embeddings.findDocuments("test query", 1);

      expect(result.data).toHaveLength(1);
    });

    it("should return error when no embeddings available", async () => {
      const newEmbeddings = new Embeddings(
        mockSynapse,
        mockWorkDir,
        mockAdapter,
      );
      const result = await newEmbeddings.findDocuments("test query");

      expect(result.success).toBe(false);
      expect(result.message).toContain("No embeddings available");
    });

    it("should handle search errors", async () => {
      mockEmbeddingFunction.mockRejectedValue(new Error("Search error"));

      const result = await embeddings.findDocuments("test query");

      expect(result.success).toBe(false);
    });
  });

  describe("file filtering", () => {
    it("should process only code files", async () => {
      (fsSync.readdirSync as jest.Mock).mockReturnValue([
        { name: "file.ts", isDirectory: () => false, isFile: () => true },
        { name: "file.txt", isDirectory: () => false, isFile: () => true },
        { name: "image.png", isDirectory: () => false, isFile: () => true },
      ]);

      await embeddings.startWatching();

      expect(mockEmbeddingFunction).toHaveBeenCalledTimes(1); // Only .ts file
    });

    it("should skip ignored directories", async () => {
      (fsSync.readdirSync as jest.Mock).mockImplementation((dir: string) => {
        if (dir === mockWorkDir) {
          return [
            { name: "src", isDirectory: () => true, isFile: () => false },
            {
              name: "node_modules",
              isDirectory: () => true,
              isFile: () => false,
            },
          ];
        }
        if (dir.includes("src")) {
          return [
            { name: "index.ts", isDirectory: () => false, isFile: () => true },
          ];
        }
        return [];
      });

      await embeddings.startWatching();

      expect(mockEmbeddingFunction).toHaveBeenCalledTimes(1); // Only src/index.ts
    });
  });

  describe("utility methods", () => {
    it("should return correct stats", async () => {
      expect(embeddings.getStats().totalFiles).toBe(0);

      await embeddings.startWatching();
      const stats = embeddings.getStats();

      expect(stats.totalFiles).toBeGreaterThan(0);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it("should stop watching", async () => {
      await embeddings.startWatching();
      await embeddings.stopWatching();

      expect(embeddings.isWatchingFiles()).toBe(false);
    });

    it("should dispose properly", async () => {
      await embeddings.startWatching();
      await embeddings.dispose();

      expect(embeddings.isWatchingFiles()).toBe(false);
      expect(embeddings.getStats().totalFiles).toBe(0);
    });
  });
});
