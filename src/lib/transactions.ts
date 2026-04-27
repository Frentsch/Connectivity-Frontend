import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, MARKETPLACE_ID, SUI_COIN_TYPE } from "./constants";

/**
 * Build a PTB that calls access_token::create_access_token.
 * Returns the created AccessToken object to the sender.
 */
export function buildCreateAccessTokenTx(params: {
  name: string;
  ipAddress: string;
  validFrom: bigint;  // Unix seconds; 0 = now
  expiresAt: bigint;  // Unix seconds
  maxBandwidth: bigint; // kB/s
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::access_token::create_access_token`,
    arguments: [
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(params.name))),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(params.ipAddress))),
      tx.pure.u64(params.validFrom),
      tx.pure.u64(params.expiresAt),
      tx.pure.u64(params.maxBandwidth),
    ],
  });
  return tx;
}

/**
 * Build a PTB that calls marketplace::create_listing.
 * The caller must already own the AccessToken (from buildCreateAccessTokenTx).
 */
export function buildCreateListingTx(params: {
  tokenId: string;
  priceMist: bigint;
  minBandwidth: bigint;
  minDuration: bigint;
  bwGranularity: bigint;
  timeGranularity: bigint;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::marketplace::create_listing`,
    typeArguments: [SUI_COIN_TYPE],
    arguments: [
      tx.object(MARKETPLACE_ID),
      tx.object(params.tokenId),
      tx.pure.u64(params.priceMist),
      tx.pure.u64(params.minBandwidth),
      tx.pure.u64(params.minDuration),
      tx.pure.u64(params.bwGranularity),
      tx.pure.u64(params.timeGranularity),
    ],
  });
  return tx;
}

/**
 * Build a PTB that calls marketplace::purchase.
 *
 * Passes tx.gas directly as the &mut Coin<SUI> payment argument.
 * The Move function splits exactly `price_mist` from it and transfers
 * that to the seller; the remainder stays in the gas coin.
 */
export function buildPurchaseTx(params: {
  listingId: string;
  start: bigint;      // Unix seconds
  end: bigint;        // Unix seconds
  bandwidth: bigint;  // kB/s
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::marketplace::purchase`,
    typeArguments: [SUI_COIN_TYPE],
    arguments: [
      tx.object(MARKETPLACE_ID),           // &mut Marketplace<SUI>
      tx.pure.address(params.listingId),   // listing_id: ID  (same BCS encoding as address)
      tx.gas,                               // &mut Coin<SUI>
      tx.pure.u64(params.start),
      tx.pure.u64(params.end),
      tx.pure.u64(params.bandwidth),
    ],
  });
  return tx;
}

/**
 * Build a PTB that calls access_token::redeem.
 * Passes the wallet's public key (flag_byte || raw_pubkey_bytes) so the
 * service provider can encrypt the auth key back to this wallet.
 */
export function buildRedeemTx(params: {
  tokenId: string;
  clientPubkey: Uint8Array; // [scheme_flag, ...raw_pubkey_bytes]
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::access_token::redeem`,
    arguments: [
      tx.object(params.tokenId),
      tx.pure.vector("u8", Array.from(params.clientPubkey)),
    ],
  });
  return tx;
}

/**
 * Build a PTB that calls marketplace::update_listing.
 */
export function buildUpdateListingTx(params: {
  listingId: string;
  newPriceMist: bigint;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::marketplace::update_listing`,
    typeArguments: [SUI_COIN_TYPE],
    arguments: [
      tx.object(MARKETPLACE_ID),
      tx.pure.address(params.listingId),
      tx.pure.u64(params.newPriceMist),
    ],
  });
  return tx;
}
