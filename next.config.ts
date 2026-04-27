import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@mysten/bcs",
    "@mysten/dapp-kit-core",
    "@mysten/dapp-kit-react",
    "@mysten/slush-wallet",
    "@mysten/sui",
    "@mysten/utils",
    "@mysten/wallet-standard",
    "@mysten/window-wallet-core",
    "@wallet-standard/ui",
    "@wallet-standard/ui-registry",
    "nanostores",
  ],
};

export default nextConfig;
