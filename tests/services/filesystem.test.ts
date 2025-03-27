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
    it("should create a file with content", async () => {
      const filePath = "/test/file.txt";
      const content = "test content";

      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await filesystem.createFile(filePath, content);

      expect(result.success).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
      });
      expect(fs.writeFile).toHaveBeenCalledWith(filePath, content);
    });
  });

  describe("getFile", () => {
    it("should read file content", async () => {
      const filePath = "/test/file.txt";
      const content = "test content";

      (fs.readFile as jest.Mock).mockResolvedValue(content);

      const result = await filesystem.getFile(filePath);

      expect(result.success).toBe(true);
      expect(result.data).toBe(content);
      expect(fs.readFile).toHaveBeenCalledWith(filePath, "utf-8");
    });
  });
});
