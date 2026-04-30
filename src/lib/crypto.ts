/**
 * Frontend crypto utilities for signature-derived ECDH key and ECIES decryption.
 *
 * Scheme:
 *   SIGN_MSG    = "connectivity-marketplace:{token_id}"
 *   signature   = wallet.signPersonalMessage(SIGN_MSG)   (Sui serialized: flag||sig||pub)
 *   seed        = HKDF-SHA256(ikm=signature, salt=token_id, info="connectivity-marketplace:ecdh-key-v1", len=32)
 *   x25519_priv = seed
 *   x25519_pub  = x25519.getPublicKey(seed)
 *
 *   client_pubkey on-chain = [0x00, ...x25519_pub_32_bytes]
 *
 * ECIES decrypt mirrors orchestrator encryptX25519:
 *   ephemeral_pub(32) || nonce(12) || ciphertext
 *   sharedSecret = x25519.getSharedSecret(priv, ephemeral_pub)
 *   key = HKDF-SHA256(sharedSecret, salt=[], info=[], len=32)
 *   plaintext = AES-256-GCM-decrypt(key, nonce, ciphertext)
 */

import { x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";

const SIGN_PREFIX = "connectivity-marketplace:";
const ECDH_INFO   = new TextEncoder().encode("connectivity-marketplace:ecdh-key-v1");

/** The message to sign for a given token ID. */
export function signingMessage(tokenId: string): Uint8Array {
  return new TextEncoder().encode(`${SIGN_PREFIX}${tokenId}`);
}

/**
 * Parse the Sui serialized signature returned by signPersonalMessage.
 * Format: base64(flag(1) || signature(64) || pubkey(32|33))
 * Returns the raw bytes — all parts are deterministic and used as HKDF input.
 */
export function parseSuiSignature(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Derive a deterministic X25519 keypair from a wallet signature and token ID.
 * Returns the 32-byte private key and 32-byte public key.
 */
export function deriveEcdhKey(signatureBytes: Uint8Array, tokenId: string): {
  priv: Uint8Array;
  pub:  Uint8Array;
} {
  const salt = new TextEncoder().encode(tokenId);
  const seed = hkdf(sha256, signatureBytes, salt, ECDH_INFO, 32);
  return { priv: seed, pub: x25519.getPublicKey(seed) };
}

/**
 * Build the client_pubkey field value for the redeem transaction.
 * Returns [0x00, ...x25519_pub_32_bytes] — 33 bytes total.
 */
export function buildClientPubkey(x25519Pub: Uint8Array): Uint8Array {
  const out = new Uint8Array(33);
  out[0] = 0x00;
  out.set(x25519Pub, 1);
  return out;
}

/**
 * ECIES decrypt — mirrors the orchestrator's encryptX25519 exactly.
 *
 * Ciphertext layout: ephemeral_pub(32) || nonce(12) || encrypted_data
 * HKDF parameters must match orchestrator: empty salt, empty info.
 */
export async function eciesDecrypt(ciphertext: Uint8Array, privKey: Uint8Array): Promise<Uint8Array> {
  if (ciphertext.length < 44) throw new Error("Ciphertext too short");

  const ephemeralPub = ciphertext.slice(0, 32);
  const nonce        = ciphertext.slice(32, 44);
  const ct           = ciphertext.slice(44);

  const sharedSecret = x25519.getSharedSecret(privKey, ephemeralPub);
  const key          = hkdf(sha256, sharedSecret, new Uint8Array(0), new Uint8Array(0), 32);

  const cryptoKey  = await globalThis.crypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]);
  const plaintext  = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, cryptoKey, ct);
  return new Uint8Array(plaintext);
}
