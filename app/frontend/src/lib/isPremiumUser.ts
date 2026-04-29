/**
 * Reads cached subscription status written by Dashboard.tsx after get-reports API call.
 * TODO: Replace sessionStorage read with a Supabase real-time subscription check once
 *       Supabase auth is fully integrated (connect to subscriptions table via user session).
 */
export function isPremiumUser(): boolean {
  try {
    const subscribed = sessionStorage.getItem('pdna_subscribed');
    const plan = sessionStorage.getItem('pdna_plan');
    return subscribed === 'true' || plan === 'monthly' || plan === 'enterprise';
  } catch {
    return false;
  }
}

export function setPremiumStatus(isSubscribed: boolean, plan: string | null): void {
  try {
    sessionStorage.setItem('pdna_subscribed', isSubscribed ? 'true' : 'false');
    sessionStorage.setItem('pdna_plan', plan ?? '');
  } catch {}
}
