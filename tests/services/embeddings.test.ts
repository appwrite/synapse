import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import os from "os";

import { Embeddings } from "../../src/services/embeddings";
import { Synapse } from "../../src/synapse";
import { EmbeddingAdapter } from "../../src/adapters/embeddings";
class DummyEmbeddingAdapter extends EmbeddingAdapter {
  private initialized = false;
  getName() {
    return "dummy";
  }
  isInitialized() {
    return this.initialized;
  }
  async initialize() {
    this.initialized = true;
  }
  async generateEmbedding(text: string) {
    // Simple deterministic embedding: char codes mod 10
    return Array(10)
      .fill(0)
      .map((_, i) => (text.charCodeAt(i % text.length) || 0) % 10);
  }
  async cleanup() {
    this.initialized = false;
  }
}

// --- Test setup ---
let tempDir: string;
let embeddings: Embeddings;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "embeddings-test-"));
  embeddings = new Embeddings(
    new Synapse(),
    tempDir,
    new DummyEmbeddingAdapter(),
  );
});

afterEach(async () => {
  await embeddings.dispose();
  await fs.rm(tempDir, { recursive: true, force: true });
});

// --- Working Directory Initialization ---
describe("working directory management", () => {
  test("creates working directory if missing", async () => {
    const customDir = path.join(tempDir, "custom");
    assert.ok(!fsSync.existsSync(customDir));
    embeddings.updateWorkDir(customDir);
    assert.ok(fsSync.existsSync(customDir));
  });
});

// --- Embedding and File Watching ---
describe("embedding and file watching behavior", () => {
  test("embeds code files and reports correct stats", async () => {
    const filePath = path.join(tempDir, "file1.js");
    await fs.writeFile(filePath, 'console.log("hello");');
    await embeddings.startWatching();
    const stats = embeddings.getStats();
    assert.strictEqual(stats.totalFiles, 1);
    assert.ok(stats.totalSize > 0);
  });

  test("ignores non-code files and respects .gitignore patterns", async () => {
    const txtFile = path.join(tempDir, "ignoreme.txt");
    const codeFile = path.join(tempDir, "file2.ts");
    const gitignore = path.join(tempDir, ".gitignore");
    await fs.writeFile(txtFile, "not code");
    await fs.writeFile(codeFile, "let x = 1;");
    await fs.writeFile(gitignore, "ignoreme.txt");
    await embeddings.refreshGitignoreCache();
    await embeddings.startWatching();
    const stats = embeddings.getStats();
    assert.strictEqual(stats.totalFiles, 1);
  });

  test("updates embeddings when files are added or removed", async () => {
    await embeddings.startWatching();
    const filePath = path.join(tempDir, "file3.js");
    await fs.writeFile(filePath, "let y = 2;");
    // Wait for watcher to pick up file
    await new Promise((resolve) => setTimeout(resolve, 300));
    let stats = embeddings.getStats();
    assert.strictEqual(stats.totalFiles, 1);

    await fs.rm(filePath);
    await new Promise((resolve) => setTimeout(resolve, 300));
    stats = embeddings.getStats();
    assert.strictEqual(stats.totalFiles, 0);
  });
});

// --- Finding Relevant Documents ---
describe("document relevance search", () => {
  test("returns relevant documents for a query", async () => {
    const filePath = path.join(tempDir, "file4.js");
    await fs.writeFile(filePath, 'function hello() { return "world"; }');
    await embeddings.startWatching();
    const result = await embeddings.findDocuments("hello", 1);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.length, 1);
    assert.ok(result.data[0].filePath.endsWith("file4.js"));
    assert.ok(result.data[0].similarity >= 0);
  });

  test("returns error if embeddings are unavailable", async () => {
    const result = await embeddings.findDocuments("anything", 1);
    assert.strictEqual(result.success, false);
    assert.match(result.message, /No embeddings available/);
  });
});

// --- Adapter Initialization and Cleanup ---
describe("embedding adapter lifecycle", () => {
  test("initializes and cleans up adapter correctly", async () => {
    const adapter = new DummyEmbeddingAdapter();
    const emb = new Embeddings(new Synapse(), tempDir, adapter);
    await emb.startWatching();
    assert.ok(adapter.isInitialized());
    await emb.dispose();
    assert.ok(!adapter.isInitialized());
  });
});
