import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Next keeps "jsx": "preserve" for the compiler. Vitest still has to parse
  // the comment-card component, which is the only TSX under test.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    environment: "happy-dom",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
