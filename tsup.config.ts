import { defineConfig } from "tsup";

const shared = {
  target: "node18",
  sourcemap: true,
  outDir: "dist",
};

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    outExtension({ format }) {
      return { js: format === "cjs" ? ".cjs" : ".js" };
    },
    ...shared,
  },
]);
