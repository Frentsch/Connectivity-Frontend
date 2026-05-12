import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, MARKETPLACE_ID, SUI_COIN_TYPE } from "./constants";

/**
 * Build a PTB that calls access_token::create_access_token.
 * Returns the created AccessToken object to the sender.
 */
export function buildCreateAccessTokenTx(params: {
  name: string;
  ipAddress: string;
  loginServer: string;
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
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(params.loginServer))),
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
  minPriceMist: bigint;
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
      tx.pure.u64(params.minPriceMist),
      tx.pure.u64(params.minBandwidth),
      tx.pure.u64(params.minDuration),
      tx.pure.u64(params.bwGranularity),
      tx.pure.u64(params.timeGranularity),
    ],
  });
  return tx;
}

export function buildCreateAndListTx(params: {
  name: string;
  ipAddress: string;
  loginServer: string;
  validFrom: bigint;
  expiresAt: bigint;
  maxBandwidth: bigint;
  priceMist: bigint;
  minPriceMist: bigint;
  minBandwidth: bigint;
  minDuration: bigint;
  bwGranularity: bigint;
  timeGranularity: bigint;
}): Transaction {
  const tx = new Transaction();
  const enc = (s: string) => Array.from(new TextEncoder().encode(s));

  const [token] = tx.moveCall({
    target: `${PACKAGE_ID}::access_token::create_access_token_obj`,
    arguments: [
      tx.pure.vector("u8", enc(params.name)),
      tx.pure.vector("u8", enc(params.ipAddress)),
      tx.pure.vector("u8", enc(params.loginServer)),
      tx.pure.u64(params.validFrom),
      tx.pure.u64(params.expiresAt),
      tx.pure.u64(params.maxBandwidth),
    ],
  });

  tx.moveCall({
    target: `${PACKAGE_ID}::marketplace::create_listing`,
    typeArguments: [SUI_COIN_TYPE],
    arguments: [
      tx.object(MARKETPLACE_ID),
      token,
      tx.pure.u64(params.priceMist),
      tx.pure.u64(params.minPriceMist),
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
  listingId:    string;
  start:        bigint;   // Unix seconds
  end:          bigint;   // Unix seconds
  bandwidth:    bigint;   // kB/s
  maxPriceMist: bigint;   // buyer's price cap — tx aborts if listing price exceeds this
}): Transaction {
  const tx = new Transaction();

  // Split exactly maxPriceMist from the gas coin so the Move contract can only
  // take up to that amount. If the listing price has risen above the cap the
  // split coin won't cover it and the transaction aborts, protecting the buyer.
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(params.maxPriceMist)]);

  tx.moveCall({
    target: `${PACKAGE_ID}::marketplace::purchase`,
    typeArguments: [SUI_COIN_TYPE],
    arguments: [
      tx.object(MARKETPLACE_ID),
      tx.pure.address(params.listingId),
      payment,
      tx.pure.u64(params.start),
      tx.pure.u64(params.end),
      tx.pure.u64(params.bandwidth),
    ],
  });

  // Merge any unspent change back into the gas coin (price < maxPrice case).
  tx.mergeCoins(tx.gas, [payment]);

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
 * Build a PTB that calls user_secret::register_secret.
 * Stores the X25519 public key (openly) and the Seal-encrypted master secret.
 */
export function buildRegisterSecretTx(publicKey: Uint8Array, encryptedSecret: Uint8Array): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target:    `${PACKAGE_ID}::user_secret::register_secret`,
    arguments: [
      tx.pure.vector("u8", Array.from(publicKey)),
      tx.pure.vector("u8", Array.from(encryptedSecret)),
    ],
  });
  return tx;
}

export function buildDelistTx(listingId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::marketplace::delist`,
    typeArguments: [SUI_COIN_TYPE],
    arguments: [
      tx.object(MARKETPLACE_ID),
      tx.pure.address(listingId),
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
