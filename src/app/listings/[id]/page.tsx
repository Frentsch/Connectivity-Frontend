"use client";

import { use } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { useListing } from "@/lib/queries";
import { BuyButton } from "@/components/BuyButton";

interface Props {
  params: Promise<{ id: string }>;
}

export default function ListingDetailPage({ params }: Props) {
  const { id } = use(params);
  const { data, isLoading } = useListing(id);

  if (isLoading) return <p>Loading…</p>;
  if (!data?.data) return <p>Listing not found.</p>;

  const fields = (
    data.data.content as { dataType: string; fields: Record<string, unknown> } | undefined
  )?.fields;
  if (!fields) return <p>Could not read listing data.</p>;

  // ServiceListing embeds AccessToken as `token` field.
  // The Sui RPC wraps embedded objects as { type, fields }, so we read the inner fields.
  const token = ((fields.token as any)?.fields ?? fields.token) as Record<string, string> | undefined;

  const priceSui = (Number(fields.price_mist as string) / 1e9).toFixed(4);
  const validFrom  = BigInt(token?.valid_from  ?? "0");
  const expiresAt  = BigInt(token?.expires_at  ?? "0");
  const bandwidth  = BigInt(token?.bandwidth   ?? "0");

  const validFromDate = token?.valid_from
    ? new Date(Number(token.valid_from) * 1000).toLocaleString()
    : "—";
  const expiresDate = expiresAt === 0n
    ? "Never"
    : new Date(Number(expiresAt) * 1000).toLocaleString();

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>{token?.service_name ?? id}</h1>
        <ConnectButton />
      </div>

      <table style={{ borderCollapse: "collapse", marginBottom: "1.5rem", width: "100%" }}>
        <tbody>
          {[
            ["Endpoint",    token?.ip_address ?? "—"],
            ["Price",       `${priceSui} SUI`],
            ["Valid from",  validFromDate],
            ["Expires",     expiresDate],
            ["Bandwidth",   bandwidth > 0n ? `${bandwidth} kB/s` : "—"],
            ["Min BW",      `${fields.min_bandwidth ?? "—"} kB/s`],
            ["Min duration",`${fields.min_duration ?? "—"} s`],
            ["Seller",      fields.issuer as string],
          ].map(([label, value]) => (
            <tr key={String(label)} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "0.5rem 1rem 0.5rem 0", color: "#666", whiteSpace: "nowrap" }}>
                {label}
              </td>
              <td
                style={{
                  padding: "0.5rem 0",
                  fontFamily: label === "Seller" ? "monospace" : undefined,
                  fontSize: label === "Seller" ? 12 : undefined,
                }}
              >
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <BuyButton
        listingId={id}
        validFrom={validFrom}
        priceMist={BigInt((fields.price_mist as string) ?? "0")}
        expiresAt={expiresAt}
        bandwidth={bandwidth}
      />
    </div>
  );
}
