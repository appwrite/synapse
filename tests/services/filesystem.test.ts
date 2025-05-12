import * as fsSync from "fs";
import * as fs from "fs/promises";
import ignore from "ignore";
import { Filesystem } from "../../src/services/filesystem";
import { Synapse } from "../../src/synapse";

jest.mock("fs/promises");
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  watch: jest.fn(),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  constants: {
    F_OK: 0,
  },
}));
jest.mock("ignore");

describe("Filesystem", () => {
  let filesystem: Filesystem;
  let mockSynapse: jest.Mocked<Synapse>;

  beforeEach(() => {
    mockSynapse = jest.mocked({
      logger: jest.fn(),
      workDir: "/test",
      setFilesystem: jest.fn(),
    } as unknown as Synapse);

    filesystem = new Filesystem(mockSynapse);
    jest.clearAllMocks();
  });

  describe("createFile", () => {
    it("should successfully create a file", async () => {
      const filePath = "/file.txt";
      const content = "test content";

      // Mock access to indicate file does NOT exist initially
      const accessError = new Error("ENOENT") as NodeJS.ErrnoException;
      accessError.code = "ENOENT";
      (fs.access as jest.Mock).mockRejectedValue(accessError);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined); // Assuming createFolder is called
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await filesystem.createFile(filePath, content);
      expect(result).toEqual({
        success: true,
        data: "File created successfully",
      });
    });

    it("should return error if file already exists", async () => {
      const filePath = "/existing.txt";
      const content = "test content";

      // Mock access to indicate file DOES exist
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await filesystem.createFile(filePath, content);
      expect(fs.writeFile).not.toHaveBeenCalled(); // Should not attempt to write
      expect(result).toEqual({
        success: false,
        error: `File already exists at path: ${filePath}`,
      });
    });

    it("should handle file creation errors during write", async () => {
      const filePath = "/test/error.txt";
      const content = "test content";

      // Mock access to indicate file does NOT exist initially
      const accessError = new Error("ENOENT") as NodeJS.ErrnoException;
      accessError.code = "ENOENT";
      (fs.access as jest.Mock).mockRejectedValue(accessError);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined); // Mock directory creation
      (fs.writeFile as jest.Mock).mockRejectedValue(
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
      const filePath = "/file.txt";
      const content = "test content";

      (fs.readFile as jest.Mock).mockResolvedValue(content);

      const result = await filesystem.getFile(filePath);
      expect(result).toEqual({
        success: true,
        data: content,
      });
    });

    it("should handle file reading errors", async () => {
      const filePath = "/test/nonexistent.txt";

      (fs.readFile as jest.Mock).mockRejectedValue(new Error("File not found"));

      const result = await filesystem.getFile(filePath);
      expect(result).toEqual({
        success: false,
        error: "File not found",
      });
    });
  });

  describe("watchFolder", () => {
    it("should set up a watcher and call callback on file changes, respecting .gitignore", async () => {
      const mockWatcher = {
        close: jest.fn(),
      };

      // Mock the filesystem functions
      (fsSync.watch as jest.Mock).mockReturnValue(mockWatcher);
      (fsSync.existsSync as jest.Mock).mockReturnValue(true);
      (fsSync.readFileSync as jest.Mock).mockReturnValue(
        "*.env\nnode_modules/",
      );

      // Mock ignore implementation
      const mockIgnore = {
        add: jest.fn().mockReturnThis(),
        ignores: jest.fn().mockImplementation((path) => path.includes(".env")),
      };
      (ignore as unknown as jest.Mock).mockReturnValue(mockIgnore);

      // Create a spy implementation to capture the watch callback
      let watchCallback:
        | ((eventType: string, filename: string) => void)
        | null = null;
      (fsSync.watch as jest.Mock).mockImplementation(
        (path, options, callback) => {
          watchCallback = callback;
          return mockWatcher;
        },
      );

      // Mock fs.lstat and fs.readFile for the file change event
      (fs.lstat as jest.Mock).mockResolvedValue({
        isFile: jest.fn().mockReturnValue(true),
      });
      (fs.readFile as jest.Mock).mockResolvedValue("file content");

      // Set up the callback spy
      const onChangeMock = jest.fn();

      // Call the method being tested
      filesystem.watchWorkDir(onChangeMock);

      // Verify watch was called with correct path
      expect(fsSync.watch).toHaveBeenCalledWith(
        mockSynapse.workDir,
        { recursive: true },
        expect.any(Function),
      );

      // Simulate a file change event for a non-ignored file
      if (watchCallback) {
        // @ts-ignore
        watchCallback("change", "file1.txt");
      }

      // Wait for the async callbacks to complete
      await new Promise((resolve) => setImmediate(resolve));

      // Check callback was called with correct data
      expect(onChangeMock).toHaveBeenCalledWith({
        path: "/file1.txt",
        content: "file content",
      });

      // Test that ignored files don't trigger the callback
      onChangeMock.mockClear();
      if (watchCallback) {
        // @ts-ignore
        watchCallback("change", ".env");
      }

      await new Promise((resolve) => setImmediate(resolve));
      expect(onChangeMock).not.toHaveBeenCalled();

      // Also test unwatchFolder
      filesystem.unwatchWorkDir();
      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });

  describe("appendFile", () => {
    it("should append content to a file", async () => {
      const filePath = "/file.txt";
      const content = "appended content";
      (fs.appendFile as jest.Mock).mockResolvedValue(undefined);

      const result = await filesystem.appendFile(filePath, content);
      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining(filePath),
        content,
      );
      expect(result).toEqual({ success: true });
    });
  });
});
