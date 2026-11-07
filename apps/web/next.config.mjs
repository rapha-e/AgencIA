import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@admetrics/domain",
    "@admetrics/integrations",
    "@admetrics/diagnostics",
    "@admetrics/ai",
    "@admetrics/execution"
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@admetrics/domain": path.resolve(__dirname, "../../packages/domain/dist/index.js"),
      "@admetrics/integrations": path.resolve(__dirname, "../../packages/integrations/dist/index.js"),
      "@admetrics/diagnostics": path.resolve(__dirname, "../../packages/diagnostics/dist/index.js"),
      "@admetrics/ai": path.resolve(__dirname, "../../packages/ai/dist/index.js"),
      "@admetrics/execution": path.resolve(__dirname, "../../packages/execution/dist/index.js")
    };
    return config;
  }
};

export default nextConfig;


