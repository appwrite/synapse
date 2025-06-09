import { env, pipeline } from "@huggingface/transformers";
import * as fsSync from "fs";
import * as path from "path";
import { Synapse } from "../synapse";

// Disable remote models and use local cache
env.allowRemoteModels = false;
env.allowLocalModels = true;

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
  private embeddingPipeline: any = null;
  private modelName: string;

  constructor(
    synapse: Synapse,
    workDir: string,
    modelName: string = "Xenova/all-MiniLM-L6-v2",
  ) {
    this.synapse = synapse;
    this.modelName = modelName;

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

  private async initializeEmbeddingModel(): Promise<void> {
    if (!this.embeddingPipeline) {
      this.log(`Initializing offline embedding model: ${this.modelName}...`);
      try {
        this.embeddingPipeline = await pipeline(
          "feature-extraction",
          this.modelName,
          {
            dtype: "q4", // Use 4-bit quantization for better performance
          },
        );
        this.log("Embedding model initialized successfully");
      } catch (error) {
        this.log(`Error initializing embedding model: ${error}`);
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
            if (
              ![
                "node_modules",
                ".git",
                "dist",
                "build",
                "coverage",
                ".next",
                "tmp",
                ".cache",
                "huggingface_hub",
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
    const output = await this.embeddingPipeline(text, {
      pooling: "mean",
      normalize: true,
    });

    // Convert tensor to array if needed
    return Array.from(output.data);
  }

  public async generateEmbeddings(): Promise<EmbeddingResult> {
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

    this.log(
      `Embedding generation completed. Generated embeddings for ${this.embeddings.length} files.`,
    );

    return {
      success: success,
      message: success
        ? `Successfully generated embeddings for ${this.embeddings.length} files.`
        : `Failed to generate embeddings for some files.`,
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
