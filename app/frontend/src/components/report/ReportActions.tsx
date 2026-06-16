import { useState } from 'react';

/**
 * ReportActions — print / save-as-PDF + copy shareable link toolbar.
 *
 * Lives at the top of a report. Hidden when printing (.no-print) and injects a
 * print stylesheet that flips the dark report theme to clean black-on-white so
 * a client or agent gets a legible printout / PDF.
 *
 * shareUrl: the PUBLIC, no-login report URL (/report/view/:token). When present
 * a "Copy Shareable Link" button is shown.
 */
export default function ReportActions({ shareUrl }: { shareUrl?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Fallback for browsers without the async clipboard API
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const btn: React.CSSProperties = {
    fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 2,
    textTransform: 'uppercase', padding: '10px 18px', cursor: 'pointer',
    background: 'none', border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C',
    display: 'inline-flex', alignItems: 'center', gap: 8,
  };

  return (
    <>
      <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
        <button onClick={() => window.print()} style={btn}>
          <span aria-hidden>⎙</span> Print / Save PDF
        </button>
        {shareUrl && (
          <button
            onClick={copy}
            style={{ ...btn, borderColor: copied ? 'rgba(45,145,66,0.6)' : 'rgba(201,168,76,0.4)', color: copied ? '#2D9142' : '#C9A84C' }}
          >
            {copied ? '✓ Link Copied' : '⧉ Copy Shareable Link'}
          </button>
        )}
      </div>

      {/* Print stylesheet — flips the dark theme to printable black-on-white. */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          nav, footer, [role="dialog"] { display: none !important; }
          html, body { background: #ffffff !important; }
          body * {
            background-color: transparent !important;
            color: #1a1a1a !important;
            box-shadow: none !important;
            border-color: #dddddd !important;
          }
          a { color: #1a1a1a !important; text-decoration: none !important; }
          section, div { page-break-inside: avoid; }
          @page { margin: 14mm; }
        }
      `}</style>
    </>
  );
}
