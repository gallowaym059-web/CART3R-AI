import fs from "node:fs";
import path from "node:path";
import type { ProviderConfig, ProviderStatus, UsageRecord } from "./types.js";

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => today().slice(0, 7);

export class UsageLedger {
  private data: UsageRecord;
  constructor(private file: string) {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    this.data = this.read();
  }
  private read(): UsageRecord {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, "utf8")) as UsageRecord;
      return { ...parsed, providers: parsed.providers ?? {} };
    } catch {
      return { day: today(), month: thisMonth(), totalRequests: 0, providers: {} };
    }
  }
  private rollPeriods() {
    if (this.data.day !== today()) {
      this.data.day = today();
      this.data.totalRequests = 0;
      for (const item of Object.values(this.data.providers)) item.daily = 0;
    }
    if (this.data.month !== thisMonth()) {
      this.data.month = thisMonth();
      for (const item of Object.values(this.data.providers)) item.monthly = 0;
    }
  }
  private save() {
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), { mode: 0o600 });
  }
  snapshot(providers: ProviderConfig[], globalDailyLimit: number, globalMonthlyLimit: number, switchAt: number) {
    this.rollPeriods();
    const rows: ProviderStatus[] = providers.map(p => {
      const u = this.data.providers[p.id] ?? { day: today(), month: thisMonth(), daily: 0, monthly: 0 };
      const dailyPercent = Math.min(100, Math.round(u.daily / p.dailyRequestLimit * 100));
      const monthlyPercent = Math.min(100, Math.round(u.monthly / p.monthlyRequestLimit * 100));
      const hasKey = Boolean(process.env[p.apiKeyEnv]);
      const available = p.enabled && hasKey &&
        dailyPercent < switchAt && monthlyPercent < switchAt &&
        u.daily < p.dailyRequestLimit && u.monthly < p.monthlyRequestLimit;
      let reason: string | undefined;
      if (!p.enabled) reason = "disabled";
      else if (!hasKey) reason = `missing ${p.apiKeyEnv}`;
      else if (u.daily >= p.dailyRequestLimit || u.monthly >= p.monthlyRequestLimit) reason = "hard quota limit reached";
      else if (dailyPercent >= switchAt || monthlyPercent >= switchAt) reason = `switch threshold reached (${switchAt}%)`;
      return {
        id: p.id, label: p.label, model: p.model, enabled: p.enabled, available,
        dailyUsed: u.daily, dailyLimit: p.dailyRequestLimit, dailyPercent,
        monthlyUsed: u.monthly, monthlyLimit: p.monthlyRequestLimit, monthlyPercent, reason
      };
    });
    return {
      global: {
        dailyUsed: this.data.totalRequests,
        dailyLimit: globalDailyLimit,
        dailyPercent: Math.min(100, Math.round(this.data.totalRequests / globalDailyLimit * 100)),
        monthlyUsed: rows.reduce((sum, row) => sum + row.monthlyUsed, 0),
        monthlyLimit: globalMonthlyLimit,
        monthlyPercent: Math.min(100, Math.round(rows.reduce((sum, row) => sum + row.monthlyUsed, 0) / globalMonthlyLimit * 100))
      },
      providers: rows
    };
  }
  canSpendGlobal(dailyLimit: number, monthlyLimit: number) {
    this.rollPeriods();
    const monthTotal = Object.values(this.data.providers).reduce((sum, p) => sum + p.monthly, 0);
    return this.data.totalRequests < dailyLimit && monthTotal < monthlyLimit;
  }
  record(providerId: string) {
    this.rollPeriods();
    const current = this.data.providers[providerId] ?? { day: today(), month: thisMonth(), daily: 0, monthly: 0 };
    current.daily += 1;
    current.monthly += 1;
    this.data.providers[providerId] = current;
    this.data.totalRequests += 1;
    this.save();
  }
}