"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface WalletCtx { address: string | null }
const LocalWalletContext = createContext<WalletCtx>({ address: null });

export function LocalWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/wallet")
      .then(r => r.json())
      .then((d: { address: string }) => setAddress(d.address))
      .catch(() => setAddress(null));
  }, []);
  return (
    <LocalWalletContext.Provider value={{ address }}>
      {children}
    </LocalWalletContext.Provider>
  );
}

export const useLocalWallet = () => useContext(LocalWalletContext);
