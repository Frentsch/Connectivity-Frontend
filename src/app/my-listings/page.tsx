"use client";

import Link from "next/link";
import { useState } from "react";
import { signAndExecute } from "@/lib/localSigner";
import { useMyListings, useMySellerEscrows, type EscrowEntry } from "@/lib/queries";
import { ListingCard } from "@/components/ListingCard";
import { buildClaimPaymentTx } from "@/lib/transactions";
import { ESCROW_STATUS_PURCHASED, ESCROW_STATUS_DELIVERED, ESCROW_GRACE_PERIOD } from "@/lib/constants";

function fmtMist(mist: number): string {
  return `${(mist / 1_000_000_000).toFixed(4)} SUI`;
}

function fmtTime(secs: number): string {
  return secs === 0 ? "—" : new Date(secs * 1000).toLocaleString();
}

function escrowStatusLabel(status: number, expiresAt: number): string {
  const now = Math.floor(Date.now() / 1000);
  if (status === ESCROW_STATUS_PURCHASED) return expiresAt > 0 && now > expiresAt ? "Expired — not redeemed" : "Awaiting redemption";
  if (status === ESCROW_STATUS_DELIVERED) return "Delivered ✓";
  return "Awaiting delivery";
}

function canClaimPayment(e: EscrowEntry): boolean {
  const now = Math.floor(Date.now() / 1000);
  return (
    (e.status === ESCROW_STATUS_DELIVERED && e.deliveredAt < e.redeemedAt + ESCROW_GRACE_PERIOD) ||
    (e.status === ESCROW_STATUS_PURCHASED && e.expiresAt > 0 && now > e.expiresAt)
  );
}

function SellerEscrowRow({ escrow, onClaimed }: { escrow: EscrowEntry; onClaimed: () => void }) {
  const [claiming, setClaiming] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleClaim() {
    setClaiming(true);
    setError(null);
    try {
      await signAndExecute(buildClaimPaymentTx(escrow.escrowId));
      onClaimed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setClaiming(false);
    }
  }

  const claimable = canClaimPayment(escrow);

  return (
    <tr style={{ borderBottom: "1px solid #eee" }}>
      <td style={{ padding: "0.6rem 1rem 0.6rem 0", fontSize: 13, fontFamily: "monospace", color: "#888" }}>
        {escrow.tokenId.slice(0, 12)}…
      </td>
      <td style={{ padding: "0.6rem 1rem 0.6rem 0", fontSize: 13 }}>{fmtMist(escrow.amount)}</td>
      <td style={{ padding: "0.6rem 1rem 0.6rem 0", fontSize: 13 }}>{fmtTime(escrow.expiresAt)}</td>
      <td style={{ padding: "0.6rem 1rem 0.6rem 0", fontSize: 13 }}>
        <span style={{ color: escrow.status === ESCROW_STATUS_DELIVERED ? "green" : "#888" }}>
          {escrowStatusLabel(escrow.status, escrow.expiresAt)}
        </span>
      </td>
      <td style={{ padding: "0.6rem 0" }}>
        {error && <span style={{ color: "red", fontSize: 12, marginRight: 8 }}>{error}</span>}
        <button
          onClick={handleClaim}
          disabled={!claimable || claiming}
          style={{ fontSize: 13, padding: "3px 12px", opacity: (!claimable || claiming) ? 0.4 : 1 }}
        >
          {claiming ? "Claiming…" : "Claim Payment"}
        </button>
      </td>
    </tr>
  );
}

export default function MyListingsPage() {
  const { data: listings = [], isLoading: listingsLoading, refetch: refetchListings } = useMyListings();
  const { data: escrows  = [], isLoading: escrowsLoading,  refetch: refetchEscrows  } = useMySellerEscrows();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>My Listings</h1>
        <button onClick={() => { refetchListings(); refetchEscrows(); }} style={{ fontSize: 13 }}>↻ Refresh</button>
      </div>

      {listingsLoading && <p>Loading listings…</p>}

      {!listingsLoading && listings.length === 0 && (
        <p style={{ color: "#888" }}>
          No active listings.{" "}
          <Link href="/sell" style={{ color: "#4DA2FF" }}>Create one →</Link>
        </p>
      )}

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", marginBottom: "2rem" }}>
        {listings.map((obj) => {
          const objectId = obj.data!.objectId;
          const fields   = (obj.data!.content as any)?.fields ?? {};
          return (
            <ListingCard key={objectId} objectId={objectId} fields={fields} manageHref={`/my-listings/${objectId}`} />
          );
        })}
      </div>

      <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Escrow Payments</h2>
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
                <th style={{ padding: "0.5rem 0",             fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {escrows.map((e) => (
                <SellerEscrowRow key={e.escrowId} escrow={e} onClaimed={refetchEscrows} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
