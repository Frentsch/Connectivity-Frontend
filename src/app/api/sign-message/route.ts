import { readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

function loadKeypair(): Ed25519Keypair {
  const ks = JSON.parse(
    readFileSync(path.join(homedir(), '.sui', 'sui_config', 'sui.keystore'), 'utf-8')
  ) as string[];
  const raw = Buffer.from(ks[0], 'base64');
  return Ed25519Keypair.fromSecretKey(raw.subarray(1, 33));
}

export async function POST(req: Request) {
  const { message } = await req.json() as { message: number[] };
  const keypair   = loadKeypair();
  const bytes     = new Uint8Array(message);
  const signature = await keypair.signPersonalMessage(bytes);
  return Response.json({
    signature: signature.signature,
    bytes:     Array.from(bytes),
  });
}
