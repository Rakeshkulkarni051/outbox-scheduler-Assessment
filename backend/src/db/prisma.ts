import { PrismaClient } from "@prisma/client";

// Single shared Prisma client instance (singleton pattern avoids exhausting
// the Postgres connection pool when tsx watch reloads the module).
export const prisma = new PrismaClient();
