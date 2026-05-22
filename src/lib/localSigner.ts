"use client";

import { Transaction } from "@mysten/sui/transactions";

export async function signAndExecute(tx: Transaction): Promise<any> {
  // Serialize without a client — the server builds, signs, and executes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serialized = (tx as any).serialize();
  const res = await fetch("/api/execute", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ transaction: serialized }),
  });
  if (!res.ok) {
    const text = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { throw new Error((JSON.parse(text) as any).error ?? text); }
    // eslint-disable-next-line no-empty
    catch { throw new Error(text || `HTTP ${res.status}`); }
  }
  return res.json();
}
