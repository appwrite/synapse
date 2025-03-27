import { jest } from "@jest/globals";
import { spawn } from "child_process";
import { Git, Synapse } from "../../src";

jest.mock("child_process", () => ({
  spawn: jest.fn(),
}));

describe("Git Service", () => {
  let git: Git;
  let mockSpawn: jest.Mock;
  let mockSynapse: jest.Mocked<Synapse>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSynapse = {} as jest.Mocked<Synapse>;

    mockSpawn = spawn as jest.Mock;
    git = new Git(mockSynapse);
  });

  const setupMockProcess = (
    output: string = "",
    error: string = "",
    exitCode: number = 0,
  ) => {
    const mockStdout = { on: jest.fn(), pipe: jest.fn() };
    const mockStderr = { on: jest.fn(), pipe: jest.fn() };
    const mockChildProcess = {
      stdout: mockStdout,
      stderr: mockStderr,
      on: jest.fn(),
    };

    mockStdout.on.mockImplementation((event, callback) => {
      if (event === "data") {
        (callback as (data: string) => void)(output);
      }
    });

    mockStderr.on.mockImplementation((event, callback) => {
      if (event === "data") {
        (callback as (data: string) => void)(error);
      }
    });

    mockChildProcess.on.mockImplementation((event, callback) => {
      if (event === "close") {
        (callback as (code: number) => void)(exitCode);
      }
    });

    mockSpawn.mockReturnValue(mockChildProcess);
    return mockChildProcess;
  };

  describe("getCurrentBranch", () => {
    it("should return current branch name", async () => {
      setupMockProcess("main\n");

      const result = await git.getCurrentBranch();

      expect(result).toBe("main");
      expect(mockSpawn).toHaveBeenCalledWith("git", [
        "rev-parse",
        "--abbrev-ref",
        "HEAD",
      ]);
    });

    it("should handle error when getting current branch", async () => {
      setupMockProcess("", "fatal: not a git repository", 128);

      await expect(git.getCurrentBranch()).rejects.toThrow(
        "Git error: fatal: not a git repository",
      );
    });
  });

  describe("status", () => {
    it("should return git status", async () => {
      const statusOutput =
        "On branch main\nnothing to commit, working tree clean";
      setupMockProcess(statusOutput);

      const result = await git.status();

      expect(result).toBe(statusOutput);
      expect(mockSpawn).toHaveBeenCalledWith("git", ["status"]);
    });
  });

  describe("add", () => {
    it("should add files to staging", async () => {
      setupMockProcess("");

      await git.add(["file1.txt", "file2.txt"]);

      expect(mockSpawn).toHaveBeenCalledWith("git", [
        "add",
        "file1.txt",
        "file2.txt",
      ]);
    });
  });

  describe("commit", () => {
    it("should commit changes with message", async () => {
      setupMockProcess("[main abc1234] test commit\n 1 file changed");

      const result = await git.commit("test commit");

      expect(result).toBe("[main abc1234] test commit\n 1 file changed");
      expect(mockSpawn).toHaveBeenCalledWith("git", [
        "commit",
        "-m",
        "test commit",
      ]);
    });
  });

  describe("pull", () => {
    it("should pull changes from remote", async () => {
      setupMockProcess("Already up to date.");

      const result = await git.pull();

      expect(result).toBe("Already up to date.");
      expect(mockSpawn).toHaveBeenCalledWith("git", ["pull"]);
    });
  });

  describe("push", () => {
    it("should push changes to remote", async () => {
      setupMockProcess("Everything up-to-date");

      const result = await git.push();

      expect(result).toBe("Everything up-to-date");
      expect(mockSpawn).toHaveBeenCalledWith("git", ["push"]);
    });

    it("should handle push error", async () => {
      setupMockProcess(
        "",
        "fatal: The current branch has no upstream branch",
        1,
      );

      await expect(git.push()).rejects.toThrow(
        "Git error: fatal: The current branch has no upstream branch",
      );
    });
  });
});
