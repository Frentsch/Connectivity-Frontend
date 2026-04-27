"use client";

import { ConnectButton } from "@/components/ConnectButton";
import { useListings } from "@/lib/queries";
import { ListingCard } from "@/components/ListingCard";

export default function BrowsePage() {
  const { data, isLoading, refetch } = useListings();

  const listings = data ?? [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Browse Services</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button onClick={() => refetch()} style={{ fontSize: 13 }}>↻ Refresh</button>
          <ConnectButton />
        </div>
      </div>

      {isLoading && <p>Loading listings…</p>}

      {!isLoading && listings.length === 0 && (
        <p style={{ color: "#888" }}>
          No listings yet.{" "}
          <a href="/sell">Create the first one.</a>
        </p>
      )}

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {listings.map((obj) => {
          const objectId = obj.data!.objectId;
          const fields = (obj.data!.content as any)?.fields ?? {};
          return <ListingCard key={objectId} objectId={objectId} fields={fields} />;
        })}
      </div>
    </div>
  );
}
