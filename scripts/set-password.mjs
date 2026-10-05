// Sets (or rotates) the app login password stored in the AppPassword table.
// Usage: node --env-file=.env scripts/set-password.mjs "<new password>"
// Rotating signs everyone out (see lib/auth.ts).
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node --env-file=.env scripts/set-password.mjs "<new password>"');
  process.exit(1);
}

// Must match the verify side in lib/auth.ts: "<salt hex>:<scrypt(64) hex>".
const salt = randomBytes(16);
const hash = `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(
  `INSERT INTO "AppPassword" (id, hash) VALUES ('singleton', $1)
   ON CONFLICT (id) DO UPDATE SET hash = EXCLUDED.hash`,
  [hash],
);
await client.end();
console.log("Password set.");
