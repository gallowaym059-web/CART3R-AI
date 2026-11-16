import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { env, loadProviders } from "./config.js";
import { Router } from "./router.js";
import { UsageLedger } from "./usage.js";

const providers = loadProviders();
const ledger = new UsageLedger(env.usageStore);
const router = new Router(providers, ledger);
const app = Fastify({ logger: true, bodyLimit: 1024 * 1024 });

await app.register(cors, { origin: env.corsOrigin.split(",").map(s => s.trim()) });

app.addHook("onRequest", async (request, reply) => {
  if (request.url === "/health") return;
  if (!env.apiKey || request.headers.authorization !== `Bearer ${env.apiKey}`) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
});

app.get("/health", async () => ({ ok: true, service: "CART3R OmniRoute" }));

app.get("/v1/status", async () => ({
  mode: "automatic",
  switchAtPercent: env.switchAtPercent,
  usage: ledger.snapshot(providers, env.globalDailyLimit, env.globalMonthlyLimit, env.switchAtPercent)
}));

const ChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string().min(1).max(30000)
  })).min(1).max(60)
});

app.post("/v1/chat/completions", async (request, reply) => {
  const parsed = ChatSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
  try {
    return await router.chat(parsed.data.messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected routing error";
    request.log.error({ err: error }, "CART3R routing failed");
    return reply.code(message.includes("No configured provider") ? 503 : 429).send({ error: message });
  }
});

try {
  await app.listen({ port: env.port, host: env.host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}