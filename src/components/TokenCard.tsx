"use client";

import { useState, useEffect } from "react";

import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { dAppKit } from "@/lib/dappkit";
import { buildRedeemTx } from "@/lib/transactions";
import { EVENT_REDEMPTION_DELIVERY } from "@/lib/constants";
import { signingMessage, parseSuiSignature, deriveEcdhKey, buildClientPubkey, eciesDecrypt } from "@/lib/crypto";

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
  const [privKey, setPrivKey]         = useState<Uint8Array | null>(null);
  const [deliveredKey, setDeliveredKey] = useState<number[] | null>(null);
  const [plaintext, setPlaintext]     = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [copied, setCopied]           = useState(false);

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

  // Auto-decrypt once the key arrives and we still hold privKey in state
  useEffect(() => {
    if (redeemState !== "delivered" || !deliveredKey || !privKey) return;
    const ct = new Uint8Array(deliveredKey);
    eciesDecrypt(ct, privKey)
      .then((plain) => setPlaintext(new TextDecoder().decode(plain)))
      .catch((e) => setDecryptError(e instanceof Error ? e.message : "Decryption failed"));
  }, [redeemState, deliveredKey, privKey]);

  async function handleRedeem() {
    if (!account) return;
    setErrorMsg(null);
    setRedeemState("redeeming");

    try {
      // 1. Sign deterministic message → derive X25519 keypair
      const msg = signingMessage(tokenId);
      const result = await dAppKit.signPersonalMessage({ message: msg });
      const sigBytes = parseSuiSignature(result.signature);
      const { priv, pub } = deriveEcdhKey(sigBytes, tokenId);
      setPrivKey(priv);

      // 2. Build client_pubkey = [0x00, ...x25519_pub]
      const clientPubkey = buildClientPubkey(pub);

      // 3. Submit redeem transaction
      await dAppKit.signAndExecuteTransaction({
        transaction: buildRedeemTx({ tokenId, clientPubkey }),
      });
      setRedeemState("waiting");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Redemption failed");
      setRedeemState("error");
    }
  }

  async function handleDecrypt() {
    if (!account) return;
    setDecryptError(null);
    try {
      const msg = signingMessage(tokenId);
      const result = await dAppKit.signPersonalMessage({ message: msg });
      const sigBytes = parseSuiSignature(result.signature);
      const { priv } = deriveEcdhKey(sigBytes, tokenId);
      const ct = new Uint8Array(deliveredKey!);
      const plain = await eciesDecrypt(ct, priv);
      setPlaintext(new TextDecoder().decode(plain));
    } catch (e) {
      setDecryptError(e instanceof Error ? e.message : "Decryption failed");
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
            <p style={{ fontSize: 13, margin: 0 }}>Signing and submitting redemption…</p>
          )}
          {redeemState === "waiting" && (
            <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
              ⏳ Waiting for service provider to deliver auth key…
            </p>
          )}
          {redeemState === "delivered" && deliveredKey && (
            <div>
              {plaintext != null ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.25rem" }}>
                    <p style={{ color: "green", margin: 0, fontWeight: 600, fontSize: 13 }}>
                      ✓ Preauthkey decrypted
                    </p>
                    <button
                      onClick={async () => { await navigator.clipboard.writeText(plaintext); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      style={{ fontSize: 12, padding: "2px 10px", cursor: "pointer", marginLeft: "0.5rem" }}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <textarea
                    readOnly value={plaintext} rows={2}
                    style={{ width: "100%", fontFamily: "monospace", fontSize: 12, boxSizing: "border-box" }}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  />
                </>
              ) : (
                <div>
                  <p style={{ color: "green", margin: "0 0 0.5rem", fontWeight: 600, fontSize: 13 }}>
                    ✓ Auth key received
                  </p>
                  {decryptError && <p style={{ color: "red", fontSize: 12, margin: "0 0 0.5rem" }}>{decryptError}</p>}
                  <button onClick={handleDecrypt} style={{ fontSize: 13, padding: "4px 12px" }}>
                    Decrypt with wallet
                  </button>
                </div>
              )}
            </div>
          )}
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
