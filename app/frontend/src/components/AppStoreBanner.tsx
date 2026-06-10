import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isNative } from '@/lib/nativeFeatures';

const DISMISS_KEY = 'pdna_app_banner_dismissed_v1';
const APP_STORE_URL = 'https://apps.apple.com/app/id6768064079?ct=web_banner';

// Routes where the banner would be intrusive (in-app workflows, report viewing,
// admin tools). Banner suppressed on these.
const SUPPRESSED_PREFIXES = [
  '/report', '/dashboard', '/admin', '/outreach',
  '/auth/', '/saved-reports', '/analyze',
];

function detectPlatform(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

// Safari iOS gets the native Apple Smart App Banner via <meta apple-itunes-app>.
// This component covers everyone else: Chrome on iOS, Android, and desktop —
// a dismissable sticky bar that pushes the App Store install.
export default function AppStoreBanner() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');

  useEffect(() => {
    if (isNative()) return;
    const p = detectPlatform();
    setPlatform(p);
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch { /* localStorage unavailable */ }
    if (!dismissed) setVisible(true);
  }, []);

  const suppressed = SUPPRESSED_PREFIXES.some(p => location.pathname.startsWith(p));
  if (!visible || isNative() || suppressed) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* localStorage unavailable */ }
    setVisible(false);
  };

  const handleGet = () => {
    try { (window as any).pdnaTrack?.('app_banner_click', { platform }); } catch { /* tracking unavailable */ }
    window.open(APP_STORE_URL, '_blank', 'noopener');
  };

  const headline = platform === 'android'
    ? 'PropertyDNA for iOS — Android coming soon'
    : 'PropertyDNA — free on the App Store';
  const subline = platform === 'android'
    ? 'Use the web version free, or send yourself the iOS link.'
    : 'Free property intelligence on every U.S. home in our index.';

  return (
    <div
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 9000,
        background: 'linear-gradient(180deg, rgba(15,14,13,0.96), rgba(15,14,13,1))',
        borderTop: '1px solid rgba(184,147,85,0.35)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 -8px 32px rgba(0,0,0,0.45)',
      }}
      role="region"
      aria-label="Download PropertyDNA for iOS"
    >
      <div style={{
        flexShrink: 0, width: 44, height: 44,
        borderRadius: 10,
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
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {headline}
        </div>
        <div style={{
          fontFamily: 'Jost, sans-serif', fontSize: 10.5, fontWeight: 300,
          color: 'rgba(244,240,232,0.5)', lineHeight: 1.4, marginTop: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {subline}
        </div>
      </div>
      <button
        type="button"
        onClick={handleGet}
        style={{
          flexShrink: 0,
          fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
          letterSpacing: '2px', textTransform: 'uppercase',
          color: '#0F0E0D', background: '#C9A84C',
          border: 'none', padding: '10px 14px', cursor: 'pointer',
        }}
      >
        {platform === 'android' ? 'Open Web' : 'Get App'}
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
