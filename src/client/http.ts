import { FilesystemHTTPService } from "./services/filesystem";
import { TerminalHTTPService } from "./services/terminal";
import { GitHTTPService } from "./services/git";
import { SystemHTTPService } from "./services/system";
import { CodeHTTPService } from "./services/code";
import { AppwriteHTTPService } from "./services/appwrite";

export type { SynapseRequest, SynapseResponse } from "./base";

export type {
  AppwriteInitParams,
  AppwriteCallParams,
} from "./services/appwrite";

export type { FormatOptions, LintResult } from "./services/code";

export type {
  FileItem,
  FileContent,
  FileListItem,
  ListFilesInDirParams,
  ListFilesInDirResult,
} from "./services/filesystem";

export type {
  GitOperationResult,
  GitOperation,
  GitParams,
} from "./services/git";

export type { SystemUsageData } from "./services/system";

export type {
  ExecuteCommandParams,
  ExecuteCommandResult,
} from "./services/terminal";

export class SynapseHTTPClient {
  private filesystemService: FilesystemHTTPService;
  private terminalService: TerminalHTTPService;
  private gitService: GitHTTPService;
  private systemService: SystemHTTPService;
  private codeService: CodeHTTPService;
  private appwriteService: AppwriteHTTPService;

  constructor({
    endpoint,
    artifactId,
    baseDir = "",
  }: {
    endpoint: string;
    artifactId: string;
    baseDir?: string;
  }) {
    const artifactBasePath = `artifact/${artifactId}`;

    this.appwriteService = new AppwriteHTTPService({ endpoint });
    this.codeService = new CodeHTTPService({ endpoint });
    this.filesystemService = new FilesystemHTTPService({
      endpoint,
      artifactBasePath,
      baseDir,
    });
    this.gitService = new GitHTTPService({ endpoint });
    this.systemService = new SystemHTTPService({ endpoint });
    this.terminalService = new TerminalHTTPService({
      endpoint,
      artifactBasePath,
      baseDir,
    });
  }

  // Appwrite
  async initAppwrite(
    params: Parameters<AppwriteHTTPService["initAppwrite"]>[0],
  ) {
    return this.appwriteService.initAppwrite(params);
  }

  async callAppwrite(
    params: Parameters<AppwriteHTTPService["callAppwrite"]>[0],
  ) {
    return this.appwriteService.callAppwrite(params);
  }

  // Code
  async formatCode(params: Parameters<CodeHTTPService["formatCode"]>[0]) {
    return this.codeService.formatCode(params);
  }

  async lintCode(params: Parameters<CodeHTTPService["lintCode"]>[0]) {
    return this.codeService.lintCode(params);
  }

  // Filesystem
  async getFolder(params: Parameters<FilesystemHTTPService["getFolder"]>[0]) {
    return this.filesystemService.getFolder(params);
  }

  async readFile(params: Parameters<FilesystemHTTPService["readFile"]>[0]) {
    return this.filesystemService.readFile(params);
  }

  async createFile(params: Parameters<FilesystemHTTPService["createFile"]>[0]) {
    return this.filesystemService.createFile(params);
  }

  async createOrUpdateFile(
    params: Parameters<FilesystemHTTPService["createOrUpdateFile"]>[0],
  ) {
    return this.filesystemService.createOrUpdateFile(params);
  }

  async updateFilePath(
    params: Parameters<FilesystemHTTPService["updateFilePath"]>[0],
  ) {
    return this.filesystemService.updateFilePath(params);
  }

  async deleteFile(params: Parameters<FilesystemHTTPService["deleteFile"]>[0]) {
    return this.filesystemService.deleteFile(params);
  }

  async listFilesInDir<WithContent extends boolean = false>(params: {
    dirPath: string;
    recursive?: boolean;
    withContent?: WithContent;
    additionalIgnorePatterns?: string[];
  }) {
    return this.filesystemService.listFilesInDir<WithContent>(params);
  }

  // Git
  async git(params: Parameters<GitHTTPService["git"]>[0]) {
    return this.gitService.git(params);
  }

  // System
  async getSystemUsage() {
    return this.systemService.getSystemUsage();
  }

  // Terminal
  async executeCommand(
    params: Parameters<TerminalHTTPService["executeCommand"]>[0],
  ) {
    return this.terminalService.executeCommand(params);
  }
}

export function createSynapseHTTPClient({
  endpoint,
  artifactId,
  baseDir = "",
}: {
  endpoint: string;
  artifactId: string;
  baseDir?: string;
}): SynapseHTTPClient {
  return new SynapseHTTPClient({
    endpoint,
    artifactId,
    baseDir,
  });
}
