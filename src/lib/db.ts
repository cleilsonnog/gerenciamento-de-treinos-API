import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../lib/env.js";

const connectionString = `${env.DATABASE_URL}`;

const adapter = new PrismaNeon({ connectionString });

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
