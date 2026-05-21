"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dAppKit } from "@/lib/dappkit";
import { buildCreateAndListTx } from "@/lib/transactions";

function toDatetimeLocal(unixSecs: number): string {
  const d = new Date(unixSecs * 1000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const nowSecs  = () => Math.floor(Date.now() / 1000);
const suiToMist = (sui: string) => BigInt(Math.round((parseFloat(sui) || 0) * 1e9));

const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3, fontSize: 13 };
const inputStyle: React.CSSProperties = { padding: "0.3rem 0.4rem", fontSize: 13, marginTop: 2 };

export function CreateListingForm() {
  const router = useRouter();

  // ── token fields ──────────────────────────────────────────────────────────────
  const [name,         setName]         = useState("");
  const [ipAddress,    setIpAddress]    = useState("");
  const [loginServer,  setLoginServer]  = useState("");
  const [validFrom,    setValidFrom]    = useState(toDatetimeLocal(nowSecs()));
  const [expiresAt,    setExpiresAt]    = useState(toDatetimeLocal(nowSecs() + 3_600));
  const [maxBandwidth, setMaxBandwidth] = useState("100");

  // ── listing fields ────────────────────────────────────────────────────────────
  const [unitPriceMist,  setUnitPriceMist]  = useState("28"); // MIST per (kB/s × second)
  const [minPriceSui,    setMinPriceSui]    = useState("0");
  const [minBandwidth,   setMinBandwidth]   = useState("10");
  const [minDuration,    setMinDuration]    = useState("60");
  const [bwGranularity,  setBwGranularity]  = useState("10");
  const [timeGranularity, setTimeGranularity] = useState("60");

  // ── status ────────────────────────────────────────────────────────────────────
  const [isPending, setIsPending] = useState(false);
  const [listingId, setListingId] = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const tx = buildCreateAndListTx({
        name,
        ipAddress,
        loginServer,
        validFrom:       BigInt(Math.floor(new Date(validFrom).getTime() / 1000)),
        expiresAt:       BigInt(Math.floor(new Date(expiresAt).getTime() / 1000)),
        maxBandwidth:    BigInt(parseInt(maxBandwidth, 10)),
        priceMist:       BigInt(parseInt(unitPriceMist, 10) || 0),
        minPriceMist:    suiToMist(minPriceSui),
        minBandwidth:    BigInt(parseInt(minBandwidth, 10)),
        minDuration:     BigInt(parseInt(minDuration, 10)),
        bwGranularity:   BigInt(parseInt(bwGranularity, 10)),
        timeGranularity: BigInt(parseInt(timeGranularity, 10)),
      });

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "Transaction") {
        const digest = result.Transaction.digest;
        const full = await dAppKit.getClient().core.getTransaction({
          digest,
          include: { effects: true, objectTypes: true },
        });
        if (full.$kind === "Transaction") {
          const { effects, objectTypes } = full.Transaction;
          const listing = effects?.changedObjects
            .filter(o => o.idOperation === "Created")
            .find(o => objectTypes?.[o.objectId]?.includes("::marketplace::ServiceListing"));
          setListingId(listing?.objectId ?? digest);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setIsPending(false);
    }
  }

  if (listingId) {
    return (
      <div>
        <p style={{ color: "green", fontWeight: 600, marginBottom: "0.5rem" }}>✓ Listing created!</p>
        <p style={{ fontSize: 13, color: "#555", marginBottom: "0.25rem" }}>Listing ID:</p>
        <code style={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>{listingId}</code>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          <button onClick={() => router.push(`/listings/${listingId}`)}>View listing</button>
          <button onClick={() => { setListingId(null); setError(null); }}>Create another</button>
        </div>
      </div>
    );
  }

  const totalForFullListing = (() => {
    const unitMist = parseInt(unitPriceMist, 10) || 0;
    const bw       = parseInt(maxBandwidth, 10)  || 0;
    const durSecs  = Math.max(0,
      Math.floor(new Date(expiresAt).getTime()  / 1000) -
      Math.floor(new Date(validFrom).getTime() / 1000)
    );
    return (unitMist * bw * durSecs / 1e9).toFixed(4);
  })();

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.9rem", maxWidth: 480 }}>

      <fieldset style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.75rem 1rem" }}>
        <legend style={{ fontSize: 12, color: "#888", padding: "0 0.25rem" }}>Access Token</legend>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

          <label style={labelStyle}>
            Service Name
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)}
              placeholder="ETH Scion Access" required />
          </label>

          <label style={labelStyle}>
            Service Endpoint
            <input style={inputStyle} value={ipAddress} onChange={e => setIpAddress(e.target.value)}
              placeholder="127.0.0.1:8080" required />
          </label>

          <label style={labelStyle}>
            Login Server URL
            <input style={inputStyle} value={loginServer} onChange={e => setLoginServer(e.target.value)}
              placeholder="https://headscale.example.com" required />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <label style={labelStyle}>
              Valid From
              <input style={inputStyle} type="datetime-local" value={validFrom}
                onChange={e => setValidFrom(e.target.value)} required />
            </label>
            <label style={labelStyle}>
              Expires At
              <input style={inputStyle} type="datetime-local" value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)} required />
            </label>
          </div>

          <label style={labelStyle}>
            Max Bandwidth (kB/s)
            <input style={inputStyle} type="number" min="1" step="1" value={maxBandwidth}
              onChange={e => setMaxBandwidth(e.target.value)} required />
          </label>

        </div>
      </fieldset>

      <fieldset style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.75rem 1rem" }}>
        <legend style={{ fontSize: 12, color: "#888", padding: "0 0.25rem" }}>Listing</legend>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <label style={labelStyle}>
              Unit Price (MIST / kB/s·s)
              <input style={inputStyle} type="number" min="1" step="1" value={unitPriceMist}
                onChange={e => setUnitPriceMist(e.target.value)} required />
              <span style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                ≈ {totalForFullListing} SUI for full listing
              </span>
            </label>
            <label style={labelStyle}>
              Min Price (SUI)
              <input style={inputStyle} type="number" min="0" step="0.000000001" value={minPriceSui}
                onChange={e => setMinPriceSui(e.target.value)} required />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <label style={labelStyle}>
              Min Bandwidth (kB/s)
              <input style={inputStyle} type="number" min="1" step="1" value={minBandwidth}
                onChange={e => setMinBandwidth(e.target.value)} required />
            </label>
            <label style={labelStyle}>
              BW Step (kB/s)
              <input style={inputStyle} type="number" min="1" step="1" value={bwGranularity}
                onChange={e => setBwGranularity(e.target.value)} required />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <label style={labelStyle}>
              Min Duration (s)
              <input style={inputStyle} type="number" min="1" step="1" value={minDuration}
                onChange={e => setMinDuration(e.target.value)} required />
            </label>
            <label style={labelStyle}>
              Time Step (s)
              <input style={inputStyle} type="number" min="1" step="1" value={timeGranularity}
                onChange={e => setTimeGranularity(e.target.value)} required />
            </label>
          </div>

        </div>
      </fieldset>

      {error && <p style={{ color: "red", fontSize: 13, margin: 0 }}>{error}</p>}

      <button type="submit" disabled={isPending} style={{ padding: "0.5rem 1.5rem", fontSize: "1rem" }}>
        {isPending ? "Creating…" : "Create Listing"}
      </button>
    </form>
  );
}
