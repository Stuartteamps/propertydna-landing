import React from 'react';
import { Tier, tierAtLeast } from '@/lib/tier';

interface TierGateProps {
  userTier: Tier;
  requiredTier: 'monthly' | 'enterprise';
  children: React.ReactNode;
  onUpgrade?: () => void;
}

const UPGRADE_INFO = {
  monthly: {
    label: 'Pro Feature',
    price: '$49 / month',
    cta: 'Upgrade to Pro',
    description: 'Unlock market trend intelligence, moving averages, neighborhood demand scoring, and absorption rate analysis.',
    note: '',
  },
  enterprise: {
    label: 'Enterprise Feature',
    price: 'Contact sales',
    cta: 'Upgrade to Enterprise',
    description: 'Unlock micro-location scoring, full adjustment-factor breakdowns, property event timelines, and live sales intelligence.',
    note: '',
  },
} as const;

export const TierGate: React.FC<TierGateProps> = ({ userTier, requiredTier, children, onUpgrade }) => {
  if (tierAtLeast(userTier, requiredTier)) return <>{children}</>;

  const info = UPGRADE_INFO[requiredTier];

  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: 160 }}>
      <div style={{ filter: 'blur(5px)', opacity: 0.3, pointerEvents: 'none', userSelect: 'none' }} aria-hidden>
        {children}
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(to bottom, rgba(10,9,8,0.5) 0%, rgba(10,9,8,0.96) 40%)',
        zIndex: 2,
        padding: '0 24px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 10 }}>
            {info.label}
          </div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 300, color: '#F0EBE0', marginBottom: 8 }}>
            {info.price}
          </div>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.75, marginBottom: 22 }}>
            {info.description}
          </div>
          <a
            href="/#pricing"
            onClick={onUpgrade}
            style={{
              fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
              letterSpacing: '3px', textTransform: 'uppercase',
              color: '#000', background: '#C9A84C',
              padding: '12px 24px', textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            {info.cta} →
          </a>
        </div>
      </div>
    </div>
  );
};
