import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { Code } from "../../src/services/code";
import { Synapse } from "../../src/synapse";

let code: Code;

beforeEach(() => {
  code = new Code(new Synapse());
});

describe("formatting JavaScript code", () => {
  test("formats with default Prettier options", async () => {
    const input = "const x=1;const y=2;";
    const expected = "const x = 1;\nconst y = 2;\n";

    const result = await code.format(input, { language: "javascript" });

    assert.deepEqual(result, {
      success: true,
      data: expected,
    });
  });
});

describe("formatting TypeScript code", () => {
  test("applies custom formatting options", async () => {
    const input = "const x:number=1;";
    const expected = "const x: number = 1\n";

    const result = await code.format(input, {
      language: "typescript",
      indent: 4,
      useTabs: true,
      semi: false,
      singleQuote: true,
    });

    assert.deepEqual(result, {
      success: true,
      data: expected,
    });
  });
});

describe("linting JavaScript code for errors", () => {
  test("reports unused variable as an error", async () => {
    const input = "const x = 1;";

    const result = await code.lint(input, {
      language: "javascript",
      rules: { "no-unused-vars": "error" },
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.data, "Expected result.data to be defined");
    assert.ok(
      result.data.issues.some(
        (issue: any) =>
          issue.rule === "no-unused-vars" && issue.severity === "error",
      ),
      "Expected unused variable error to be reported",
    );
  });
});

describe("linting JavaScript code for warnings", () => {
  test("warns on console statements", async () => {
    const input = 'console.log("test");';

    const result = await code.lint(input, {
      language: "javascript",
      rules: { "no-console": "warn" },
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.data, "Expected result.data to be defined");
    assert.ok(
      result.data.issues.some(
        (issue: any) =>
          issue.rule === "no-console" && issue.severity === "warning",
      ),
      "Expected console warning to be reported",
    );
  });
});
