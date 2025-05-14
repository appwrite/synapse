import * as fsSync from "fs";
import { constants as fsConstants } from "fs";
import * as fs from "fs/promises";
import ignore from "ignore";
import * as path from "path";
import { Synapse } from "../synapse";

export type FileItem = {
  name: string;
  isDirectory: boolean;
};

export type FileItemResult = {
  success: boolean;
  data?: FileItem[];
  error?: string;
};

export type FileOperationResult = {
  success: boolean;
  data?: string;
  error?: string;
};

export type FileSearchResult = {
  success: boolean;
  data?: {
    results: string[];
  };
  error?: string;
};

export class Filesystem {
  private synapse: Synapse;
  private workDir: string;
  private folderWatchers: Map<string, fsSync.FSWatcher> = new Map();

  /**
   * Creates a new Filesystem instance
   * @param synapse - The Synapse instance to use
   */
  constructor(synapse: Synapse, workDir?: string) {
    this.synapse = synapse;
    this.synapse.setFilesystem(this);

    if (workDir) {
      if (!fsSync.existsSync(workDir)) {
        fsSync.mkdirSync(workDir, { recursive: true });
      }
      this.workDir = workDir;
    } else {
      this.workDir = process.cwd();
    }
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[Filesystem][${timestamp}] ${message}`);
  }

  private resolvePath(inputPath: string): string {
    if (path.isAbsolute(inputPath)) {
      return inputPath;
    }
    return path.join(this.workDir, inputPath);
  }

  /**
   * Creates a new file at the specified path with optional content.
   * Fails if the file already exists.
   * @param filePath - The full path where the file should be created
   * @param content - Optional content to write to the file (defaults to empty string)
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if file creation fails for reasons other than existence
   */
  async createFile(
    filePath: string,
    content: string = "",
  ): Promise<FileOperationResult> {
    const fullPath = this.resolvePath(filePath);

    try {
      await fs.access(fullPath, fsConstants.F_OK);
      const errorMsg = `File already exists at path:`;
      this.log(`Error: ${errorMsg} ${fullPath}`);

      return { success: false, error: `${errorMsg} ${filePath}` }; // file already exists
    } catch (accessError: unknown) {
      if ((accessError as NodeJS.ErrnoException)?.code === "ENOENT") {
        try {
          const dirPath = path.dirname(filePath);
          const folderResult = await this.createFolder(dirPath);
          if (!folderResult.success) {
            this.log(
              `Failed to create parent directory for ${filePath}: ${folderResult.error}`,
            );

            return { success: false, error: folderResult.error }; // failed to create parent directory
          }
          await fs.writeFile(fullPath, content, { flag: "wx" });

          return { success: true, data: "File created successfully" }; // file created successfully
        } catch (writeError: unknown) {
          const errorMsg =
            writeError instanceof Error
              ? writeError.message
              : String(writeError);
          this.log(`Error during file write: ${errorMsg}`);
          if ((writeError as NodeJS.ErrnoException)?.code === "EEXIST") {
            // file already exists
            return {
              success: false,
              error: `File already exists at path: ${filePath}`,
            };
          }

          return { success: false, error: errorMsg }; // failed to write file
        }
      } else {
        const errorMsg =
          accessError instanceof Error
            ? accessError.message
            : String(accessError);
        this.log(`Error accessing path ${filePath}: ${errorMsg}`);

        return { success: false, error: errorMsg }; // failed to access path
      }
    }
  }

  /**
   * Reads and returns the contents of a file
   * @param filePath - The path to the file to read
   * @returns Promise<FileOperationResult> containing the file content in the data property
   * @throws Error if file reading fails
   */
  async getFile(filePath: string): Promise<FileOperationResult> {
    try {
      const fullPath = this.resolvePath(filePath);

      const data = await fs.readFile(fullPath, "utf-8");

      return { success: true, data };
    } catch (error) {
      this.log(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Updates the content of a file
   * @param filePath - The path to the file to update
   * @param content - The new content to write to the file
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if file update fails
   */
  async updateFile(
    filePath: string,
    content: string,
  ): Promise<FileOperationResult> {
    try {
      this.log(`Updating file at path: ${filePath}`);
      const fullPath = this.resolvePath(filePath);
      const dirPath = path.dirname(filePath);

      await this.createFolder(dirPath);
      await fs.writeFile(fullPath, content);

      return { success: true };
    } catch (error) {
      this.log(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Appends content to a file
   * @param filePath - The path to the file to append to
   * @param content - The content to append to the file
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if file appending fails
   */
  async appendFile(
    filePath: string,
    content: string,
  ): Promise<FileOperationResult> {
    try {
      const fullPath = this.resolvePath(filePath);
      await fs.appendFile(fullPath, content);
      return { success: true };
    } catch (error) {
      this.log(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Updates the path of a file
   * @param oldPath - The old path of the file
   * @param newPath - The new path of the file
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if file path update fails
   */
  async updateFilePath(
    oldPath: string,
    newPath: string,
  ): Promise<FileOperationResult> {
    try {
      this.log(`Moving file from ${oldPath} to ${newPath}`);
      const fullOldPath = this.resolvePath(oldPath);
      const fullNewPath = this.resolvePath(newPath);

      await fs.rename(fullOldPath, fullNewPath);

      return { success: true };
    } catch (error) {
      this.log(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Deletes a file
   * @param filePath - The path to the file to delete
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if file deletion fails
   */
  async deleteFile(filePath: string): Promise<FileOperationResult> {
    try {
      this.log(`Deleting file at path: ${filePath}`);
      const fullPath = this.resolvePath(filePath);

      await fs.unlink(fullPath);

      return { success: true };
    } catch (error) {
      this.log(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Creates a new directory and any necessary parent directories
   * @param dirPath - The path where the directory should be created
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if directory creation fails
   */
  async createFolder(dirPath: string): Promise<FileOperationResult> {
    const fullPath = this.resolvePath(dirPath);

    if (dirPath === "." || dirPath === "" || dirPath === "/") {
      // Skip creation for root or relative '.' path
      return { success: true };
    }

    try {
      await fs.mkdir(fullPath, { recursive: true });

      return { success: true };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(
        `Error creating directory at path ${fullPath}: ${errorMsg} (Code: ${(error as NodeJS.ErrnoException)?.code})`,
      );

      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Lists all files and directories in the specified directory
   * @param dirPath - The path to the directory to read
   * @returns Promise<FileOperationResult> containing array of FileItems in the data property
   * @throws Error if directory reading fails
   */
  async getFolder(dirPath: string): Promise<FileItemResult> {
    try {
      this.log(`Reading directory at path: ${dirPath}`);
      const fullPath = this.resolvePath(dirPath);

      const items = await fs.readdir(fullPath, { withFileTypes: true });
      const data: FileItem[] = items.map((item) => ({
        name: item.name,
        isDirectory: item.isDirectory(),
      }));

      return { success: true, data };
    } catch (error) {
      this.log(
        `Error reading directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Updates the name of a folder
   * @param dirPath - The path to the folder to rename
   * @param name - The new name for the folder
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if folder renaming fails
   */
  async updateFolderName(
    dirPath: string,
    name: string,
  ): Promise<FileOperationResult> {
    try {
      this.log(`Renaming folder at ${dirPath} to ${name}`);
      const fullPath = this.resolvePath(dirPath);

      const dir = path.dirname(fullPath);
      const newPath = path.join(dir, name);

      await fs.rename(fullPath, newPath);

      return { success: true };
    } catch (error) {
      this.log(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Updates the path of a folder
   * @param oldPath - The old path of the folder
   * @param newPath - The new path of the folder
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if folder path update fails
   */
  async updateFolderPath(
    oldPath: string,
    newPath: string,
  ): Promise<FileOperationResult> {
    try {
      this.log(`Moving folder from ${oldPath} to ${newPath}`);
      const fullOldPath = this.resolvePath(oldPath);
      const fullNewPath = this.resolvePath(newPath);

      await fs.rename(fullOldPath, fullNewPath);

      return { success: true };
    } catch (error) {
      this.log(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Deletes a file or directory and all its contents
   * @param dirPath - The path to the directory to delete
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if deletion fails
   */
  async deleteFolder(dirPath: string): Promise<FileOperationResult> {
    try {
      this.log(`Deleting folder at path: ${dirPath}`);
      const fullPath = this.resolvePath(dirPath);

      await fs.rm(fullPath, { recursive: true });

      return { success: true };
    } catch (error) {
      this.log(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Starts watching a directory for changes and calls the callback with the updated file path and content.
   * @param onChange - Callback to call with the path and new content of the changed file
   */
  watchWorkDir(
    onChange: (result: { path: string; content: string | null }) => void,
  ): void {
    const fullPath = this.resolvePath(this.workDir);
    if (this.folderWatchers.has(fullPath)) {
      return;
    }

    // Read and parse .gitignore from the root of the workspace
    let ig: ReturnType<typeof ignore> | null = null;
    try {
      const gitignorePath = this.resolvePath(".gitignore");
      const gitignoreContent = fsSync.existsSync(gitignorePath)
        ? fsSync.readFileSync(gitignorePath, "utf-8")
        : "";
      ig = ignore().add(gitignoreContent);
    } catch {
      ig = null;
    }

    const watcher = fsSync.watch(
      fullPath,
      { recursive: true },
      async (eventType, filename) => {
        if (!filename) return;
        // filename is relative to workDir
        // ignore always expects forward slashes
        const relPath = filename.replace(/\\/g, "/");
        if (ig && ig.ignores(relPath)) {
          return; // ignore this change
        }
        const changedPath = path.join("/", filename); // relative to workDir
        const absPath = path.join(this.workDir, filename);

        try {
          const stat = await fs.lstat(absPath);
          if (stat.isFile()) {
            const content = await fs.readFile(absPath, "utf-8");
            onChange({ path: changedPath, content });
          } else {
            // It's a directory, not a file
            onChange({ path: changedPath, content: null });
          }
        } catch {
          // File might have been deleted or is inaccessible
          onChange({ path: changedPath, content: null });
        }
      },
    );

    this.folderWatchers.set(fullPath, watcher);
  }

  /**
   * Stops watching a directory for changes.
   */
  unwatchWorkDir(): void {
    const fullPath = this.resolvePath(this.workDir);
    const watcher = this.folderWatchers.get(fullPath);
    if (watcher) {
      watcher.close();
      this.folderWatchers.delete(fullPath);
    }
  }

  /**
   * Updates the working directory
   * @param workDir - The new working directory
   */
  updateWorkDir(workDir: string): void {
    if (!fsSync.existsSync(workDir)) {
      fsSync.mkdirSync(workDir, { recursive: true });
    }
    this.workDir = workDir;
  }

  /**
   * Cleans up all folder watchers and releases resources.
   */
  cleanup(): void {
    this.log("Cleaning up all folder watchers");
    for (const [, watcher] of this.folderWatchers.entries()) {
      watcher.close();
    }
    this.folderWatchers.clear();
  }

  /**
   * Searches for files in the current workDir based on a search term.
   * Matches both file paths and file contents.
   * @param searchTerm - The term to search for in file paths or contents
   * @returns Promise<FileSearchResult> - List of matching file paths (relative to workDir)
   */
  async searchFiles(searchTerm: string): Promise<FileSearchResult> {
    if (!searchTerm || searchTerm.trim() === "") {
      return { success: false, error: "Search term is required" };
    }
    const results: string[] = [];
    const workDir = path.resolve(this.workDir);
    const searchLower = searchTerm.toLowerCase();

    // Read and parse .gitignore
    let ig: ReturnType<typeof ignore> | null = null;
    try {
      const gitignorePath = this.resolvePath(".gitignore");
      const gitignoreContent = fsSync.existsSync(gitignorePath)
        ? fsSync.readFileSync(gitignorePath, "utf-8")
        : "";
      ig = ignore().add(gitignoreContent);
    } catch {
      ig = null;
    }

    async function walk(dir: string) {
      let entries: fsSync.Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const absPath = path.join(dir, entry.name);
        const relPath = path.relative(workDir, absPath).replace(/\\/g, "/");
        // Ignore files/directories in .gitignore
        if (ig && ig.ignores(relPath)) {
          continue;
        }
        if (entry.isDirectory()) {
          await walk(absPath);
        } else if (entry.isFile()) {
          // Check if file path matches
          if (relPath.toLowerCase().includes(searchLower)) {
            if (relPath && relPath !== "" && relPath !== ".") {
              results.push(relPath);
            }
            continue;
          }
          // Check if file content matches
          try {
            const content = await fs.readFile(absPath, "utf-8");
            if (content.toLowerCase().includes(searchLower)) {
              if (relPath && relPath !== "" && relPath !== ".") {
                results.push(relPath);
              }
            }
          } catch {
            // Ignore unreadable files
          }
        }
      }
    }

    await walk(workDir);
    return { success: true, data: { results } };
  }
}
