"use client";

import { use, useState, useEffect } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { useListing } from "@/lib/queries";
import { BuyButton } from "@/components/BuyButton";
import { warn } from "console";

// ── helpers ───────────────────────────────────────────────────────────────────

function toDatetimeLocal(unixSecs: bigint): string {
  if (unixSecs === 0n) return "";
  const d = new Date(Number(unixSecs) * 1000);
  // Shift by the local timezone offset so the string represents local time.
  // datetime-local inputs display and parse values as local time, not UTC.
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

function fromDatetimeLocal(s: string): number {
  return s ? Math.floor(new Date(s).getTime() / 1000) : 0;
}

function validate(
  validFromSecs: number,
  expiresAtSecs: number,
  bwKbs: number,
  maxPrice: bigint,
  c: {
    minValidFrom: number; maxExpiresAt: number;
    minBw: number; maxBw: number; bwGran: number;
    minDuration: number; timeGran: number;
    priceEstimate: number;
  },
): string[][] {
  const errs: string[] = [];
  const warnings: string[] = [];
  if (maxPrice < c.priceEstimate)
    warnings.push(`Max price (${maxPrice} SUI) is below the estimated price (${(Number(c.priceEstimate) / 1e9).toFixed(9)} SUI) — transaction will likely fail`);

  if (validFromSecs < c.minValidFrom)
    errs.push(`Start cannot be before listing valid_from (${new Date(c.minValidFrom * 1000).toLocaleString()})`);
  if (c.maxExpiresAt > 0 && expiresAtSecs > c.maxExpiresAt)
    errs.push(`End cannot be after listing expiry (${new Date(c.maxExpiresAt * 1000).toLocaleString()})`);
  const dur = expiresAtSecs - validFromSecs;
  if (dur <= 0)
    errs.push("End must be after start");
  else if (dur < c.minDuration)
    errs.push(`Duration must be at least ${c.minDuration} s (currently ${dur} s)`);
  else if (c.timeGran > 0 && dur % c.timeGran !== 0)
    errs.push(`Duration must be a multiple of ${c.timeGran} s (currently ${dur} s)`);
  if (bwKbs < c.minBw)
    errs.push(`Bandwidth must be at least ${c.minBw} kB/s`);
  else if (bwKbs > c.maxBw)
    errs.push(`Bandwidth cannot exceed ${c.maxBw} kB/s`);
  else if (c.bwGran > 0 && bwKbs % c.bwGran !== 0)
    errs.push(`Bandwidth must be a multiple of ${c.bwGran} kB/s`);
  return [warnings, errs];
}

// ── pricing policy helpers ────────────────────────────────────────────────────

interface DiscountTierJs { threshold: number; fraction_bps: number }
interface PricingPolicyJs {
  base_price_mist: number;
  min_price:       number;
  bw_tiers:  DiscountTierJs[];
  dur_tiers: DiscountTierJs[];
}

function interpolateFraction(tiers: DiscountTierJs[], value: number): number {
  if (tiers.length === 0) return 10_000;
  if (value <= tiers[0].threshold) return tiers[0].fraction_bps;
  const last = tiers[tiers.length - 1];
  if (value >= last.threshold) return last.fraction_bps;
  for (let i = 0; i < tiers.length - 1; i++) {
    const lo = tiers[i], hi = tiers[i + 1];
    if (value >= lo.threshold && value < hi.threshold) {
      const span  = hi.threshold    - lo.threshold;
      const delta = value           - lo.threshold;
      return lo.fraction_bps + (delta * (hi.fraction_bps - lo.fraction_bps)) / span;
    }
  }
  return 10_000;
}

function computePolicyPrice(
  policy: PricingPolicyJs,
  bandwidthKbs: number, durationSecs: number,
  maxBw: number, maxDur: number,
): bigint {
  if (maxBw <= 0 || maxDur <= 0) return BigInt(policy.min_price);
  const linear   = policy.base_price_mist * (bandwidthKbs / maxBw) * (durationSecs / maxDur);
  const bwFrac   = interpolateFraction(policy.bw_tiers,  bandwidthKbs) / 10_000;
  const durFrac  = interpolateFraction(policy.dur_tiers, durationSecs) / 10_000;
  const computed = linear * bwFrac * durFrac;
  return BigInt(Math.round(Math.max(policy.min_price, computed)));
}

// Parse a PricingPolicy from Sui RPC.
// PricingPolicy is now a required struct field, not an Option, so it arrives
// as { fields: { base_price_mist, min_price, bw_tiers, dur_tiers } } directly.
function parsePricingPolicy(raw: unknown): PricingPolicyJs {
  const p = (raw as any)?.fields ?? raw ?? {};
  const parseTiers = (tiers: unknown[]): DiscountTierJs[] =>
    (tiers ?? []).map((t: any) => {
      const f = t?.fields ?? t;
      return { threshold: Number(f.threshold), fraction_bps: Number(f.fraction_bps) };
    });
  return {
    base_price_mist: Number(p.base_price_mist ?? 0),
    min_price:       Number(p.min_price ?? 0),
    bw_tiers:  parseTiers((p.bw_tiers  as any[]) ?? []),
    dur_tiers: parseTiers((p.dur_tiers as any[]) ?? []),
  };
}

// ── purchase form ─────────────────────────────────────────────────────────────

interface FormProps {
  listingId: string;
  tokenId:   string | undefined;
  policy:    PricingPolicyJs;
  token:     Record<string, string>;
  fields:    Record<string, unknown>;
}

function PurchaseForm({ listingId, tokenId, policy, token, fields }: FormProps) {
  const priceMist = BigInt(policy.base_price_mist);
  const validFrom  = BigInt(token.valid_from  ?? "0");
  const expiresAt  = BigInt(token.expires_at  ?? "0");
  const maxBw      = Number(token.bandwidth   ?? "0");
  const minBw      = Number(fields.min_bandwidth  ?? "0");
  const minDuration = Number(fields.min_duration  ?? "0");
  const bwGran     = Number(fields.bw_granularity  ?? "0");
  const timeGran   = Number(fields.time_granularity ?? "0");

  // maxDur from the token itself (not the user's selection) for the default seed
  const tokenMaxDur     = Number(expiresAt) - Number(validFrom);
  const defaultEstimate = computePolicyPrice(policy, maxBw, tokenMaxDur, maxBw, tokenMaxDur);
  const defaultEstimateSui = (Number(defaultEstimate) / 1e9).toFixed(9);

  const [inputFrom,     setInputFrom]     = useState(toDatetimeLocal(validFrom));
  const [inputTo,       setInputTo]       = useState(toDatetimeLocal(expiresAt));
  const [inputBw,       setInputBw]       = useState(String(maxBw));
  const [inputMaxPrice, setInputMaxPrice] = useState(defaultEstimateSui);

  const curFromSecs  = fromDatetimeLocal(inputFrom);
  const curToSecs    = fromDatetimeLocal(inputTo);
  const bwVal        = Number(inputBw) || 0;
  const maxPriceMist = BigInt(Math.round((Number(inputMaxPrice) || 0) * 1e9));

  const curDur         = curToSecs - curFromSecs;
  const estimatedPrice = computePolicyPrice(policy, bwVal, curDur, maxBw, tokenMaxDur);
  const effectiveEstimate = estimatedPrice;

  // Keep the Max price input in sync with the estimate whenever parameters change.
  useEffect(() => {
    setInputMaxPrice((Number(estimatedPrice) / 1e9).toFixed(9));
  }, [estimatedPrice]);

  const priceWarning: string[] = [];
  if (maxPriceMist < effectiveEstimate)
    priceWarning.push(`Max price (${inputMaxPrice} SUI) is below the estimated price (${(Number(effectiveEstimate) / 1e9).toFixed(9)} SUI) — transaction will fail`);

  const errors = validate(curFromSecs, curToSecs, bwVal, maxPriceMist, {
    minValidFrom: Number(validFrom),
    maxExpiresAt: Number(expiresAt),
    minBw, maxBw, bwGran,
    minDuration, timeGran, priceEstimate: Number(effectiveEstimate)
  });

  const priceSui = (Number(priceMist) / 1e9).toFixed(4);

  return (
    <>
      <table style={{ borderCollapse: "collapse", marginBottom: "1.5rem", width: "100%" }}>
        <tbody>
          {[
            ["Endpoint",     token.ip_address ?? "—"],
            ["Price",        `${priceSui} SUI`],
            ["Max valid from", token.valid_from ? new Date(Number(token.valid_from) * 1000).toLocaleString() : "—"],
            ["Max expires",  expiresAt === 0n ? "Never" : new Date(Number(expiresAt) * 1000).toLocaleString()],
            ["Max bandwidth",maxBw > 0 ? `${maxBw} kB/s` : "—"],
            ["Min bandwidth",`${minBw} kB/s`],
            ["Min duration", `${minDuration} s`],
            ["BW step",      bwGran > 0 ? `${bwGran} kB/s` : "—"],
            ["Time step",    timeGran > 0 ? `${timeGran} s` : "—"],
            ["Seller",       fields.issuer as string],
            ["Pricing", `${(Number(defaultEstimate) / 1e9).toFixed(4)} SUI${policy.bw_tiers.length > 0 || policy.dur_tiers.length > 0 ? " (volume discount)" : ""}`],
          ].map(([label, value]) => (
            <tr key={String(label)} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "0.5rem 1rem 0.5rem 0", color: "#666", whiteSpace: "nowrap", fontSize: 14 }}>
                {label}
              </td>
              <td style={{
                padding: "0.5rem 0", fontSize: 14,
                fontFamily: label === "Seller" ? "monospace" : undefined,
              }}>
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── customise purchase ──────────────────────────────────────────── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ margin: "0 0 0.75rem" }}>Customise purchase</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "0.75rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            Start
            <input
              type="datetime-local"
              value={inputFrom}
              min={toDatetimeLocal(validFrom)}
              max={toDatetimeLocal(expiresAt)}
              step={1}
              onChange={(e) => setInputFrom(e.target.value)}
              style={{ padding: "0.35rem", fontSize: 13 }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            End
            <input
              type="datetime-local"
              value={inputTo}
              min={toDatetimeLocal(validFrom)}
              max={toDatetimeLocal(expiresAt)}
              step={1}
              onChange={(e) => setInputTo(e.target.value)}
              style={{ padding: "0.35rem", fontSize: 13 }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            Bandwidth (kB/s)
            <input
              type="number"
              value={inputBw}
              min={minBw}
              max={maxBw}
              step={bwGran > 0 ? bwGran : 1}
              onChange={(e) => setInputBw(e.target.value)}
              style={{ padding: "0.35rem", fontSize: 13 }}
            />
          </label>

          { (
            <div>
            <p style={{ margin: "0 0 0.5rem", fontSize: 13, color: "#444" }}>
              Estimated price:{" "}
              <strong>{(Number(effectiveEstimate) / 1e9).toFixed(9)} SUI</strong>
              {BigInt(policy.min_price) > 0n && estimatedPrice <= BigInt(policy.min_price) && (
                <span style={{ color: "#888", marginLeft: 6 }}>(min price floor)</span>
              )}
            </p>
            </div>
          )}

          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            Max price (SUI)
            <input
              type="number"
              value={inputMaxPrice}
              min={0}
              step={0.000000001}
              onChange={(e) => setInputMaxPrice(e.target.value)}
              style={{ padding: "0.35rem", fontSize: 13 }}
            />
          </label>
        </div>

        {/*errors*/}
        {errors[1].length > 0 && (
          <ul style={{ margin: "0 0 0.75rem", padding: "0.5rem 0.5rem 0.5rem 1.5rem", background: "#fff3f3", borderRadius: 4, color: "#c00", fontSize: 13 }}>
            {errors[1].map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
        
        {/*warnings*/}
        {errors[0].length > 0 && (
           <ul style={{ margin: "0 0 0.75rem", padding: "0.5rem 0.5rem 0.5rem 1.5rem", background: "#fff3f3", borderRadius: 4, color: "rgb(200, 140, 0)", fontSize: 13 }}>
            {errors[0].map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
      </div>

      <BuyButton
        listingId={listingId}
        tokenId={tokenId}
        priceMist={priceMist}
        maxPriceMist={maxPriceMist}
        validFrom={BigInt(curFromSecs)}
        expiresAt={BigInt(curToSecs)}
        bandwidth={BigInt(bwVal)}
        disabled={errors[1].length > 0}
      />
    </>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = useListing(id);

  if (isLoading) return <p>Loading…</p>;
  if (!data?.data) return <p>Listing not found.</p>;

  const fields = (
    data.data.content as { dataType: string; fields: Record<string, unknown> } | undefined
  )?.fields;
  if (!fields) return <p>Could not read listing data.</p>;

  const token = ((fields.token as any)?.fields ?? fields.token) as Record<string, string> | undefined;
  if (!token) return <p>Could not read token data.</p>;

  const tokenId   = (token as any)?.id?.id as string | undefined;
  const policy    = parsePricingPolicy(fields.pricing_policy);
  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>{token.service_name ?? id}</h1>
        <ConnectButton />
      </div>

      <PurchaseForm
        listingId={id}
        tokenId={tokenId}
        policy={policy}
        token={token}
        fields={fields}
      />
    </div>
  );
}
