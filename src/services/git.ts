import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { Synapse } from "../synapse";

export type GitOperationResult = {
  success: boolean;
  data?: string;
  error?: string;
};

export class Git {
  private synapse: Synapse;

  /**
   * Creates a new Git instance
   * @param synapse - The Synapse instance to use
   */
  constructor(synapse: Synapse) {
    this.synapse = synapse;
  }

  private isErrnoException(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
  }

  private async execute(args: string[]): Promise<GitOperationResult> {
    return new Promise((resolve) => {
      const git = spawn("git", args, { cwd: this.synapse.workDir });
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
          error: `Failed to execute git command: ${error.message}`,
        });
      });

      git.on("close", (code) => {
        if (code !== 0) {
          resolve({
            success: false,
            error: errorOutput.trim() || "Git command failed",
          });
        } else {
          resolve({ success: true, data: output.trim() });
        }
      });
    });
  }

  private async isGitRepository(): Promise<boolean> {
    try {
      const gitDir = path.join(this.synapse.workDir, ".git");
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
          error: "Git repository already exists in this directory",
        };
      }

      // Check if we have write permissions in the current directory
      try {
        await fs.promises.access(this.synapse.workDir, fs.constants.W_OK);
      } catch (error: unknown) {
        if (this.isErrnoException(error)) {
          return {
            success: false,
            error: `No write permission in the current directory: ${error.message}`,
          };
        }
        return {
          success: false,
          error: "No write permission in the current directory",
        };
      }

      return this.execute(["init"]);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        success: false,
        error: `Failed to initialize git repository: ${message}`,
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
   * Set Git user name
   * @param name - The user name to set for Git
   * @returns The output of the git config command
   */
  async setUserName(name: string): Promise<GitOperationResult> {
    return this.execute(["config", "user.name", name]);
  }

  /**
   * Set Git user email
   * @param email - The email to set for Git
   * @returns The output of the git config command
   */
  async setUserEmail(email: string): Promise<GitOperationResult> {
    return this.execute(["config", "user.email", email]);
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
