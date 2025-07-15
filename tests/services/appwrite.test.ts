import test from "node:test";
import assert from "node:assert/strict";
import { Appwrite } from "../../src/services/appwrite";
import { Synapse } from "../../src/synapse";

function createAppwrite() {
  const appwrite = new Appwrite(new Synapse());
  appwrite
    .setEndpoint("https://fra.cloud.appwrite.io/v1")
    .setProject("test-project")
    .setKey("test-api-key");
  return appwrite;
}

test("Appwrite instance creation", () => {
  const appwrite = new Appwrite(new Synapse());
  assert.ok(appwrite instanceof Appwrite);
});

test("Appwrite configuration chaining", () => {
  const appwrite = new Appwrite(new Synapse());
  const result = appwrite
    .setEndpoint("https://fra.cloud.appwrite.io/v1")
    .setProject("test-project")
    .setKey("test-api-key");
  assert.strictEqual(result, appwrite);
});

test("Appwrite initialization check", () => {
  const appwrite = new Appwrite(new Synapse());
  assert.equal(appwrite.isInitialized(), false);

  appwrite
    .setEndpoint("https://fra.cloud.appwrite.io/v1")
    .setProject("test-project")
    .setKey("test-api-key");
  assert.equal(appwrite.isInitialized(), true);
});

test("Appwrite service call: error when not initialized", async () => {
  const appwrite = new Appwrite(new Synapse());
  await assert.rejects(
    () => appwrite.call({ service: "users", method: "list" }),
    /Appwrite SDK is not properly initialized/,
  );
});

test("Appwrite service call: error for non-existent service", async () => {
  const appwrite = createAppwrite();
  await assert.rejects(
    () => appwrite.call({ service: "nonexistent", method: "list" }),
    /Service 'nonexistent' does not exist in Appwrite SDK/,
  );
});

test("Appwrite service call: users.list", async () => {
  const appwrite = createAppwrite();
  await assert.rejects(
    () =>
      appwrite.call({
        service: "users",
        method: "list",
        args: { queries: ['{"method":"limit","values":[25]}'] },
      }),
    /The current user is not authorized to perform the requested action/,
  );
});
