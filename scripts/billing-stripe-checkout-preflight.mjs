#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import {
  buildStripeCheckoutRequest,
  summarizeStripeCheckoutRequest,
  validateStripeCheckoutConfig,
} from '@wtc/billing';
import { expandPlan, PLANS } from '@wtc/entitlements';
import { resolvePreflightLogRoot, writePreflightSummary } from './preflight-log-root.mjs';

const args = process.argv.slice(2);
const allowedArgs = new Set(['--dry-run', '--help']);
const unknownArg = args.find((arg) => !allowedArgs.has(arg));
const wantsHelp = args.includes('--help');
const logRootEnv = process.env.STRIPE_CHECKOUT_PREFLIGHT_LOG_ROOT;
let preflightLogRoot;
const fixturePlans = ['tortila_monthly', 'education_lifetime', 'bundle_starter'];

function usage() {
  console.log([
    'Usage: node --import tsx scripts/billing-stripe-checkout-preflight.mjs [--dry-run]',
    '',
    'Dry-run validates generated test-mode Stripe checkout config and builds redacted Checkout requests.',
    'It performs no Stripe network I/O and does not create Checkout Sessions.',
  ].join('\n'));
}

function exitRefused(reason) {
  console.error(`# Stripe checkout preflight refused - ${reason}`);
  process.exit(2);
}

function writeSummary(summary) {
  return writePreflightSummary(getPreflightLogRoot(), summary);
}

function getPreflightLogRoot() {
  if (preflightLogRoot) return preflightLogRoot;
  try {
    preflightLogRoot = resolvePreflightLogRoot(logRootEnv, 'logs/billing-stripe-checkout-preflight');
    return preflightLogRoot;
  } catch {
    exitRefused('preflight log root must be repo-local under logs/');
  }
}

function checkoutModeForPlan(planCode) {
  return PLANS[planCode]?.billing === 'one_time' ? 'payment' : 'subscription';
}

function fixtureConfig() {
  return {
    provider: 'stripe',
    secretKey: `sk_test_preflight_${randomBytes(12).toString('hex')}`,
    webhookSecret: `whsec_preflight_${randomBytes(12).toString('hex')}`,
    priceMap: {
      tortila_monthly: 'price_preflight_tortila',
      education_lifetime: 'price_preflight_education',
      bundle_starter: 'price_preflight_bundle',
    },
  };
}

function redactedBaseSummary(runId) {
  return {
    version: 1,
    runId,
    mode: 'dry-run',
    provider: 'stripe',
    network: 'not-run',
    evidence: 'redacted-counts-only',
    requests: [],
  };
}

async function runDryRun() {
  if (process.env.APP_ENV === 'production') exitRefused('APP_ENV=production is not allowed');
  if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')) exitRefused('live Stripe secret key present');

  const runId = randomBytes(8).toString('hex');
  const config = fixtureConfig();
  const check = validateStripeCheckoutConfig({ ...config, selectedPlanCodes: fixturePlans });
  const summary = redactedBaseSummary(runId);
  summary.config = {
    ok: check.ok,
    configuredPlanCount: check.configuredPlans.length,
    selectedPlanCount: fixturePlans.length,
  };
  if (!check.ok) {
    summary.result = 'fail';
    summary.failure = 'config_invalid';
    const summaryPath = writeSummary(summary);
    console.error('# Stripe checkout preflight failed - config_invalid');
    console.error(`mode=dry-run provider=stripe network=not-run summary=${summaryPath}`);
    process.exit(1);
  }

  for (const planCode of fixturePlans) {
    const mode = checkoutModeForPlan(planCode);
    const productCodes = expandPlan(planCode);
    buildStripeCheckoutRequest({
      userId: '00000000-0000-4000-8000-000000000123',
      planCode,
      priceId: config.priceMap[planCode],
      mode,
      successUrl: 'https://wtc.local/app/billing?checkout=success',
      cancelUrl: 'https://wtc.local/app/billing?checkout=cancelled',
      customerEmail: 'checkout-preflight@wtc.local',
    }, { secretKey: config.secretKey });
    summary.requests.push(summarizeStripeCheckoutRequest({
      planCode,
      mode,
      productCount: productCodes.length,
      hasCustomerEmail: true,
    }));
  }

  summary.result = 'pass';
  const summaryPath = writeSummary(summary);
  console.log('# Stripe checkout preflight dry-run complete');
  console.log(`mode=dry-run provider=stripe network=not-run requests=${summary.requests.length} summary=${summaryPath}`);
}

if (wantsHelp) {
  usage();
  process.exit(0);
}
if (unknownArg) exitRefused('unknown argument');
getPreflightLogRoot();

await runDryRun();
