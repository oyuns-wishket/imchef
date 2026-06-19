import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  // Supabase requires TLS; the pooler cert chain isn't in Node's CA bundle,
  // so disable strict verification in production (matches Supabase guidance).
  const ssl =
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined;
  // Small pool: serverless functions each hold their own pool, and Supabase's
  // transaction pooler (port 6543) multiplexes, so keep per-instance count low.
  const adapter = new PrismaPg({
    connectionString,
    ssl,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;
