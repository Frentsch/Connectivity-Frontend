"use client";

import { use, useState } from "react";
import { useToken } from "@/lib/queries";
import { ConnectButton } from "@/components/ConnectButton";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useQuery } from "@tanstack/react-query";
import { dAppKit } from "@/lib/dappkit";
import { buildRedeemTx } from "@/lib/transactions";
import { EVENT_REDEMPTION_DELIVERY, TOKEN_TYPE, ACCESS_KEY_TYPE } from "@/lib/constants";
import { signingMessage, parseSuiSignature, deriveEcdhKey, buildClientPubkey, eciesDecrypt } from "@/lib/crypto";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(secs: string | undefined): string {
  if (!secs) return "—";
  const n = Number(secs);
  return n === 0 ? "Never" : new Date(n * 1000).toLocaleString();
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

// ── AccessToken detail ────────────────────────────────────────────────────────

interface RedemptionDeliveryParsed {
  token_id: string;
  redeemed_by: string;
  encrypted_auth_key: number[];
}

function AccessTokenDetail({ objectId, fields }: { objectId: string; fields: Record<string, string> }) {
  const expiresAt = Number(fields.expires_at ?? 0);
  const nowSecs   = Math.floor(Date.now() / 1000);
  const isExpired = expiresAt > 0 && nowSecs > expiresAt;

  type RedeemState = "idle" | "redeeming" | "waiting" | "delivered" | "error";
  const [redeemState, setRedeemState]   = useState<RedeemState>("idle");
  const [privKey, setPrivKey]           = useState<Uint8Array | null>(null);
  const [deliveredKey, setDeliveredKey] = useState<number[] | null>(null);
  const [plaintext, setPlaintext]       = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);
  const [copied, setCopied]             = useState(false);

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

  // Watch for delivery event matching this token
  if (redeemState === "waiting" && deliveryEvents?.data) {
    const match = deliveryEvents.data.find((e) => {
      const p = e.parsedJson as RedemptionDeliveryParsed;
      return p.token_id?.toLowerCase() === objectId.toLowerCase();
    });
    if (match) {
      const p = match.parsedJson as RedemptionDeliveryParsed;
      setDeliveredKey(p.encrypted_auth_key);
      setRedeemState("delivered");
      // Auto-decrypt if we still have the private key in state
      if (privKey) {
        const ct = new Uint8Array(p.encrypted_auth_key);
        eciesDecrypt(ct, privKey)
          .then((plain) => setPlaintext(new TextDecoder().decode(plain)))
          .catch((e) => setDecryptError(e instanceof Error ? e.message : "Decryption failed"));
      }
    }
  }

  async function handleRedeem() {
    if (!account) return;
    setErrorMsg(null);
    setRedeemState("redeeming");

    try {
      const msg = signingMessage(objectId);
      const result = await dAppKit.signPersonalMessage({ message: msg });
      const sigBytes = parseSuiSignature(result.signature);
      const { priv, pub } = deriveEcdhKey(sigBytes, objectId);
      setPrivKey(priv);

      const clientPubkey = buildClientPubkey(pub);
      await dAppKit.signAndExecuteTransaction({
        transaction: buildRedeemTx({ tokenId: objectId, clientPubkey }),
      });
      setRedeemState("waiting");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Redemption failed");
      setRedeemState("error");
    }
  }

  async function handleDecrypt() {
    if (!account || !deliveredKey) return;
    setDecryptError(null);
    try {
      const msg = signingMessage(objectId);
      const result = await dAppKit.signPersonalMessage({ message: msg });
      const sigBytes = parseSuiSignature(result.signature);
      const { priv } = deriveEcdhKey(sigBytes, objectId);
      const plain = await eciesDecrypt(new Uint8Array(deliveredKey), priv);
      setPlaintext(new TextDecoder().decode(plain));
    } catch (e) {
      setDecryptError(e instanceof Error ? e.message : "Decryption failed");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>{fields.service_name}</h1>
          <span style={{ color: isExpired ? "orange" : "green", fontWeight: 600 }}>
            {isExpired ? "Expired" : "Active"}
          </span>
        </div>
        <ConnectButton />
      </div>

      <table style={{ borderCollapse: "collapse", marginBottom: "1.5rem" }}>
        <tbody>
          <Row label="Object ID"  value={objectId}            mono />
          <Row label="Service"    value={fields.service_name} />
          <Row label="Endpoint"   value={fields.ip_address}   />
          <Row label="Valid from" value={fmtTime(fields.valid_from)} />
          <Row label="Expires"    value={fmtTime(fields.expires_at)} />
          <Row label="Bandwidth"  value={fields.bandwidth ? `${fields.bandwidth} kB/s` : "—"} />
          <Row label="Issuer"     value={fields.issuer}        mono />
        </tbody>
      </table>

      {!isExpired && (
        <div style={{ borderTop: "1px solid #eee", paddingTop: "1rem" }}>
          {redeemState === "idle" && !account && (
            <p style={{ color: "#aaa" }}>Connect wallet to redeem.</p>
          )}
          {redeemState === "idle" && account && (
            <button onClick={handleRedeem} style={{ padding: "0.5rem 2rem", fontSize: "1rem" }}>
              Redeem Token
            </button>
          )}
          {redeemState === "redeeming" && <p>Signing and submitting redemption…</p>}
          {redeemState === "waiting" && (
            <p style={{ color: "#888" }}>⏳ Waiting for service provider to deliver auth key…</p>
          )}
          {redeemState === "delivered" && deliveredKey && (
            <div>
              {plaintext != null ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.25rem" }}>
                    <p style={{ color: "green", margin: 0, fontWeight: 600 }}>✓ Preauthkey decrypted</p>
                    <button
                      onClick={async () => { await navigator.clipboard.writeText(plaintext); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      style={{ fontSize: 12, padding: "2px 10px", cursor: "pointer", marginLeft: "0.5rem" }}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <textarea readOnly value={plaintext} rows={2}
                    style={{ width: "100%", fontFamily: "monospace", fontSize: 12, boxSizing: "border-box" }}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  />
                </>
              ) : (
                <div>
                  <p style={{ color: "green", margin: "0 0 0.5rem", fontWeight: 600 }}>✓ Auth key received</p>
                  {decryptError && <p style={{ color: "red", fontSize: 13, margin: "0 0 0.5rem" }}>{decryptError}</p>}
                  <button onClick={handleDecrypt} style={{ padding: "0.4rem 1.2rem", fontSize: "0.9rem" }}>
                    Decrypt with wallet
                  </button>
                </div>
              )}
            </div>
          )}
          {redeemState === "error" && (
            <div>
              <p style={{ color: "red" }}>Error: {errorMsg}</p>
              <button onClick={() => setRedeemState("idle")}>Retry</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AccessKey detail ──────────────────────────────────────────────────────────

function AccessKeyDetail({ objectId, fields }: { objectId: string; fields: Record<string, unknown> }) {
  const f = fields as {
    token_id: string; service_name: string; ip_address: string;
    valid_from: string; expires_at: string; bandwidth: string;
    issuer: string; auth_key: number[];
  };

  const [plaintext, setPlaintext]       = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [decrypting, setDecrypting]     = useState(false);
  const [copied, setCopied]             = useState(false);

  const account = useCurrentAccount();

  async function handleDecrypt() {
    if (!account) return;
    setDecryptError(null);
    setDecrypting(true);
    try {
      // The signing message uses the original token_id, not the AccessKey object ID
      const msg = signingMessage(f.token_id);
      const result = await dAppKit.signPersonalMessage({ message: msg });
      const sigBytes = parseSuiSignature(result.signature);
      const { priv } = deriveEcdhKey(sigBytes, f.token_id);
      const ct = new Uint8Array(f.auth_key ?? []);
      const plain = await eciesDecrypt(ct, priv);
      setPlaintext(new TextDecoder().decode(plain));
    } catch (e) {
      setDecryptError(e instanceof Error ? e.message : "Decryption failed");
    } finally {
      setDecrypting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>{f.service_name}</h1>
          <span style={{ color: "green", fontWeight: 600 }}>✓ Access Key</span>
        </div>
        <ConnectButton />
      </div>

      <table style={{ borderCollapse: "collapse", marginBottom: "1.5rem" }}>
        <tbody>
          <Row label="Object ID"  value={objectId}      mono />
          <Row label="Token ID"   value={f.token_id}    mono />
          <Row label="Service"    value={f.service_name} />
          <Row label="Endpoint"   value={f.ip_address}  />
          <Row label="Valid from" value={fmtTime(f.valid_from)} />
          <Row label="Expires"    value={fmtTime(f.expires_at)} />
          <Row label="Bandwidth"  value={f.bandwidth ? `${f.bandwidth} kB/s` : "—"} />
          <Row label="Issuer"     value={f.issuer}      mono />
        </tbody>
      </table>

      <div style={{ borderTop: "1px solid #d4edda", paddingTop: "1rem" }}>
        {plaintext != null ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.25rem" }}>
              <p style={{ margin: 0, fontWeight: 600, color: "green" }}>✓ Preauthkey decrypted</p>
              <button
                onClick={async () => { await navigator.clipboard.writeText(plaintext); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                style={{ fontSize: 12, padding: "2px 10px", cursor: "pointer", marginLeft: "0.5rem" }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <textarea readOnly value={plaintext} rows={2}
              style={{ width: "100%", fontFamily: "monospace", fontSize: 12, boxSizing: "border-box" }}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
          </>
        ) : (
          <div>
            <p style={{ margin: "0 0 0.75rem", color: "#555", fontSize: 14 }}>
              Sign with your wallet to decrypt the auth key for this service.
            </p>
            {decryptError && <p style={{ color: "red", fontSize: 13, margin: "0 0 0.5rem" }}>{decryptError}</p>}
            {!account ? (
              <p style={{ color: "#aaa", fontSize: 13 }}>Connect wallet to decrypt.</p>
            ) : (
              <button
                onClick={handleDecrypt}
                disabled={decrypting}
                style={{ padding: "0.5rem 1.5rem", fontSize: "0.9rem", opacity: decrypting ? 0.6 : 1 }}
              >
                {decrypting ? "Decrypting…" : "Decrypt with wallet"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TokenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useToken(id);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem" }}>
      <a href="/tokens" style={{ fontSize: 13, color: "#888", display: "block", marginBottom: "1rem" }}>
        ← Back to My Tokens
      </a>

      {isLoading && <p>Loading…</p>}
      {error    && <p style={{ color: "red" }}>Failed to load object: {String(error)}</p>}

      {data?.data && (() => {
        const obj     = data.data;
        const objType = (obj.content as any)?.type ?? obj.type ?? "";
        const fields  = (obj.content as any)?.fields as Record<string, unknown> ?? {};

        if (objType.includes(TOKEN_TYPE) || objType.endsWith("::access_token::AccessToken")) {
          return <AccessTokenDetail objectId={obj.objectId} fields={fields as Record<string, string>} />;
        }
        if (objType.includes(ACCESS_KEY_TYPE) || objType.endsWith("::access_token::AccessKey")) {
          return <AccessKeyDetail objectId={obj.objectId} fields={fields} />;
        }
        return <p style={{ color: "#888" }}>Unknown object type: {objType}</p>;
      })()}
    </div>
  );
}
