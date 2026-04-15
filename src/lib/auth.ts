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

      // Try multiple context properties to find the user
      const context = ctx.context as Record<string, unknown>;
      const userId =
        (context.session as { user?: { id?: string } } | undefined)?.user
          ?.id ??
        (context.user as { id?: string } | undefined)?.id ??
        (context.newUser as { id?: string } | undefined)?.id;

      if (userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { banReason: true, banExpires: true },
        });

        if (dbUser) {
          const params = new URLSearchParams();
          if (dbUser.banReason) params.set("reason", dbUser.banReason);
          if (dbUser.banExpires)
            params.set("expires", dbUser.banExpires.toISOString());
          throw ctx.redirect(`${frontendUrl}/banned?${params.toString()}`);
        }
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
