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

export function BuyButton({ listingId, tokenId, priceMist, maxPriceMist, validFrom, expiresAt, bandwidth, disabled }: Props) {
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
          alert(`Purchase failed: ${err instanceof Error ? err.message : "Unknown error"}`);
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
