"use client";

import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { ecdhKeypairFromSecret, eciesDecrypt } from "@/lib/crypto";
import { useMasterSecret } from "@/lib/MasterSecretContext";

interface Props {
  accessKeyObject: {
    objectId: string;
    content?: {
      dataType: string;
      fields: Record<string, unknown>;
    };
  };
}

function fmtTime(secs: string | undefined): string {
  if (!secs) return "—";
  const n = Number(secs);
  return n === 0 ? "Never" : new Date(n * 1000).toLocaleString();
}

export function AccessKeyCard({ accessKeyObject }: Props) {
  const fields = accessKeyObject.content?.fields as
    | {
        token_id:     string;
        service_name: string;
        ip_address:   string;
        valid_from:   string;
        expires_at:   string;
        bandwidth:    string;
        issuer:       string;
        auth_key:     number[];
      }
    | undefined;
  if (!fields) return null;

  const keyId = accessKeyObject.objectId;

  const [plaintext, setPlaintext]       = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [decrypting, setDecrypting]     = useState(false);
  const [copied, setCopied]             = useState(false);

  const account             = useCurrentAccount();
  const { getMasterSecret } = useMasterSecret();

  async function handleDecrypt() {
    if (!account || !fields) return;
    setDecryptError(null);
    setDecrypting(true);
    try {
      const masterSecret = await getMasterSecret();
      const { priv } = ecdhKeypairFromSecret(masterSecret);
      const plain = await eciesDecrypt(new Uint8Array(fields.auth_key ?? []), priv);
      setPlaintext(new TextDecoder().decode(plain));
    } catch (e) {
      setDecryptError(e instanceof Error ? e.message : "Decryption failed");
    } finally {
      setDecrypting(false);
    }
  }

  return (
    <div style={{ border: "1px solid #c8e6c9", borderRadius: 8, padding: "1rem", background: "#f9fff9" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>{fields.service_name}</h3>
        <span style={{ color: "green", fontWeight: 600, fontSize: 13 }}>✓ Delivered</span>
      </div>

      <p style={{ fontFamily: "monospace", fontSize: 11, color: "#999", marginTop: 4,
                   overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "wrap" }}
         title={keyId}>
        {keyId}
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
            <td style={{ fontSize: 13 }}>{fmtTime(fields.valid_from)}</td>
          </tr>
          <tr>
            <td style={{ color: "#666", paddingRight: "1rem", fontSize: 13, whiteSpace: "nowrap" }}>Expires</td>
            <td style={{ fontSize: 13 }}>{fmtTime(fields.expires_at)}</td>
          </tr>
          <tr>
            <td style={{ color: "#666", paddingRight: "1rem", fontSize: 13, whiteSpace: "nowrap" }}>Bandwidth</td>
            <td style={{ fontSize: 13 }}>{fields.bandwidth ? `${fields.bandwidth} kB/s` : "—"}</td>
          </tr>
          <tr>
            <td style={{ color: "#666", paddingRight: "1rem", fontSize: 13, whiteSpace: "nowrap" }}>Issuer</td>
            <td style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>{fields.issuer}</td>
          </tr>
          <tr>
            <td style={{ color: "#666", paddingRight: "1rem", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "top" }}>Token ID</td>
            <td style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all", color: "#999" }}>{fields.token_id}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: "0.5rem", textAlign: "right" }}>
        <a href={`/tokens/${keyId}`} style={{ fontSize: 12, color: "#888" }}>View details →</a>
      </div>

      <div style={{ marginTop: "0.75rem", borderTop: "1px solid #d4edda", paddingTop: "0.75rem" }}>
        {plaintext != null ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.25rem" }}>
              <p style={{ fontSize: 13, color: "green", fontWeight: 600, margin: 0 }}>✓ Preauthkey decrypted</p>
              <button
                onClick={async () => { await navigator.clipboard.writeText(plaintext); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                style={{ fontSize: 12, padding: "2px 10px", cursor: "pointer", marginLeft: "0.5rem", flexShrink: 0 }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <textarea
              readOnly value={plaintext} rows={2}
              style={{ width: "100%", fontFamily: "monospace", fontSize: 11, boxSizing: "border-box" }}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
          </>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 0.5rem" }}>
              Sign with your wallet to decrypt the auth key.
            </p>
            {decryptError && <p style={{ color: "red", fontSize: 12, margin: "0 0 0.4rem" }}>{decryptError}</p>}
            {!account ? (
              <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>Connect wallet to decrypt.</p>
            ) : (
              <button
                onClick={handleDecrypt}
                disabled={decrypting}
                style={{ fontSize: 13, padding: "4px 12px", cursor: "pointer", opacity: decrypting ? 0.6 : 1 }}
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
