"use client";

import { useState } from "react";
import { dAppKit } from "@/lib/dappkit";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { buildPurchaseTx } from "@/lib/transactions";

interface Props {
  listingId: string;
  priceMist: bigint;
  validFrom: bigint;
  expiresAt: bigint;
  bandwidth: bigint;
}

export function BuyButton({ listingId, priceMist, validFrom, expiresAt, bandwidth }: Props) {
  const account = useCurrentAccount();
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!account) return <p>Connect your wallet to purchase.</p>;
  if (isSuccess) return <p style={{ color: "green" }}>Purchased! Check <a href="/tokens">My Tokens</a>.</p>;

  return (
    <button
      onClick={async () => {
        const tx = buildPurchaseTx({ listingId, start: validFrom, end: expiresAt, bandwidth });
        setIsPending(true);
        try {
          const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
          console.log("Purchased:", result.$kind === "Transaction" ? result.Transaction.digest : result);
          setIsSuccess(true);
        } catch (err: unknown) {
          alert(`Purchase failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
          setIsPending(false);
        }
      }}
      disabled={isPending}
      style={{ padding: "0.75rem 2rem", fontSize: "1rem" }}
    >
      {isPending ? "Processing…" : `Buy for ${(Number(priceMist) / 1e9).toFixed(4)} SUI`}
    </button>
  );
}
