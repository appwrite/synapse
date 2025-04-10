import * as fs from "fs/promises";
import { Filesystem } from "../../src/services/filesystem";
import { Synapse } from "../../src/synapse";

jest.mock("fs/promises");

describe("Filesystem", () => {
  let filesystem: Filesystem;
  let mockSynapse: jest.Mocked<Synapse>;

  beforeEach(() => {
    mockSynapse = jest.mocked({
      logger: jest.fn(),
      workDir: "/test",
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
});
