import { FlatCompat } from "@eslint/eslintrc";
import { createRequire } from "node:module";
import { dirname } from "node:path";
const require = createRequire(import.meta.url);
const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  resolvePluginsRelativeTo: dirname(require.resolve("eslint-config-next")),
});
const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["scripts/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "public/**",
      "data/**",
    ],
  },
];

export default config;
