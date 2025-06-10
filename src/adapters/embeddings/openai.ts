import { EmbeddingAdapter, EmbeddingConfig } from "../embeddings";

export interface OpenAIConfig extends EmbeddingConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
}

export class OpenAIEmbeddingAdapter extends EmbeddingAdapter {
  private apiKey: string;
  private model: string;
  private baseURL: string;
  private initialized: boolean = false;

  constructor(config: OpenAIConfig) {
    super(config);
    if (!config.apiKey) {
      throw new Error("OpenAI API key is required");
    }
    this.apiKey = config.apiKey;
    this.model = config.model || "text-embedding-3-small";
    this.baseURL = config.baseURL || "https://api.openai.com/v1";
  }

  async initialize(): Promise<void> {
    console.log(`[OpenAI] Initializing with model: ${this.model}...`);
    if (!this.apiKey.startsWith("sk-")) {
      console.warn(
        "[OpenAI] API key doesn't start with 'sk-', this might cause issues",
      );
    }
    this.initialized = true;
    console.log("[OpenAI] Adapter initialized successfully");
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.initialized) {
      throw new Error(
        "OpenAI adapter not initialized. Call initialize() first.",
      );
    }

    try {
      const response = await fetch(`${this.baseURL}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: text,
          model: this.model,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `OpenAI API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as any;

      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error("Invalid response format from OpenAI API");
      }

      return data.data[0].embedding;
    } catch (error) {
      console.error(`[OpenAI] Error generating embedding: ${error}`);
      throw error;
    }
  }

  getName(): string {
    return `OpenAI (${this.model})`;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
    console.log("[OpenAI] Adapter cleaned up");
  }
}
