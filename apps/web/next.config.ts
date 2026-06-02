import type { NextConfig } from 'next';

const allowedDevOrigins = (process.env.WTC_DEV_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const config: NextConfig = {
  allowedDevOrigins,
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // Compile workspace packages (they ship TypeScript source consumed directly).
  transpilePackages: [
    '@wtc/ui',
    '@wtc/shared',
    '@wtc/config',
    '@wtc/crypto',
    '@wtc/auth',
    '@wtc/audit',
    '@wtc/entitlements',
    '@wtc/billing',
    '@wtc/analytics',
    '@wtc/bot-adapters',
    '@wtc/axioma-bridge',
    '@wtc/lms',
    '@wtc/tradingview-access',
    '@wtc/backtester',
    '@wtc/db',
    '@wtc/cabinet',
  ],
  eslint: { ignoreDuringBuilds: true },
};

export default config;
