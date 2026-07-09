// ─────────────────────────────────────────────────────────────────────────────
// InternalLinks — the connective tissue that makes the site read as an
// intelligence layer. Links out to the city market page (only if it's a real
// market slug), 2–3 research articles, and the /analyze report CTA.
// ─────────────────────────────────────────────────────────────────────────────
import { Link } from 'react-router-dom';
import { marketSlugs } from '@/data/marketPages';
import { researchArticles } from '@/data/researchPages';
import { T, eyebrow } from './_shared';

interface Props {
  city: string | null;
  state: string | null;
}

/** "La Quinta","CA" → "la-quinta-ca". */
export function citySlug(city: string | null, state: string | null): string | null {
  if (!city || !state) return null;
  return `${city}-${state}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function InternalLinks({ city, state }: Props) {
  const slug = citySlug(city, state);
  const hasMarket = slug != null && marketSlugs.includes(slug);
  const articles = researchArticles.slice(0, 3);

  return (
    <nav aria-label="Related PropertyDNA intelligence" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
      {/* Market page (or fall back to analyze) */}
      <LinkCard
        to={hasMarket ? `/market/${slug}` : '/analyze'}
        eyebrowText={hasMarket ? 'Market intelligence' : 'Run a report'}
        title={hasMarket ? `${city}, ${state} market` : 'Analyze any address'}
        blurb={
          hasMarket
            ? `Median value, price per square foot, days on market, and neighborhood trends for ${city}.`
            : 'Run a full Property DNA report on any home to see its value, comps, and risk.'
        }
      />

      {/* Research articles */}
      {articles.map((a) => (
        <LinkCard
          key={a.slug}
          to={`/research/${a.slug}`}
          eyebrowText={a.category}
          title={a.title}
          blurb={a.excerpt}
        />
      ))}

      {/* Always-on analyze CTA */}
      <LinkCard
        to="/analyze"
        eyebrowText="Free report"
        title="Get this home's full Property DNA"
        blurb="Value, comparable sales, risk factors, and the 9 proprietary scores — free, no login."
        accent
      />
    </nav>
  );
}

function LinkCard({
  to,
  eyebrowText,
  title,
  blurb,
  accent,
}: {
  to: string;
  eyebrowText: string;
  title: string;
  blurb: string;
  accent?: boolean;
}) {
  return (
    <Link
      to={to}
      style={{
        display: 'block',
        textDecoration: 'none',
        background: accent ? 'rgba(201,168,76,0.07)' : T.panel,
        border: `1px solid ${accent ? 'rgba(201,168,76,0.28)' : T.border}`,
        padding: '22px 24px',
      }}
    >
      <div style={{ ...eyebrow, fontSize: 9, marginBottom: 10 }}>{eyebrowText}</div>
      <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 300, color: T.cream, lineHeight: 1.25, marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 300, color: 'rgba(240,235,224,0.55)', lineHeight: 1.65 }}>{blurb}</div>
      <div style={{ fontFamily: T.sans, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.gold, marginTop: 14 }}>Read →</div>
    </Link>
  );
}
