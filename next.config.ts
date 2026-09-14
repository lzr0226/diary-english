import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  ...(process.env.NEXT_STANDALONE === "1"
    ? { output: "standalone" as const }
    : {}),
  serverExternalPackages: ["@cloudbase/node-sdk"],
  outputFileTracingIncludes: {
    "/api/dictionary": ["./data/ecdict/shards/**/*.json"],
  },
};
export default config;
