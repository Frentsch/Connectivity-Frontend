"use client";

import { useState } from "react";

interface Props {
  accessKeyObject: {
    objectId: string;
    content?: {
      dataType: string;
      fields: Record<string, unknown>;
    };
  };
}

// Sui JSON RPC returns vector<u8> as number[] in parsed object content.
function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
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

  const keyId  = accessKeyObject.objectId;
  const hexKey = bytesToHex(fields.auth_key);
  const [copied, setCopied] = useState(false);

  async function copyKey() {
    await navigator.clipboard.writeText(hexKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ border: "1px solid #c8e6c9", borderRadius: 8, padding: "1rem", background: "#f9fff9" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>{fields.service_name}</h3>
        <span style={{ color: "green", fontWeight: 600, fontSize: 13 }}>✓ Delivered</span>
      </div>

      <p style={{ fontFamily: "monospace", fontSize: 11, color: "#999", marginTop: 4 }}>{keyId}</p>

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.25rem" }}>
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
            Encrypted auth key (hex, encrypted for your public key):
          </p>
          <button
            onClick={copyKey}
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
    </div>
  );
}
