import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { ESLint } from "eslint";
import { format } from "prettier";
import { Code } from "../../src/services/code";
import { Synapse } from "../../src/synapse";

jest.mock("prettier");
jest.mock("eslint");
jest.mock("../../src/synapse");

describe("Code", () => {
  let code: Code;
  let mockSynapse: jest.Mocked<Synapse>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSynapse = new Synapse() as jest.Mocked<Synapse>;
    code = new Code(mockSynapse);
  });

  describe("format", () => {
    test("should format JavaScript code correctly", async () => {
      const input = "const x=1;const y=2;";
      const expected = "const x = 1;\nconst y = 2;\n";

      (format as jest.MockedFunction<typeof format>).mockResolvedValue(
        expected,
      );

      const result = await code.format(input, { language: "javascript" });

      expect(result).toEqual({
        success: true,
        data: expected,
      });
    });

    test("should format TypeScript code with custom options", async () => {
      const input = "const x:number=1;";
      const expected = "const x: number = 1;\n";

      (format as jest.MockedFunction<typeof format>).mockResolvedValue(
        expected,
      );

      const result = await code.format(input, {
        language: "typescript",
        indent: 4,
        useTabs: true,
        semi: false,
        singleQuote: true,
      });

      expect(result).toEqual({
        success: true,
        data: expected,
      });
    });
  });

  describe("lint", () => {
    test("should lint JavaScript code and return issues", async () => {
      const input = "const x = 1;";
      const mockLintResult: ESLint.LintResult[] = [
        {
          messages: [
            {
              line: 1,
              column: 1,
              severity: 2,
              ruleId: "no-unused-vars",
              message: "x is defined but never used",
            },
          ],
          filePath: "",
          errorCount: 1,
          warningCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          source: input,
          suppressedMessages: [],
          fatalErrorCount: 0,
          usedDeprecatedRules: [],
        },
      ];

      const mockLintText = jest
        .fn<() => Promise<ESLint.LintResult[]>>()
        .mockResolvedValue(mockLintResult);
      const MockESLint = jest.fn().mockImplementation(() => ({
        lintText: mockLintText,
      }));
      (ESLint as unknown) = MockESLint;

      const result = await code.lint(input, { language: "javascript" });

      expect(result).toEqual({
        success: true,
        data: {
          issues: [
            {
              line: 1,
              column: 1,
              severity: "error",
              rule: "no-unused-vars",
              message: "x is defined but never used",
            },
          ],
        },
      });
    });

    test("should handle warnings in lint results", async () => {
      const input = 'console.log("test");';
      const mockLintResult: ESLint.LintResult[] = [
        {
          messages: [
            {
              line: 1,
              column: 1,
              severity: 1,
              ruleId: "no-console",
              message: "Unexpected console statement",
            },
          ],
          filePath: "",
          errorCount: 0,
          warningCount: 1,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          source: input,
          suppressedMessages: [],
          fatalErrorCount: 0,
          usedDeprecatedRules: [],
        },
      ];

      const mockLintText = jest
        .fn<() => Promise<ESLint.LintResult[]>>()
        .mockResolvedValue(mockLintResult);
      const MockESLint = jest.fn().mockImplementation(() => ({
        lintText: mockLintText,
      }));
      (ESLint as unknown) = MockESLint;

      const result = await code.lint(input, { language: "javascript" });

      expect(result).toEqual({
        success: true,
        data: {
          issues: [
            {
              line: 1,
              column: 1,
              severity: "warning",
              rule: "no-console",
              message: "Unexpected console statement",
            },
          ],
        },
      });
    });
  });
});
