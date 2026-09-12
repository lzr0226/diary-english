const fs = require("node:fs");
const path = require("node:path");
fs.mkdirSync("public", { recursive: true });
const base = path.dirname(require.resolve("pdfjs-dist/package.json"));
fs.copyFileSync(
  path.join(base, "build/pdf.worker.min.mjs"),
  "public/pdf.worker.min.mjs",
);
