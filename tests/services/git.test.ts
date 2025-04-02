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

      expect(result).toEqual({
        success: true,
        data: "main",
      });
      expect(mockSpawn).toHaveBeenCalledWith("git", [
        "rev-parse",
        "--abbrev-ref",
        "HEAD",
      ]);
    });

    it("should handle error when getting current branch", async () => {
      setupMockProcess("", "fatal: not a git repository", 128);

      const result = await git.getCurrentBranch();

      expect(result).toEqual({
        success: false,
        data: "fatal: not a git repository",
      });
    });
  });

  describe("status", () => {
    it("should return git status", async () => {
      const statusOutput =
        "On branch main\nnothing to commit, working tree clean";
      setupMockProcess(statusOutput);

      const result = await git.status();

      expect(result).toEqual({
        success: true,
        data: statusOutput,
      });
      expect(mockSpawn).toHaveBeenCalledWith("git", ["status"]);
    });

    it("should handle error when repository is not initialized", async () => {
      setupMockProcess("", "fatal: not a git repository", 128);

      const result = await git.status();

      expect(result).toEqual({
        success: false,
        data: "fatal: not a git repository",
      });
    });
  });

  describe("add", () => {
    it("should add files to staging", async () => {
      setupMockProcess("");

      const result = await git.add(["file1.txt", "file2.txt"]);

      expect(result).toEqual({
        success: true,
        data: "",
      });
      expect(mockSpawn).toHaveBeenCalledWith("git", [
        "add",
        "file1.txt",
        "file2.txt",
      ]);
    });

    it("should handle error when adding non-existent files", async () => {
      setupMockProcess(
        "",
        "fatal: pathspec 'nonexistent.txt' did not match any files",
        128,
      );

      const result = await git.add(["nonexistent.txt"]);

      expect(result).toEqual({
        success: false,
        data: "fatal: pathspec 'nonexistent.txt' did not match any files",
      });
    });
  });

  describe("commit", () => {
    it("should commit changes with message", async () => {
      const commitOutput = "[main abc1234] test commit\n 1 file changed";
      setupMockProcess(commitOutput);

      const result = await git.commit("test commit");

      expect(result).toEqual({
        success: true,
        data: commitOutput,
      });
      expect(mockSpawn).toHaveBeenCalledWith("git", [
        "commit",
        "-m",
        "test commit",
      ]);
    });

    it("should handle error when there are no changes to commit", async () => {
      setupMockProcess("", "nothing to commit, working tree clean", 1);

      const result = await git.commit("test commit");

      expect(result).toEqual({
        success: false,
        data: "nothing to commit, working tree clean",
      });
    });
  });

  describe("pull", () => {
    it("should pull changes from remote", async () => {
      setupMockProcess("Already up to date.");

      const result = await git.pull();

      expect(result).toEqual({
        success: true,
        data: "Already up to date.",
      });
      expect(mockSpawn).toHaveBeenCalledWith("git", ["pull"]);
    });

    it("should handle error when there is no remote configured", async () => {
      setupMockProcess("", "fatal: no remote repository specified", 1);

      const result = await git.pull();

      expect(result).toEqual({
        success: false,
        data: "fatal: no remote repository specified",
      });
    });
  });

  describe("push", () => {
    it("should push changes to remote", async () => {
      setupMockProcess("Everything up-to-date");

      const result = await git.push();

      expect(result).toEqual({
        success: true,
        data: "Everything up-to-date",
      });
      expect(mockSpawn).toHaveBeenCalledWith("git", ["push"]);
    });

    it("should handle error when there is no upstream branch", async () => {
      setupMockProcess(
        "",
        "fatal: The current branch has no upstream branch",
        1,
      );

      const result = await git.push();

      expect(result).toEqual({
        success: false,
        data: "fatal: The current branch has no upstream branch",
      });
    });
  });
});
