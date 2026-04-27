"use client";

import { useState } from "react";
import { dAppKit } from "@/lib/dappkit";
import { buildCreateAccessTokenTx } from "@/lib/transactions";

export function CreateListingForm() {
  const [name, setName]               = useState("");
  const [ipAddress, setIpAddress]     = useState("");
  const [expiresAt, setExpiresAt]     = useState("");
  const [maxBandwidth, setMaxBandwidth] = useState("");
  const [isPending, setIsPending]     = useState(false);
  const [tokenId, setTokenId]         = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const validFrom  = BigInt(Math.floor(Date.now() / 1000));
    const expiresAtSecs = BigInt(Math.floor(new Date(expiresAt).getTime() / 1000));
    const bw = BigInt(parseInt(maxBandwidth, 10));

    const tx = buildCreateAccessTokenTx({
      name,
      ipAddress,
      validFrom,
      expiresAt: expiresAtSecs,
      maxBandwidth: bw,
    });

    try {
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "Transaction") {
        // Find the created AccessToken object in objectChanges
        const change = (result.Transaction as any).objectChanges?.find(
          (c: any) => c.type === "created" && c.objectType?.includes("::access_token::AccessToken")
        );
        setTokenId(change?.objectId ?? result.Transaction.digest);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setIsPending(false);
    }
  }

  if (tokenId) {
    return (
      <div>
        <p style={{ color: "green" }}>Access token created!</p>
        <p style={{ fontSize: 13, marginBottom: "0.5rem" }}>Token ID:</p>
        <code style={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>
          {tokenId}
        </code>
        <p style={{ fontSize: 13, color: "#666", marginTop: "0.75rem" }}>
          Use this token ID with <code>create-listing</code> to list it on the marketplace.
        </p>
        <button style={{ marginTop: "0.5rem" }} onClick={() => { setTokenId(null); }}>
          Create another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 420 }}>
      <label>
        Service Name
        <input
          style={{ display: "block", width: "100%", marginTop: 4 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Premium API Access"
          required
        />
      </label>
      <label>
        Service Endpoint
        <input
          style={{ display: "block", width: "100%", marginTop: 4 }}
          value={ipAddress}
          onChange={(e) => setIpAddress(e.target.value)}
          placeholder="127.0.0.1:8080"
          required
        />
      </label>
      <label>
        Expires At
        <input
          style={{ display: "block", width: "100%", marginTop: 4 }}
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          required
        />
      </label>
      <label>
        Max Bandwidth (kB/s)
        <input
          style={{ display: "block", width: "100%", marginTop: 4 }}
          type="number"
          min="1"
          step="1"
          value={maxBandwidth}
          onChange={(e) => setMaxBandwidth(e.target.value)}
          placeholder="100"
          required
        />
      </label>
      {error && <p style={{ color: "red", fontSize: 13, margin: 0 }}>{error}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create Access Token"}
      </button>
    </form>
  );
}
