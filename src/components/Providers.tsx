"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { ReactNode, useState } from "react";
import { dAppKit } from "@/lib/dappkit";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        {children}
      </DAppKitProvider>
    </QueryClientProvider>
  );
}
