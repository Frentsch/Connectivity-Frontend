import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@mysten/bcs",
    "@mysten/dapp-kit-core",
    "@mysten/dapp-kit-react",
    "@mysten/seal",
    "@mysten/slush-wallet",
    "@mysten/sui",
    "@mysten/utils",
    "@mysten/wallet-standard",
    "@mysten/walrus",
    "@mysten/window-wallet-core",
    "@noble/curves",
    "@noble/hashes",
    "@wallet-standard/ui",
    "@wallet-standard/ui-registry",
    "nanostores",
  ],
};

export default nextConfig;
