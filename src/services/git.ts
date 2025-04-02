import { spawn } from "child_process";
import { Synapse } from "../synapse";

export class Git {
  private synapse: Synapse;

  constructor(synapse: Synapse) {
    this.synapse = synapse;
  }

  /**
   * Executes a git command and returns the output as a Promise
   * @param args - The arguments to pass to the git command
   * @returns The output of the git command
   */
  private async execute(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const git = spawn("git", args);
      let output = "";
      let errorOutput = "";

      git.stdout.on("data", (data) => {
        output += data.toString();
      });

      git.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      git.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Git error: ${errorOutput}`));
        } else {
          resolve(output.trim());
        }
      });
    });
  }

  async init() {
    await this.execute(["init"]);
  }

  /**
   * Add a remote repository
   * @param name - The name of the remote (e.g., "origin")
   * @param url - The URL of the remote repository
   * @returns The output of the git remote add command
   */
  async addRemote(name: string, url: string): Promise<string> {
    return this.execute(["remote", "add", name, url]);
  }

  /**
   * Get the current branch name
   * @returns The current branch name
   */
  async getCurrentBranch(): Promise<string> {
    return this.execute(["rev-parse", "--abbrev-ref", "HEAD"]);
  }

  /**
   * Get the status of the repository
   * @returns The status of the repository
   */
  async status(): Promise<string> {
    return this.execute(["status"]);
  }

  /**
   * Add files to staging
   * @param files - The files to add to staging
   * @returns The output of the git add command
   */
  async add(files: string[]): Promise<string> {
    return this.execute(["add", ...files]);
  }

  /**
   * Commit changes
   * @param message - The commit message
   * @returns The output of the git commit command
   */
  async commit(message: string): Promise<string> {
    return this.execute(["commit", "-m", message]);
  }

  /**
   * Pull changes from remote
   * @returns The output of the git pull command
   */
  async pull(): Promise<string> {
    return this.execute(["pull"]);
  }

  /**
   * Push changes to remote
   * @returns The output of the git push command
   */
  async push(): Promise<string> {
    return this.execute(["push"]);
  }
}
