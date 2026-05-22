import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isNative } from '@/lib/nativeFeatures';

// Top-of-screen banner that appears on iOS/Android when the device drops
// offline. Surfaces a direct path to cached reports so users in the field
// (open house, walkthrough, no signal) aren't stranded.

export default function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isNative() || online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 800,
        background: 'rgba(201,76,76,0.96)',
        color: '#fff',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px' }}>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, letterSpacing: 0.5, lineHeight: 1.4 }}>
          You're offline — reports you've saved are still readable.
        </div>
        <Link
          to="/saved-reports"
          style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#fff', textDecoration: 'underline', whiteSpace: 'nowrap' }}
        >
          View saved
        </Link>
      </div>
    </div>
  );
}
