import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { Synapse } from "../synapse";

export type GitOperationResult = {
  success: boolean;
  data: string;
};

export class Git {
  private synapse: Synapse;
  private workingDir: string;

  constructor(synapse: Synapse) {
    this.synapse = synapse;
    this.workingDir = process.cwd();
  }

  /**
   * Check if an error is a NodeJS.ErrnoException
   */
  private isErrnoException(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
  }

  /**
   * Executes a git command and returns the output as a Promise
   * @param args - The arguments to pass to the git command
   * @returns The output of the git command
   */
  private async execute(args: string[]): Promise<GitOperationResult> {
    return new Promise((resolve) => {
      const git = spawn("git", args, { cwd: this.workingDir });
      let output = "";
      let errorOutput = "";

      git.stdout.on("data", (data) => {
        output += data.toString();
      });

      git.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      git.on("error", (error: Error) => {
        resolve({
          success: false,
          data: `Failed to execute git command: ${error.message}`,
        });
      });

      git.on("close", (code) => {
        if (code !== 0) {
          resolve({
            success: false,
            data: errorOutput.trim() || "Git command failed",
          });
        } else {
          resolve({ success: true, data: output.trim() });
        }
      });
    });
  }

  /**
   * Check if the current directory is already a git repository
   */
  private async isGitRepository(): Promise<boolean> {
    try {
      const gitDir = path.join(this.workingDir, ".git");
      return fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory();
    } catch (error: unknown) {
      if (this.isErrnoException(error)) {
        console.error(`Error checking git repository: ${error.message}`);
      }
      return false;
    }
  }

  /**
   * Initialize a new git repository
   * @returns Result of the git init operation
   */
  async init(): Promise<GitOperationResult> {
    try {
      // Check if we're already in a git repository
      if (await this.isGitRepository()) {
        return {
          success: false,
          data: "Git repository already exists in this directory",
        };
      }

      // Check if we have write permissions in the current directory
      try {
        await fs.promises.access(this.workingDir, fs.constants.W_OK);
      } catch (error: unknown) {
        if (this.isErrnoException(error)) {
          return {
            success: false,
            data: `No write permission in the current directory: ${error.message}`,
          };
        }
        return {
          success: false,
          data: "No write permission in the current directory",
        };
      }

      return this.execute(["init"]);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        success: false,
        data: `Failed to initialize git repository: ${message}`,
      };
    }
  }

  /**
   * Add a remote repository
   * @param name - The name of the remote (e.g., "origin")
   * @param url - The URL of the remote repository
   * @returns The output of the git remote add command
   */
  async addRemote(name: string, url: string): Promise<GitOperationResult> {
    return this.execute(["remote", "add", name, url]);
  }

  /**
   * Get the current branch name
   * @returns The current branch name
   */
  async getCurrentBranch(): Promise<GitOperationResult> {
    return this.execute(["rev-parse", "--abbrev-ref", "HEAD"]);
  }

  /**
   * Get the status of the repository
   * @returns The status of the repository
   */
  async status(): Promise<GitOperationResult> {
    return this.execute(["status"]);
  }

  /**
   * Add files to staging
   * @param files - The files to add to staging
   * @returns The output of the git add command
   */
  async add(files: string[]): Promise<GitOperationResult> {
    return this.execute(["add", ...files]);
  }

  /**
   * Commit changes
   * @param message - The commit message
   * @returns The output of the git commit command
   */
  async commit(message: string): Promise<GitOperationResult> {
    return this.execute(["commit", "-m", message]);
  }

  /**
   * Pull changes from remote
   * @returns The output of the git pull command
   */
  async pull(): Promise<GitOperationResult> {
    return this.execute(["pull"]);
  }

  /**
   * Push changes to remote
   * @returns The output of the git push command
   */
  async push(): Promise<GitOperationResult> {
    return this.execute(["push"]);
  }
}
