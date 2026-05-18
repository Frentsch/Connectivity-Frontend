// Deployed package ID — set via NEXT_PUBLIC_PACKAGE_ID env var after `sui client publish`
export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID ?? "";

// Marketplace shared object — set via NEXT_PUBLIC_MARKETPLACE_ID env var
export const MARKETPLACE_ID = process.env.NEXT_PUBLIC_MARKETPLACE_ID ?? "";

// Coin type used by the marketplace
export const SUI_COIN_TYPE = "0x2::sui::SUI";

// Move type paths
export const LISTING_TYPE    = `${PACKAGE_ID}::marketplace::ServiceListing`;
export const TOKEN_TYPE      = `${PACKAGE_ID}::access_token::AccessToken`;
export const ACCESS_KEY_TYPE = `${PACKAGE_ID}::access_token::AccessKey`;

// Events emitted by the contract
export const EVENT_LISTING_CREATED       = `${PACKAGE_ID}::marketplace::ListingCreated`;
export const EVENT_REDEMPTION_DELIVERY   = `${PACKAGE_ID}::access_token::RedemptionDelivery`;
export const EVENT_PURCHASE_COMPLETED    = `${PACKAGE_ID}::marketplace::PurchaseCompleted`;

// Escrow status values (mirror escrow.move constants)
export const ESCROW_STATUS_PURCHASED = 0;
export const ESCROW_STATUS_REDEEMED  = 1;
export const ESCROW_STATUS_DELIVERED = 2;
export const ESCROW_GRACE_PERIOD = 30; 

// Active network — override with NEXT_PUBLIC_NETWORK=mainnet in production
export const DEFAULT_NETWORK =
  (process.env.NEXT_PUBLIC_NETWORK as "devnet" | "testnet" | "mainnet") ?? "testnet";

// UserSecret — stores the Seal-encrypted master key on-chain
export const USER_SECRET_TYPE = `${PACKAGE_ID}::user_secret::UserSecret`;

// Seal testnet key server configs — object IDs from https://seal-docs.wal.app
// Replace with mainnet server object IDs before deploying.
export const SEAL_SERVER_CONFIGS = [
  { objectId: process.env.NEXT_PUBLIC_SEAL_SERVER_1 ?? "", weight: 1 },
  { objectId: process.env.NEXT_PUBLIC_SEAL_SERVER_2 ?? "", weight: 1 },
];
export const SEAL_THRESHOLD = 2;
