import * as fs from "fs/promises";
import * as path from "path";
import { Synapse } from "../synapse";

export type FileItem = {
  name: string;
  isDirectory: boolean;
};

export type FileOperationResult = {
  success: boolean;
  data?: string | FileItem[];
  error?: string;
};

export class Filesystem {
  private synapse: Synapse;

  /**
   * Creates a new Filesystem instance
   * @param synapse - The Synapse instance to use
   */
  constructor(synapse: Synapse) {
    this.synapse = synapse;
  }

  private log(method: string, message: string): void {
    this.synapse.logger(`[${method}] ${message}`);
  }

  /**
   * Creates a new file at the specified path with optional content
   * @param filePath - The full path where the file should be created
   * @param content - Optional content to write to the file (defaults to empty string)
   * @returns Promise<FileOperationResult> indicating success or failure
   * @throws Error if file creation fails
   */
  async createFile(
    filePath: string,
    content: string = "",
  ): Promise<FileOperationResult> {
    try {
      this.log("createFile", `Creating file at path: ${filePath}`);

      const dirPath = path.dirname(filePath);
      this.log("createFile", `Ensuring directory exists: ${dirPath}`);

      await this.createFolder(dirPath);

      this.log("createFile", "Writing file content...");
      await fs.writeFile(filePath, content);

      this.log("createFile", "File created successfully");
      return { success: true };
    } catch (error) {
      this.log(
        "createFile",
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
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
      this.log("getFile", `Reading file at path: ${filePath}`);

      const data = await fs.readFile(filePath, "utf-8");

      this.log("getFile", "File read successfully");
      return { success: true, data };
    } catch (error) {
      this.log(
        "getFile",
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
      this.log("updateFile", `Updating file at path: ${filePath}`);

      const dirPath = path.dirname(filePath);
      this.log("updateFile", `Ensuring directory exists: ${dirPath}`);

      await this.createFolder(dirPath);

      this.log("updateFile", "Writing file content...");
      await fs.writeFile(filePath, content);

      this.log("updateFile", "File updated successfully");
      return { success: true };
    } catch (error) {
      this.log(
        "updateFile",
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
      this.log("updateFilePath", `Moving file from ${oldPath} to ${newPath}`);

      await fs.rename(oldPath, newPath);

      this.log("updateFilePath", "File moved successfully");
      return { success: true };
    } catch (error) {
      this.log(
        "updateFilePath",
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
      this.log("deleteFile", `Deleting file at path: ${filePath}`);

      await fs.unlink(filePath);

      this.log("deleteFile", "File deleted successfully");
      return { success: true };
    } catch (error) {
      this.log(
        "deleteFile",
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
    try {
      this.log("createFolder", `Creating directory at path: ${dirPath}`);

      await fs.mkdir(dirPath, { recursive: true });

      this.log("createFolder", "Directory created successfully");
      return { success: true };
    } catch (error) {
      this.log(
        "createFolder",
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Lists all files and directories in the specified directory
   * @param dirPath - The path to the directory to read
   * @returns Promise<FileOperationResult> containing array of FileItems in the data property
   * @throws Error if directory reading fails
   */
  async getFolder(dirPath: string): Promise<FileOperationResult> {
    try {
      this.log("getFolder", `Reading directory at path: ${dirPath}`);

      const items = await fs.readdir(dirPath, { withFileTypes: true });
      const data: FileItem[] = items.map((item) => ({
        name: item.name,
        isDirectory: item.isDirectory(),
      }));

      this.log(
        "getFolder",
        `Directory read successfully, found ${items.length} items`,
      );
      return { success: true, data };
    } catch (error) {
      this.log(
        "getFolder",
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
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
      this.log("updateFolderName", `Renaming folder at ${dirPath} to ${name}`);

      const dir = path.dirname(dirPath);
      const newPath = path.join(dir, name);

      await fs.rename(dirPath, newPath);

      this.log("updateFolderName", "Folder renamed successfully");
      return { success: true };
    } catch (error) {
      this.log(
        "updateFolderName",
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
      this.log(
        "updateFolderPath",
        `Moving folder from ${oldPath} to ${newPath}`,
      );

      await fs.rename(oldPath, newPath);

      this.log("updateFolderPath", "Folder moved successfully");
      return { success: true };
    } catch (error) {
      this.log(
        "updateFolderPath",
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
      this.log("deleteFolder", `Deleting folder at path: ${dirPath}`);

      await fs.rm(dirPath, { recursive: true, force: true });

      this.log("deleteFolder", "Folder deleted successfully");
      return { success: true };
    } catch (error) {
      this.log(
        "deleteFolder",
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
