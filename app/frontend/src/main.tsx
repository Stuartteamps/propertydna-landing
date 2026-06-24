import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.tsx';
import './index.css';
import { loadRuntimeConfig } from './lib/config.ts';

// Capture an Ambassador referral code (?ref=CODE) on first load so it can be
// attributed when this visitor eventually runs a report. Persists across nav.
try {
  const _ref = new URLSearchParams(window.location.search).get('ref');
  if (_ref) localStorage.setItem('pdna_ref', _ref.slice(0, 40));
} catch { /* localStorage unavailable */ }

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

    // Apple Guideline 3.1.1: iOS app is fully free with no subscription tier
    // and no IAP. Force every iOS user to read as a brand-new free-tier
    // visitor regardless of any web Stripe subscription on the account. The
    // check-usage response is rewritten on the client so subscribed status
    // never reaches the UI.
    if (url && /\/check-usage\b/.test(url)) {
      return originalFetch(input, init).then(resp => {
        if (!resp.ok) return resp;
        return resp.clone().json().then((data: any) => {
          const patched = {
            ...data,
            isSubscribed: false,
            plan: null,
            tier: 'free',
            reportCount: 0,
            quota: null,
          };
          return new Response(JSON.stringify(patched), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }).catch(() => resp);
      });
    }
    return originalFetch(input, init);
  };

  // Marks the document for native-specific styling — currently used to add
  // bottom padding so the fixed NativeBottomNav doesn't cover page content.
  document.documentElement.classList.add('pdna-native');

  // Apple 3.1.1 safety net: hard-block window.open to any external payment
  // surface on iOS (Stripe, etc.). React components self-guard via isNative()
  // but this is belt-and-suspenders for anything missed.
  const isPaymentURL = (u: string) => /\b(stripe\.com|checkout\.stripe|buy\.stripe)\b/i.test(u);
  const originalOpen = window.open.bind(window);
  window.open = ((url?: string | URL, ...rest: any[]) => {
    const s = typeof url === 'string' ? url : url?.toString() || '';
    if (s && isPaymentURL(s)) return null;
    return originalOpen(url as any, ...(rest as []));
  }) as typeof window.open;

  // Prune any /pricing route navigation on iOS — the page is web-only.
  const pruneIfPricing = () => {
    if (window.location.pathname === '/pricing') {
      window.history.replaceState({}, '', '/');
    }
  };
  pruneIfPricing();
  window.addEventListener('popstate', pruneIfPricing);
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

// Register service worker for PWA install eligibility on Android Chrome.
// iOS Capacitor native app skips this — it serves bundled assets directly.
if (
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && !Capacitor.isNativePlatform()
  && window.location.protocol === 'https:'
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failure is non-blocking — site still works without it,
      // only PWA install ceremony degrades.
    });
  });
}

// Initialize the app
initializeApp();
