const { createRequire } = require("node:module");
const esbuild = createRequire(require.resolve("tsx"))("esbuild");
esbuild.buildSync({
  entryPoints: ["tencent/backend/domain.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outfile: "tencent/cloudfunctions/diaryApi/core.cjs",
  external: ["nodemailer"],
  legalComments: "none",
});
console.log(
  "Cloud function core built from shared Web domain, validation, AI, mail and ASR modules.",
);
