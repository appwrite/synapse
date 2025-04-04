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
  });

  describe("createFile", () => {
    it("should successfully create a file", async () => {
      const filePath = "/file.txt";
      const content = "test content";

      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await filesystem.createFile(filePath, content);
      expect(result).toEqual({ success: true });
    });

    it("should handle file creation errors", async () => {
      const filePath = "/test/error.txt";
      const content = "test content";

      (fs.writeFile as jest.Mock).mockRejectedValue(
        new Error("Failed to create file"),
      );

      const result = await filesystem.createFile(filePath, content);
      expect(result).toEqual({
        success: false,
        error: "Failed to create file",
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
