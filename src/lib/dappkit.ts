import { createDAppKit } from "@mysten/dapp-kit-core";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { DEFAULT_NETWORK } from "./constants";

// Singleton — only initialized in the browser (Providers.tsx is ssr:false)
export const dAppKit =
  typeof window !== "undefined"
    ? createDAppKit({
        networks: ["testnet", "devnet", "mainnet"] as const,
        createClient: (network) =>
          new SuiJsonRpcClient({
            url: getJsonRpcFullnodeUrl(network),
            network,
          }),
        defaultNetwork: DEFAULT_NETWORK,
        autoConnect: true,
      })
    : (null as unknown as ReturnType<typeof createDAppKit>);
