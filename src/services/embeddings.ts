import * as chokidar from "chokidar";
import * as fsSync from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import { EmbeddingAdapter } from "../adapters/embeddings";
import { Synapse } from "../synapse";

export type EmbeddingResult = {
  success: boolean;
  message: string;
};

export type DocumentEmbedding = {
  filePath: string;
  content: string;
  embedding: number[];
  size: number;
};

export type RelevantDocument = {
  filePath: string;
  content: string;
  similarity: number;
};

export type EmbeddingsConstructorParams = {
  synapse: Synapse;
  workDir: string;
  embeddingAdapter: EmbeddingAdapter;
};

export class Embeddings {
  private synapse: Synapse;
  private workDir: string;
  private embeddings: Map<string, DocumentEmbedding> = new Map();
  private embeddingAdapter: EmbeddingAdapter;
  private gitignorePatterns: string[] | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private isWatching: boolean = false;
  private processingQueue: Set<string> = new Set();

  constructor({
    synapse,
    workDir,
    embeddingAdapter,
  }: EmbeddingsConstructorParams) {
    this.synapse = synapse;
    this.embeddingAdapter = embeddingAdapter;

    if (workDir) {
      if (!fsSync.existsSync(workDir)) {
        fsSync.mkdirSync(workDir, { recursive: true });
      }
      this.workDir = workDir;
    } else {
      this.workDir = process.cwd();
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

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[Embeddings][${timestamp}] ${message}`);
  }

  private parseGitignore(): string[] {
    if (this.gitignorePatterns !== null) {
      return this.gitignorePatterns;
    }

    const gitignorePath = path.join(this.workDir, ".gitignore");
    const patterns: string[] = [];

    try {
      if (fsSync.existsSync(gitignorePath)) {
        const content = fsSync.readFileSync(gitignorePath, "utf-8");
        const lines = content.split("\n");

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#")) {
            let pattern = trimmed.replace(/\/$/, "").replace(/\*$/, "");
            if (pattern) {
              patterns.push(pattern);
            }
          }
        }

        this.log(`Loaded ${patterns.length} patterns from .gitignore`);
      }
    } catch (error) {
      this.log(`Error reading .gitignore: ${error}`);
    }

    this.gitignorePatterns = patterns;
    return patterns;
  }

  private shouldIgnoreFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    const relativePath = path.relative(this.workDir, filePath);

    const hardcodedIgnore = [
      "node_modules",
      ".git",
      "dist",
      "build",
      "coverage",
      ".next",
      "tmp",
      ".cache",
      "huggingface_hub",
      "helpers",
    ];

    // Check if any part of the path contains ignored directories
    const pathParts = relativePath.split(path.sep);
    for (const part of pathParts) {
      if (hardcodedIgnore.includes(part)) {
        return true;
      }
    }

    const gitignorePatterns = this.parseGitignore();

    for (const pattern of gitignorePatterns) {
      if (
        fileName === pattern ||
        relativePath === pattern ||
        relativePath.startsWith(pattern + "/") ||
        pathParts.includes(pattern)
      ) {
        return true;
      }
    }

    return false;
  }

  private isCodeFile(filePath: string): boolean {
    const codeExtensions = [
      ".ts",
      ".js",
      ".tsx",
      ".jsx",
      ".py",
      ".java",
      ".cpp",
      ".c",
      ".cs",
      ".go",
      ".rs",
      ".php",
      ".rb",
      ".swift",
      ".kt",
      ".scala",
      ".sh",
      ".sql",
      ".html",
      ".css",
      ".md",
      ".json",
      ".xml",
      ".yaml",
      ".yml",
    ];

    const ext = path.extname(filePath);
    return codeExtensions.includes(ext);
  }

  public refreshGitignoreCache(): void {
    this.gitignorePatterns = null;
    this.log("Gitignore cache refreshed");
  }

  private async initializeEmbeddingModel(): Promise<void> {
    if (
      !this.embeddingAdapter.isInitialized() &&
      !this.embeddingAdapter.isInitializing
    ) {
      this.log(
        `Initializing embedding adapter: ${this.embeddingAdapter.getName()}...`,
      );
      try {
        await this.embeddingAdapter.initialize();
        this.log("Embedding adapter initialized successfully");
      } catch (error) {
        this.log(`Error initializing embedding adapter: ${error}`);
        throw error;
      }
    }
  }

  private async readFileContent(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, "utf-8");

      // Limit file size for embedding model processing
      return content.length > 7000
        ? content.substring(0, 7000) + "..."
        : content;
    } catch (error) {
      this.log(`Error reading file ${filePath}: ${error}`);
      return "";
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private async embedFile(filePath: string): Promise<void> {
    const relativePath = path.relative(this.workDir, filePath);

    // Prevent duplicate processing
    if (this.processingQueue.has(relativePath)) {
      return;
    }

    this.processingQueue.add(relativePath);

    try {
      this.log(`Embedding file: ${relativePath}`);

      const content = await this.readFileContent(filePath);
      if (!content.trim()) {
        this.log(`Skipping empty file: ${relativePath}`);
        this.embeddings.delete(relativePath);
        return;
      }

      // Create a document string that includes file path context
      const documentText = `File: ${relativePath}\n\n${content}`;

      const embedding =
        await this.embeddingAdapter.generateEmbedding(documentText);

      this.embeddings.set(relativePath, {
        filePath: relativePath,
        content: content,
        embedding: embedding,
        size: content.length,
      });

      this.log(`Successfully embedded: ${relativePath}`);
    } catch (error) {
      this.log(`Error embedding file ${relativePath}: ${error}`);
    } finally {
      this.processingQueue.delete(relativePath);
    }
  }

  private async removeFileEmbedding(filePath: string): Promise<void> {
    const relativePath = path.relative(this.workDir, filePath);

    if (this.embeddings.has(relativePath)) {
      this.embeddings.delete(relativePath);
      this.log(`Removed embedding for deleted file: ${relativePath}`);
    }
  }

  private async onFileChange(filePath: string): Promise<void> {
    if (!this.isCodeFile(filePath) || this.shouldIgnoreFile(filePath)) {
      return;
    }

    await this.embedFile(filePath);
  }

  private async onFileDelete(filePath: string): Promise<void> {
    await this.removeFileEmbedding(filePath);
  }

  public async startWatching(): Promise<EmbeddingResult> {
    if (this.isWatching) {
      return {
        success: true,
        message: "File watcher is already running",
      };
    }

    try {
      await this.initializeEmbeddingModel();

      this.log("Starting file watcher and initial embedding generation...");
      const startTime = performance.now();

      // Initial scan and embedding of existing files
      await this.initialScan();

      // Set up file watcher
      this.watcher = chokidar.watch(this.workDir, {
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/dist/**",
          "**/build/**",
          "**/coverage/**",
          "**/.next/**",
          "**/tmp/**",
          "**/.cache/**",
          "**/huggingface_hub/**",
          "**/helpers/**",
        ],
        persistent: true,
        ignoreInitial: true, // We already did initial scan
      });

      this.watcher
        .on("add", (filePath) => this.onFileChange(filePath))
        .on("change", (filePath) => this.onFileChange(filePath))
        .on("unlink", (filePath) => this.onFileDelete(filePath));

      this.isWatching = true;

      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000;

      this.log(
        `File watcher started. Initial embedding completed in ${duration.toFixed(2)}s`,
      );
      this.log(`Watching ${this.embeddings.size} files for changes`);

      return {
        success: true,
        message: `File watcher started successfully. Embedded ${this.embeddings.size} files in ${duration.toFixed(2)}s`,
      };
    } catch (error) {
      this.log(`Error starting file watcher: ${error}`);
      return {
        success: false,
        message: `Failed to start file watcher: ${error}`,
      };
    }
  }

  private async initialScan(): Promise<void> {
    const files = this.getAllCodeFiles(this.workDir);
    this.log(`Found ${files.length} code files for initial embedding`);

    const embedPromises = files.map((filePath) => this.embedFile(filePath));
    await Promise.all(embedPromises);
  }

  private getAllCodeFiles(directory: string): string[] {
    const files: string[] = [];

    const traverseDirectory = (dir: string): void => {
      try {
        const entries = fsSync.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!this.shouldIgnoreFile(fullPath)) {
              traverseDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            if (this.isCodeFile(fullPath) && !this.shouldIgnoreFile(fullPath)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        this.log(`Error reading directory ${dir}: ${error}`);
      }
    };

    traverseDirectory(directory);
    return files;
  }

  public async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.isWatching = false;
      this.log("File watcher stopped");
    }
  }

  public async findDocuments(
    query: string,
    limit: number = 5,
  ): Promise<{ success: boolean; data: RelevantDocument[]; message: string }> {
    if (this.embeddingAdapter.isInitializing) {
      return {
        success: false,
        data: [],
        message:
          "Embedding adapter is initializing. Please wait a moment and try again.",
      };
    }

    if (!this.isWatching) {
      return {
        success: false,
        data: [],
        message:
          "No embeddings available. Please run startWatching() first or create some code files first.",
      };
    }

    if (this.embeddings.size === 0) {
      return {
        success: false,
        data: [],
        message:
          "No embeddings available yet. Try creating some code files first.",
      };
    }

    await this.initializeEmbeddingModel();

    this.log(`Searching for documents relevant to: "${query}"`);

    try {
      // Generate embedding for the query
      const queryVector = await this.embeddingAdapter.generateEmbedding(query);

      // Calculate similarities
      const similarities = Array.from(this.embeddings.values()).map((doc) => ({
        filePath: doc.filePath,
        content: doc.content,
        similarity: this.cosineSimilarity(queryVector, doc.embedding),
      }));

      // Sort by similarity (highest first) and limit results
      const results = similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      this.log(`Found ${results.length} relevant documents`);
      results.forEach((result, index) => {
        this.log(
          `${index + 1}. ${result.filePath} (similarity: ${result.similarity.toFixed(4)})`,
        );
      });

      return {
        success: true,
        data: results,
        message: `Found ${results.length} relevant documents`,
      };
    } catch (error) {
      this.log(`Error finding relevant documents: ${error}`);
      return {
        success: false,
        data: [],
        message: `Error finding relevant documents: ${error}`,
      };
    }
  }

  public getStats(): { totalFiles: number; totalSize: number } {
    const embeddings = Array.from(this.embeddings.values());
    const totalSize = embeddings.reduce((sum, doc) => sum + doc.size, 0);
    return {
      totalFiles: embeddings.length,
      totalSize: totalSize,
    };
  }

  public isWatchingFiles(): boolean {
    return this.isWatching;
  }

  public async dispose(): Promise<void> {
    await this.stopWatching();
    this.embeddings.clear();
    this.processingQueue.clear();
    this.embeddingAdapter.cleanup();
  }
}
