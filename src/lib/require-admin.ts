import { fromNodeHeaders } from "better-auth/node";
import { FastifyReply, FastifyRequest } from "fastify";

import { auth } from "./auth.js";
import { prisma } from "./db.js";

export const requireAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ userId: string } | undefined> => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    reply.status(401).send({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
    return undefined;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!user || user.role !== "admin") {
    reply.status(403).send({
      error: "Forbidden",
      code: "FORBIDDEN",
    });
    return undefined;
  }

  return { userId: session.user.id };
};
