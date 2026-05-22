import { readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';

const NETWORK = (process.env.NEXT_PUBLIC_NETWORK as 'devnet' | 'testnet' | 'mainnet') ?? 'testnet';

function loadKeypair(): Ed25519Keypair {
  const ks = JSON.parse(
    readFileSync(path.join(homedir(), '.sui', 'sui_config', 'sui.keystore'), 'utf-8')
  ) as string[];
  const raw = Buffer.from(ks[0], 'base64'); // flag(1) + privkey(32)
  return Ed25519Keypair.fromSecretKey(raw.subarray(1, 33));
}

export async function POST(req: Request) {
  try {
    const { transaction: serialized } = await req.json() as { transaction: string };
    const keypair = loadKeypair();
    const client  = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl(NETWORK), network: NETWORK });
    const tx      = Transaction.from(serialized);
    // SuiJsonRpcClient.signAndExecuteTransaction spreads extra props into
    // executeTransactionBlock, so passing `options` (not `include`) reaches the RPC.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (client as any).signAndExecuteTransaction({
      signer:      keypair,
      transaction: tx,
      options: {
        showObjectChanges: true,
        showEvents:        true,
      },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
