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
  const mockWorkingDir = "/tmp/synapse/git-test";

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, "cwd").mockReturnValue(mockWorkingDir);
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });

    mockSpawn = spawn as jest.Mock;
    mockSynapse = new Synapse() as jest.Mocked<Synapse>;
    git = new Git(mockSynapse, mockWorkingDir);
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
    it("success - new repository", async () => {
      setupMockProcess("Initialized empty Git repository");
      expect(await git.init()).toEqual({
        success: true,
        data: "Initialized empty Git repository",
      });
    });

    it("error - repository exists", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.existsSync as jest.Mock).mockImplementation(function (
        this: unknown,
        ...args: unknown[]
      ): boolean {
        const path = args[0] as string;
        return path.includes(".git");
      });
      expect(await git.init()).toEqual({
        success: false,
        error: "Git repository already exists in this directory",
      });
    });

    it("success - change workDir", async () => {
      // First ensure no git repo exists
      (fs.existsSync as jest.Mock).mockImplementation(function (
        this: unknown,
      ): boolean {
        return false;
      });
      setupMockProcess("Initialized empty Git repository");

      // Change workDir
      git.updateWorkDir("/tmp/synapse/git-test/another-project");

      // Now init should succeed
      const secondInit = await git.init();
      expect(secondInit).toEqual({
        success: true,
        data: "Initialized empty Git repository",
      });
    });
  });

  describe("addRemote", () => {
    it("success", async () => {
      setupMockProcess("");
      expect(
        await git.addRemote("origin", "https://github.com/user/repo.git"),
      ).toEqual({
        success: true,
        data: "",
      });
    });

    it("error - remote exists", async () => {
      setupMockProcess("", "remote origin already exists", 128);
      expect(
        await git.addRemote("origin", "https://github.com/user/repo.git"),
      ).toEqual({
        success: false,
        error: "remote origin already exists",
      });
    });
  });

  describe("getCurrentBranch", () => {
    it("success", async () => {
      setupMockProcess("main\n");
      expect(await git.getCurrentBranch()).toEqual({
        success: true,
        data: "main",
      });
    });

    it("error", async () => {
      setupMockProcess("", "fatal: not a git repository", 128);
      expect(await git.getCurrentBranch()).toEqual({
        success: false,
        error: "fatal: not a git repository",
      });
    });
  });

  describe("status", () => {
    it("success", async () => {
      const statusOutput =
        "On branch main\nnothing to commit, working tree clean";
      setupMockProcess(statusOutput);
      expect(await git.status()).toEqual({
        success: true,
        data: statusOutput,
      });
    });
  });

  describe("add", () => {
    it("success", async () => {
      setupMockProcess("");
      expect(await git.add(["file1.txt"])).toEqual({
        success: true,
        data: "",
      });
    });

    it("error - non-existent files", async () => {
      setupMockProcess(
        "",
        "fatal: pathspec 'nonexistent.txt' did not match any files",
        128,
      );
      expect(await git.add(["nonexistent.txt"])).toEqual({
        success: false,
        error: "fatal: pathspec 'nonexistent.txt' did not match any files",
      });
    });
  });

  describe("commit", () => {
    it("success", async () => {
      const commitOutput = "[main abc1234] test commit\n 1 file changed";
      setupMockProcess(commitOutput);
      expect(await git.commit("test commit")).toEqual({
        success: true,
        data: commitOutput,
      });
    });

    it("error - nothing to commit", async () => {
      setupMockProcess("", "nothing to commit, working tree clean", 1);
      expect(await git.commit("test commit")).toEqual({
        success: false,
        error: "nothing to commit, working tree clean",
      });
    });
  });

  describe("pull", () => {
    it("success", async () => {
      setupMockProcess("Already up to date.");
      expect(await git.pull()).toEqual({
        success: true,
        data: "Already up to date.",
      });
    });

    it("error - no remote", async () => {
      setupMockProcess("", "fatal: no remote repository specified", 1);
      expect(await git.pull()).toEqual({
        success: false,
        error: "fatal: no remote repository specified",
      });
    });
  });

  describe("push", () => {
    it("success", async () => {
      setupMockProcess("Everything up-to-date");
      expect(await git.push()).toEqual({
        success: true,
        data: "Everything up-to-date",
      });
    });

    it("error - no upstream", async () => {
      setupMockProcess(
        "",
        "fatal: The current branch has no upstream branch",
        1,
      );
      expect(await git.push()).toEqual({
        success: false,
        error: "fatal: The current branch has no upstream branch",
      });
    });
  });
});
