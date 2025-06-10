import * as fsSync from "fs";
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

export class Embeddings {
  private synapse: Synapse;
  private workDir: string;
  private embeddings: DocumentEmbedding[] = [];
  private embeddingAdapter: EmbeddingAdapter;
  private gitignorePatterns: string[] | null = null;

  constructor(
    synapse: Synapse,
    workDir: string,
    embeddingAdapter: EmbeddingAdapter,
  ) {
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

  private shouldIgnoreDirectory(dirName: string, fullPath: string): boolean {
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

    if (hardcodedIgnore.includes(dirName)) {
      return true;
    }

    const gitignorePatterns = this.parseGitignore();

    const relativePath = path.relative(this.workDir, fullPath);

    for (const pattern of gitignorePatterns) {
      if (
        dirName === pattern ||
        relativePath === pattern ||
        relativePath.startsWith(pattern + "/") ||
        relativePath.split("/").includes(pattern)
      ) {
        return true;
      }
    }

    return false;
  }

  public refreshGitignoreCache(): void {
    this.gitignorePatterns = null;
    this.log("Gitignore cache refreshed");
  }

  private async initializeEmbeddingModel(): Promise<void> {
    if (!this.embeddingAdapter.isInitialized()) {
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

  private getCodeFiles(directory: string): string[] {
    const files: string[] = [];
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

    const traverseDirectory = (dir: string): void => {
      try {
        const entries = fsSync.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!this.shouldIgnoreDirectory(entry.name, fullPath)) {
              traverseDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (codeExtensions.includes(ext)) {
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

  private readFileContent(filePath: string): string {
    try {
      const content = fsSync.readFileSync(filePath, "utf-8");

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

  private async generateEmbedding(text: string): Promise<number[]> {
    return await this.embeddingAdapter.generateEmbedding(text);
  }

  public async generateEmbeddings(): Promise<EmbeddingResult> {
    const startTime = performance.now();
    this.log("Starting embedding generation for codebase...");

    await this.initializeEmbeddingModel();

    const files = this.getCodeFiles(this.workDir);
    this.log(`Found ${files.length} code files to process`);

    this.embeddings = [];
    let success = true;

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      const relativePath = path.relative(this.workDir, filePath);

      try {
        this.log(`Processing file ${i + 1}/${files.length}: ${relativePath}`);

        const content = this.readFileContent(filePath);
        if (!content.trim()) {
          this.log(`Skipping empty file: ${relativePath}`);
          continue;
        }

        // Create a document string that includes file path context
        const documentText = `File: ${relativePath}\n\n${content}`;

        const embedding = await this.generateEmbedding(documentText);

        this.embeddings.push({
          filePath: relativePath,
          content: content,
          embedding: embedding,
          size: content.length,
        });

        this.log(`Successfully processed: ${relativePath}`);
      } catch (error) {
        this.log(`Error processing file ${relativePath}: ${error}`);
        success = false;
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const durationSeconds = (duration / 1000).toFixed(2);

    this.log(
      `Embedding generation completed in ${durationSeconds}s. Generated embeddings for ${this.embeddings.length} files.`,
    );

    return {
      success: success,
      message: success
        ? `Successfully generated embeddings for ${this.embeddings.length} files in ${durationSeconds}s.`
        : `Failed to generate embeddings for some files. Duration: ${durationSeconds}s.`,
    };
  }

  public async findRelevantDocuments(
    query: string,
    limit: number = 5,
  ): Promise<{ success: boolean; data: RelevantDocument[]; message: string }> {
    if (this.embeddings.length === 0) {
      this.log(
        "No embeddings available. Please run generateEmbeddings() first.",
      );
      return {
        success: false,
        data: [],
        message:
          "No embeddings available. Please run generateEmbeddings() first.",
      };
    }

    await this.initializeEmbeddingModel();

    this.log(`Searching for documents relevant to: "${query}"`);

    try {
      // Generate embedding for the query
      const queryVector = await this.generateEmbedding(query);

      // Calculate similarities
      const similarities = this.embeddings.map((doc) => ({
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

  public getEmbeddingsStats(): { totalFiles: number; totalSize: number } {
    const totalSize = this.embeddings.reduce((sum, doc) => sum + doc.size, 0);
    return {
      totalFiles: this.embeddings.length,
      totalSize: totalSize,
    };
  }
}
