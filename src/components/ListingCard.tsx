"use client";

import Link from "next/link";

interface Props {
  objectId: string;
  fields: {
    issuer: string;
    price_mist: string;
    token?: {
      fields?: {
        service_name?: string;
        ip_address?: string;
        expires_at?: string;
        bandwidth?: string;
      };
    };
  };
}

export function ListingCard({ objectId, fields }: Props) {
  const token = fields.token?.fields ?? {};
  const priceSui = (Number(fields.price_mist) / 1e9).toFixed(4);
  const expiresAt = Number(token.expires_at ?? 0);
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
      <Link href={`/listings/${objectId}`}>
        <button style={{ marginTop: "0.75rem", width: "100%" }}>View &amp; Buy</button>
      </Link>
    </div>
  );
}
