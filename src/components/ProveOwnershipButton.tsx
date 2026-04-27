"use client";

import { useState } from "react";
import { useSignPersonalMessage, useCurrentAccount } from "@mysten/dapp-kit";
import { buildChallengeMessage, encodeChallenge } from "@/lib/proof";

interface Props {
  tokenId: string;
  listingId?: string;
  /** Off-chain JWT issuer endpoint registered by the seller (e.g. from metadata_uri JSON) */
  serviceEndpoint: string;
}

type State = "idle" | "fetching-nonce" | "signing" | "verifying" | "done" | "error";

export function ProveOwnershipButton({ tokenId, listingId, serviceEndpoint }: Props) {
  const account = useCurrentAccount();
  const { mutateAsync: signMessage } = useSignPersonalMessage();
  const [state, setState] = useState<State>("idle");
  const [jwt, setJwt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleProve() {
    if (!account) return;
    setError(null);
    setJwt(null);

    try {
      // 1. Get a fresh nonce from the service
      setState("fetching-nonce");
      const challengeRes = await fetch(`${serviceEndpoint}/challenge?tokenId=${encodeURIComponent(tokenId)}`);
      if (!challengeRes.ok) throw new Error(`Challenge request failed: ${challengeRes.status}`);
      const { nonce, expiresAtMs } = await challengeRes.json();

      // 2. Build and sign the deterministic challenge message
      setState("signing");
      const message = buildChallengeMessage({ tokenId, nonce, serviceEndpoint, expiresAtMs });
      const { signature, bytes } = await signMessage({ message: encodeChallenge(message) });

      // 3. Submit proof to the service
      setState("verifying");
      const verifyRes = await fetch(`${serviceEndpoint}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId,
          listingId,
          walletAddress: account.address,
          message: bytes,
          signature,
          nonce,
        }),
      });
      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({}));
        throw new Error(body.error ?? `Verification failed: ${verifyRes.status}`);
      }

      const { jwt: receivedJwt } = await verifyRes.json();
      setJwt(receivedJwt);
      setState("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  const labels: Record<State, string> = {
    idle: "Prove Ownership & Get JWT",
    "fetching-nonce": "Requesting challenge…",
    signing: "Sign in wallet…",
    verifying: "Verifying…",
    done: "Done",
    error: "Retry",
  };

  return (
    <div>
      <button onClick={handleProve} disabled={state !== "idle" && state !== "error"}>
        {labels[state]}
      </button>
      {error && <p style={{ color: "red", fontSize: 13, marginTop: 8 }}>Error: {error}</p>}
      {jwt && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "green", margin: 0 }}>JWT received — use as Bearer token:</p>
          <textarea
            readOnly
            value={jwt}
            rows={4}
            style={{ width: "100%", fontFamily: "monospace", fontSize: 11, marginTop: 4 }}
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
        </div>
      )}
    </div>
  );
}
