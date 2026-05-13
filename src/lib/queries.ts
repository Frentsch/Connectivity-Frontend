import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { dAppKit } from "./dappkit";
import { TOKEN_TYPE, ACCESS_KEY_TYPE, MARKETPLACE_ID, USER_SECRET_TYPE, PACKAGE_ID, EVENT_PURCHASE_COMPLETED } from "./constants";

/**
 * Returns the set of AccessToken object IDs currently owned by `address`.
 * Used by BuyButton to identify the newly created token after a purchase.
 */
export async function fetchOwnedTokenIds(address: string): Promise<Set<string>> {
  const result = await dAppKit.getClient().getOwnedObjects({
    owner: address,
    filter: { StructType: TOKEN_TYPE },
    options: {},
  });
  return new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result.data.map((o: any) => o.data?.objectId as string | undefined).filter((id): id is string => !!id)
  );
}

export function useListings() {
  return useQuery({
    queryKey: ["listings", MARKETPLACE_ID],
    queryFn: async () => {
      if (!MARKETPLACE_ID) return [];

      // 1. Fetch the Marketplace object to get the ObjectBag ID
      const mp = await dAppKit.getClient().getObject({
        id: MARKETPLACE_ID,
        options: { showContent: true },
      });
      const bagId = ((mp.data?.content as any)?.fields?.listings as any)?.fields?.id?.id as string | undefined;
      if (!bagId) return [];

      // 2. List all dynamic fields of the bag (each objectId is a ServiceListing ID)
      const df = await dAppKit.getClient().getDynamicFields({ parentId: bagId });
      if (df.data.length === 0) return [];

      // 3. Fetch all listings in one call
      const listings = await dAppKit.getClient().multiGetObjects({
        ids: df.data.map((f) => f.objectId),
        options: { showContent: true },
      });
      return listings.filter((l) => !!l.data?.content);
    },
    enabled: !!MARKETPLACE_ID,
    staleTime: 30_000,
  });
}

export function useListing(listingId: string) {
  return useQuery({
    queryKey: ["getObject", listingId],
    queryFn: () =>
      dAppKit.getClient().getObject({ id: listingId, options: { showContent: true, showOwner: true } }),
    enabled: !!listingId,
  });
}

export function useMyTokens() {
  const account = useCurrentAccount();
  return useQuery({
    queryKey: ["getOwnedObjects", account?.address, TOKEN_TYPE],
    queryFn: () =>
      dAppKit.getClient().getOwnedObjects({
        owner: account?.address ?? "",
        filter: { StructType: TOKEN_TYPE },
        options: { showContent: true },
      }),
    enabled: !!account?.address,
  });
}

export function useMyAccessKeys() {
  const account = useCurrentAccount();
  return useQuery({
    queryKey: ["getOwnedObjects", account?.address, ACCESS_KEY_TYPE],
    queryFn: () =>
      dAppKit.getClient().getOwnedObjects({
        owner: account?.address ?? "",
        filter: { StructType: ACCESS_KEY_TYPE },
        options: { showContent: true },
      }),
    enabled: !!account?.address,
  });
}

export function useMyListings() {
  const account = useCurrentAccount();
  const query   = useListings();
  const myListings = (query.data ?? []).filter((obj) => {
    const issuer = (obj.data?.content as any)?.fields?.issuer as string | undefined;
    return issuer?.toLowerCase() === account?.address?.toLowerCase();
  });
  return { ...query, data: myListings };
}

/**
 * Finds the UserSecret object owned by `address` and returns the
 * encrypted_secret bytes, or null if none exists yet (first-time setup needed).
 */
export function useUserSecret(address?: string) {
  return useQuery({
    queryKey: ["userSecret", address],
    enabled:  !!address,
    queryFn:  async () => {
      const result = await dAppKit.getClient().getOwnedObjects({
        owner:   address!,
        filter:  { StructType: USER_SECRET_TYPE },
        options: { showContent: true },
      });
      if (!result.data.length) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields = (result.data[0].data?.content as any)?.fields;
      const rawPub = fields?.public_key       as number[] | undefined;
      const rawEnc = fields?.encrypted_secret as number[] | undefined;
      if (!rawPub || !rawEnc) return null;
      return {
        publicKey:       new Uint8Array(rawPub),
        encryptedSecret: new Uint8Array(rawEnc),
      };
    },
  });
}

export interface EscrowEntry {
  escrowId:  string;
  tokenId:   string;
  buyer:     string;
  seller:    string;
  amount:    number;  // MIST
  status:    number;  // 0=purchased 1=redeemed 2=delivered
  expiresAt: number;  // Unix seconds
}

type PurchaseEvent = { token_id: string; escrow_id: string; buyer: string; seller: string; amount: string };

async function fetchEscrowEntries(filterKey: "buyer" | "seller", address: string): Promise<EscrowEntry[]> {
  const events = await dAppKit.getClient().queryEvents({
    query: { MoveEventType: EVENT_PURCHASE_COMPLETED },
    limit: 100,
    order: "descending",
  });
  const myEvents = events.data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((e) => e.parsedJson as PurchaseEvent)
    .filter((p) => p[filterKey].toLowerCase() === address.toLowerCase());
  if (!myEvents.length) return [];
  const objects = await dAppKit.getClient().multiGetObjects({
    ids: myEvents.map((p) => p.escrow_id),
    options: { showContent: true },
  });
  return myEvents.flatMap((ev, i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields = (objects[i]?.data?.content as any)?.fields;
    if (!fields) return [];  // escrow already claimed / deleted
    return [{
      escrowId:  ev.escrow_id,
      tokenId:   ev.token_id,
      buyer:     ev.buyer,
      seller:    ev.seller,
      amount:    Number(ev.amount),
      status:    Number(fields.status),
      expiresAt: Number(fields.expires_at),
    }];
  });
}

/** Escrows where the current user is the seller (for My Listings). */
export function useMySellerEscrows() {
  const account = useCurrentAccount();
  return useQuery<EscrowEntry[]>({
    queryKey: ["sellerEscrows", account?.address],
    enabled:  !!account?.address,
    queryFn:  () => fetchEscrowEntries("seller", account!.address),
  });
}

/** Escrows where the current user is the buyer (for My Tokens). */
export function useMyBuyerEscrows() {
  const account = useCurrentAccount();
  return useQuery<EscrowEntry[]>({
    queryKey: ["buyerEscrows", account?.address],
    enabled:  !!account?.address,
    queryFn:  () => fetchEscrowEntries("buyer", account!.address),
  });
}

/**
 * Finds the escrow_id for a given token by querying PurchaseCompleted events.
 * Returns null while loading or if no matching event is found.
 */
export function useEscrowForToken(tokenId?: string) {
  return useQuery({
    queryKey: ["escrowForToken", tokenId],
    enabled:  !!tokenId,
    queryFn:  async () => {
      const eventType = `${PACKAGE_ID}::marketplace::PurchaseCompleted`;
      const result = await dAppKit.getClient().queryEvents({
        query: { MoveEventType: eventType },
        limit: 50,
        order: "descending",
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const match = result.data.find((e) => (e.parsedJson as any)?.token_id === tokenId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return match ? ((match.parsedJson as any).escrow_id as string) : null;
    },
  });
}

export function useToken(tokenId: string) {
  return useQuery({
    queryKey: ["getObject", tokenId],
    queryFn: () =>
      dAppKit.getClient().getObject({ id: tokenId, options: { showContent: true, showOwner: true, showType: true } }),
    enabled: !!tokenId,
  });
}
