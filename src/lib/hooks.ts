"use client";

import { useRef } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { dAppKit } from "./dappkit";
import { useUserSecret } from "./queries";
import { makeSealClient, encryptNewMasterSecret, decryptMasterSecret } from "./masterSecret";
import { buildRegisterSecretTx } from "./transactions";
import type { SealClient } from "@mysten/seal";

/**
 * Provides two things:
 *
 *  publicKey       — the user's X25519 public key read directly from the
 *                    UserSecret on-chain object.  Available without any wallet
 *                    interaction; pass it straight into buildRedeemTx.
 *
 *  getMasterSecret — lazily decrypts (one Seal round-trip / wallet sign) and
 *                    caches the master secret.  Only needed for ECIES decryption.
 *
 * First-time setup (no UserSecret on-chain): calling getMasterSecret triggers
 * the one-time generate → Seal-encrypt → register_secret flow automatically.
 */
export function useMasterSecret() {
  const account = useCurrentAccount();
  const { data: userSecret, refetch: refetchSecret } = useUserSecret(account?.address);
  const cachedRef     = useRef<Uint8Array | null>(null);
  const sealClientRef = useRef<SealClient | null>(null);

  function getSealClient(): SealClient {
    if (!sealClientRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sealClientRef.current = makeSealClient(dAppKit.getClient() as any);
    }
    return sealClientRef.current;
  }

  async function getMasterSecret(): Promise<Uint8Array> {
    if (cachedRef.current) return cachedRef.current;
    if (!account) throw new Error("Wallet not connected");

    const sealClient = getSealClient();

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
  }

  return {
    // Readily available for redeem — no wallet interaction needed
    publicKey: userSecret?.publicKey ?? null,
    getMasterSecret,
  };
}
