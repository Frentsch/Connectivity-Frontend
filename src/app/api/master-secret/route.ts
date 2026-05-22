import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

const SECRET_PATH = path.join(homedir(), '.connectivity-marketplace', 'master_secret.b64');

export async function GET() {
  if (!existsSync(SECRET_PATH)) {
    mkdirSync(path.dirname(SECRET_PATH), { recursive: true });
    const secret = crypto.getRandomValues(new Uint8Array(32));
    writeFileSync(SECRET_PATH, Buffer.from(secret).toString('base64'), { mode: 0o600 });
  }
  const secret = readFileSync(SECRET_PATH, 'utf-8').trim();
  return Response.json({ secret });
}
