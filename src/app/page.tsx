"use client";

import { ConnectButton } from "@/components/ConnectButton";
import { useListings } from "@/lib/queries";
import { ListingCard } from "@/components/ListingCard";

export default function BrowsePage() {
  const { data, isLoading, refetch } = useListings();

  const nowSecs = Math.floor(Date.now() / 1000);
  const listings = (data ?? []).filter((obj) => {
    const fields = (obj.data?.content as any)?.fields ?? {};
    const token  = fields.token?.fields ?? fields.token ?? {};
    const expiresAt = Number(token.expires_at ?? 0);
    return expiresAt === 0 || expiresAt > nowSecs;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Browse Listings</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button onClick={() => refetch()} style={{ fontSize: 13 }}>↻ Refresh</button>
          <ConnectButton />
        </div>
      </div>

      {isLoading && <p>Loading listings…</p>}

      {!isLoading && listings.length === 0 && (
        <p style={{ color: "#888" }}>
          No listings yet.{" "}
          {/*<a href="/sell">Create the first one.</a>*/}
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
