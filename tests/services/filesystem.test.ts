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
      setLogger: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendCommand: jest.fn(),
    } as unknown as Synapse);

    filesystem = new Filesystem(mockSynapse);
  });

  describe("createFile", () => {
    it("should create a file with content and verify its existence", async () => {
      const filePath = "/test/file.txt";
      const content = "test content";

      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(content);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const createResult = await filesystem.createFile(filePath, content);
      expect(createResult.success).toBe(true);

      expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
      });

      expect(fs.writeFile).toHaveBeenCalledWith(filePath, content);

      await expect(fs.access(filePath)).resolves.toBeUndefined();

      const readResult = await filesystem.getFile(filePath);
      expect(readResult.success).toBe(true);
      expect(readResult.data).toBe(content);
    });

    it("should handle file creation errors properly", async () => {
      const filePath = "/test/error.txt";
      const content = "test content";
      const error = new Error("Failed to create file");

      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockRejectedValue(error);

      const result = await filesystem.createFile(filePath, content);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to create file");
      expect(mockSynapse.logger).toHaveBeenCalledWith(
        expect.stringContaining("Error: Failed to create file"),
      );
    });
  });

  describe("getFile", () => {
    it("should read file content and verify data", async () => {
      const filePath = "/test/file.txt";
      const content = "test content";

      (fs.readFile as jest.Mock).mockResolvedValue(content);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      await expect(fs.access(filePath)).resolves.toBeUndefined();

      const result = await filesystem.getFile(filePath);
      expect(result.success).toBe(true);
      expect(result.data).toBe(content);
      expect(fs.readFile).toHaveBeenCalledWith(filePath, "utf-8");
    });

    it("should handle file reading errors properly", async () => {
      const filePath = "/test/nonexistent.txt";
      const error = new Error("File not found");

      (fs.readFile as jest.Mock).mockRejectedValue(error);

      const result = await filesystem.getFile(filePath);
      expect(result.success).toBe(false);
      expect(result.error).toBe("File not found");
      expect(mockSynapse.logger).toHaveBeenCalledWith(
        expect.stringContaining("Error: File not found"),
      );
    });
  });
});
