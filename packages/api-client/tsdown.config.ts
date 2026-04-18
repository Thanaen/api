import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  platform: "neutral",
  outDir: "dist",
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,
});
