// ─────────────────────────────────────────────────────────────────────────────
// AISummary — plain-English, AI-readable valuation paragraph.
// This is the block ChatGPT / Perplexity / Gemini / AI Overviews quote verbatim,
// so it reads as natural prose filled from REAL data. Clauses whose data is
// missing are omitted rather than fabricated.
// ─────────────────────────────────────────────────────────────────────────────
import type { PublicProperty } from '@/lib/property-dna/publicProperty';
import { T, eyebrow } from './_shared';

export default function AISummary({ p }: { p: PublicProperty }) {
  const place = [p.city, p.state].filter(Boolean).join(', ');
  const drivers = p.valuation.keyDrivers.slice(0, 3);
  const risks = p.riskFactors.slice(0, 3);

  // Build the paragraph clause-by-clause; skip anything we don't truly have.
  const sentences: string[] = [];

  if (p.estimatedValue != null) {
    let s = `Property DNA estimates that ${p.address}${place ? ` in ${place}` : ''} is worth approximately $${p.estimatedValue.toLocaleString()}`;
    if (p.confidenceScore != null) s += `, with a confidence score of ${p.confidenceScore}/100`;
    s += '.';
    sentences.push(s);
    sentences.push(
      'This estimate is based on recent comparable sales, square footage, location, community features, condition, and current market trends.',
    );
  } else {
    sentences.push(
      `Property DNA is tracking ${p.address}${place ? ` in ${place}` : ''}, but a confident automated value is not yet available for this address.`,
    );
  }

  if (p.lowRange != null && p.highRange != null) {
    sentences.push(
      `The supported value range runs from $${p.lowRange.toLocaleString()} to $${p.highRange.toLocaleString()}.`,
    );
  }

  if (drivers.length) {
    sentences.push(`The strongest value drivers are ${joinList(drivers)}.`);
  }

  if (risks.length) {
    sentences.push(`The main risk factors are ${joinList(risks.map((r) => `${r.label.toLowerCase()} (${r.detail})`))}.`);
  }

  const prose = sentences.join(' ');

  return (
    <section
      aria-label="Summary"
      style={{
        background: 'linear-gradient(180deg, rgba(201,168,76,0.08) 0%, rgba(17,17,17,0.6) 100%)',
        border: '1px solid rgba(201,168,76,0.22)',
        borderLeft: `3px solid ${T.gold}`,
        padding: 'clamp(22px, 3.5vw, 34px)',
      }}
    >
      <div style={{ ...eyebrow, marginBottom: 14 }}>Property DNA Summary</div>
      <p
        style={{
          fontFamily: T.serif,
          fontSize: 'clamp(18px, 2.3vw, 24px)',
          fontWeight: 300,
          lineHeight: 1.55,
          color: T.cream,
          margin: 0,
        }}
      >
        {prose}
      </p>
    </section>
  );
}

/** Oxford-style list join: "a", "a and b", "a, b, and c". */
function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
