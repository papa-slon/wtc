export { ROLES, isRole, hasRole, hasAnyRole } from './roles.ts';
export type { Role } from './roles.ts';

export { AppError, toEnvelope, statusForCode } from './errors.ts';
export type { ErrorCode, ErrorEnvelope } from './errors.ts';

export { assertNotProduction, requiredSecret, isPlaceholderSecret, isLowEntropySecret, isWeakSecret, isBase64Key } from './env-guards.ts';

export { newId } from './ids.ts';

export {
  emailSchema,
  passwordSchema,
  registerSchema,
  loginSchema,
  exchangeKeyInputSchema,
  botConfigSchema,
  tradingViewUsernameSchema,
  courseInputSchema,
} from './schemas.ts';
export type {
  RegisterInput,
  LoginInput,
  ExchangeKeyInput,
  BotConfigInput,
  TradingViewUsernameInput,
  CourseInput,
} from './schemas.ts';
