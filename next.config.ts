import type { NextConfig } from "next";

const deploymentDescription = (process.env.VERCEL_GIT_COMMIT_MESSAGE
  ?? "Fix benchmark navigation and calculation fidelity").split(/\r?\n/, 1)[0].trim();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_ALPHA_DEPLOYED_AT: new Date().toISOString(),
    NEXT_PUBLIC_ALPHA_DEPLOYMENT_DESCRIPTION: deploymentDescription
  }
};

export default nextConfig;
