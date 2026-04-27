"use client";

import { ConnectButton } from "@/components/ConnectButton";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useMyTokens, useMyAccessKeys } from "@/lib/queries";
import { TokenCard } from "@/components/TokenCard";
import { AccessKeyCard } from "@/components/AccessKeyCard";

export default function TokensPage() {
  const account = useCurrentAccount();
  const { data: tokensData, isLoading: tokensLoading } = useMyTokens();
  const { data: keysData,   isLoading: keysLoading   } = useMyAccessKeys();

  const tokens = tokensData?.data ?? [];
  const keys   = keysData?.data   ?? [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>My Tokens</h1>
        <ConnectButton />
      </div>

      {!account && <p>Connect your wallet to view your tokens.</p>}

      {/* ── Access Tokens ─────────────────────────────────────────────────── */}
      {account && (
        <>
          <h2 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.1rem" }}>Access Tokens</h2>

          {tokensLoading && <p>Loading…</p>}

          {!tokensLoading && tokens.length === 0 && (
            <p style={{ color: "#888" }}>
              No access tokens yet.{" "}
              <a href="/">Browse services</a> to purchase one.
            </p>
          )}

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", marginBottom: "2rem" }}>
            {tokens.map((obj) =>
              obj.data ? (
                <TokenCard
                  key={obj.data.objectId}
                  tokenObject={obj.data as Parameters<typeof TokenCard>[0]["tokenObject"]}
                />
              ) : null
            )}
          </div>
        </>
      )}

      {/* ── Access Keys (persistent on-chain after redemption delivery) ────── */}
      {account && (
        <>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>Access Keys</h2>

          {keysLoading && <p>Loading…</p>}

          {!keysLoading && keys.length === 0 && (
            <p style={{ color: "#888" }}>
              No access keys yet. Redeem an access token to receive one.
            </p>
          )}

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {keys.map((obj) =>
              obj.data ? (
                <AccessKeyCard
                  key={obj.data.objectId}
                  accessKeyObject={obj.data as Parameters<typeof AccessKeyCard>[0]["accessKeyObject"]}
                />
              ) : null
            )}
          </div>
        </>
      )}
    </div>
  );
}
