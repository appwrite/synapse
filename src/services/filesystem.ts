import archiver from "archiver";
import chokidar, { FSWatcher } from "chokidar";
import * as fsSync from "fs";
import { constants as fsConstants } from "fs";
import * as fs from "fs/promises";
import ignore from "ignore";
import mime from "mime-types";
import * as path from "path";
import { Synapse } from "../synapse";

const IGNORE_PATTERNS = [
  "node_modules",
  "dist",
  "build",
  "coverage",
  "logs",
  ".git",
  "package-lock.json",
  "pnpm-lock.yaml",
  "bun.lock"
];

export type FileItem = {
  name: string;
  isDirectory: boolean;
};

export type FileItemResult = {
  success: boolean;
  data?: FileItem[];
  error?: string;
};

export type FileContent = {
  success: boolean;
  data?: {
    content: string;
    mimeType: string;
  };
  error?: string;
};

export type FileOperationResult = {
  success: boolean;
  data?: string;
  error?: string;
};

export type FileSearchResult = {
  success: boolean;
  error?: string;
  data?: {
    results: FileSearchMatch[];
  };
};

export type FileSearchMatch = {
  path: string;
  matches: Array<{
    row: number;
    column: number;
    line: string;
  }>;
};

export type ZipResult = {
  success: boolean;
  error?: string;
  data?: {
    buffer: Buffer;
  };
};

export type FileListItem<WithContent extends boolean = false> =
  WithContent extends true
    ? { path: string; content: string }
    : { path: string };

export type FileListResult<WithContent extends boolean = false> = {
  success: boolean;
  data?: FileListItem<WithContent>[];
  error?: string;
};

