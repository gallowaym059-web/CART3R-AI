export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ProviderConfig = {
  id: string;
  label: string;
  baseUrl: string;
  apiKeyEnv: string;
  model: string;
  enabled: boolean;
  priority: number;
  dailyRequestLimit: number;
  monthlyRequestLimit: number;
  maxOutputTokens: number;
};

export type UsageRecord = {
  day: string;
  month: string;
  totalRequests: number;
  providers: Record<string, { day: string; month: string; daily: number; monthly: number }>;
};

export type ProviderStatus = {
  id: string;
  label: string;
  model: string;
  enabled: boolean;
  available: boolean;
  dailyUsed: number;
  dailyLimit: number;
  dailyPercent: number;
  monthlyUsed: number;
  monthlyLimit: number;
  monthlyPercent: number;
  reason?: string;
};