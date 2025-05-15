import * as chokidar from "chokidar";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import { Filesystem } from "../../src/services/filesystem";
import { Synapse } from "../../src/synapse";

jest.mock("fs/promises");
jest.mock("fs");
jest.mock("ignore");
jest.mock("chokidar");

describe("Filesystem", () => {
  let filesystem: Filesystem;
  let mockSynapse: jest.Mocked<Synapse>;
  const tempDir = path.join(process.cwd(), "tmp", "test");

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    mockSynapse = jest.mocked({
      logger: jest.fn(),
      workDir: tempDir,
      setFilesystem: jest.fn(),
    } as unknown as Synapse);

    filesystem = new Filesystem(mockSynapse, tempDir);
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("createFile", () => {
    it("should successfully create a file", async () => {
      const filePath = path.join(tempDir, "file.txt");
      const content = "test content";

      // Mock access to indicate file does NOT exist initially
      const accessError = new Error("ENOENT") as NodeJS.ErrnoException;
      accessError.code = "ENOENT";
      (fsp.access as jest.Mock).mockRejectedValue(accessError);
      (fsp.mkdir as jest.Mock).mockResolvedValue(undefined); // Assuming createFolder is called
      (fsp.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await filesystem.createFile(filePath, content);
      expect(result).toEqual({
        success: true,
        data: "File created successfully",
      });
    });

    it("should return error if file already exists", async () => {
      const filePath = path.join(tempDir, "existing.txt");
      const content = "test content";

      // Mock access to indicate file DOES exist
      (fsp.access as jest.Mock).mockResolvedValue(undefined);

      const result = await filesystem.createFile(filePath, content);
      expect(fsp.writeFile).not.toHaveBeenCalled(); // Should not attempt to write
      expect(result).toEqual({
        success: false,
        error: `File already exists at path: ${filePath}`,
      });
    });

    it("should handle file creation errors during write", async () => {
      const filePath = path.join(tempDir, "error.txt");
      const content = "test content";

      // Mock access to indicate file does NOT exist initially
      const accessError = new Error("ENOENT") as NodeJS.ErrnoException;
      accessError.code = "ENOENT";
      (fsp.access as jest.Mock).mockRejectedValue(accessError);
      (fsp.mkdir as jest.Mock).mockResolvedValue(undefined); // Mock directory creation
      (fsp.writeFile as jest.Mock).mockRejectedValue(
        new Error("Failed to write file"),
      );

      const result = await filesystem.createFile(filePath, content);
      expect(result).toEqual({
        success: false,
        error: "Failed to write file",
      });
    });
  });

  describe("getFile", () => {
    it("should successfully read file content", async () => {
      const filePath = path.join(tempDir, "file.txt");
      const content = "test content";

      (fsp.readFile as jest.Mock).mockResolvedValue(content);

      const result = await filesystem.getFile(filePath);
      expect(result).toEqual({
        success: true,
        data: content,
      });
    });

    it("should handle file reading errors", async () => {
      const filePath = path.join(tempDir, "nonexistent.txt");

      (fsp.readFile as jest.Mock).mockRejectedValue(
        new Error("File not found"),
      );

      const result = await filesystem.getFile(filePath);
      expect(result).toEqual({
        success: false,
        error: "File not found",
      });
    });
  });

  describe("appendFile", () => {
    it("should append content to a file", async () => {
      const filePath = path.join(tempDir, "file.txt");
      const content = "appended content";
      (fsp.appendFile as unknown as jest.Mock).mockResolvedValue(undefined);

      const result = await filesystem.appendFile(filePath, content);
      expect(fsp.appendFile).toHaveBeenCalledWith(
        expect.stringContaining(filePath),
        content,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe("searchFiles", () => {
    it("should find files by path and content", async () => {
      // Setup mock directory structure
      const files = [
        { name: "foo.txt", content: "hello world" },
        { name: "bar.md", content: "search me" },
        { name: "baz.txt", content: "nothing here" },
      ];
      // Mock fs.readdir and fs.readFile
      (fsp.readdir as jest.Mock).mockImplementation(async (dir) => {
        if (dir === tempDir) {
          return files.map((f) => ({
            name: f.name,
            isDirectory: () => false,
            isFile: () => true,
          }));
        }
        return [];
      });
      (fsp.readFile as jest.Mock).mockImplementation(async (filePath) => {
        const file = files.find((f) => filePath.endsWith(f.name));
        return file ? file.content : "";
      });
      // Search by file name
      let results = await filesystem.searchFiles("foo");
      expect(results.data?.results).toContain("foo.txt");
      // Search by content
      results = await filesystem.searchFiles("search me");
      expect(results.data?.results).toContain("bar.md");
      // Search for non-matching term
      results = await filesystem.searchFiles("notfound");
      expect(results.data?.results).toEqual([]);
    });
  });

  describe("watchWorkDir", () => {
    it("should set up a watcher and handle file changes", async () => {
      const onChange = jest.fn();
      const testFilePath = path.join(tempDir, "watch-test.txt");

      // Mock chokidar watcher
      const mockWatcher = {
        on: jest.fn().mockReturnThis(),
        close: jest.fn(),
      };
      (chokidar.watch as jest.Mock).mockReturnValue(mockWatcher);

      // Mock file system operations
      (fsp.lstat as jest.Mock).mockResolvedValue({ isFile: () => true });
      (fsp.readFile as jest.Mock).mockResolvedValue("test content");

      // Start watching
      filesystem.watchWorkDir(onChange);

      // Simulate file change event
      const addCallback = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "add",
      )[1];
      addCallback(testFilePath);

      // Wait for the watcher to detect changes
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify onChange was called with correct data
      expect(onChange).toHaveBeenCalledWith({
        path: "/watch-test.txt",
        content: "test content",
      });

      // Clean up
      filesystem.unwatchWorkDir();
      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });
});