export class Filesystem {
  private synapse: Synapse;
  private workDir: string;
  private folderWatchers: Map<string, FSWatcher> = new Map();

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
   * @param params - Object containing file creation parameters
   * @param params.filePath - The full path where the file should be created
   * @param params.content - Optional content to write to the file (defaults to empty string)
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if file creation fails for reasons other than existence
   */
  async createFile({
    filePath,
    content = "",
  }: {
    filePath: string;
    content?: string;
  }): Promise<FileOperationResult> {
    if (!filePath) {
      return { success: false, error: "filePath is required" };
    }

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
          const folderResult = await this.createFolder({ dirPath });
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
   * @param params - Object containing file reading parameters
   * @param params.filePath - The path to the file to read
   * @returns Promise<FileOperationResult> containing the file content in the data property
   * @throws Error if file reading fails
   */
  async getFile({ filePath }: { filePath: string }): Promise<FileContent> {
    if (!filePath) {
      return { success: false, error: "filePath is required" };
    }

    try {
      const fullPath = this.resolvePath(filePath);

      const content = await fs.readFile(fullPath, "utf-8");
      const mimeType = mime.lookup(fullPath);

      return {
        success: true,
        data: {
          content,
          mimeType: mimeType || "text/plain",
        },
      };
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
   * @param params - Object containing file update parameters
   * @param params.filePath - The path to the file to update
   * @param params.content - The new content to write to the file
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if file update fails
   */
  async updateFile({
    filePath,
    content,
  }: {
    filePath: string;
    content: string;
  }): Promise<FileOperationResult> {
    if (!filePath) {
      return { success: false, error: "filePath is required" };
    }

    try {
      this.log(`Updating file at path: ${filePath}`);
      const fullPath = this.resolvePath(filePath);
      const dirPath = path.dirname(filePath);

      await this.createFolder({ dirPath });
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
   * @param params - Object containing file append parameters
   * @param params.filePath - The path to the file to append to
   * @param params.content - The content to append to the file
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if file appending fails
   */
  async appendFile({
    filePath,
    content,
  }: {
    filePath: string;
    content: string;
  }): Promise<FileOperationResult> {
    if (!filePath) {
      return { success: false, error: "filePath is required" };
    }

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
   * @param params - Object containing file path update parameters
   * @param params.oldPath - The old path of the file
   * @param params.newPath - The new path of the file
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if file path update fails
   */
  async updateFilePath({
    oldPath,
    newPath,
  }: {
    oldPath: string;
    newPath: string;
  }): Promise<FileOperationResult> {
    if (!oldPath || !newPath) {
      return { success: false, error: "oldPath and newPath are required" };
    }

    try {
      this.log(`Moving file from ${oldPath} to ${newPath}`);
      const fullOldPath = this.resolvePath(oldPath);
      const fullNewPath = this.resolvePath(newPath);

      // Create the parent directory of the target path if it doesn't exist
      const dirPath = path.dirname(newPath);
      const folderResult = await this.createFolder(dirPath);
      if (!folderResult.success) {
        this.log(
          `Failed to create parent directory for ${newPath}: ${folderResult.error}`
        );
        return { success: false, error: folderResult.error };
      }

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
   * @param params - Object containing file deletion parameters
   * @param params.filePath - The path to the file to delete
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if file deletion fails
   */
  async deleteFile({
    filePath,
  }: {
    filePath: string;
  }): Promise<FileOperationResult> {
    if (!filePath) {
      return { success: false, error: "filePath is required" };
    }

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
   * @param params - Object containing directory creation parameters
   * @param params.dirPath - The path where the directory should be created
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if directory creation fails
   */
  async createFolder({
    dirPath,
  }: {
    dirPath: string;
  }): Promise<FileOperationResult> {
    if (!dirPath) {
      return { success: false, error: "dirPath is required" };
    }

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
   * @param params - Object containing directory reading parameters
   * @param params.dirPath - The path to the directory to read
   * @returns Promise<FileOperationResult> containing array of FileItems in the data property
   * @throws Error if directory reading fails
   */
  async getFolder({ dirPath }: { dirPath: string }): Promise<FileItemResult> {
    if (!dirPath) {
      return { success: false, error: "dirPath is required" };
    }

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
   * @param params - Object containing folder rename parameters
   * @param params.dirPath - The path to the folder to rename
   * @param params.name - The new name for the folder
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if folder renaming fails
   */
  async updateFolderName({
    dirPath,
    name,
  }: {
    dirPath: string;
    name: string;
  }): Promise<FileOperationResult> {
    if (!dirPath || !name) {
      return { success: false, error: "dirPath and name are required" };
    }

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
   * @param params - Object containing folder path update parameters
   * @param params.oldPath - The old path of the folder
   * @param params.newPath - The new path of the folder
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if folder path update fails
   */
  async updateFolderPath({
    oldPath,
    newPath,
  }: {
    oldPath: string;
    newPath: string;
  }): Promise<FileOperationResult> {
    if (!oldPath || !newPath) {
      return { success: false, error: "oldPath and newPath are required" };
    }

    try {
      this.log(`Moving folder from ${oldPath} to ${newPath}`);
      const fullOldPath = this.resolvePath(oldPath);
      const fullNewPath = this.resolvePath(newPath);

      // Create the parent directory of the target path if it doesn't exist
      const dirPath = path.dirname(newPath);
      const folderResult = await this.createFolder(dirPath);
      if (!folderResult.success) {
        this.log(
          `Failed to create parent directory for ${newPath}: ${folderResult.error}`
        );
        return { success: false, error: folderResult.error };
      }

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
   * @param params - Object containing directory deletion parameters
   * @param params.dirPath - The path to the directory to delete
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if deletion fails
   */
  async deleteFolder({
    dirPath,
  }: {
    dirPath: string;
  }): Promise<FileOperationResult> {
    if (!dirPath) {
      return { success: false, error: "dirPath is required" };
    }

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
    onChange: (result: {
      path: string;
      event: string;
      content: string | null;
    }) => void,
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

    const watcher = chokidar.watch(fullPath, {
      ignored: (filePath: string) => {
        const relativePath = path
          .relative(path.resolve(fullPath), path.resolve(filePath))
          .replace(/\\/g, "/");
        if (relativePath === "" || relativePath === ".") {
          return false;
        }
        if (relativePath.startsWith("..")) {
          return true;
        }
        if (IGNORE_PATTERNS.some((pattern) => relativePath.includes(pattern))) {
          this.log(`Ignoring file: ${relativePath}, filePath: ${filePath}`);
          return true;
        }
        if (ig && ig.ignores(relativePath)) {
          this.log(`Ignoring file: ${relativePath}, filePath: ${filePath}`);
          return true;
        }
        return false;
      },
    });

    // Bind events
    watcher
      .on("all", async (event, filePath) => {
        const relativePath = path.relative(fullPath, filePath);
        const changedPath = relativePath;

        try {
          const stat = await fs.lstat(filePath);
          if (stat.isFile()) {
            const content = await fs.readFile(filePath, "utf-8");
            this.log(`Event: ${event}, filePath: ${changedPath}`);
            onChange({ path: changedPath, event, content });
          } else {
            this.log(`Event: ${event}, filePath: ${changedPath}`);
            onChange({ path: changedPath, event, content: null });
          }
        } catch {
          onChange({ path: changedPath, event, content: null });
        }
      })
      .on("error", (error: unknown) => {
        console.error(`Watcher error: ${error}`);
      });

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
   * @param params - Object containing search parameters
   * @param params.term - The term to search for in file paths or contents
   * @returns Promise<FileSearchResult> - List of matching file paths with row and column information
   */
  async searchFiles({ term }: { term: string }): Promise<FileSearchResult> {
    if (!term || term.trim() === "") {
      return { success: false, error: "Search `term` is required" };
    }
    const results: FileSearchMatch[] = [];
    const workDir = path.resolve(this.workDir);
    const searchLower = term.toLowerCase();

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
          let fileMatch: FileSearchMatch | null = null;

          // Check if file path matches
          if (relPath.toLowerCase().includes(searchLower)) {
            if (relPath && relPath !== "" && relPath !== ".") {
              fileMatch = { path: relPath, matches: [] };
              results.push(fileMatch);
            }
            continue;
          }

          // Check if file content matches
          try {
            const content = await fs.readFile(absPath, "utf-8");
            const lines = content.split("\n");
            let hasMatch = false;

            for (let rowIndex = 0; rowIndex < lines.length; rowIndex++) {
              const line = lines[rowIndex];
              const lineLower = line.toLowerCase();
              let columnIndex = lineLower.indexOf(searchLower);

              if (columnIndex !== -1) {
                if (!hasMatch) {
                  fileMatch = { path: relPath, matches: [] };
                  hasMatch = true;
                }

                // Find all occurrences in the current line
                while (columnIndex !== -1) {
                  fileMatch!.matches.push({
                    row: rowIndex + 1,
                    column: columnIndex + 1,
                    line: line.trim(),
                  });

                  columnIndex = lineLower.indexOf(searchLower, columnIndex + 1);
                }
              }
            }

            if (hasMatch && relPath && relPath !== "" && relPath !== ".") {
              results.push(fileMatch!);
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

  /**
   * Creates a gzip file containing all files in the workDir and returns it as a Buffer
   * @param params - Object containing gzip creation parameters
   * @param params.saveAs - Optional file path to save the gzip file
   * @returns Promise<ZipResult> containing the gzip file as a Buffer
   */
  async createGzipFile({
    saveAs = null,
  }: {
    saveAs?: string | null;
  } = {}): Promise<ZipResult> {
    if (!this.workDir) {
      return { success: false, error: "Work directory is not set" };
    }

    try {
      const archive = archiver("tar", {
        gzip: true,
        gzipOptions: { level: 9 },
      });

      // Recursively add files to archive first
      const addDirectory = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path
            .relative(this.workDir, fullPath)
            .replace(/\\/g, "/");

          // Skip .git directory and other common ignored patterns
          if (
            IGNORE_PATTERNS.some((pattern) => relativePath.includes(pattern))
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            await addDirectory(fullPath);
          } else {
            try {
              const stats = await fs.stat(fullPath);
              if (stats.isFile()) {
                archive.file(fullPath, { name: relativePath });
              }
            } catch (err) {
              console.warn(`Skipping file ${fullPath}: ${err}`);
            }
          }
        }
      };

      // Process files
      await addDirectory(this.workDir);

      // Handle saving to file and getting buffer
      if (saveAs) {
        // Save to file
        const fullSavePath = this.resolvePath(saveAs);
        const writeStream = fsSync.createWriteStream(fullSavePath);

        archive.pipe(writeStream);
        archive.finalize();

        await new Promise<void>((resolve, reject) => {
          writeStream.on("finish", () => resolve());
          writeStream.on("error", (error) => reject(error));
          archive.on("error", (error) => reject(error));
        });

        // Read the file back as buffer
        const buffer = await fs.readFile(fullSavePath);
        return {
          success: true,
          data: { buffer },
        };
      } else {
        // Just get buffer without saving to file
        const bufferChunks: Buffer[] = [];

        const archivePromise = new Promise<Buffer>((resolve, reject) => {
          archive.on("data", (chunk: Buffer) => bufferChunks.push(chunk));
          archive.on("end", () => resolve(Buffer.concat(bufferChunks)));
          archive.on("error", (err: Error) => reject(err));
        });

        archive.finalize();

        const buffer = await archivePromise;
        return {
          success: true,
          data: { buffer },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Lists all files in a directory with optional content and recursive traversal
   * @param params - Object containing directory listing parameters
   * @param params.dirPath - The directory path to list files from
   * @param params.withContent - Whether to include file content in the results
   * @param params.recursive - Whether to recursively traverse subdirectories
   * @param params.additionalIgnorePatterns - Additional patterns to ignore
   * @returns Promise<FileListResult> containing array of file objects
   */
  async listFilesInDir({
    dirPath,
    withContent,
    recursive,
    additionalIgnorePatterns,
  }: {
    dirPath: string;
    withContent?: boolean;
    recursive?: boolean;
    additionalIgnorePatterns?: string[];
  }): Promise<FileListResult<boolean>> {
    if (!dirPath) {
      return { success: false, error: "path is required" };
    }

    const safeCwd = path.resolve(this.workDir, dirPath);
    try {
      const fullPath = this.resolvePath(safeCwd);
      const workDir = path.resolve(this.workDir);
      const results: Array<{ path: string; content?: string }> = [];

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

      const walkDirectory = async (dir: string) => {
        let entries: fsSync.Dirent[];
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          const absPath = path.join(dir, entry.name);
          const relPath = path.relative(fullPath, absPath).replace(/\\/g, "/");
          const relPathFromWorkDir = path
            .relative(workDir, absPath)
            .replace(/\\/g, "/");

          // Skip if ignored by .gitignore or IGNORE_PATTERNS
          if (ig && ig.ignores(relPathFromWorkDir)) {
            continue;
          }
          if (
            [...IGNORE_PATTERNS, ...(additionalIgnorePatterns || [])].some(
              (pattern) => relPathFromWorkDir.includes(pattern),
            )
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            if (recursive) {
              await walkDirectory(absPath);
            }
          } else if (entry.isFile()) {
            const fileObj: { path: string; content?: string } = {
              path: relPath,
            };

            if (withContent) {
              try {
                const content = await fs.readFile(absPath, "utf-8");
                fileObj.content = content;
              } catch {
                // If we can't read the file, skip it or include it without content
                continue;
              }
            }

            results.push(fileObj);
          }
        }
      };

      await walkDirectory(fullPath);

      return {
        success: true,
        data: results as FileListItem<boolean>[],
      };
    } catch (error) {
      this.log(
        `Error listing files in directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
