import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/dictionary": ["./data/ecdict/shards/**/*.json"],
  },
};
export default config;
