/**
 * Master-secret lifecycle helpers using Seal IBE.
 *
 * The master secret S (32 random bytes) is encrypted with Seal IBE under the
 * identity = BCS-serialised sender address.  The ciphertext (~300 bytes) is
 * stored directly in the UserSecret Move object rather than on Walrus, which
 * keeps the setup flow to a single wallet approval and avoids WAL token
 * requirements.  Walrus can replace on-chain storage for larger payloads.
 */

import { SealClient, SessionKey } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import type { SealCompatibleClient } from "@mysten/seal";
import { PACKAGE_ID, SEAL_SERVER_CONFIGS, SEAL_THRESHOLD } from "./constants";

// Seal identity for a given address = hex of BCS-serialised 32-byte address,
// matching what `bcs::to_bytes(&sender)` produces in the Move seal_approve function.
function sealId(address: string): string {
  return bcs.Address.serialize(address).toHex();
}

export function makeSealClient(suiClient: SealCompatibleClient): SealClient {
  return new SealClient({
    suiClient,
    serverConfigs: SEAL_SERVER_CONFIGS,
    verifyKeyServers: false,
  });
}

/**
 * Generate a fresh 32-byte master secret, derive its public key, and Seal-encrypt it.
 * Returns the raw secret (for immediate use), the public key (stored openly on-chain),
 * and the encrypted secret bytes (stored sealed on-chain).
 */
export async function encryptNewMasterSecret(
  sealClient: SealClient,
  address: string,
): Promise<{ masterSecret: Uint8Array; publicKey: Uint8Array; encryptedSecret: Uint8Array }> {
  const masterSecret = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const { x25519 } = await import("@noble/curves/ed25519");
  const publicKey = x25519.getPublicKey(masterSecret);

  const { encryptedObject } = await sealClient.encrypt({
    threshold: SEAL_THRESHOLD,
    packageId:  PACKAGE_ID,
    id:         sealId(address),
    data:       masterSecret,
  });

  return { masterSecret, publicKey, encryptedSecret: encryptedObject };
}

/**
 * Decrypt an encrypted master secret fetched from a UserSecret object.
 * Requires one wallet sign for the Seal SessionKey.
 */
export async function decryptMasterSecret(params: {
  sealClient:           SealClient;
  suiClient:            SealCompatibleClient;
  address:              string;
  encryptedSecret:      Uint8Array;
  signPersonalMessage:  (msg: Uint8Array) => Promise<{ signature: string }>;
}): Promise<Uint8Array> {
  const { sealClient, suiClient, address, encryptedSecret, signPersonalMessage } = params;

  const sessionKey = await SessionKey.create({
    address,
    packageId: PACKAGE_ID,
    ttlMin:    10,
    suiClient,
  });

  const msg = sessionKey.getPersonalMessage();
  const { signature } = await signPersonalMessage(msg);
  await sessionKey.setPersonalMessageSignature(signature);

  const txBytes = await buildSealApproveTxBytes(address);

  return sealClient.decrypt({ data: encryptedSecret, sessionKey, txBytes });
}

// Builds the transaction that calls seal_approve — submitted as dry_run by Seal
// key servers to verify the caller's identity before releasing key shares.
async function buildSealApproveTxBytes(address: string): Promise<Uint8Array> {
  const tx = new Transaction();
  tx.moveCall({
    target:    `${PACKAGE_ID}::user_secret::seal_approve`,
    arguments: [tx.pure.vector("u8", Array.from(bcs.Address.serialize(address).toBytes()))],
  });
  // onlyTransactionKind = true produces bytes compatible with dry_run_transaction_block
  return tx.build({ onlyTransactionKind: true });
}
