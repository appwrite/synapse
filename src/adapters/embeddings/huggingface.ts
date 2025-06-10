import {
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";
import { EmbeddingAdapter, EmbeddingConfig } from "../embeddings";

export interface HuggingFaceConfig extends EmbeddingConfig {
  modelName?: string;
  pooling?: "mean" | "none" | "cls" | undefined;
  normalize?: boolean;
}

export class HuggingFaceEmbeddingAdapter extends EmbeddingAdapter {
  private pipeline: FeatureExtractionPipeline | null = null;
  private modelName: string;
  private pooling: "mean" | "none" | "cls" | undefined;
  private normalize: boolean;

  constructor(config: HuggingFaceConfig = {}) {
    super(config);
    this.modelName = config.modelName || "jinaai/jina-embeddings-v2-base-code";
    this.pooling = config.pooling || "mean";
    this.normalize = config.normalize !== false; // default to true
  }

  async initialize(): Promise<void> {
    if (!this.pipeline) {
      console.log(`[HuggingFace] Initializing model: ${this.modelName}...`);
      try {
        this.pipeline = await pipeline("feature-extraction", this.modelName);
        console.log("[HuggingFace] Model initialized successfully");
      } catch (error) {
        console.error(`[HuggingFace] Error initializing model: ${error}`);
        throw error;
      }
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.pipeline) {
      throw new Error(
        "HuggingFace adapter not initialized. Call initialize() first.",
      );
    }

    try {
      const output = await this.pipeline(text, {
        pooling: this.pooling,
        normalize: this.normalize,
      });

      // Convert tensor to array if needed
      return Array.from(output.data);
    } catch (error) {
      console.error(`[HuggingFace] Error generating embedding: ${error}`);
      throw error;
    }
  }

  getName(): string {
    return `HuggingFace (${this.modelName})`;
  }

  isInitialized(): boolean {
    return this.pipeline !== null;
  }

  async cleanup(): Promise<void> {
    this.pipeline = null;
    console.log("[HuggingFace] Adapter cleaned up");
  }
}
