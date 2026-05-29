import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.tsx';
import './index.css';
import { loadRuntimeConfig } from './lib/config.ts';

// In the iOS/Android app, window.location.origin is "capacitor://localhost",
// so a fetch to "/.netlify/functions/X" resolves to "capacitor://localhost/..."
// and fails. Rewrite those calls to the production domain so every Netlify
// function (checkout, get-reports, queue-report, etc.) works in the native app.
if (Capacitor.isNativePlatform()) {
  const API_BASE = 'https://thepropertydna.com';
  const originalFetch = window.fetch.bind(window);
  window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
    let url: string | undefined;
    if (typeof input === 'string') {
      url = input;
      if (input.startsWith('/.netlify/')) input = API_BASE + input;
      else if (input.startsWith('capacitor://localhost/.netlify/')) input = API_BASE + input.slice('capacitor://localhost'.length);
    } else if (input instanceof URL) {
      url = input.pathname;
      if (input.pathname.startsWith('/.netlify/')) input = new URL(API_BASE + input.pathname + input.search);
    } else if (input instanceof Request && input.url.includes('/.netlify/')) {
      url = input.url;
      const u = new URL(input.url);
      input = new Request(API_BASE + u.pathname + u.search, input);
    }

    // Build 19+: iOS now offers In-App Purchase, so real Pro status (from
    // either Apple IAP or — per 3.1.3(b) — a web Stripe subscription on the
    // same account) is allowed to flow through. No interception.
    return originalFetch(input, init);
  };

  // Marks the document for native-specific styling — currently used to add
  // bottom padding so the fixed NativeBottomNav doesn't cover page content.
  document.documentElement.classList.add('pdna-native');

  // Apple 3.1.1 safety net: still block external Stripe-payment URLs on iOS
  // (Apple requires the IAP path on iOS for digital subscriptions; web
  // checkout would re-introduce a non-IAP path).
  const isPaymentURL = (u: string) => /\b(stripe\.com|checkout\.stripe|buy\.stripe)\b/i.test(u);
  const originalOpen = window.open.bind(window);
  window.open = ((url?: string | URL, ...rest: any[]) => {
    const s = typeof url === 'string' ? url : url?.toString() || '';
    if (s && isPaymentURL(s)) return null;
    return originalOpen(url as any, ...(rest as []));
  }) as typeof window.open;

  // Reflect Apple IAP results into the storage keys isPremiumUser reads. Use
  // localStorage on iOS so the entitlement persists across app launches
  // (sessionStorage clears when the app process exits). Server-side
  // reconciliation via verify-apple-receipt is async.
  const markPremium = (plan: string) => {
    try {
      localStorage.setItem('pdna_subscribed', 'true');
      localStorage.setItem('pdna_plan', plan);
      sessionStorage.setItem('pdna_subscribed', 'true');
      sessionStorage.setItem('pdna_plan', plan);
    } catch { /* storage unavailable */ }
  };
  window.addEventListener('pdna:purchase-success', (e: any) => {
    const productId: string = e?.detail?.productId || '';
    markPremium(productId.includes('yearly') ? 'yearly' : 'monthly');
  });
  window.addEventListener('pdna:purchase-restored', (e: any) => {
    if (e?.detail?.active) markPremium('restored');
  });
}

// Load runtime configuration before rendering the app
async function initializeApp() {
  // Prerendered blog pages are served as pure static HTML for SEO.
  // Intentionally skip React mounting so the crawler-facing markup stays
  // lightweight and self-contained — no client-side hydration needed.
  if (
    document
      .querySelector('meta[name="prerender-static-page"]')
      ?.getAttribute('content') === 'blog'
  ) {
    return;
  }

  try {
    await loadRuntimeConfig();
    console.log('Runtime configuration loaded successfully');
  } catch (error) {
    console.warn(
      'Failed to load runtime configuration, using defaults:',
      error
    );
  }

  // Render the app
  createRoot(document.getElementById('root')!).render(<App />);
}

// Initialize the app
initializeApp();
