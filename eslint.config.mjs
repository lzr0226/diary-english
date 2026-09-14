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
    files: ["scripts/*.cjs", "tencent/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      ".pnpm-store/**",
      "next-env.d.ts",
      "public/**",
      "data/**",
      "tencent/cloudfunctions/diaryApi/core.cjs",
      "tencent/**/node_modules/**",
    ],
  },
];

export default config;
