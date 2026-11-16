import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { ProviderConfig } from "./types.js";

const ProviderSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  baseUrl: z.string().url(),
  apiKeyEnv: z.string().min(1),
  model: z.string().min(1),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(100),
  dailyRequestLimit: z.number().int().positive(),
  monthlyRequestLimit: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive().max(8192).default(1200)
});

export const env = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",
  apiKey: process.env.CART3R_API_KEY ?? "",
  providerConfig: process.env.PROVIDERS_CONFIG ?? "./config/providers.json",
  usageStore: process.env.USAGE_STORE ?? "./data/usage.json",
  globalDailyLimit: Number(process.env.GLOBAL_DAILY_REQUEST_LIMIT ?? 100),
  globalMonthlyLimit: Number(process.env.GLOBAL_MONTHLY_REQUEST_LIMIT ?? 2000),
  switchAtPercent: Math.min(99, Math.max(1, Number(process.env.PROVIDER_SWITCH_AT_PERCENT ?? 80))),
  timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 45000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000"
};

export function loadProviders(): ProviderConfig[] {
  const file = path.resolve(env.providerConfig);
  if (!fs.existsSync(file)) {
    throw new Error(`Provider config not found: ${file}. Copy config/providers.example.json to config/providers.json.`);
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { providers?: unknown[] };
  return z.array(ProviderSchema).parse(raw.providers ?? []).sort((a, b) => a.priority - b.priority);
}