"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { MasterSecretProvider } from "@/lib/MasterSecretContext";
import { LocalWalletProvider } from "@/lib/LocalWalletContext";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <LocalWalletProvider>
        <MasterSecretProvider>
          {children}
        </MasterSecretProvider>
      </LocalWalletProvider>
    </QueryClientProvider>
  );
}
