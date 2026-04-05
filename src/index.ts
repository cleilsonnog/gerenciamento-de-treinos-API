// Import the framework and instantiate it
import "dotenv/config";

import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifyApiReference from "@scalar/fastify-api-reference";
import Fastify from "fastify";
import rawBody from "fastify-raw-body";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";

import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { env } from "./lib/env.js";
import { aiRoutes } from "./routes/ai.js";
import { homeRoutes } from "./routes/home.js";
import { meRoutes } from "./routes/me.js";
import { statsRoutes } from "./routes/stats.js";
import { stripeRoutes } from "./routes/stripe.js";
import { workoutPlanRoutes } from "./routes/workout_plan.js";

const envToLogger = {
  development: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
  production: true,
  test: false,
};

const app = Fastify({
  logger: envToLogger[env.NODE_ENV],
  trustProxy: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(rawBody, {
  field: "rawBody",
  global: false,
  runFirst: true,
  encoding: false,
});

await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "Gerenciamento de Treinos API",
      description: "API para o Gerenciamento de Treinos",
      version: "1.0.0",
    },
    servers: [
      {
        description: "API Base URL",
        url: env.API_BASE_URL,
      },
    ],
  },
  transform: jsonSchemaTransform,
});

await app.register(fastifyCors, {
  origin: env.WEB_APP_BASE_URL,
  credentials: true,
});

await app.register(fastifyApiReference, {
  routePrefix: "/docs",
  configuration: {
    sources: [
      {
        title: "Gerenciamento de Treinos API",
        slug: "gerenciamento-de-treinos-api",
        url: "/swagger.json",
      },
      {
        title: "Auth API",
        slug: "auth-api",
        url: "/api/auth/open-api/generate-schema",
      },
    ],
  },
});
// Declare a route

await app.register(workoutPlanRoutes);
await app.register(homeRoutes, { prefix: "/home" });
await app.register(statsRoutes, { prefix: "/stats" });
await app.register(meRoutes, { prefix: "/me" });
await app.register(aiRoutes, { prefix: "/ai" });
await app.register(stripeRoutes);

app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/swagger.json",
  schema: {
    hide: true,
  },
  handler: async () => {
    return app.swagger();
  },
});

app.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  schema: {
    hide: true,
  },
  async handler(request, reply) {
    try {
      // Construct request URL
      const url = new URL(request.url, env.API_BASE_URL);

      // Create Fetch API-compatible request
      const req = new Request(url.toString(), {
        method: request.method,
        headers: fromNodeHeaders(request.headers),
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });
      // Process authentication request
      const response = await auth.handler(req);

      if (response.headers.get("location")?.includes("error")) {
        const body = response.body ? await response.clone().text() : null;
        app.log.error({
          msg: "Auth error",
          location: response.headers.get("location"),
          status: response.status,
          body,
          requestUrl: url.toString(),
          cookies: request.headers.cookie,
        });
      }

      // Forward response to client
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key !== "set-cookie") {
          reply.header(key, value);
        }
      });
      for (const cookie of response.headers.getSetCookie()) {
        reply.header("set-cookie", cookie);
      }
      reply.send(response.body ? await response.text() : null);
    } catch (error) {
      app.log.error(error);
      reply.status(500).send({
        error: "Internal authentication error",
        code: "AUTH_FAILURE",
      });
    }
  },
});

app.get("/debug/auth-config", async () => {
  return {
    apiBaseUrl: env.API_BASE_URL,
    nodeEnv: env.NODE_ENV,
    hasGoogleClientId: !!env.GOOGLE_CLIENT_ID,
    hasGoogleClientSecret: !!env.GOOGLE_CLIENT_SECRET,
    googleClientSecretPrefix: env.GOOGLE_CLIENT_SECRET?.substring(0, 8),
    redirectUri: `${env.API_BASE_URL}/api/auth/callback/google`,
  };
});

// Run the server!
try {
  await app.listen({ port: env.PORT || 8080, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
