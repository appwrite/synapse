import { ESLint } from "eslint";
import { format, Options } from "prettier";
import { Synapse } from "../synapse";

export interface FormatOptions {
  language: string;
  indent?: number;
  useTabs?: boolean;
  semi?: boolean;
  singleQuote?: boolean;
  printWidth?: number;
}

export interface LintOptions {
  language: string;
  rules?: Record<string, "error" | "warn" | "off">;
}

export interface FormatResult {
  success: boolean;
  data?: string;
  error?: string;
}

export interface LintResult {
  success: boolean;
  data?: {
    issues: Array<{
      line: number;
      column: number;
      severity: "error" | "warning";
      rule: string;
      message: string;
    }>;
  };
  error?: string;
}

export class Code {
  private synapse: Synapse;

  /**
   * Creates a new CodeStyle instance
   * @param synapse The Synapse instance for WebSocket communication
   */
  constructor(synapse: Synapse) {
    this.synapse = synapse;
  }

  private getParserForLanguage(language: string): string {
    const languageMap: Record<string, string> = {
      javascript: "babel",
      typescript: "typescript",
      json: "json",
      html: "html",
      css: "css",
      markdown: "markdown",
      yaml: "yaml",
    };

    return languageMap[language.toLowerCase()] || "babel";
  }

  private toPrettierOptions(
    language: string,
    options?: FormatOptions,
  ): Options {
    const parser = this.getParserForLanguage(language);

    return {
      parser,
      tabWidth: options?.indent || 2,
      useTabs: options?.useTabs || false,
      semi: options?.semi !== undefined ? options.semi : true,
      singleQuote: options?.singleQuote || false,
      printWidth: options?.printWidth || 80,
    };
  }

  /**
   * Format code according to specified options
   * @param code The code to format
   * @param options Formatting options
   * @returns A promise resolving to the formatting result
   */
  async format(code: string, options: FormatOptions): Promise<FormatResult> {
    try {
      if (!code || typeof code !== "string") {
        return {
          success: false,
          error: "Invalid code input: code must be a non-empty string",
        };
      }

      if (!options.language) {
        return {
          success: false,
          error: "Language must be specified in format options",
        };
      }

      const prettierOptions = this.toPrettierOptions(options.language, options);
      const formattedCode = await format(code, prettierOptions);

      return {
        success: true,
        data: formattedCode,
      };
    } catch (error) {
      return {
        success: false,
        error: `Formatting failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Lint code to identify issues
   * @param code The code to lint
   * @param options Linting options
   * @returns A promise resolving to the linting result
   */
  async lint(code: string, options: LintOptions): Promise<LintResult> {
    try {
      if (!code || typeof code !== "string") {
        return {
          success: false,
          error: "Invalid code input: code must be a non-empty string",
        };
      }

      if (!options.language) {
        return {
          success: false,
          error: "Language must be specified in lint options",
        };
      }

      const eslintOptions = {
        overrideConfig: {
          languageOptions: {
            ecmaVersion: 2020,
            sourceType: "module",
          },
          rules: options.rules || {},
        },
        overrideConfigFile: true,
      } as ESLint.Options;

      const linter = new ESLint(eslintOptions);
      const eslintResult = await linter.lintText(code);

      return {
        success: true,
        data: {
          issues: eslintResult.flatMap((result) =>
            result.messages.map((message) => ({
              line: message.line,
              column: message.column,
              severity: message.severity === 2 ? "error" : "warning",
              rule: message.ruleId || "",
              message: message.message,
            })),
          ),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Linting failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}
