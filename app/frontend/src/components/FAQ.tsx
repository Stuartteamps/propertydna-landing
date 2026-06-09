/**
 * FAQ block with Schema.org FAQPage JSON-LD baked in.
 *
 * AI engines (ChatGPT, Perplexity, Google AI Overviews) cite pages with
 * structured FAQ markup. Drop this at the bottom of any indexable page.
 */
import { useState } from 'react';

export type FAQItem = { q: string; a: string };

export default function FAQ({
  title = 'Frequently Asked Questions',
  items,
  eyebrow,
}: {
  title?: string;
  items: FAQItem[];
  eyebrow?: string;
}) {
  const [open, setOpen] = useState<number | null>(0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type':         'Question',
      name:            q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <section style={{ background: '#0f1419', padding: '64px 24px', borderTop: '1px solid #1f2937' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        {eyebrow && (
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>
            {eyebrow}
          </div>
        )}
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px, 4vw, 42px)', color: '#fafafa', fontWeight: 400, margin: '0 0 32px' }}>
          {title}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, i) => (
            <div key={i} style={{ background: '#111827', borderRadius: 6, border: '1px solid #1f2937', overflow: 'hidden' }}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                style={{
                  width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#fafafa',
                  padding: '18px 20px', fontSize: 16, fontWeight: 500, cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
                  fontFamily: 'inherit',
                }}
              >
                <span>{it.q}</span>
                <span style={{ color: '#fbbf24', fontSize: 22, transition: 'transform 0.2s', transform: open === i ? 'rotate(45deg)' : 'rotate(0)' }}>+</span>
              </button>
              {open === i && (
                <div style={{ padding: '0 20px 20px', color: '#cbd5e1', fontSize: 15, lineHeight: 1.7 }}>
                  {it.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
