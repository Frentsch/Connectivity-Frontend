"use client";

import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useMyListings } from "@/lib/queries";
import { ListingCard } from "@/components/ListingCard";

export default function MyListingsPage() {
  const account = useCurrentAccount();
  const { data, isLoading, refetch } = useMyListings();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>My Listings</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button onClick={() => refetch()} style={{ fontSize: 13 }}>↻ Refresh</button>
          <ConnectButton />
        </div>
      </div>

      {!account && <p style={{ color: "#888" }}>Connect your wallet to view your listings.</p>}

      {account && isLoading && <p>Loading listings…</p>}

      {account && !isLoading && data.length === 0 && (
        <p style={{ color: "#888" }}>
          No active listings.{" "}
          <Link href="/sell" style={{ color: "#4DA2FF" }}>Create one →</Link>
        </p>
      )}

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {data.map((obj) => {
          const objectId = obj.data!.objectId;
          const fields   = (obj.data!.content as any)?.fields ?? {};
          return (
            <ListingCard
              key={objectId}
              objectId={objectId}
              fields={fields}
              manageHref={`/my-listings/${objectId}`}
            />
          );
        })}
      </div>
    </div>
  );
}
