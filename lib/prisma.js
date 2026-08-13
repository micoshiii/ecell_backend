// lib/prisma.js
import { PrismaClient } from "@prisma/client";

const datasourceUrl = process.env.DATABASE_URL
  ? `${process.env.DATABASE_URL}${process.env.DATABASE_URL.includes("?") ? "&" : "?"
  }connection_limit=10&pool_timeout=10&connect_timeout=10`
  : undefined;

let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({ datasourceUrl });
} else {
  if (!globalThis.prisma) {
    globalThis.prisma = new PrismaClient({ datasourceUrl });
  }
  prisma = globalThis.prisma;
}

// Warm up the connection pool on startup (avoids cold-start latency on first request)
prisma.$connect().catch((e) => console.error("Prisma connect error:", e));

export default prisma;
