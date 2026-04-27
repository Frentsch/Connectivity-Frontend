/**
 * proof.ts — helpers for the off-chain ownership proof / JWT flow.
 *
 * Flow:
 *   1. Frontend asks the service for a challenge nonce.
 *   2. Frontend signs a deterministic message with the wallet.
 *   3. Frontend sends (tokenId, signature, walletAddress, nonce) to the service.
 *   4. Service verifies on-chain ownership + signature, then issues a JWT.
 *
 * The signed message is a plain text string (not JSON) to keep it human-readable
 * in the wallet modal. The service endpoint acts as a domain separator to
 * prevent signatures being reused across different services.
 */

/**
 * Build the challenge message the wallet will sign.
 * Must be deterministic and reproducible by the verifying service.
 */
export function buildChallengeMessage(params: {
  tokenId: string;
  nonce: string;
  serviceEndpoint: string;
  expiresAtMs: number;
}): string {
  return [
    "SUI-ACCESS-PROOF",
    `service:${params.serviceEndpoint}`,
    `token:${params.tokenId}`,
    `nonce:${params.nonce}`,
    `expires:${params.expiresAtMs}`,
  ].join("\n");
}

/** Encode the challenge string to Uint8Array for useSignPersonalMessage. */
export function encodeChallenge(message: string): Uint8Array {
  return new TextEncoder().encode(message);
}

/**
 * Service-side verification reference (Node.js, using @mysten/sui):
 *
 * ```ts
 * import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
 * import { SuiClient } from "@mysten/sui/client";
 *
 * async function verifyOwnership(body: VerifyBody) {
 *   // 1. Consume the nonce (check it exists in a TTL store)
 *   if (!nonceStore.consume(body.nonce)) throw new Error("Invalid or expired nonce");
 *
 *   // 2. Verify the wallet signature
 *   const messageBytes = Buffer.from(body.message, "base64");
 *   const signerAddress = await verifyPersonalMessageSignature(messageBytes, body.signature);
 *   if (signerAddress !== body.walletAddress) throw new Error("Signature mismatch");
 *
 *   // 3. Verify on-chain token ownership
 *   const client = new SuiClient({ url: "https://fullnode.mainnet.sui.io" });
 *   const obj = await client.getObject({ id: body.tokenId, options: { showContent: true, showOwner: true } });
 *   const owner = (obj.data?.owner as any)?.AddressOwner;
 *   if (owner !== body.walletAddress) throw new Error("Token not owned by wallet");
 *
 *   // 4. Verify token is valid (not revoked, not expired)
 *   const fields = (obj.data?.content as any)?.fields;
 *   if (fields.is_revoked) throw new Error("Token revoked");
 *   const expiresAt = Number(fields.expires_at_ms);
 *   if (expiresAt > 0 && Date.now() > expiresAt) throw new Error("Token expired");
 *   if (fields.listing_id !== body.listingId) throw new Error("Listing mismatch");
 *
 *   // 5. Issue JWT
 *   return jwt.sign({ sub: body.walletAddress, token: body.tokenId, listing: body.listingId }, SECRET);
 * }
 * ```
 */
