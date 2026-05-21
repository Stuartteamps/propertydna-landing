import { Link, useLocation } from 'react-router-dom';
import { isNative, tapHaptic } from '@/lib/nativeFeatures';

// iOS/Android-only sticky bottom navigation. Hidden on web so the desktop
// layout is unchanged. Renders four tabs with haptic feedback on tap and
// honors the device safe-area inset so it sits above the home indicator.

interface Tab {
  label: string;
  path: string;
  match: (p: string) => boolean;
  icon: JSX.Element;
}

const ICON_SIZE = 22;

const tabs: Tab[] = [
  {
    label: 'Home',
    path: '/',
    match: (p) => p === '/' || p === '/analyze',
    icon: (
      <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5z" />
      </svg>
    ),
  },
  {
    label: 'Map',
    path: '/market-heatmaps',
    match: (p) => p.startsWith('/market-heatmaps') || p.startsWith('/heatmaps'),
    icon: (
      <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6 9 4l6 2 6-2v14l-6 2-6-2-6 2V6z" />
        <path d="M9 4v16M15 6v16" />
      </svg>
    ),
  },
  {
    label: 'Saved',
    path: '/saved-reports',
    match: (p) => p.startsWith('/saved-reports'),
    icon: (
      <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
      </svg>
    ),
  },
  {
    label: 'Account',
    path: '/dashboard',
    match: (p) => p.startsWith('/dashboard'),
    icon: (
      <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.5 3.5-7 8-7s8 2.5 8 7" />
      </svg>
    ),
  },
];

export default function NativeBottomNav() {
  const location = useLocation();
  if (!isNative()) return null;

  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 700,
        background: 'rgba(10,9,8,0.97)',
        borderTop: '1px solid rgba(201,168,76,0.18)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'space-around', height: 56 }}>
        {tabs.map((tab) => {
          const active = tab.match(location.pathname);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              onClick={() => tapHaptic()}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                color: active ? '#C9A84C' : '#6B6252',
                textDecoration: 'none',
                fontFamily: 'Jost, sans-serif',
                fontSize: 9,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
