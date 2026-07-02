import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    // Build output, deps, generated code, and standalone scripts are not linted.
    // Without this, eslint walks .next/ and generated-blog-data.ts and reports
    // tens of thousands of errors in code we never hand-author.
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "**/node_modules/**",
      "lib/generated-blog-data.ts",
      "scripts/**",
      "create-coinbase-webhook.js",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
