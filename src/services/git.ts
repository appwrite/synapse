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
  private workDir: string;
  private timeout: number;

  /**
   * Creates a new Git instance
   * @param synapse - The Synapse instance to use
   */
  constructor(synapse: Synapse, workDir?: string, timeout: number = 5000) {
    this.synapse = synapse;
    this.timeout = timeout;

    if (workDir) {
      if (!fs.existsSync(workDir)) {
        fs.mkdirSync(workDir, { recursive: true });
      }
      this.workDir = workDir;
    } else {
      this.workDir = process.cwd();
    }
  }

  private isErrnoException(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
  }

  private async execute(args: string[]): Promise<GitOperationResult> {
    return new Promise((resolve) => {
      const git = spawn("git", args, { cwd: this.workDir });
      let output = "";
      let errorOutput = "";
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          git.kill("SIGTERM");

          setTimeout(() => {
            if (!git.killed) {
              git.kill("SIGKILL");
            }
          }, 1000);

          resolve({
            success: false,
            error: `Git command timed out after ${this.timeout} seconds: git ${args.join(" ")}`,
          });
        }
      }, this.timeout);

      const resolveOnce = (result: GitOperationResult) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(result);
        }
      };

      git.stdout.on("data", (data) => {
        output += data.toString();
      });

      git.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      git.on("error", (error: Error) => {
        resolveOnce({
          success: false,
          error: `Failed to execute git command: ${error.message}`,
        });
      });

      git.on("close", (code) => {
        if (code !== 0) {
          resolveOnce({
            success: false,
            error: errorOutput.trim() || "Git command failed",
          });
        } else {
          resolveOnce({ success: true, data: output.trim() });
        }
      });
    });
  }

  private async isGitRepository(): Promise<boolean> {
    try {
      const gitDir = path.join(this.workDir, ".git");
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
        await fs.promises.access(this.workDir, fs.constants.W_OK);
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
   * @param params - Object containing remote repository parameters
   * @param params.name - The name of the remote (e.g., "origin")
   * @param params.url - The URL of the remote repository
   * @returns The output of the git remote add command
   */
  async addRemote({
    name,
    url,
  }: {
    name: string;
    url: string;
  }): Promise<GitOperationResult> {
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
   * @param params - Object containing user name parameters
   * @param params.name - The user name to set for Git
   * @returns The output of the git config command
   */
  async setUserName({ name }: { name: string }): Promise<GitOperationResult> {
    return this.execute(["config", "user.name", name]);
  }

  /**
   * Set Git user email
   * @param params - Object containing user email parameters
   * @param params.email - The email to set for Git
   * @returns The output of the git config command
   */
  async setUserEmail({
    email,
  }: {
    email: string;
  }): Promise<GitOperationResult> {
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
   * @param params - Object containing file addition parameters
   * @param params.files - The files to add to staging
   * @returns The output of the git add command
   */
  async add({ files }: { files: string[] }): Promise<GitOperationResult> {
    return this.execute(["add", ...files]);
  }

  /**
   * Commit changes
   * @param params - Object containing commit message parameters
   * @param params.message - The commit message
   * @returns The output of the git commit command
   */
  async commit({ message }: { message: string }): Promise<GitOperationResult> {
    return this.execute(["commit", "-m", message]);
  }

  /**
   * Pull changes from remote
   * @param params - Object containing pull parameters
   * @param params.branch - The branch to pull from
   * @returns The output of the git pull command
   */
  async pull({ branch }: { branch?: string }): Promise<GitOperationResult> {
    const args = branch ? ["pull", branch] : ["pull"];
    return this.execute(args);
  }

  /**
   * Push changes to remote
   * @returns The output of the git push command
   */
  async push({ branch }: { branch?: string }): Promise<GitOperationResult> {
    const args = branch ? ["push", branch] : ["push"];
    return this.execute(args);
  }

  /**
   * Updates the working directory
   * @param workDir - The new working directory
   */
  updateWorkDir(workDir: string): void {
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }
    this.workDir = workDir;
  }
}
