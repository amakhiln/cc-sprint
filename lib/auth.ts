import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "@/infrastructure/db/client";

export const AUTH_COOKIE = "pm-auth";
export const SESSION_SECONDS = 9 * 60 * 60;

// ponytail: cached 60s so the proxy isn't a DB round-trip on every request.
// Ceiling: a password change takes up to 60s to sign out other sessions on a
// warm server. Drop the TTL if that matters.
let cached: { hash: string; at: number } | null = null;

async function storedHash(): Promise<string | null> {
  if (cached && Date.now() - cached.at < 60_000) return cached.hash;
  const row = await prisma.appPassword.findUnique({ where: { id: "singleton" } });
  cached = row ? { hash: row.hash, at: Date.now() } : null;
  return row?.hash ?? null;
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

// Token is "<expiresAtMs>.<sig>", signed with the stored hash (secret,
// salted): the expiry is enforced server-side, not just by the cookie's
// maxAge, and rotating the password invalidates every existing token.
function sign(hash: string, expiresAt: string): string {
  return createHmac("sha256", hash).update(`pm-auth-v2.${expiresAt}`).digest("hex");
}

function tokenFor(hash: string): string {
  const expiresAt = String(Date.now() + SESSION_SECONDS * 1000);
  return `${expiresAt}.${sign(hash, expiresAt)}`;
}

// Returns the cookie value to set on a correct password, else null. Fails
// closed when no password has been set yet.
export async function tokenForPassword(attempt: string): Promise<string | null> {
  const hash = await storedHash();
  if (!hash) return null;
  const [salt, expected] = hash.split(":");
  // Must match scripts/set-password.mjs.
  const actual = scryptSync(attempt, Buffer.from(salt, "hex"), 64);
  return safeEqual(actual, Buffer.from(expected, "hex")) ? tokenFor(hash) : null;
}

export async function isValidToken(value: string | undefined): Promise<boolean> {
  const [expiresAt, sig] = value?.split(".") ?? [];
  if (!expiresAt || !sig || !(Number(expiresAt) > Date.now())) return false;
  const hash = await storedHash();
  return !!hash && safeEqual(Buffer.from(sig), Buffer.from(sign(hash, expiresAt)));
}
