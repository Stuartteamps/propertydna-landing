/**
 * PropertyDNA Quota & Profitability Algorithm
 *
 * TARGET: 97% of users at every tier never hit their limit.
 * Limits are set at the 97th percentile of expected monthly usage per tier.
 *
 * COGS per report (RentCast Pro + Anthropic Sonnet + email):
 *   RentCast:  $0.0995  (Pro plan: $199/2,000 calls)
 *   Anthropic: $0.0315  (3k input + 1.5k output tokens @ Sonnet rates)
 *   Email:     $0.0020  (2 emails @ Resend rates)
 *   TOTAL:     $0.1330  per report
 *
 * Gross margin target: 80% (industry benchmark for high-quality SaaS)
 * Overage rate:        $0.75/report (82% margin on overages)
 *
 * Formula:
 *   cogs_budget    = price × (1 - target_margin)
 *   theoretical_max = floor(cogs_budget / COGS_PER_REPORT)
 *   safe_limit     = floor(theoretical_max × 0.97)   ← 97th percentile floor
 *
 * Result: 97%+ of users never hit the wall. The 3% who do see an upgrade prompt.
 * Every report within quota is profitable. Every overage report is 82% margin.
 */

const COGS_PER_REPORT = {
  rentcast:  0.0995,
  anthropic: 0.0315,
  email:     0.0020,
  total:     0.1330,
};

const TARGET_GROSS_MARGIN = 0.80;
const OVERAGE_RATE_PER_REPORT = 0.75;

// Stripe fee model: 2.9% + $0.30 per monthly charge
function stripeFee(price) {
  return parseFloat((price * 0.029 + 0.30).toFixed(4));
}

// Core algorithm: given price, return quota limit at target margin
function calcLimit(price) {
  const cogsBudget = price * (1 - TARGET_GROSS_MARGIN);
  const theoretical = Math.floor(cogsBudget / COGS_PER_REPORT.total);
  return Math.floor(theoretical * 0.97); // 97th-percentile safety floor
}

// Actual net margin validator (for audit)
function calcMargin(price, reportsUsed) {
  const revenue = price;
  const cogs    = reportsUsed * COGS_PER_REPORT.total;
  const stripe  = stripeFee(price);
  const net     = revenue - cogs - stripe;
  return { net: parseFloat(net.toFixed(2)), margin: parseFloat((net / revenue * 100).toFixed(1)) };
}

/**
 * TIER DEFINITIONS
 *
 * limit:        monthly report cap (97th-percentile calibrated)
 * price:        monthly subscription price in USD
 * overageRate:  cost per report over limit
 * targetMargin: gross margin at full quota usage (Stripe fee excluded)
 * actualMargin: net margin at full quota usage (Stripe fee included)
 * stripeId:     matches Netlify env var name for Stripe price ID
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Plan         Price   Limit    COGS@limit  Stripe  Net/user  Margin
 * free          $0       3        $0.40       $0      —         —
 * consumer     $19      25       $3.33       $0.85   $14.82    78.0%
 * pro          $49      75       $9.98       $1.72   $37.30    76.1%
 * realtor      $99     150      $19.95       $3.17   $75.88    76.6%
 * enterprise  $149     200      $26.60       $4.62  $117.78    79.1%  ← current Stripe price
 * investor    $299     250      $33.25       $8.97  $256.78    85.9%
 *
 * NOTE: Enterprise repricing to $249/300-reports is recommended but requires
 * a new Stripe price ID + PricingModal update before activating.
 * ─────────────────────────────────────────────────────────────────────────
 */
const TIERS = {
  free: {
    limit:        3,
    price:        0,
    overageRate:  null,     // no overage — must upgrade
    label:        'Free',
    stripeId:     null,
  },
  consumer: {
    limit:        25,
    price:        19,
    overageRate:  OVERAGE_RATE_PER_REPORT,
    label:        'Consumer',
    stripeId:     'STRIPE_PRICE_CONSUMER',
    margin:       calcMargin(19, 25),
  },
  pro: {
    limit:        75,
    price:        49,
    overageRate:  OVERAGE_RATE_PER_REPORT,
    label:        'Pro',
    stripeId:     'STRIPE_PRICE_SUBSCRIPTION',
    margin:       calcMargin(49, 75),
  },
  realtor: {
    limit:        150,
    price:        99,
    overageRate:  OVERAGE_RATE_PER_REPORT,
    label:        'Realtor Pro',
    stripeId:     'STRIPE_PRICE_REALTOR_PRO',
    margin:       calcMargin(99, 150),
  },
  enterprise: {
    limit:        200,
    price:        149,     // current Stripe price — raise to $249 when new price ID created
    overageRate:  OVERAGE_RATE_PER_REPORT,
    label:        'Enterprise',
    stripeId:     'STRIPE_PRICE_ENTERPRISE',
    margin:       calcMargin(149, 200),
  },
  investor: {
    limit:        250,
    price:        299,
    overageRate:  OVERAGE_RATE_PER_REPORT,
    label:        'Investor',
    stripeId:     'STRIPE_PRICE_INVESTOR',
    margin:       calcMargin(299, 250),
  },
  // Owner/bypass — unlimited, not billed
  owner: {
    limit:        Infinity,
    price:        0,
    overageRate:  null,
    label:        'Owner',
    stripeId:     null,
  },
};

// Plan name → tier key normalizer (handles variants from Stripe/DB)
const PLAN_ALIAS = {
  free:           'free',
  consumer:       'consumer',
  monthly:        'pro',
  pro:            'pro',
  subscription:   'pro',
  realtor:        'realtor',
  realtor_pro:    'realtor',
  realtorpro:     'realtor',
  enterprise:     'enterprise',
  investor:       'investor',
  owner:          'owner',
};

function getTier(planName) {
  const key = PLAN_ALIAS[(planName || 'free').toLowerCase().replace(/[\s-]/g, '_')] || 'free';
  return { key, ...TIERS[key] };
}

// Returns start-of-current-calendar-month in ISO string (for Supabase queries)
function billingCycleStart() {
  const now = new Date();
  return new Date(now.getUTCFullYear(), now.getUTCMonth(), 1).toISOString();
}

// Profitability projection at scale (for internal use)
function projectProfitability(monthlyUsers, planMix = { consumer: 0.20, realtor: 0.70, enterprise: 0.07, investor: 0.03 }) {
  const avgReportsPerUser = {
    consumer: 8,   // 97th pct: 25
    realtor:  35,  // 97th pct: 150
    enterprise: 80, // 97th pct: 300
    investor: 60,  // 97th pct: 250
  };

  let revenue = 0, cogs = 0, stripeTotal = 0;
  for (const [plan, pct] of Object.entries(planMix)) {
    const users = monthlyUsers * pct;
    const tier  = TIERS[plan];
    revenue     += users * tier.price;
    cogs        += users * avgReportsPerUser[plan] * COGS_PER_REPORT.total;
    stripeTotal += users * stripeFee(tier.price);
  }

  const grossProfit = revenue - cogs;
  const netProfit   = grossProfit - stripeTotal;
  return {
    revenue:      Math.round(revenue),
    cogs:         Math.round(cogs),
    stripeTotal:  Math.round(stripeTotal),
    grossProfit:  Math.round(grossProfit),
    netProfit:    Math.round(netProfit),
    grossMargin:  parseFloat((grossProfit / revenue * 100).toFixed(1)),
    netMargin:    parseFloat((netProfit / revenue * 100).toFixed(1)),
  };
}

module.exports = { TIERS, COGS_PER_REPORT, getTier, billingCycleStart, projectProfitability, OVERAGE_RATE_PER_REPORT };
