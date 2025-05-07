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

export type FileItemTree = FileItem & { children?: FileItemTree[] };

export type FileItemTreeResult = {
  success: boolean;
  data?: FileItemTree;
  error?: string;
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

export class Filesystem {
  private synapse: Synapse;
  private folderWatchers: Map<string, fsSync.FSWatcher> = new Map();

  /**
   * Creates a new Filesystem instance
   * @param synapse - The Synapse instance to use
   */
  constructor(synapse: Synapse) {
    this.synapse = synapse;
    this.synapse.setFilesystem(this);
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[Filesystem][${timestamp}] ${message}`);
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
    const fullPath = path.join(this.synapse.workDir, filePath);

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
      const fullPath = path.join(this.synapse.workDir, filePath);

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
      const fullPath = path.join(this.synapse.workDir, filePath);
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
      const fullOldPath = path.join(this.synapse.workDir, oldPath);
      const fullNewPath = path.join(this.synapse.workDir, newPath);

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
      const fullPath = path.join(this.synapse.workDir, filePath);

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
    if (dirPath === "." || dirPath === "" || dirPath === "/") {
      // Skip creation for root or relative '.' path
      return { success: true };
    }

    const fullPath = path.join(this.synapse.workDir, dirPath);

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
      const fullPath = path.join(this.synapse.workDir, dirPath);

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
   * Recursively reads a directory and returns its tree structure
   * @param dirPath - The path to the directory to read
   * @returns Promise<FileOperationResult> containing the directory tree
   */
  async getFolderTree(dirPath: string): Promise<FileItemTreeResult> {
    // Read and parse .gitignore from the root of the workspace
    let ig: ReturnType<typeof ignore> | null = null;
    try {
      const gitignorePath = path.join(this.synapse.workDir, ".gitignore");
      const gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
      ig = ignore().add(gitignoreContent);
    } catch {
      // If .gitignore does not exist, proceed without ignoring anything
      ig = null;
    }

    // Helper function to recursively read directories
    const readDirRecursive = async (
      currentPath: string,
    ): Promise<FileItemTree | null> => {
      // Compute the relative path from the root for ignore matching
      const relPath = path.relative("/", currentPath).replace(/\\/g, "/");
      // Skip if ignored (but always include the root)
      if (ig && relPath && ig.ignores(relPath)) {
        return null;
      }
      const fullPath = path.join(this.synapse.workDir, currentPath);
      const stat = await fs.lstat(fullPath);
      const isDirectory = stat.isDirectory();
      const item: FileItemTree = {
        name: path.basename(currentPath),
        isDirectory,
      };
      if (isDirectory) {
        try {
          const items = await fs.readdir(fullPath);
          const children = await Promise.all(
            items.map((child) =>
              readDirRecursive(path.join(currentPath, child)),
            ),
          );
          item.children = children.filter(Boolean) as FileItemTree[];
        } catch {
          item.children = [];
        }
      }
      return item;
    };

    try {
      this.log(`Reading directory tree at path: ${dirPath}`);
      const tree = await readDirRecursive(dirPath);
      if (!tree) {
        return {
          success: false,
          error: "All files/folders are ignored by .gitignore",
        };
      }
      return { success: true, data: tree };
    } catch (error) {
      this.log(
        `Error reading directory tree ${dirPath}: ${error instanceof Error ? error.message : String(error)}`,
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
      const fullPath = path.join(this.synapse.workDir, dirPath);

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
      const fullOldPath = path.join(this.synapse.workDir, oldPath);
      const fullNewPath = path.join(this.synapse.workDir, newPath);

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
      const fullPath = path.join(this.synapse.workDir, dirPath);

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
   * Starts watching a directory for changes and calls the callback with the updated folder structure.
   * @param onChange - Callback to call with the result of getFolder when a change is detected
   */
  watchWorkDir(onChange: (result: FileItemTreeResult) => void): void {
    const fullPath = path.join(this.synapse.workDir);
    if (this.folderWatchers.has(fullPath)) {
      return;
    }

    const watcher = fsSync.watch(fullPath, { recursive: true }, async () => {
      const result = await this.getFolderTree("/");
      onChange(result);
    });

    this.folderWatchers.set(fullPath, watcher);
  }

  /**
   * Stops watching a directory for changes.
   */
  unwatchWorkDir(): void {
    const fullPath = path.join(this.synapse.workDir);
    const watcher = this.folderWatchers.get(fullPath);
    if (watcher) {
      watcher.close();
      this.folderWatchers.delete(fullPath);
    }
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
}
