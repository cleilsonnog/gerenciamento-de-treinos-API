import { fromNodeHeaders } from "better-auth/node";
import { FastifyReply, FastifyRequest } from "fastify";

import { auth } from "./auth.js";
import { prisma } from "./db.js";

export const checkBan = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const publicPaths = ["/api/auth", "/swagger.json", "/docs", "/webhook"];
  const isPublic = publicPaths.some((path) => request.url.startsWith(path));

  if (isPublic) {
    return;
  }

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { banned: true, banReason: true, banExpires: true },
  });

  if (!user?.banned) {
    return;
  }

  if (user.banExpires && user.banExpires < new Date()) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { banned: false, banReason: null, banExpires: null },
    });
    return;
  }

  reply.status(403).send({
    error: "Sua conta está suspensa.",
    code: "USER_BANNED",
    banReason: user.banReason ?? null,
    banExpires: user.banExpires?.toISOString() ?? null,
  });
};
