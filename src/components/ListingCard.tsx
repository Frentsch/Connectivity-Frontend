"use client";

import Link from "next/link";

interface Props {
  objectId: string;
  fields: {
    issuer: string;
    pricing_policy?: {
      fields?: {
        base_price_mist?: string;
        min_price?:       string;
      };
    };
    token?: {
      fields?: {
        service_name?: string;
        ip_address?: string;
        valid_from?:  string;
        expires_at?:  string;
        bandwidth?:   string;
      };
    };
  };
  manageHref?: string;
}

export function ListingCard({ objectId, fields, manageHref }: Props) {
  const token        = fields.token?.fields ?? {};
  const baseMist     = Number(fields.pricing_policy?.fields?.base_price_mist ?? 0);
  const minPriceMist = Number(fields.pricing_policy?.fields?.min_price ?? 0);
  const bandwidth    = Number(token.bandwidth  ?? 0);
  const validFrom    = Number(token.valid_from ?? 0);
  const expiresAt    = Number(token.expires_at ?? 0);
  const duration     = Math.max(0, expiresAt - validFrom);
  const totalMist    = Math.max(minPriceMist, baseMist * bandwidth * duration);
  const priceSui     = (totalMist / 1e9).toFixed(4);
  const expiresStr = expiresAt === 0 ? "No expiry" : new Date(expiresAt * 1000).toLocaleDateString();

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem" }}>
      <h3 style={{ margin: "0 0 0.5rem" }}>{token.service_name ?? "Unnamed service"}</h3>
      <p style={{ margin: "0.25rem 0" }}>{priceSui} SUI</p>
      <p style={{ margin: "0.25rem 0", color: "#666", fontSize: 13 }}>
        {token.ip_address ?? "—"}
      </p>
      <p style={{ margin: "0.25rem 0", color: "#888", fontSize: 12 }}>
        Expires: {expiresStr}
        {token.bandwidth ? ` · ${token.bandwidth} kB/s` : ""}
      </p>
      <p style={{ margin: "0.25rem 0", fontFamily: "monospace", fontSize: 11, color: "#bbb" }}>
        {fields.issuer.slice(0, 10)}…
      </p>
      <Link href={manageHref ?? `/listings/${objectId}`}>
        <button style={{ marginTop: "0.75rem", width: "100%" }}>
          {manageHref ? "Manage" : "View & Buy"}
        </button>
      </Link>
    </div>
  );
}
