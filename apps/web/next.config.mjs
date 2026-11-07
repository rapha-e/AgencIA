/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@admetrics/domain",
    "@admetrics/integrations",
    "@admetrics/diagnostics",
    "@admetrics/ai",
    "@admetrics/execution"
  ]
};

export default nextConfig;

