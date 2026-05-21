"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { dAppKit } from "@/lib/dappkit";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useMasterSecret } from "@/lib/MasterSecretContext";
import { buildPurchaseAndRedeemTx } from "@/lib/transactions";
import { ecdhKeypairFromSecret, buildClientPubkey } from "@/lib/crypto";
import { EVENT_REDEMPTION_DELIVERY, EVENT_PURCHASE_COMPLETED, ACCESS_KEY_TYPE } from "@/lib/constants";

interface Props {
  listingId:    string;
  tokenId?:     string;
  maxPriceMist: bigint;
  validFrom:    bigint;
  expiresAt:    bigint;
  bandwidth:    bigint;
  disabled?:    boolean;
}

type BtnState =
  | { tag: 'idle' }
  | { tag: 'pending' }
  | { tag: 'waiting'; tokenId: string }
  | { tag: 'error'; message: string }

export function BuyAndRedeemButton({ listingId, tokenId, maxPriceMist, validFrom, expiresAt, bandwidth, disabled }: Props) {
  const account               = useCurrentAccount();
  const router                = useRouter();
  const { getMasterSecret, publicKey } = useMasterSecret();

  const [state, setState] = useState<BtnState>({ tag: 'idle' });

  // ── Poll delivery events while waiting ──────────────────────────────────────
  const { data: deliveryEvents } = useQuery({
    queryKey: ['buyRedeemDelivery', EVENT_REDEMPTION_DELIVERY],
    queryFn:  () => (dAppKit.getClient() as any).queryEvents({
      query: { MoveEventType: EVENT_REDEMPTION_DELIVERY },
      limit: 50,
      order: 'descending',
    }),
    enabled:         state.tag === 'waiting',
    refetchInterval: state.tag === 'waiting' ? 3000 : false,
  });

  // token_id from the matched delivery event — triggers AccessKey polling.
  const deliveredTokenId = (() => {
    if (state.tag !== 'waiting' || !deliveryEvents?.data) return null;
    const match = (deliveryEvents.data as any[]).find((e: any) => {
      const p = e.parsedJson as { token_id: string };
      return p.token_id?.toLowerCase() === state.tokenId.toLowerCase();
    });
    return match ? state.tokenId : null;
  })();

  // ── Poll owned AccessKeys once delivery event arrives ────────────────────────
  const { data: ownedAccessKeys } = useQuery({
    queryKey: ['buyRedeemAccessKeys', account?.address],
    queryFn:  () => (dAppKit.getClient() as any).getOwnedObjects({
      owner:   account?.address ?? '',
      filter:  { StructType: ACCESS_KEY_TYPE },
      options: { showContent: true },
    }),
    enabled:         !!deliveredTokenId && !!account?.address,
    refetchInterval: deliveredTokenId ? 2000 : false,
  });

  // ── Navigate when the AccessKey object appears on-chain ─────────────────────
  useEffect(() => {
    if (!deliveredTokenId || !ownedAccessKeys?.data) return;
    const key = (ownedAccessKeys.data as any[]).find((o: any) => {
      const f = o.data?.content?.fields;
      return f?.token_id?.toLowerCase() === deliveredTokenId.toLowerCase();
    });
    if (key?.data?.objectId) {
      router.push(`/tokens/${key.data.objectId}`);
    }
  }, [ownedAccessKeys, deliveredTokenId, router]);

  if (!account) return <p>Connect your wallet to purchase.</p>;

  // ── Click handler ────────────────────────────────────────────────────────────
  async function handleClick() {
    setState({ tag: 'pending' });
    try {
      const pub = publicKey ?? ecdhKeypairFromSecret(await getMasterSecret()).pub;

      const tx = buildPurchaseAndRedeemTx({
        listingId,
        start:        validFrom,
        end:          expiresAt,
        bandwidth,
        maxPriceMist,
        clientPubkey: buildClientPubkey(pub),
      });

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });

      // The buyer's token may be a split of the original listing token (different ID).
      // Parse the PurchaseCompleted event to get the actual token ID instead of
      // relying on the listing's tokenId prop, which won't match for partial purchases.
      let actualTokenId = tokenId ?? '';
      if ((result as any).$kind === 'Transaction') {
        const digest = (result as any).Transaction.digest;
        const events = await (dAppKit.getClient() as any).queryEvents({
          query: { Transaction: digest },
        });
        const purchaseEvent = (events.data as any[])?.find(
          (e: any) => e.type === EVENT_PURCHASE_COMPLETED,
        );
        if (purchaseEvent?.parsedJson?.token_id) {
          actualTokenId = purchaseEvent.parsedJson.token_id;
        }
      }

      if (!actualTokenId) {
        setState({ tag: 'error', message: 'Could not determine purchased token ID' });
        return;
      }
      setState({ tag: 'waiting', tokenId: actualTokenId });
    } catch (err: unknown) {
      setState({ tag: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (state.tag === 'waiting') {
    return (
      <p style={{ margin: 0, color: '#888', fontSize: '0.95rem', alignSelf: 'center' }}>
        ⏳ Waiting for service provider to deliver auth key…
      </p>
    );
  }

  if (state.tag === 'error') {
    return (
      <span style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <span style={{ color: 'red', fontSize: '0.9rem' }}>
          Buy &amp; Redeem failed: {state.message}
        </span>
        <button onClick={() => setState({ tag: 'idle' })} style={{ fontSize: '0.85rem' }}>
          Retry
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={state.tag === 'pending' || disabled}
      style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
    >
      {state.tag === 'pending'
        ? 'Processing…'
        : `Buy & Redeem for ${(Number(maxPriceMist) / 1e9).toFixed(4)} SUI`}
    </button>
  );
}
