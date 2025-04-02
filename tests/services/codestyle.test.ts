import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { ESLint } from "eslint";
import { format } from "prettier";
import { CodeStyle } from "../../src/services/codestyle";
import { Synapse } from "../../src/synapse";

jest.mock("prettier");
jest.mock("eslint");
jest.mock("../../src/synapse");

describe("CodeStyle", () => {
  let codeStyle: CodeStyle;
  let mockSynapse: jest.Mocked<Synapse>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSynapse = new Synapse() as jest.Mocked<Synapse>;
    codeStyle = new CodeStyle(mockSynapse);
  });

  describe("format", () => {
    test("should format JavaScript code with default options", async () => {
      const input = "const x=1;const y=2;";
      const expected = "const x = 1;\nconst y = 2;\n";

      const mockFormat = format as jest.MockedFunction<typeof format>;
      mockFormat.mockResolvedValue(expected);

      const result = await codeStyle.format(input, { language: "javascript" });

      expect(result.success).toBe(true);
      expect(result.data).toBe(expected);
      expect(format).toHaveBeenCalledWith(input, {
        parser: "babel",
        tabWidth: 2,
        useTabs: false,
        semi: true,
        singleQuote: false,
        printWidth: 80,
      });
    });

    test("should format TypeScript code with custom options", async () => {
      const input = 'const x:number=1;const y:string="test";';
      const expected = "const x: number = 1\nconst y: string = 'test'\n";

      const mockFormat = format as jest.MockedFunction<typeof format>;
      mockFormat.mockResolvedValue(expected);

      const result = await codeStyle.format(input, {
        language: "typescript",
        indent: 4,
        useTabs: true,
        semi: false,
        singleQuote: true,
        printWidth: 100,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(expected);
      expect(format).toHaveBeenCalledWith(input, {
        parser: "typescript",
        tabWidth: 4,
        useTabs: true,
        semi: false,
        singleQuote: true,
        printWidth: 100,
      });
    });

    test("should handle unsupported language gracefully", async () => {
      const input = "some code";
      const expected = "formatted code";

      const mockFormat = format as jest.MockedFunction<typeof format>;
      mockFormat.mockResolvedValue(expected);

      const result = await codeStyle.format(input, { language: "unsupported" });

      expect(result.success).toBe(true);
      expect(result.data).toBe(expected);
      expect(format).toHaveBeenCalledWith(input, {
        parser: "babel", // Should default to babel
        tabWidth: 2,
        useTabs: false,
        semi: true,
        singleQuote: false,
        printWidth: 80,
      });
    });
  });

  describe("lint", () => {
    test("should lint JavaScript code with default rules", async () => {
      const input = "const x = 1;\nconst y = 2;";
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

      const result = await codeStyle.lint(input, { language: "javascript" });

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toEqual({
        line: 1,
        column: 1,
        severity: "error",
        rule: "no-unused-vars",
        message: "x is defined but never used",
      });
    });

    test("should lint with custom rules", async () => {
      const input = "let x = 1;";
      const customRules = {
        "prefer-const": "error" as const,
      };

      const mockLintResult: ESLint.LintResult[] = [
        {
          messages: [
            {
              line: 1,
              column: 1,
              severity: 2,
              ruleId: "prefer-const",
              message: "Use const instead of let",
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

      const result = await codeStyle.lint(input, {
        language: "javascript",
        rules: customRules,
      });

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].rule).toBe("prefer-const");
      expect(MockESLint).toHaveBeenCalledWith({
        baseConfig: {
          parser: "@typescript-eslint/parser",
          rules: customRules,
        },
      });
    });

    test("should handle warnings correctly", async () => {
      const input = 'console.log("test");';
      const mockLintResult: ESLint.LintResult[] = [
        {
          messages: [
            {
              line: 1,
              column: 1,
              severity: 1, // Warning severity
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

      const result = await codeStyle.lint(input, { language: "javascript" });

      expect(result.success).toBe(true);
      expect(result.issues[0].severity).toBe("warning");
    });
  });
});
