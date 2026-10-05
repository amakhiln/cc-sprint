import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString?.trim()) {
    throw new Error(
      "DATABASE_URL environment variable is not set. Set it in .env (see .env.example) before using the database.",
    );
  }

  // Honor ?schema= like the Prisma CLI does (migrate deploy targets it) --
  // the adapter otherwise always queries "public". Lets a dev/test schema
  // (e.g. ?schema=pm_test) live in the same Supabase project.
  const url = new URL(connectionString);
  const schema = url.searchParams.get("schema") ?? undefined;
  url.searchParams.delete("schema");
  const adapter = new PrismaPg({ connectionString: url.toString() }, { schema });
  return new PrismaClient({ adapter });
}

// Reuse the client across hot reloads in dev so we don't exhaust the
// connection pool with a new PrismaClient per edit.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
