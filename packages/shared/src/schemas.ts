/**
 * Shared Zod schemas used at every input boundary (route handlers, server actions, worker).
 * Imports zod (install-time dependency). Keep validation here, not scattered in UI.
 */
import { z } from 'zod';

export const emailSchema = z.string().email().max(254);
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(200);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().min(1).max(80).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Exchange API key capture. Secret is validated then sealed; never stored/logged in plaintext. */
export const exchangeKeyInputSchema = z.object({
  exchange: z.enum(['bingx', 'binance', 'bybit', 'okx']),
  label: z.string().min(1).max(60),
  apiKey: z.string().min(8).max(256),
  apiSecret: z.string().min(8).max(256),
  mode: z.enum(['demo', 'live']).default('demo'),
});
export type ExchangeKeyInput = z.infer<typeof exchangeKeyInputSchema>;

/** Safe metadata-only check request for a stored exchange key. Does not authorize live exchange pings. */
export const exchangeKeyMetadataCheckSchema = z.object({
  bot: z.string().min(1).max(80),
  exchangeAccountId: z.string().uuid(),
});
export type ExchangeKeyMetadataCheckInput = z.infer<typeof exchangeKeyMetadataCheckSchema>;

/** Generic, conservative bot config envelope. Bot-specific shapes refine this. */
export const botConfigSchema = z.object({
  symbols: z.array(z.string().min(1)).min(1).max(50),
  riskPercent: z.number().min(0).max(100),
  leverage: z.number().int().min(1).max(125),
  maxUnits: z.number().int().min(1).max(20),
  takeProfitPercent: z.number().min(0).max(1000).optional(),
  stopLossPercent: z.number().min(0).max(100).optional(),
});
export type BotConfigInput = z.infer<typeof botConfigSchema>;

export const tradingViewUsernameSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[A-Za-z0-9_]+$/, 'TradingView usernames are letters, numbers and underscores'),
});
export type TradingViewUsernameInput = z.infer<typeof tradingViewUsernameSchema>;

export const courseInputSchema = z.object({
  title: z.string().min(1).max(140),
  description: z.string().max(4000).optional(),
  productCode: z.enum(['education', 'club']).default('education'),
  published: z.boolean().default(false),
});
export type CourseInput = z.infer<typeof courseInputSchema>;
