"use client";

import { useState, useEffect } from "react";

import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { dAppKit } from "@/lib/dappkit";
import { buildRedeemTx } from "@/lib/transactions";
import { EVENT_REDEMPTION_DELIVERY } from "@/lib/constants";

interface RedemptionDeliveryParsed {
  token_id: string;
  redeemed_by: string;
  encrypted_auth_key: number[];
}

interface Props {
  tokenObject: {
    objectId: string;
    content?: {
      dataType: string;
      fields: Record<string, unknown>;
    };
  };
}

export function TokenCard({ tokenObject }: Props) {
  const fields = tokenObject.content?.fields as Record<string, string> | undefined;
  if (!fields) return null;

  const tokenId = tokenObject.objectId;
  const expiresAt = Number(fields.expires_at ?? 0);
  const nowSecs = Math.floor(Date.now() / 1000);
  const isExpired = expiresAt > 0 && nowSecs > expiresAt;

  type RedeemState = "idle" | "redeeming" | "waiting" | "delivered" | "error";
  const [redeemState, setRedeemState] = useState<RedeemState>("idle");
  const [deliveredKey, setDeliveredKey] = useState<number[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const account = useCurrentAccount();

  const { data: deliveryEvents } = useQuery({
    queryKey: ["deliveryEvents", EVENT_REDEMPTION_DELIVERY],
    queryFn: () =>
      dAppKit.getClient().queryEvents({
        query: { MoveEventType: EVENT_REDEMPTION_DELIVERY },
        limit: 50,
        order: "descending",
      }),
    enabled: redeemState === "waiting",
    refetchInterval: redeemState === "waiting" ? 3000 : false,
  });

  useEffect(() => {
    if (redeemState !== "waiting" || !deliveryEvents?.data) return;
    const match = deliveryEvents.data.find((e) => {
      const p = e.parsedJson as RedemptionDeliveryParsed;
      return p.token_id?.toLowerCase() === tokenId.toLowerCase();
    });
    if (match) {
      const p = match.parsedJson as RedemptionDeliveryParsed;
      setDeliveredKey(p.encrypted_auth_key);
      setRedeemState("delivered");
    }
  }, [deliveryEvents, redeemState, tokenId]);

  async function handleRedeem() {
    if (!account) return;
    setErrorMsg(null);
    setRedeemState("redeeming");

    const rawPubkey = account.publicKey;
    let flag = 0x02; // default: Secp256r1 (Slush wallet)
    if (rawPubkey.length === 32) {
      flag = 0x00; // Ed25519
    } else {
      // Distinguish Secp256k1 (0x01) from Secp256r1 (0x02) by address derivation
      try {
        const { Secp256k1PublicKey } = await import("@mysten/sui/keypairs/secp256k1");
        if (new Secp256k1PublicKey(rawPubkey).toSuiAddress() === account.address) flag = 0x01;
      } catch { /* not Secp256k1, keep Secp256r1 default */ }
    }

    // Sui wallets expose compressed EC keys with parity 0x00/0x01 instead of
    // the SEC1 standard 0x02/0x03. Normalize so the orchestrator's noble-curves
    // calls receive a valid compressed point.
    let pubkey = new Uint8Array(rawPubkey);
    if (pubkey.length === 33 && pubkey[0] <= 1) pubkey[0] += 2;

    const pubkeyWithFlag = new Uint8Array(pubkey.length + 1);
    pubkeyWithFlag[0] = flag;
    pubkeyWithFlag.set(pubkey, 1);

    try {
      await dAppKit.signAndExecuteTransaction({
        transaction: buildRedeemTx({ tokenId, clientPubkey: pubkeyWithFlag }),
      });
      setRedeemState("waiting");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Redemption failed");
      setRedeemState("error");
    }
  }

  const statusColor = isExpired ? "orange" : "green";
  const statusText = isExpired ? "Expired" : "Active";

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <h3 style={{ margin: 0 }}>{fields.service_name}</h3>
        <span style={{ color: statusColor, fontWeight: 600, fontSize: 13 }}>{statusText}</span>
      </div>

      <p style={{ fontFamily: "monospace", fontSize: 11, color: "#999", marginTop: 4 }}>
        {tokenId}
      </p>

      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: "0.5rem" }}>
        <tbody>
          {fields.ip_address && (
            <tr>
              <td style={{ color: "#666", paddingRight: "1rem", fontSize: 13, whiteSpace: "nowrap" }}>Endpoint</td>
              <td style={{ fontSize: 13 }}>{fields.ip_address}</td>
            </tr>
          )}
          <tr>
            <td style={{ color: "#666", paddingRight: "1rem", fontSize: 13, whiteSpace: "nowrap" }}>Valid from</td>
            <td style={{ fontSize: 13 }}>
              {fields.valid_from ? new Date(Number(fields.valid_from) * 1000).toLocaleString() : "—"}
            </td>
          </tr>
          <tr>
            <td style={{ color: "#666", paddingRight: "1rem", fontSize: 13, whiteSpace: "nowrap" }}>Expires</td>
            <td style={{ fontSize: 13 }}>
              {expiresAt === 0 ? "Never" : new Date(expiresAt * 1000).toLocaleString()}
            </td>
          </tr>
          <tr>
            <td style={{ color: "#666", paddingRight: "1rem", fontSize: 13, whiteSpace: "nowrap" }}>Bandwidth</td>
            <td style={{ fontSize: 13 }}>{fields.bandwidth ? `${fields.bandwidth} kB/s` : "—"}</td>
          </tr>
          {fields.issuer && (
            <tr>
              <td style={{ color: "#666", paddingRight: "1rem", fontSize: 13, whiteSpace: "nowrap" }}>Issuer</td>
              <td style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>{fields.issuer}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: "0.5rem", textAlign: "right" }}>
        <a href={`/tokens/${tokenId}`} style={{ fontSize: 12, color: "#888" }}>View details →</a>
      </div>

      {!isExpired && (
        <div style={{ marginTop: "1rem", borderTop: "1px solid #eee", paddingTop: "0.75rem" }}>
          {redeemState === "idle" && !account && (
            <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>Connect wallet to redeem.</p>
          )}
          {redeemState === "idle" && account && (
            <button onClick={handleRedeem} style={{ padding: "0.5rem 1.5rem", fontSize: "0.9rem" }}>
              Redeem Token
            </button>
          )}
          {redeemState === "redeeming" && (
            <p style={{ fontSize: 13, margin: 0 }}>Submitting redemption transaction…</p>
          )}
          {redeemState === "waiting" && (
            <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
              ⏳ Waiting for service provider to deliver auth key…
            </p>
          )}
          {redeemState === "delivered" && deliveredKey && (() => {
            const hexKey = deliveredKey.map((b) => b.toString(16).padStart(2, "0")).join("");
            return (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.25rem" }}>
                  <p style={{ color: "green", margin: 0, fontWeight: 600, fontSize: 13 }}>
                    ✓ Auth key received (hex, encrypted for your public key)
                  </p>
                  <button
                    onClick={async () => { await navigator.clipboard.writeText(hexKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    style={{ fontSize: 12, padding: "2px 10px", cursor: "pointer", marginLeft: "0.5rem", flexShrink: 0 }}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={hexKey}
                  rows={3}
                  style={{ width: "100%", fontFamily: "monospace", fontSize: 11, boxSizing: "border-box" }}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </div>
            );
          })()}
          {redeemState === "error" && (
            <div>
              <p style={{ color: "red", fontSize: 13, margin: "0 0 0.25rem" }}>Error: {errorMsg}</p>
              <button onClick={() => setRedeemState("idle")}>Retry</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
