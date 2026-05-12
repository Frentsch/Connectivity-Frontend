import { x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";

// @noble/hashes returns Uint8Array<ArrayBufferLike>; Web Crypto requires a
// concrete ArrayBuffer. This helper copies the bytes into a fresh allocation.
function toBuffer(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

/**
 * Derive the user's X25519 keypair from their master secret.
 * The master secret is used directly as the private key scalar.
 * The corresponding public key is stored openly on the UserSecret Move object
 * so that the redeem flow never needs to decrypt the master secret.
 */
export function ecdhKeypairFromSecret(masterSecret: Uint8Array): { priv: Uint8Array; pub: Uint8Array } {
  return { priv: masterSecret, pub: x25519.getPublicKey(masterSecret) };
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

  // Use buffer.slice() to produce concrete ArrayBuffer-backed views required by Web Crypto.
  const buf        = ciphertext.buffer.slice(ciphertext.byteOffset, ciphertext.byteOffset + ciphertext.byteLength) as ArrayBuffer;
  const ephemeralPub = new Uint8Array(buf, 0, 32);
  const nonce        = new Uint8Array(buf, 32, 12);
  const ct           = buf.slice(44);

  const sharedSecret = x25519.getSharedSecret(privKey, ephemeralPub);
  const key          = hkdf(sha256, sharedSecret, new Uint8Array(0), new Uint8Array(0), 32);

  const cryptoKey = await globalThis.crypto.subtle.importKey("raw", toBuffer(key), "AES-GCM", false, ["decrypt"]);
  const plaintext = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, cryptoKey, ct);
  return new Uint8Array(plaintext);
}
