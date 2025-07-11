import test from "node:test";
import assert from "node:assert/strict";
import { Appwrite } from "../../src/services/appwrite";
import { Synapse } from "../../src/synapse";

function createAppwrite() {
  const appwrite = new Appwrite(new Synapse());
  appwrite
    .setEndpoint(process.env.APPWRITE_ENDPOINT || "")
    .setProject(process.env.APPWRITE_PROJECT_ID || "")
    .setKey(process.env.APPWRITE_API_KEY || "");
  return appwrite;
}

test("Appwrite instance creation", () => {
  const appwrite = new Appwrite(new Synapse());
  assert.ok(appwrite instanceof Appwrite);
});

test("Appwrite configuration chaining", () => {
  const appwrite = new Appwrite(new Synapse());
  const result = appwrite
    .setEndpoint(process.env.APPWRITE_ENDPOINT || "")
    .setProject("test-project")
    .setKey("test-api-key");
  assert.strictEqual(result, appwrite);
});

test("Appwrite initialization check", () => {
  const appwrite = new Appwrite(new Synapse());
  assert.equal(appwrite.isInitialized(), false);

  appwrite
    .setEndpoint(process.env.APPWRITE_ENDPOINT || "")
    .setProject(process.env.APPWRITE_PROJECT_ID || "")
    .setKey(process.env.APPWRITE_API_KEY || "");
  assert.equal(appwrite.isInitialized(), true);
});

test("Appwrite service call: error when not initialized", async () => {
  const appwrite = new Appwrite(new Synapse());
  await assert.rejects(
    () => appwrite.call("users", "list"),
    /Appwrite SDK is not properly initialized/,
  );
});

test("Appwrite service call: error for non-existent service", async () => {
  const appwrite = createAppwrite();
  await assert.rejects(
    () => appwrite.call("nonexistent", "list"),
    /Service 'nonexistent' does not exist in Appwrite SDK/,
  );
});

test("Appwrite service call: users.list", async () => {
  const appwrite = createAppwrite();
  const result = await appwrite.call("users", "list", {
    queries: ['{"method":"limit","values":[25]}'],
  });
  assert.ok(result.total >= 0);
  assert.ok(Array.isArray(result.users));
});
