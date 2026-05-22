"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { x25519 } from "@noble/curves/ed25519";

interface MasterSecretContextValue {
  getMasterSecret: () => Promise<Uint8Array>;
  publicKey: Uint8Array | null;
}

const MasterSecretContext = createContext<MasterSecretContextValue | null>(null);

export function MasterSecretProvider({ children }: { children: ReactNode }) {
  const cachedRef = useRef<Uint8Array | null>(null);
  const [publicKey, setPublicKey] = useState<Uint8Array | null>(null);

  // Eagerly load the secret on mount so publicKey is available without waiting
  // for the first getMasterSecret() call.
  useEffect(() => {
    fetch("/api/master-secret")
      .then(r => r.json())
      .then((d: { secret: string }) => {
        const secret = Uint8Array.from(Buffer.from(d.secret, "base64"));
        cachedRef.current = secret;
        setPublicKey(x25519.getPublicKey(secret));
      })
      .catch(console.error);
  }, []);

  const getMasterSecret = useCallback(async (): Promise<Uint8Array> => {
    if (cachedRef.current) return cachedRef.current;
    const { secret } = await fetch("/api/master-secret").then(r => r.json()) as { secret: string };
    const bytes = Uint8Array.from(Buffer.from(secret, "base64"));
    cachedRef.current = bytes;
    setPublicKey(x25519.getPublicKey(bytes));
    return bytes;
  }, []);

  const value = useMemo<MasterSecretContextValue>(
    () => ({ getMasterSecret, publicKey }),
    [getMasterSecret, publicKey],
  );

  return (
    <MasterSecretContext.Provider value={value}>
      {children}
    </MasterSecretContext.Provider>
  );
}

export function useMasterSecret() {
  const ctx = useContext(MasterSecretContext);
  if (!ctx) throw new Error("useMasterSecret must be used inside MasterSecretProvider");
  return ctx;
}
