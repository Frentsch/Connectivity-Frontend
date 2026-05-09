"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dAppKit } from "@/lib/dappkit";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { buildPurchaseTx } from "@/lib/transactions";
import { fetchOwnedTokenIds } from "@/lib/queries";

interface Props {
  listingId:    string;
  tokenId?:     string;
  priceMist:    bigint;
  maxPriceMist: bigint;
  validFrom:    bigint;
  expiresAt:    bigint;
  bandwidth:    bigint;
  disabled?:    boolean;
}

export function BuyButton({ listingId, tokenId, maxPriceMist, validFrom, expiresAt, bandwidth, disabled }: Props) {
  const account = useCurrentAccount();
  const router  = useRouter();
  const [isPending, setIsPending] = useState(false);

  if (!account) return <p>Connect your wallet to purchase.</p>;

  return (
    <button
      onClick={async () => {
        const tx = buildPurchaseTx({ listingId, start: validFrom, end: expiresAt, bandwidth, maxPriceMist });
        setIsPending(true);
        try {
          await dAppKit.signAndExecuteTransaction({ transaction: tx });

          if(tokenId!=null)router.push(`/tokens/${tokenId}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          let details = "";
          try {
            // Pure inputs are BCS-encoded little-endian u64 stored as base64.
            // Input order matches buildPurchaseTx: [0]=maxPriceMist, [1]=MARKETPLACE_ID obj,
            // [2]=listingId addr, [3]=start, [4]=end, [5]=bandwidth
            const decodeBcsU64 = (b64: string): bigint => {
              const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
              let v = 0n;
              for (let i = 0; i < 8; i++) v |= BigInt(bytes[i]) << BigInt(i * 8);
              return v;
            };
            const inp = tx.getData().inputs;
            const pure = (idx: number) => {
              const input = inp[idx] as { Pure?: { bytes: string } };
              return input.Pure ? decodeBcsU64(input.Pure.bytes) : null;
            };
            const maxPrice = pure(0);
            const start    = pure(3);
            const end      = pure(4);
            const bw       = pure(5);
            details = "\n\nTransaction inputs:\n" + [
              `Split coin (maxPrice): ${maxPrice != null ? (Number(maxPrice) / 1e9).toFixed(6) + " SUI" : "?"}`,
              `Bandwidth:             ${bw       != null ? bw + " kB/s" : "?"}`,
              `From: ${start != null ? new Date(Number(start) * 1000).toISOString() : "?"}`,
              `To:   ${end   != null ? new Date(Number(end)   * 1000).toISOString() : "?"}`,
            ].join("\n");
          } catch { /* ignore parse errors, original error still shown */ }
          alert(`Purchase failed: ${msg}${details}`);
        } finally {
          setIsPending(false);
        }
      }}
      disabled={isPending || disabled}
      style={{ padding: "0.75rem 2rem", fontSize: "1rem" }}
    >
      {isPending ? "Processing…" : `Buy for ${(Number(maxPriceMist) / 1e9).toFixed(4)} SUI`}
    </button>
  );
}
