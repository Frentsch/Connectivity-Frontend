import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { dAppKit } from "./dappkit";
import { TOKEN_TYPE, ACCESS_KEY_TYPE, MARKETPLACE_ID } from "./constants";

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

export function useToken(tokenId: string) {
  return useQuery({
    queryKey: ["getObject", tokenId],
    queryFn: () =>
      dAppKit.getClient().getObject({ id: tokenId, options: { showContent: true, showOwner: true } }),
    enabled: !!tokenId,
  });
}
