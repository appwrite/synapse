export interface EmbeddingConfig {
  [key: string]: any;
}

export abstract class EmbeddingAdapter {
  protected config: EmbeddingConfig;

  constructor(config: EmbeddingConfig = {}) {
    this.config = config;
  }

  /**
   * Initialize the embedding model/service
   */
  abstract initialize(): Promise<void>;

  /**
   * Generate embeddings for the given text
   * @param text The text to generate embeddings for
   * @returns Promise<number[]> The embedding vector
   */
  abstract generateEmbedding(text: string): Promise<number[]>;

  /**
   * Get the name/identifier of this adapter
   */
  abstract getName(): string;

  /**
   * Check if the adapter is initialized and ready to use
   */
  abstract isInitialized(): boolean;

  /**
   * Clean up resources when done
   */
  async cleanup(): Promise<void> {
    // Default implementation - can be overridden by specific adapters
  }
}
