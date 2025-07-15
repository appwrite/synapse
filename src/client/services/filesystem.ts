import * as path from "path";
import { SynapseRequest, SynapseResponse } from "../base";

export type FileItem = {
  name: string;
  isDirectory: boolean;
};

export type FileContent = {
  content: string;
  mimeType: string;
};

export type FileListItem<WithContent extends boolean = false> = {
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedTime?: number;
} & (WithContent extends true ? { content?: string } : {});

export type ListFilesInDirParams = {
  dirPath: string;
  recursive?: boolean;
  withContent?: boolean;
  additionalIgnorePatterns?: string[];
};

export type ListFilesInDirResult<WithContent extends boolean = false> =
  FileListItem<WithContent>[];

export class FilesystemHTTPService {
  private endpoint: string;
  private artifactBasePath: string;
  private baseDir: string;

  constructor({
    endpoint,
    artifactBasePath,
    baseDir = "",
  }: {
    endpoint: string;
    artifactBasePath: string;
    baseDir?: string;
  }) {
    this.endpoint = endpoint;
    this.artifactBasePath = artifactBasePath;
    this.baseDir = baseDir;
  }

  /**
   * Get folder contents
   */
  async getFolder({
    dirPath,
    ignoreBasePath = false,
  }: {
    dirPath: string;
    ignoreBasePath?: boolean;
  }): Promise<SynapseResponse<FileItem[]>> {
    const resolvedPath = ignoreBasePath
      ? dirPath
      : path.resolve(this.artifactBasePath, dirPath);

    return this.request({
      type: "fs",
      operation: "getFolder",
      params: {
        dirPath: resolvedPath,
      },
    });
  }

  /**
   * Read file content
   */
  async readFile({
    filepath,
  }: {
    filepath: string;
  }): Promise<SynapseResponse<FileContent>> {
    const safeFilePath = path.join(
      this.baseDir,
      this.artifactBasePath,
      filepath,
    );

    return this.request({
      type: "fs",
      operation: "getFile",
      params: {
        filepath: safeFilePath,
      },
    });
  }

  /**
   * Create a new file
   */
  async createFile({
    filepath,
    content,
    ignoreBasePath = false,
  }: {
    filepath: string;
    content: string;
    ignoreBasePath?: boolean;
  }): Promise<SynapseResponse<string>> {
    const resolvedPath = ignoreBasePath
      ? filepath
      : path.resolve(this.artifactBasePath, filepath);

    return this.request({
      type: "fs",
      operation: "createFile",
      params: {
        filepath: resolvedPath,
        content,
      },
    });
  }

  /**
   * Create or update a file
   */
  async createOrUpdateFile({
    filepath,
    content,
  }: {
    filepath: string;
    content: string;
  }): Promise<SynapseResponse<string>> {
    const safeFilePath = path.join(
      this.baseDir,
      this.artifactBasePath,
      filepath,
    );

    return this.request({
      type: "fs",
      operation: "updateFile",
      params: {
        filepath: safeFilePath,
        content,
      },
    });
  }

  /**
   * Update file path (move/rename)
   */
  async updateFilePath({
    filepath,
    newPath,
  }: {
    filepath: string;
    newPath: string;
  }): Promise<SynapseResponse<string>> {
    const safeFilePath = path.join(
      this.baseDir,
      this.artifactBasePath,
      filepath,
    );
    const safeNewPath = path.join(this.baseDir, this.artifactBasePath, newPath);

    return this.request({
      type: "fs",
      operation: "updateFilePath",
      params: {
        filepath: safeFilePath,
        newPath: safeNewPath,
      },
    });
  }

  /**
   * Delete a file
   */
  async deleteFile({
    filepath,
  }: {
    filepath: string;
  }): Promise<SynapseResponse<string>> {
    const safeFilePath = path.join(
      this.baseDir,
      this.artifactBasePath,
      filepath,
    );

    return this.request({
      type: "fs",
      operation: "deleteFile",
      params: {
        filepath: safeFilePath,
      },
    });
  }

  /**
   * List files in directory
   */
  async listFilesInDir<WithContent extends boolean = false>({
    dirPath,
    recursive = false,
    withContent = false as WithContent,
    additionalIgnorePatterns = [],
  }: {
    dirPath: string;
    recursive?: boolean;
    withContent?: WithContent;
    additionalIgnorePatterns?: string[];
  }): Promise<SynapseResponse<ListFilesInDirResult<WithContent>>> {
    const safeDirPath = path.join(this.baseDir, this.artifactBasePath, dirPath);

    const response = await this.request({
      type: "fs",
      operation: "listFilesInDir",
      params: {
        dirPath: safeDirPath,
        recursive,
        withContent,
        additionalIgnorePatterns,
      },
    });

    if (response.success && response.data) {
      // Clean up the paths to be relative to the artifact base path
      const cleanedData = response.data.map((file: any) => ({
        ...file,
        path: file.path.replace(`${this.artifactBasePath}/`, ""),
      }));

      return {
        ...response,
        data: cleanedData,
      };
    }

    return response;
  }

  private async request<T = any>(
    body: SynapseRequest,
  ): Promise<SynapseResponse<T>> {
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as SynapseResponse<T>;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
