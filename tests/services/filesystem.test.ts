import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import os from "os";

import { Filesystem } from "../../src/services/filesystem";
import { Synapse } from "../../src/synapse";

// --- Test helpers ---
let tempDir: string;
let filesystem: Filesystem;
let synapse: Synapse;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "filesystem-test-"));
  synapse = {
    logger: () => {},
    workDir: tempDir,
    setFilesystem: () => {},
  } as unknown as Synapse;
  filesystem = new Filesystem(synapse, tempDir);
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

// --- File Creation ---
describe("File creation", () => {
  test("creates a new file successfully", async () => {
    const filePath = path.join(tempDir, "file.txt");
    const content = "test content";
    const result = await filesystem.createFile(filePath, content);
    assert.deepEqual(result, {
      success: true,
      data: "File created successfully",
    });
    assert.strictEqual(await fs.readFile(filePath, "utf-8"), content);
  });

  test("returns error if file already exists", async () => {
    const filePath = path.join(tempDir, "existing.txt");
    await fs.writeFile(filePath, "already here");
    const result = await filesystem.createFile(filePath, "new content");
    assert.deepEqual(result, {
      success: false,
      error: `File already exists at path: ${filePath}`,
    });
  });

  test("handles errors during file creation", async () => {
    const filePath = path.join(tempDir, "invalid\x00file.txt");
    const result = await filesystem.createFile(filePath, "content");
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
  });
});

// --- File Reading ---
describe("File reading", () => {
  test("reads file content successfully", async () => {
    const filePath = path.join(tempDir, "file.txt");
    const content = "test content";
    await fs.writeFile(filePath, content);
    const result = await filesystem.getFile(filePath);
    assert.deepEqual(result, {
      success: true,
      data: {
        content,
        mimeType: "text/plain",
      },
    });
  });

  test("handles file reading errors", async () => {
    const filePath = path.join(tempDir, "nonexistent.txt");
    const result = await filesystem.getFile(filePath);
    assert.strictEqual(result.success, false);
    assert.match(result.error!, /no such file/i);
  });
});

// --- File Appending ---
describe("File appending", () => {
  test("appends content to a file", async () => {
    const filePath = path.join(tempDir, "file.txt");
    await fs.writeFile(filePath, "start");
    const result = await filesystem.appendFile(filePath, " end");
    assert.deepEqual(result, { success: true });
    assert.strictEqual(await fs.readFile(filePath, "utf-8"), "start end");
  });
});

// --- File Searching ---
describe("File searching", () => {
  test("finds files by path and content", async () => {
    await fs.writeFile(path.join(tempDir, "foo.txt"), "hello world");
    await fs.writeFile(path.join(tempDir, "bar.md"), "search me");
    await fs.writeFile(path.join(tempDir, "baz.txt"), "nothing here");

    let results = await filesystem.searchFiles("foo");
    assert.ok(results.data?.results.some((r) => r.path === "foo.txt"));

    results = await filesystem.searchFiles("search me");
    assert.ok(results.data?.results.some((r) => r.path === "bar.md"));

    results = await filesystem.searchFiles("notfound");
    assert.deepEqual(results.data?.results, []);
  });
});

// --- Directory Watching ---
describe("Directory watching", () => {
  test("sets up a watcher and handles file changes", async (t) => {
    // This test is a stub: chokidar is not used here, but you can implement a real watcher test if needed.
    // For a real watcher test, you would create a file and listen for changes.
    t.skip("Directory watching is environment-dependent and skipped in CI");
  });
});

// --- Zip File Creation ---
describe("Zip file creation", () => {
  test("creates a tar.gz file containing all files", async () => {
    await fs.writeFile(path.join(tempDir, "file1.txt"), "one");
    await fs.writeFile(path.join(tempDir, "file2.txt"), "two");
    const result = await filesystem.createGzipFile();
    assert.strictEqual(result.success, true);
    assert.ok(result.data?.buffer instanceof Buffer);
    // Optionally, check buffer magic number for gzip (1f 8b)
    assert.strictEqual(result.data?.buffer[0], 0x1f);
    assert.strictEqual(result.data?.buffer[1], 0x8b);
  });

  test("creates a tar.gz file and saves it to disk", async () => {
    await fs.writeFile(path.join(tempDir, "file1.txt"), "one");
    const outFile = "test.tar.gz";
    const result = await filesystem.createGzipFile(outFile);
    assert.strictEqual(result.success, true);
    const outPath = path.join(tempDir, outFile);
    assert.ok(fsSync.existsSync(outPath));
    const fileBuffer = await fs.readFile(outPath);
    assert.ok(fileBuffer instanceof Buffer);
  });

  test("handles errors during zip creation", async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    const result = await filesystem.createGzipFile();
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
  });
});

// --- Directory Listing ---
describe("Directory listing", () => {
  test("lists files in current working directory", async () => {
    const result = await filesystem.listFilesInDir({
      dirPath: tempDir,
      withContent: false,
      recursive: false,
    });
    assert.strictEqual(result.success, true);
    assert.deepEqual(result.data, []);
  });

  test("lists files without content", async () => {
    await fs.writeFile(path.join(tempDir, "file1.txt"), "a");
    await fs.writeFile(path.join(tempDir, "file2.js"), "b");
    const result = await filesystem.listFilesInDir({
      dirPath: tempDir,
      withContent: false,
      recursive: false,
    });
    assert.strictEqual(result.success, true);
    assert.ok(result.data?.some((f) => f.path === "file1.txt"));
    assert.ok(result.data?.some((f) => f.path === "file2.js"));
  });

  test("lists files with content", async () => {
    await fs.writeFile(path.join(tempDir, "file1.txt"), "content of file1");
    await fs.writeFile(path.join(tempDir, "file2.js"), "content of file2");
    const result = await filesystem.listFilesInDir({
      dirPath: tempDir,
      withContent: true,
      recursive: false,
    });
    assert.strictEqual(result.success, true);
    assert.ok(
      result.data?.some(
        (f) => (f as { content: string }).content === "content of file1",
      ),
    );
    assert.ok(
      result.data?.some(
        (f) => (f as { content: string }).content === "content of file2",
      ),
    );
  });

  test("handles recursive directory traversal", async () => {
    const subdir = path.join(tempDir, "subdir");
    await fs.mkdir(subdir);
    await fs.writeFile(path.join(subdir, "sub.txt"), "sub");
    const result = await filesystem.listFilesInDir({
      dirPath: tempDir,
      withContent: false,
      recursive: true,
    });
    assert.strictEqual(result.success, true);
    assert.ok(result.data?.some((f) => f.path.endsWith("subdir/sub.txt")));
  });

  test("returns error when dirPath is not provided", async () => {
    const result = await filesystem.listFilesInDir({
      dirPath: "",
      withContent: false,
      recursive: false,
    });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, "path is required");
  });

  test("handles directory read errors", async () => {
    const result = await filesystem.listFilesInDir({
      dirPath: path.join(tempDir, "nonexistent"),
      withContent: false,
      recursive: false,
    });
    assert.strictEqual(result.success, true);
    assert.deepEqual(result.data, []);
  });
});
