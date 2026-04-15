import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { admin, openAPI } from "better-auth/plugins";

import { prisma } from "./db.js";
import { env } from "./env.js";

export const auth = betterAuth({
  baseURL: env.API_BASE_URL,
  trustedOrigins: env.WEB_APP_BASE_URL,
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: env.GOOGLE_CLIENT_ID as string,
      clientSecret: env.GOOGLE_CLIENT_SECRET as string,
      redirectURI: `${env.API_BASE_URL}/api/auth/callback/google`,
    },
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  plugins: [
    openAPI(),
    admin({
      adminUserIds: env.ADMIN_USER_IDS,
    }),
  ],
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (!ctx.path.startsWith("/callback")) {
        return;
      }

      const returned = ctx.context.returned;
      if (!(returned instanceof Response)) {
        return;
      }

      const location = returned.headers.get("location") ?? "";
      if (!location.includes("error=banned")) {
        return;
      }

      const frontendUrl = env.WEB_APP_BASE_URL[0];

      // Better-Auth updates the account's accessToken during OAuth callback
      // even for banned users. Find the most recently updated Google account
      // whose user is banned.
      const recentAccount = await prisma.account.findFirst({
        where: {
          providerId: "google",
          updatedAt: { gte: new Date(Date.now() - 30000) },
          user: { banned: true },
        },
        orderBy: { updatedAt: "desc" },
        select: {
          user: { select: { banReason: true, banExpires: true } },
        },
      });

      if (recentAccount?.user) {
        const params = new URLSearchParams();
        if (recentAccount.user.banReason)
          params.set("reason", recentAccount.user.banReason);
        if (recentAccount.user.banExpires)
          params.set("expires", recentAccount.user.banExpires.toISOString());
        throw ctx.redirect(`${frontendUrl}/banned?${params.toString()}`);
      }

      throw ctx.redirect(`${frontendUrl}/banned`);
    }),
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: env.NODE_ENV === "production" ? ".nogueiradev.com" : undefined,
    },
  },
});
