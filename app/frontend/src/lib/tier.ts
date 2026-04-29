export type Tier = 'free' | 'monthly' | 'enterprise';

export function planToTier(plan: string | null | undefined): Tier {
  if (plan === 'enterprise') return 'enterprise';
  if (plan === 'monthly' || plan === 'unlimited') return 'monthly';
  return 'free';
}

export function tierAtLeast(userTier: Tier, required: Tier): boolean {
  const order: Tier[] = ['free', 'monthly', 'enterprise'];
  return order.indexOf(userTier) >= order.indexOf(required);
}

export const TIER_LABELS: Record<Tier, string> = {
  free: 'Free',
  monthly: 'Pro · $49/mo',
  enterprise: 'Enterprise',
};

export async function fetchUserTier(email: string): Promise<{ tier: Tier; plan: string | null }> {
  try {
    const res = await fetch('/.netlify/functions/check-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    return { tier: planToTier(data.plan), plan: data.plan || null };
  } catch {
    return { tier: 'free', plan: null };
  }
}
