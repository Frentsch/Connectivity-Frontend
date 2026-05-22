"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useListing } from "@/lib/queries";
import { signAndExecute } from "@/lib/localSigner";
import { buildDelistTx } from "@/lib/transactions";

function fmtTime(secs: string | number | undefined): string {
  if (!secs) return "—";
  const n = Number(secs);
  return n === 0 ? "Never" : new Date(n * 1000).toLocaleString();
}

function fmtSui(mist: string | number | undefined): string {
  if (!mist) return "—";
  return (Number(mist) / 1e9).toFixed(4) + " SUI";
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <tr>
      <td style={{ color: "#555", paddingRight: "1.5rem", paddingBottom: "0.4rem", fontSize: 14, whiteSpace: "nowrap", verticalAlign: "top" }}>
        {label}
      </td>
      <td style={{ paddingBottom: "0.4rem", fontSize: 14, fontFamily: mono ? "monospace" : undefined, wordBreak: "break-all" }}>
        {value}
      </td>
    </tr>
  );
}

export default function MyListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }   = use(params);
  const router   = useRouter();
  const { data, isLoading } = useListing(id);

  const [delisting, setDelisting] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  if (isLoading) return <p>Loading…</p>;
  if (!data?.data) return <p>Listing not found.</p>;

  const fields = (data.data.content as any)?.fields as Record<string, any> | undefined;
  if (!fields) return <p>Could not read listing data.</p>;

  const token   = (fields.token?.fields ?? fields.token ?? {}) as Record<string, string>;
  const policy  = (fields.pricing_policy?.fields ?? fields.pricing_policy ?? {}) as Record<string, string>;

  const nowSecs   = Math.floor(Date.now() / 1000);
  const expiresAt = Number(token.expires_at ?? 0);
  const isExpired = expiresAt > 0 && nowSecs > expiresAt;

  async function handleDelist() {
    setError(null);
    setDelisting(true);
    try {
      await signAndExecute(buildDelistTx(id));
      router.push("/my-listings");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delist failed");
      setDelisting(false);
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <a href="/my-listings" style={{ fontSize: 13, color: "#888", display: "block", marginBottom: "1rem" }}>
        ← Back to My Listings
      </a>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>{token.service_name ?? id}</h1>
          <span style={{ color: isExpired ? "orange" : "green", fontWeight: 600, fontSize: 13 }}>
            {isExpired ? "Expired" : "Active"}
          </span>
        </div>
      </div>

      <h3 style={{ margin: "0 0 0.5rem", fontSize: 14, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>
        Access Token
      </h3>
      <table style={{ borderCollapse: "collapse", marginBottom: "1.5rem", width: "100%" }}>
        <tbody>
          <Row label="Listing ID"   value={id}                       mono />
          <Row label="Service"      value={token.service_name}        />
          <Row label="Endpoint"     value={token.ip_address}          />
          <Row label="Login Server" value={token.login_server || "—"} />
          <Row label="Valid from"   value={fmtTime(token.valid_from)} />
          <Row label="Expires"      value={fmtTime(token.expires_at)} />
          <Row label="Bandwidth"    value={token.bandwidth ? `${token.bandwidth} kB/s` : "—"} />
          <Row label="Issuer"       value={fields.issuer}             mono />
        </tbody>
      </table>

      <h3 style={{ margin: "0 0 0.5rem", fontSize: 14, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>
        Listing Parameters
      </h3>
      <table style={{ borderCollapse: "collapse", marginBottom: "1.5rem", width: "100%" }}>
        <tbody>
          <Row label="Base Price"    value={fmtSui(policy.base_price_mist)} />
          <Row label="Min Price"     value={fmtSui(policy.min_price)}       />
          <Row label="Min Bandwidth" value={fields.min_bandwidth ? `${fields.min_bandwidth} kB/s` : "—"} />
          <Row label="BW Step"       value={fields.bw_granularity  ? `${fields.bw_granularity} kB/s`  : "—"} />
          <Row label="Min Duration"  value={fields.min_duration    ? `${fields.min_duration} s`        : "—"} />
          <Row label="Time Step"     value={fields.time_granularity ? `${fields.time_granularity} s`   : "—"} />
        </tbody>
      </table>

      <div style={{ borderTop: "1px solid #eee", paddingTop: "1rem" }}>
        {error && <p style={{ color: "red", fontSize: 13, marginBottom: "0.5rem" }}>{error}</p>}

        {(
          <button
            onClick={handleDelist}
            disabled={delisting}
            style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5", padding: "0.5rem 1.5rem", borderRadius: 6, cursor: "pointer", fontSize: "0.95rem" }}
          >
            {delisting ? "Delisting…" : "Delist"}
          </button>
        )}
      </div>
    </div>
  );
}
