const OWNER_EMAILS = ['stuartteamps@gmail.com'];

export function isPremiumUser(): boolean {
  try {
    const email      = sessionStorage.getItem('pdna_email') || '';
    const subscribed = sessionStorage.getItem('pdna_subscribed');
    const plan       = sessionStorage.getItem('pdna_plan');
    if (OWNER_EMAILS.includes(email.toLowerCase())) return true;
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

/**
 * Async check — calls check-usage and caches result.
 * Use this in components that need a reliable first-load check.
 */
export async function checkAndSetPremium(email: string): Promise<boolean> {
  if (!email) return false;
  try {
    sessionStorage.setItem('pdna_email', email.toLowerCase());
    if (OWNER_EMAILS.includes(email.toLowerCase())) {
      setPremiumStatus(true, 'enterprise');
      return true;
    }
    const res = await fetch('/.netlify/functions/check-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setPremiumStatus(data.isSubscribed ?? false, data.plan ?? null);
    return data.isSubscribed ?? false;
  } catch {
    return isPremiumUser();
  }
}
