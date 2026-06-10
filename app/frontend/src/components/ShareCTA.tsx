import { useState } from 'react';
import { isNative } from '@/lib/nativeFeatures';

const APP_STORE_URL = 'https://apps.apple.com/app/id6768064079';
const SHARE_TEXT = 'I just used PropertyDNA — it shows the data your real estate agent does not want you to see. Free on iOS:';
const WEB_URL = 'https://thepropertydna.com';

interface ShareCTAProps {
  // Optional: caller can pass a property-specific message
  subjectLabel?: string;
  compact?: boolean;
}

const channels = [
  {
    key: 'twitter',
    label: 'X / Twitter',
    href: (text: string, url: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    href: (_text: string, url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    href: (_text: string, url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    key: 'sms',
    label: 'Text',
    href: (text: string, url: string) =>
      `sms:?&body=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    key: 'email',
    label: 'Email',
    href: (text: string, url: string) =>
      `mailto:?subject=${encodeURIComponent('PropertyDNA — free property intelligence')}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
  },
];

export default function ShareCTA({ subjectLabel, compact = false }: ShareCTAProps) {
  const [copied, setCopied] = useState(false);
  const url = isNative() ? APP_STORE_URL : WEB_URL;
  const text = subjectLabel
    ? `Just ran a PropertyDNA report on ${subjectLabel}. The data your agent does not want you to see — free.`
    : SHARE_TEXT;

  const handleShare = (channelKey: string, href: string) => {
    try { (window as any).pdnaTrack?.('share_click', { channel: channelKey }); } catch { /* tracking unavailable */ }
    window.open(href, '_blank', 'noopener');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      try { (window as any).pdnaTrack?.('share_click', { channel: 'copy' }); } catch { /* tracking unavailable */ }
    } catch {
      // Clipboard unavailable — silently no-op
    }
  };

  return (
    <div style={{
      padding: compact ? '18px 20px' : '28px 28px',
      background: 'rgba(184,147,85,0.06)',
      border: '1px solid rgba(184,147,85,0.25)',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div>
        <div style={{
          fontFamily: 'Jost, sans-serif', fontSize: 9,
          letterSpacing: '3px', textTransform: 'uppercase',
          color: '#C9A84C', marginBottom: 8,
        }}>
          Defend Another Buyer
        </div>
        <div style={{
          fontFamily: 'Cormorant Garamond, Georgia, serif',
          fontSize: compact ? 18 : 22, fontWeight: 300,
          color: '#F4F0E8', lineHeight: 1.3,
        }}>
          {subjectLabel
            ? 'Share this report — protect someone else from a bad deal.'
            : 'Share PropertyDNA. End information asymmetry, one buyer at a time.'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {channels.map(c => (
          <button
            key={c.key}
            type="button"
            onClick={() => handleShare(c.key, c.href(text, url))}
            style={{
              fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
              letterSpacing: '2px', textTransform: 'uppercase',
              color: 'rgba(244,240,232,0.75)', background: 'transparent',
              border: '1px solid rgba(255,255,255,0.18)',
              padding: '10px 14px', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#C9A84C'; e.currentTarget.style.color = '#C9A84C'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = 'rgba(244,240,232,0.75)'; }}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          onClick={handleCopy}
          style={{
            fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
            letterSpacing: '2px', textTransform: 'uppercase',
            color: copied ? '#0F0E0D' : 'rgba(244,240,232,0.75)',
            background: copied ? '#C9A84C' : 'transparent',
            border: copied ? 'none' : '1px solid rgba(255,255,255,0.18)',
            padding: '10px 14px', cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {copied ? 'Copied' : 'Copy Link'}
        </button>
      </div>
    </div>
  );
}
