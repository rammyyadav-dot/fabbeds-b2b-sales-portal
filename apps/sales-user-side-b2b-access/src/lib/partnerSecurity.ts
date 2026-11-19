import { zite } from 'zitejs/db';

// CTO audit B1/B3: no signing key in source code, short sessions, server-side revocation.
// Key order: ZITE_PARTNER_SESSION_SECRET (app secret) → System Secrets table (server-only, generated randomly).
const TOKEN_VERSION = 'v2';
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;   // 12 hours
export const SESSION_REFRESH_AFTER_MS = 60 * 60 * 1000;  // re-issue once a session is 1 hour old

let cachedSecret: string | null = null;
async function sessionSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.ZITE_PARTNER_SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) return (cachedSecret = fromEnv);
  const res = await (zite as any).systemSecrets.findAll({ filters: { secretName: 'PARTNER_SESSION_SECRET' }, limit: 5 });
  const rec = [...res.records].sort((a: any, b: any) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))[0];
  const value = String(rec?.secretValue || '');
  if (value.length < 32) throw new Error('Partner session signing key is not configured.');
  return (cachedSecret = value);
}

async function hmacKey(usage: 'sign' | 'verify') {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(await sessionSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

export interface PartnerSession { accountId: string; issuedAt: number }

/** Verifies signature, age, account status and revocation. Returns null for any invalid session. */
export async function verifyPartnerSession(token: string): Promise<PartnerSession | null> {
  try {
    const parts = atob(String(token || '')).split(':');
    if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) return null; // legacy v1 tokens are rejected
    const [, accountId, ts, sigHex] = parts;
    const issuedAt = Number(ts);
    if (!accountId || !Number.isFinite(issuedAt) || Date.now() - issuedAt > SESSION_MAX_AGE_MS || issuedAt > Date.now() + 60000) return null;
    const pairs = sigHex.match(/.{2}/g);
    if (!pairs) return null;
    const ok = await crypto.subtle.verify('HMAC', await hmacKey('verify'), new Uint8Array(pairs.map(h => parseInt(h, 16))), new TextEncoder().encode(`${TOKEN_VERSION}:${accountId}:${issuedAt}`));
    if (!ok) return null;
    const account: any = await zite.partnerAccounts.findOne({ id: accountId });
    if (!account || account.accountStatus === 'Suspended') return null;
    const revokedAt = account.sessionsRevokedAt ? new Date(account.sessionsRevokedAt).getTime() : 0;
    if (revokedAt && issuedAt <= revokedAt) return null;
    return { accountId, issuedAt };
  } catch {
    return null;
  }
}

export async function verifyPartnerToken(token: string): Promise<string | null> {
  return (await verifyPartnerSession(token))?.accountId ?? null;
}

export async function createPartnerToken(accountId: string): Promise<string> {
  const issuedAt = Date.now();
  const sig = await crypto.subtle.sign('HMAC', await hmacKey('sign'), new TextEncoder().encode(`${TOKEN_VERSION}:${accountId}:${issuedAt}`));
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return btoa(`${TOKEN_VERSION}:${accountId}:${issuedAt}:${sigHex}`);
}
