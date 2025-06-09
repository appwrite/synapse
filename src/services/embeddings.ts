import * as fsSync from "fs";
import * as path from "path";
import { Synapse } from "../synapse";

interface DocumentEmbedding {
  filePath: string;
  content: string;
  embedding: number[];
  size: number;
}

interface RelevantDocument {
  filePath: string;
  content: string;
  similarity: number;
}

export class Embeddings {
  private synapse: Synapse;
  private workDir: string;
  private embeddings: DocumentEmbedding[] = [];
  private extractor: any = null;

  constructor(synapse: Synapse, workDir: string) {
    this.synapse = synapse;

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

  private async initializeExtractor(): Promise<void> {
    if (!this.extractor) {
      this.log("Initializing jina-embeddings-v2-base-code model...");
      try {
        const TransformersApi = Function(
          "return import('@xenova/transformers')",
        )();
        const { pipeline } = await TransformersApi;
        this.extractor = await pipeline(
          "feature-extraction",
          "jinaai/jina-embeddings-v2-base-code",
          {
            quantized: false,
          },
        );
        this.log("Model initialized successfully");
      } catch (error) {
        this.log(`Error initializing model: ${error}`);
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
            // Skip node_modules, .git, and other common non-source directories
            if (
              ![
                "node_modules",
                ".git",
                "dist",
                "build",
                "coverage",
                ".next",
                "tmp",
              ].includes(entry.name)
            ) {
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
      // Limit file size to avoid overwhelming the model (max ~7000 chars to stay under 8192 tokens)
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

  public async generateEmbeddings(): Promise<void> {
    this.log("Starting embedding generation for codebase...");

    await this.initializeExtractor();

    const files = this.getCodeFiles(this.workDir);
    this.log(`Found ${files.length} code files to process`);

    this.embeddings = [];

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

        const embedding = await this.extractor(documentText, {
          pooling: "mean",
        });

        this.embeddings.push({
          filePath: relativePath,
          content: content,
          embedding: Array.from(embedding.data as number[]),
          size: content.length,
        });

        this.log(`Successfully processed: ${relativePath}`);
      } catch (error) {
        this.log(`Error processing file ${relativePath}: ${error}`);
      }
    }

    this.log(
      `Embedding generation completed. Generated embeddings for ${this.embeddings.length} files.`,
    );
  }

  public async findRelevantDocuments(
    query: string,
    limit: number = 5,
  ): Promise<RelevantDocument[]> {
    if (this.embeddings.length === 0) {
      this.log(
        "No embeddings available. Please run generateEmbeddings() first.",
      );
      return [];
    }

    await this.initializeExtractor();

    this.log(`Searching for documents relevant to: "${query}"`);

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.extractor(query, { pooling: "mean" });
      const queryVector = Array.from(queryEmbedding.data as number[]);

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

      return results;
    } catch (error) {
      this.log(`Error finding relevant documents: ${error}`);
      return [];
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
