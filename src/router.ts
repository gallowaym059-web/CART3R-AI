import type { ChatMessage, ProviderConfig } from "./types.js";
import { env } from "./config.js";
import { UsageLedger } from "./usage.js";

export class NoProviderAvailableError extends Error {}
export class Router {
  constructor(private providers: ProviderConfig[], private ledger: UsageLedger) {}

  async chat(messages: ChatMessage[]) {
    if (!this.ledger.canSpendGlobal(env.globalDailyLimit, env.globalMonthlyLimit)) {
      throw new Error("CART3R global usage limit reached. Try again after the quota resets or raise the configured limit.");
    }
    const status = this.ledger.snapshot(this.providers, env.globalDailyLimit, env.globalMonthlyLimit, env.switchAtPercent);
    const candidates = this.providers.filter(p => status.providers.find(s => s.id === p.id)?.available);
    if (!candidates.length) throw new NoProviderAvailableError("No configured provider is currently eligible. Check API keys, provider quotas and enabled settings.");

    const failures: string[] = [];
    for (const provider of candidates) {
      try {
        const result = await this.callProvider(provider, messages);
        this.ledger.record(provider.id);
        return {
          ...result,
          routing: { provider: provider.id, label: provider.label, model: provider.model, fallbackUsed: failures.length > 0, skippedOrFailed: failures }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown provider error";
        failures.push(`${provider.id}: ${message}`);
        // Move on for rate limits, temporary errors, and provider outages.
      }
    }
    throw new Error(`All eligible providers failed. ${failures.join(" | ")}`);
  }

  private async callProvider(provider: ProviderConfig, messages: ChatMessage[]) {
    const key = process.env[provider.apiKeyEnv];
    if (!key) throw new Error(`Missing API key: ${provider.apiKeyEnv}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.timeoutMs);
    try {
      const response = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: provider.model,
          messages,
          max_tokens: provider.maxOutputTokens,
          temperature: 0.4
        })
      });
      const body = await response.json().catch(() => ({})) as any;
      if (!response.ok) {
        const detail = body?.error?.message ?? body?.message ?? `HTTP ${response.status}`;
        throw new Error(`${response.status}: ${String(detail).slice(0, 300)}`);
      }
      const content = body?.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("Provider returned no text response");
      return { content };
    } finally {
      clearTimeout(timeout);
    }
  }
}