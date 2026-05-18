"use client";

import { useState } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useMyTokens, useMyAccessKeys, useMyBuyerEscrows, type EscrowEntry } from "@/lib/queries";
import { TokenCard } from "@/components/TokenCard";
import { AccessKeyCard } from "@/components/AccessKeyCard";
import { dAppKit } from "@/lib/dappkit";
import { buildClaimRefundTx } from "@/lib/transactions";
import { ESCROW_STATUS_DELIVERED, ESCROW_STATUS_REDEEMED, ESCROW_GRACE_PERIOD} from "@/lib/constants";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMist(mist: number): string {
  return `${(mist / 1_000_000_000).toFixed(4)} SUI`;
}

function fmtTime(secs: number): string {
  return secs === 0 ? "—" : new Date(secs * 1000).toLocaleString();
}

function escrowStatusLabel(status: number): string {
  if (status === 0) return "Awaiting redemption";
  if (status === 1) return "Awaiting delivery";
  return "Delivered ✓";
}

function canClaimRefund(e: EscrowEntry): boolean {
  const now = Math.floor(Date.now() / 1000);
  return (e.status === ESCROW_STATUS_REDEEMED && e.expiresAt > 0 && now > e.expiresAt && now > e.redeemedAt + ESCROW_GRACE_PERIOD) 
  || (e.status === ESCROW_STATUS_DELIVERED && e.deliveredAt >= e.redeemedAt + ESCROW_GRACE_PERIOD) ;
}

// ── Escrow row ────────────────────────────────────────────────────────────────

function BuyerEscrowRow({ escrow, onRefunded }: { escrow: EscrowEntry; onRefunded: () => void }) {
  const [claiming, setClaiming] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleRefund() {
    setClaiming(true);
    setError(null);
    try {
      await dAppKit.signAndExecuteTransaction({ transaction: buildClaimRefundTx(escrow.escrowId) });
      onRefunded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setClaiming(false);
    }
  }

  const refundable = canClaimRefund(escrow);

  return (
    <tr style={{ borderBottom: "1px solid #eee" }}>
      <td style={{ padding: "0.6rem 1rem 0.6rem 0", fontSize: 13, fontFamily: "monospace", color: "#888" }}>
        {escrow.tokenId.slice(0, 12)}…
      </td>
      <td style={{ padding: "0.6rem 1rem 0.6rem 0", fontSize: 13 }}>
        {fmtMist(escrow.amount)}
      </td>
      <td style={{ padding: "0.6rem 1rem 0.6rem 0", fontSize: 13 }}>
        {fmtTime(escrow.expiresAt)}
      </td>
      <td style={{ padding: "0.6rem 1rem 0.6rem 0", fontSize: 13 }}>
        <span style={{ color: escrow.status === 2 ? "green" : "#888" }}>
          {escrowStatusLabel(escrow.status)}
        </span>
      </td>
      
      <td style={{ padding: "0.6rem 1rem 0.6rem 0", fontSize: 13 }}>
        {fmtTime(escrow.redeemedAt)}
      </td>
      <td style={{ padding: "0.6rem 1rem 0.6rem 0", fontSize: 13 }}>
        {fmtTime(escrow.deliveredAt)}
      </td>
      <td style={{ padding: "0.6rem 0" }}>
        {error && <span style={{ color: "red", fontSize: 12, marginRight: 8 }}>{error}</span>}
        <button
          onClick={handleRefund}
          disabled={!refundable || claiming}
          style={{ fontSize: 13, padding: "3px 12px", opacity: (!refundable || claiming) ? 0.4 : 1 }}
          title={!refundable ? "Claimable after token expiry if delivery was never made" : undefined}
        >
          {claiming ? "Claiming…" : "Claim Refund"}
        </button>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TokensPage() {
  const account = useCurrentAccount();
  const { data: tokensData, isLoading: tokensLoading }             = useMyTokens();
  const { data: keysData,   isLoading: keysLoading   }             = useMyAccessKeys();
  const { data: escrows = [], isLoading: escrowsLoading, refetch } = useMyBuyerEscrows();

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

      {/* ── Access Keys ───────────────────────────────────────────────────── */}
      {account && (
        <>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>Access Keys</h2>

          {keysLoading && <p>Loading…</p>}

          {!keysLoading && keys.length === 0 && (
            <p style={{ color: "#888" }}>
              No access keys yet. Redeem an access token to receive one.
            </p>
          )}

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", marginBottom: "2rem" }}>
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

      {/* ── Escrow refunds ────────────────────────────────────────────────── */}
      {account && (
        <>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>Escrow Payments</h2>

          {escrowsLoading && <p>Loading…</p>}

          {!escrowsLoading && escrows.length === 0 && (
            <p style={{ color: "#888", fontSize: 14 }}>No pending escrow payments.</p>
          )}

          {!escrowsLoading && escrows.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
                    <th style={{ padding: "0.5rem 1rem 0.5rem 0", fontWeight: 600 }}>Token</th>
                    <th style={{ padding: "0.5rem 1rem 0.5rem 0", fontWeight: 600 }}>Amount</th>
                    <th style={{ padding: "0.5rem 1rem 0.5rem 0", fontWeight: 600 }}>Expires</th>
                    <th style={{ padding: "0.5rem 1rem 0.5rem 0", fontWeight: 600 }}>Status</th>
                    <th style={{ padding: "0.5rem 1rem 0.5rem 0", fontWeight: 600 }}>Redeemed at</th>
                    <th style={{ padding: "0.5rem 1rem 0.5rem 0", fontWeight: 600 }}>Delivered at</th>
                    <th style={{ padding: "0.5rem 0",             fontWeight: 600 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {escrows.map((e) => (
                    <BuyerEscrowRow key={e.escrowId} escrow={e} onRefunded={refetch} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
