import * as fsSync from "fs";
import OpenAI from "openai";
import * as path from "path";
import { Embeddings } from "../../src/services/embeddings";
import { Synapse } from "../../src/synapse";

jest.mock("fs");
jest.mock("openai");
jest.mock("path");

describe("Embeddings", () => {
  let embeddings: Embeddings;
  let mockSynapse: Synapse;
  let mockOpenAI: jest.Mocked<OpenAI>;
  let mockEmbeddings: jest.Mocked<OpenAI["embeddings"]>;

  const mockWorkDir = "/test/workspace";

  beforeEach(() => {
    jest.clearAllMocks();

    mockSynapse = new Synapse();

    // Mock fs operations
    (fsSync.existsSync as jest.Mock).mockReturnValue(true);
    (fsSync.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fsSync.readdirSync as jest.Mock).mockImplementation((dir: string) => {
      if (dir === mockWorkDir) {
        return [
          { name: "file1.ts", isDirectory: () => false, isFile: () => true },
          { name: "file2.js", isDirectory: () => false, isFile: () => true },
          { name: "subdir", isDirectory: () => true, isFile: () => false },
          {
            name: "node_modules",
            isDirectory: () => true,
            isFile: () => false,
          },
        ];
      }
      if (dir.endsWith("subdir")) {
        return [
          { name: "file3.py", isDirectory: () => false, isFile: () => true },
        ];
      }
      return [];
    });

    (fsSync.readFileSync as jest.Mock).mockImplementation(
      (filePath: string) => {
        if (filePath.includes("file1.ts")) return "const hello = 'world';";
        if (filePath.includes("file2.js"))
          return "function test() { return 42; }";
        if (filePath.includes("file3.py")) return "def hello(): return 'world'";
        return "";
      },
    );

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

    // Mock OpenAI
    mockEmbeddings = {
      create: jest.fn(),
    } as any;

    mockOpenAI = {
      embeddings: mockEmbeddings,
    } as any;

    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
      () => mockOpenAI,
    );

    // Set environment variable
    process.env.OPENAI_API_KEY = "test-api-key";

    embeddings = new Embeddings(mockSynapse, mockWorkDir);
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe("initialization", () => {
    it("should create embeddings instance with valid work directory", () => {
      expect(embeddings).toBeInstanceOf(Embeddings);
      expect(fsSync.existsSync).toHaveBeenCalledWith(mockWorkDir);
    });

    it("should use current working directory when no workDir provided", () => {
      const embeddingsWithoutDir = new Embeddings(mockSynapse, "");
      expect(embeddingsWithoutDir).toBeInstanceOf(Embeddings);
    });

    it("should create work directory if it doesn't exist", () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(false);
      new Embeddings(mockSynapse, "/new/directory");
      expect(fsSync.mkdirSync).toHaveBeenCalledWith("/new/directory", {
        recursive: true,
      });
    });
  });

  describe("generateEmbeddings", () => {
    beforeEach(() => {
      mockEmbeddings.create.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }],
      } as any);
    });

    it("should successfully generate embeddings for code files", async () => {
      const result = await embeddings.generateEmbeddings();

      expect(result.success).toBe(true);
      expect(result.message).toContain(
        "Successfully generated embeddings for 3 files",
      );
      expect(mockEmbeddings.create).toHaveBeenCalledTimes(3);
    });

    it("should throw error when OpenAI API key is missing", async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(embeddings.generateEmbeddings()).rejects.toThrow(
        "OPENAI_API_KEY environment variable is required",
      );
    });

    it("should handle file read errors gracefully", async () => {
      (fsSync.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error("File read error");
      });

      const result = await embeddings.generateEmbeddings();

      expect(result.success).toBe(true); // Should still succeed with processed files
      expect(mockEmbeddings.create).toHaveBeenCalledTimes(0); // No files processed due to read errors
    });

    it("should handle OpenAI API errors", async () => {
      mockEmbeddings.create.mockRejectedValue(new Error("API Error"));

      const result = await embeddings.generateEmbeddings();

      expect(result.success).toBe(false);
      expect(result.message).toContain("Failed to generate embeddings");
    });

    it("should skip empty files", async () => {
      (fsSync.readFileSync as jest.Mock).mockReturnValue("");

      const result = await embeddings.generateEmbeddings();

      expect(result.success).toBe(true);
      expect(mockEmbeddings.create).toHaveBeenCalledTimes(0);
    });

    it("should truncate large files", async () => {
      const largeContent = "a".repeat(8000);
      (fsSync.readFileSync as jest.Mock).mockReturnValue(largeContent);

      await embeddings.generateEmbeddings();

      const callArgs = mockEmbeddings.create.mock.calls[0][0];
      expect(callArgs.input).toContain("...");
      expect(callArgs.input.length).toBeLessThan(largeContent.length + 100); // Account for file path prefix
    });
  });

  describe("findRelevantDocuments", () => {
    beforeEach(async () => {
      // Generate some embeddings first
      mockEmbeddings.create.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }],
      } as any);

      await embeddings.generateEmbeddings();
    });

    it("should find relevant documents", async () => {
      // Mock query embedding
      mockEmbeddings.create.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }],
      } as any);

      const result = await embeddings.findRelevantDocuments("test query");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data[0]).toHaveProperty("filePath");
      expect(result.data[0]).toHaveProperty("content");
      expect(result.data[0]).toHaveProperty("similarity");
    });

    it("should limit results to specified number", async () => {
      mockEmbeddings.create.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }],
      } as any);

      const result = await embeddings.findRelevantDocuments("test query", 2);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it("should return error when no embeddings available", async () => {
      const newEmbeddings = new Embeddings(mockSynapse, mockWorkDir);

      const result = await newEmbeddings.findRelevantDocuments("test query");

      expect(result.success).toBe(false);
      expect(result.data).toHaveLength(0);
    });

    it("should handle OpenAI API errors during search", async () => {
      mockEmbeddings.create.mockRejectedValue(new Error("API Error"));

      const result = await embeddings.findRelevantDocuments("test query");

      expect(result.success).toBe(false);
      expect(result.data).toHaveLength(0);
    });

    it("should sort results by similarity", async () => {
      // Reset and create embeddings with different vectors that will have different similarities
      const newEmbeddings = new Embeddings(mockSynapse, mockWorkDir);

      // Mock different embeddings for each file with more distinct vectors
      mockEmbeddings.create
        .mockResolvedValueOnce({
          data: [{ embedding: [1, 0, 0, 0, 0] }],
        } as any) // Most similar to query
        .mockResolvedValueOnce({
          data: [{ embedding: [0, 1, 0, 0, 0] }],
        } as any) // Less similar
        .mockResolvedValueOnce({
          data: [{ embedding: [0, 0, 0, 0, 1] }],
        } as any); // Least similar

      await newEmbeddings.generateEmbeddings();

      // Mock query embedding that's closest to the first file
      mockEmbeddings.create.mockResolvedValue({
        data: [{ embedding: [0.9, 0.1, 0, 0, 0] }],
      } as any);

      const result = await newEmbeddings.findRelevantDocuments("test query");

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(3);
      // Check that similarities are in descending order
      expect(result.data[0].similarity).toBeGreaterThan(
        result.data[1].similarity,
      );
      expect(result.data[1].similarity).toBeGreaterThan(
        result.data[2].similarity,
      );
    });
  });

  describe("getEmbeddingsStats", () => {
    it("should return empty stats initially", () => {
      const stats = embeddings.getEmbeddingsStats();

      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSize).toBe(0);
    });

    it("should return correct stats after generating embeddings", async () => {
      mockEmbeddings.create.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }],
      } as any);

      await embeddings.generateEmbeddings();
      const stats = embeddings.getEmbeddingsStats();

      expect(stats.totalFiles).toBe(3);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe("file filtering", () => {
    it("should only process supported code file extensions", async () => {
      // Create a fresh embeddings instance for this test
      const testEmbeddings = new Embeddings(mockSynapse, mockWorkDir);

      // Reset the mock for this specific test
      mockEmbeddings.create.mockClear();

      (fsSync.readdirSync as jest.Mock).mockImplementation((dir: string) => {
        if (dir === mockWorkDir) {
          return [
            { name: "file.ts", isDirectory: () => false, isFile: () => true },
            { name: "file.txt", isDirectory: () => false, isFile: () => true },
            { name: "image.png", isDirectory: () => false, isFile: () => true },
            { name: "doc.md", isDirectory: () => false, isFile: () => true },
          ];
        }
        return [];
      });

      (fsSync.readFileSync as jest.Mock).mockImplementation(
        (filePath: string) => {
          if (filePath.includes("file.ts")) return "const test = 'typescript';";
          if (filePath.includes("doc.md")) return "# Markdown document";
          return "some content";
        },
      );

      mockEmbeddings.create.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }],
      } as any);

      const result = await testEmbeddings.generateEmbeddings();

      expect(result.success).toBe(true);
      expect(mockEmbeddings.create).toHaveBeenCalledTimes(2); // Only .ts and .md files
    });

    it("should skip excluded directories", async () => {
      // Create a fresh embeddings instance for this test
      const testEmbeddings = new Embeddings(mockSynapse, mockWorkDir);

      // Reset the mock for this specific test
      mockEmbeddings.create.mockClear();

      (fsSync.readdirSync as jest.Mock).mockImplementation((dir: string) => {
        if (dir === mockWorkDir) {
          return [
            { name: "src", isDirectory: () => true, isFile: () => false },
            {
              name: "node_modules",
              isDirectory: () => true,
              isFile: () => false,
            },
            { name: ".git", isDirectory: () => true, isFile: () => false },
            { name: "dist", isDirectory: () => true, isFile: () => false },
          ];
        }
        if (dir.endsWith("src")) {
          return [
            { name: "index.ts", isDirectory: () => false, isFile: () => true },
          ];
        }
        return [];
      });

      (fsSync.readFileSync as jest.Mock).mockImplementation(
        (filePath: string) => {
          if (filePath.includes("index.ts"))
            return "export const main = () => {};";
          return "";
        },
      );

      mockEmbeddings.create.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }],
      } as any);

      const result = await testEmbeddings.generateEmbeddings();

      expect(result.success).toBe(true);
      expect(mockEmbeddings.create).toHaveBeenCalledTimes(1); // Only src/index.ts
    });
  });
});
