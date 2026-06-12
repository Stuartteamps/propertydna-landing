import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isNative } from '@/lib/nativeFeatures';

const DISMISS_KEY = 'pdna_android_install_dismissed_v1';
const SUPPRESSED_PREFIXES = ['/report', '/dashboard', '/admin', '/auth/', '/analyze'];

// Chrome on Android fires beforeinstallprompt when the site meets PWA install
// criteria. We catch the event, defer it, and surface our own install CTA
// styled to match the brand. iOS gets the Apple Smart App Banner separately.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function detectPlatform(): 'android' | 'ios' | 'desktop' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Macintosh|Windows|Linux/i.test(ua)) return 'desktop';
  return 'other';
}

export default function AndroidInstallPrompt() {
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isNative()) return;
    if (detectPlatform() !== 'android') return;

    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch { /* localStorage unavailable */ }
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setVisible(false);
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* localStorage unavailable */ }
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const suppressed = SUPPRESSED_PREFIXES.some(p => location.pathname.startsWith(p));
  if (!visible || !deferredPrompt || isNative() || suppressed) return null;

  const handleInstall = async () => {
    try { (window as any).pdnaTrack?.('pwa_install_click', { platform: 'android' }); } catch { /* tracking unavailable */ }
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        try { (window as any).pdnaTrack?.('pwa_install_accepted', { platform: 'android' }); } catch { /* tracking unavailable */ }
      }
    } catch {
      // user cancelled — no-op
    }
    setVisible(false);
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* localStorage unavailable */ }
    setVisible(false);
  };

  return (
    <div
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 9100,
        background: 'linear-gradient(180deg, rgba(15,14,13,0.97), #0F0E0D)',
        borderTop: '1px solid rgba(184,147,85,0.45)',
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 -10px 36px rgba(0,0,0,0.5)',
      }}
      role="region"
      aria-label="Install PropertyDNA on Android"
    >
      <div style={{
        flexShrink: 0, width: 44, height: 44, borderRadius: 10,
        background: 'linear-gradient(135deg, #C9A84C, #8a6f2e)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Cormorant Garamond, serif', fontSize: 16, fontWeight: 500,
        color: '#0F0E0D', letterSpacing: '-0.5px',
      }}>
        PDN
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'Jost, sans-serif', fontSize: 12, fontWeight: 500,
          color: '#F4F0E8', lineHeight: 1.3,
        }}>
          Install PropertyDNA on Android
        </div>
        <div style={{
          fontFamily: 'Jost, sans-serif', fontSize: 10.5, fontWeight: 300,
          color: 'rgba(244,240,232,0.55)', lineHeight: 1.4, marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          Free. Adds to your home screen. Works offline.
        </div>
      </div>
      <button
        type="button"
        onClick={handleInstall}
        style={{
          flexShrink: 0,
          fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
          letterSpacing: '2px', textTransform: 'uppercase',
          color: '#0F0E0D', background: '#C9A84C',
          border: 'none', padding: '11px 16px', cursor: 'pointer',
        }}
      >
        Install
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: 'none', border: 'none', color: '#6B6252',
          fontSize: 20, cursor: 'pointer', padding: '4px 6px', lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
