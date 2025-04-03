import { jest } from "@jest/globals";
import { spawn } from "child_process";
import * as fs from "fs";
import { Git, Synapse } from "../../src";

jest.mock("child_process", () => ({
  spawn: jest.fn(),
}));

jest.mock("fs", () => {
  const actual = jest.requireActual("fs") as typeof fs;
  return {
    ...actual,
    existsSync: jest.fn(),
    statSync: jest.fn(),
    promises: {
      ...actual.promises,
      access: jest.fn(() => Promise.resolve()),
    },
  };
});

describe("Git Service", () => {
  let git: Git;
  let mockSpawn: jest.Mock;
  let mockSynapse: jest.Mocked<Synapse>;
  const mockWorkingDir = "/workspace/synapse";

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock process.cwd
    jest.spyOn(process, "cwd").mockReturnValue(mockWorkingDir);

    // Mock fs.existsSync to return false by default (no git repo)
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });

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

  describe("init", () => {
    it("should initialize a new git repository", async () => {
      setupMockProcess("Initialized empty Git repository");

      const result = await git.init();

      expect(result).toEqual({
        success: true,
        data: "Initialized empty Git repository",
      });
      expect(mockSpawn).toHaveBeenCalledWith("git", ["init"], {
        cwd: mockWorkingDir,
      });
    });

    it("should handle error when repository already exists", async () => {
      // Mock fs.existsSync to return true (git repo exists)
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await git.init();

      expect(result).toEqual({
        success: false,
        error: "Git repository already exists in this directory",
      });
    });
  });

  describe("addRemote", () => {
    it("should add a remote repository", async () => {
      setupMockProcess("");

      const result = await git.addRemote(
        "origin",
        "https://github.com/user/repo.git",
      );

      expect(result).toEqual({
        success: true,
        data: "",
      });
      expect(mockSpawn).toHaveBeenCalledWith(
        "git",
        ["remote", "add", "origin", "https://github.com/user/repo.git"],
        { cwd: mockWorkingDir },
      );
    });

    it("should handle error when remote already exists", async () => {
      setupMockProcess("", "remote origin already exists", 128);

      const result = await git.addRemote(
        "origin",
        "https://github.com/user/repo.git",
      );

      expect(result).toEqual({
        success: false,
        error: "remote origin already exists",
      });
    });
  });

  describe("getCurrentBranch", () => {
    it("should return current branch name", async () => {
      setupMockProcess("main\n");

      const result = await git.getCurrentBranch();

      expect(result).toEqual({
        success: true,
        data: "main",
      });
      expect(mockSpawn).toHaveBeenCalledWith(
        "git",
        ["rev-parse", "--abbrev-ref", "HEAD"],
        { cwd: mockWorkingDir },
      );
    });

    it("should handle error when getting current branch", async () => {
      setupMockProcess("", "fatal: not a git repository", 128);

      const result = await git.getCurrentBranch();

      expect(result).toEqual({
        success: false,
        error: "fatal: not a git repository",
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
      expect(mockSpawn).toHaveBeenCalledWith("git", ["status"], {
        cwd: mockWorkingDir,
      });
    });

    it("should handle error when repository is not initialized", async () => {
      setupMockProcess("", "fatal: not a git repository", 128);

      const result = await git.status();

      expect(result).toEqual({
        success: false,
        error: "fatal: not a git repository",
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
      expect(mockSpawn).toHaveBeenCalledWith(
        "git",
        ["add", "file1.txt", "file2.txt"],
        { cwd: mockWorkingDir },
      );
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
        error: "fatal: pathspec 'nonexistent.txt' did not match any files",
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
      expect(mockSpawn).toHaveBeenCalledWith(
        "git",
        ["commit", "-m", "test commit"],
        { cwd: mockWorkingDir },
      );
    });

    it("should handle error when there are no changes to commit", async () => {
      setupMockProcess("", "nothing to commit, working tree clean", 1);

      const result = await git.commit("test commit");

      expect(result).toEqual({
        success: false,
        error: "nothing to commit, working tree clean",
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
      expect(mockSpawn).toHaveBeenCalledWith("git", ["pull"], {
        cwd: mockWorkingDir,
      });
    });

    it("should handle error when there is no remote configured", async () => {
      setupMockProcess("", "fatal: no remote repository specified", 1);

      const result = await git.pull();

      expect(result).toEqual({
        success: false,
        error: "fatal: no remote repository specified",
      });
    });
  });

  describe("setUserName", () => {
    it("should set git user name", async () => {
      setupMockProcess(""); // Git config doesn't return output on success

      const result = await git.setUserName("John Doe");

      expect(result).toEqual({
        success: true,
        data: "",
      });
      expect(mockSpawn).toHaveBeenCalledWith(
        "git",
        ["config", "user.name", "John Doe"],
        { cwd: mockWorkingDir },
      );
    });

    it("should handle error when setting user name fails", async () => {
      setupMockProcess("", "error: could not set user.name", 1);

      const result = await git.setUserName("John Doe");

      expect(result).toEqual({
        success: false,
        error: "error: could not set user.name",
      });
    });
  });

  describe("setUserEmail", () => {
    it("should set git user email", async () => {
      setupMockProcess(""); // Git config doesn't return output on success

      const result = await git.setUserEmail("john.doe@example.com");

      expect(result).toEqual({
        success: true,
        data: "",
      });
      expect(mockSpawn).toHaveBeenCalledWith(
        "git",
        ["config", "user.email", "john.doe@example.com"],
        { cwd: mockWorkingDir },
      );
    });

    it("should handle error when setting user email fails", async () => {
      setupMockProcess("", "error: could not set user.email", 1);

      const result = await git.setUserEmail("john.doe@example.com");

      expect(result).toEqual({
        success: false,
        error: "error: could not set user.email",
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
      expect(mockSpawn).toHaveBeenCalledWith("git", ["push"], {
        cwd: mockWorkingDir,
      });
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
        error: "fatal: The current branch has no upstream branch",
      });
    });
  });
});
