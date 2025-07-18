export { Appwrite } from "./services/appwrite";
export { Code } from "./services/code";
export { Embeddings } from "./services/embeddings";
export { Filesystem } from "./services/filesystem";
export { Git } from "./services/git";
export { Ports } from "./services/ports";
export type { PortNotification } from "./services/ports";
export { System } from "./services/system";
export { Terminal } from "./services/terminal";
export { Synapse } from "./synapse";

export { SynapseHTTPClient, createSynapseHTTPClient } from "./client/http";
export type {
  SynapseRequest,
  SynapseResponse,
  AppwriteInitParams,
  AppwriteCallParams,
  FormatOptions,
  LintResult,
  FileItem,
  FileContent,
  FileListItem,
  ListFilesInDirParams,
  ListFilesInDirResult,
  GitOperationResult,
  GitOperation,
  GitParams,
  SystemUsageData,
  ExecuteCommandParams,
  ExecuteCommandResult,
} from "./client/http";
