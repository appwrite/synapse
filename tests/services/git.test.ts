import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import os from "os";

import { Git, Synapse } from "../../src";

// --- Test helpers ---
let tempDir: string;
let git: Git;
let synapse: Synapse;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "git-test-"));
  synapse = new Synapse();
  git = new Git(synapse, tempDir);
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
  synapse.disconnect();
});

async function configureGitUser(): Promise<void> {
  await git.setUserName("Test User");
  await git.setUserEmail("test@example.com");
}

// --- Git Repository Initialization ---
describe("Git repository initialization", () => {
  test("initializes a new repository", async () => {
    const result = await git.init();
    assert.strictEqual(result.success, true);
    assert.ok(result.data);
    assert.match(result.data, /Initialized empty Git repository/);
    assert.ok(fsSync.existsSync(path.join(tempDir, ".git")));
  });

  test("returns error if repository already exists", async () => {
    await git.init();
    const result = await git.init();
    assert.strictEqual(result.success, false);
    assert.strictEqual(
      result.error,
      "Git repository already exists in this directory",
    );
  });

  test("allows changing working directory", async () => {
    const newDir = path.join(tempDir, "another-project");
    await fs.mkdir(newDir);
    git.updateWorkDir(newDir);
    const result = await git.init();
    assert.strictEqual(result.success, true);
    assert.ok(fsSync.existsSync(path.join(newDir, ".git")));
  });
});

// --- Remote Management ---
describe("Git remote management", () => {
  test("adds a new remote successfully", async () => {
    await git.init();
    const result = await git.addRemote(
      "origin",
      "https://github.com/user/repo.git",
    );
    assert.strictEqual(result.success, true);
  });

  test("returns error if remote already exists", async () => {
    await git.init();
    await git.addRemote("origin", "https://github.com/user/repo.git");
    const result = await git.addRemote(
      "origin",
      "https://github.com/user/repo.git",
    );
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.match(result.error, /remote origin already exists/);
  });
});

// --- Branch and Status ---
describe("Branch and status operations", () => {
  test("gets the current branch after initial commit", async () => {
    await git.init();
    await configureGitUser();
    const filePath = path.join(tempDir, "init.txt");
    await fs.writeFile(filePath, "initial");
    await git.add(["init.txt"]);
    await git.commit("Initial commit");

    const result = await git.getCurrentBranch();
    assert.strictEqual(result.success, true);
    assert.ok(result.data);
  });

  test("returns error if not a git repository", async () => {
    const result = await git.getCurrentBranch();
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.match(result.error, /not a git repository/);
  });

  test("shows git status", async () => {
    await git.init();
    const result = await git.status();
    assert.strictEqual(result.success, true);
    assert.ok(result.data);
    assert.match(result.data, /On branch/);
  });
});

// --- File Staging ---
describe("File staging", () => {
  test("adds files to staging area", async () => {
    await git.init();
    const filePath = path.join(tempDir, "file1.txt");
    await fs.writeFile(filePath, "content");
    const result = await git.add(["file1.txt"]);
    assert.strictEqual(result.success, true);
  });

  test("returns error for non-existent files", async () => {
    await git.init();
    const result = await git.add(["nonexistent.txt"]);
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.match(result.error, /did not match any files/);
  });
});

// --- Commits ---
describe("Committing changes", () => {
  test("commits staged changes", async () => {
    await git.init();
    await configureGitUser();
    const filePath = path.join(tempDir, "file.txt");
    await fs.writeFile(filePath, "commit me");
    await git.add(["file.txt"]);
    const result = await git.commit("test commit");
    assert.strictEqual(result.success, true);
    assert.ok(result.data);
    assert.match(result.data, /\[.*\] test commit/);
  });

  test("returns error when nothing to commit", async () => {
    await git.init();
    await configureGitUser();
    const result = await git.commit("test commit");
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.match(
      result.error,
      /Git command failed|nothing to commit|working tree clean|no changes added to commit/,
    );
  });
});
