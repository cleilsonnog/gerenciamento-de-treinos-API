import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env") });

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().startsWith("postgresql://"),
  BETTER_AUTH_SECRET: z.string(),
  API_BASE_URL: z.url().default("http://localhost:8080"),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string(),
  OPENAI_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PRICE_MONTHLY_ID: z.string().startsWith("price_"),
  STRIPE_PRICE_QUARTERLY_ID: z.string().startsWith("price_").optional(),
  STRIPE_PRICE_YEARLY_ID: z.string().startsWith("price_"),
  WEB_APP_BASE_URL: z.string().transform((val) => val.split(",").map((u) => u.trim())),
  ADMIN_USER_IDS: z
    .string()
    .default("")
    .transform((val) => val.split(",").map((id) => id.trim()).filter(Boolean)),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export const env = envSchema.parse(process.env);
