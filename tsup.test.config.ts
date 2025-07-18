import { esbuildPluginFilePathExtensions } from "esbuild-plugin-file-path-extensions";
import { defineConfig, type Options } from "tsup";

const commonConfig: Options = {
  sourcemap: true,
  clean: true,
  dts: false,
  treeshake: true,
  target: "node16",
  entry: ["src/**/*.ts", "tests/**/*.ts"],
  outDir: "dist",
};

export default defineConfig([
  {
    ...commonConfig,
    format: "esm",
    esbuildPlugins: [esbuildPluginFilePathExtensions({ filter: /^\./ })],
    bundle: true,
    // Yes, bundle: true => https://github.com/favware/esbuild-plugin-file-path-extensions?tab=readme-ov-file#usage
  },
  {
    ...commonConfig,
    format: "cjs",
    bundle: false,
  },
]);
