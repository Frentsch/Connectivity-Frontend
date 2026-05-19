"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, ReactNode } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { dAppKit } from "./dappkit";
import { useUserSecret } from "./queries";
import { makeSealClient, encryptNewMasterSecret, decryptMasterSecret } from "./masterSecret";
import { buildRegisterSecretTx } from "./transactions";
import type { SealClient } from "@mysten/seal";

interface MasterSecretContextValue {
  getMasterSecret: () => Promise<Uint8Array>;
  publicKey: Uint8Array | null;
}

const MasterSecretContext = createContext<MasterSecretContextValue | null>(null);

export function MasterSecretProvider({ children }: { children: ReactNode }) {
  const account = useCurrentAccount();
  const { data: userSecret, refetch: refetchSecret } = useUserSecret(account?.address);
  const cachedRef     = useRef<Uint8Array | null>(null);
  const sealClientRef = useRef<SealClient | null>(null);

  // Drop the cached secret whenever the connected wallet account changes.
  useEffect(() => {
    cachedRef.current     = null;
    sealClientRef.current = null;
  }, [account?.address]);

  const getMasterSecret = useCallback(async (): Promise<Uint8Array> => {
    if (cachedRef.current) return cachedRef.current;
    if (!account) throw new Error("Wallet not connected");

    if (!sealClientRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sealClientRef.current = makeSealClient(dAppKit.getClient() as any);
    }
    const sealClient = sealClientRef.current;

    if (!userSecret) {
      // First-time setup — generate, encrypt, and store the master secret
      const { masterSecret, publicKey, encryptedSecret } = await encryptNewMasterSecret(
        sealClient,
        account.address,
      );
      await dAppKit.signAndExecuteTransaction({
        transaction: buildRegisterSecretTx(publicKey, encryptedSecret),
      });
      await refetchSecret();
      cachedRef.current = masterSecret;
      return masterSecret;
    }

    // Returning user — decrypt existing secret (one wallet sign for SessionKey)
    const secret = await decryptMasterSecret({
      sealClient,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      suiClient:           dAppKit.getClient() as any,
      address:             account.address,
      encryptedSecret:     userSecret.encryptedSecret,
      signPersonalMessage: async (msg) => dAppKit.signPersonalMessage({ message: msg }),
    });
    cachedRef.current = secret;
    return secret;
  }, [account, userSecret, refetchSecret]);

  const value = useMemo<MasterSecretContextValue>(
    () => ({ getMasterSecret, publicKey: userSecret?.publicKey ?? null }),
    [getMasterSecret, userSecret?.publicKey],
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
