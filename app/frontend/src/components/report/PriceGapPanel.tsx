/**
 * PriceGapPanel — "Why your price is off."
 *
 * Compares the home's PropertyDNA-adjusted value against a reference price and
 * explains the gap with the same adjustment drivers used in the valuation. This
 * is the leave-behind a listing agent (or a buyer's agent) uses to justify a
 * number to a client or another agent.
 *
 * Reference price priority:
 *   1. An explicit list price — from report data, or a ?list= URL query param
 *      (so a shareable link can carry the asking price, e.g. /report/view/<t>?list=2500000).
 *   2. Fallback: reconcile the DNA-adjusted value against the raw automated (AVM)
 *      estimate, explaining what property-specific factors move the value.
 */

const parseMoney = (v: any): number | null => {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return isFinite(n) && n > 0 ? n : null;
};

const money = (v: number | null) => (v ? `$${Math.round(v).toLocaleString()}` : '—');

function readListParam(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const p = new URLSearchParams(window.location.search);
    return parseMoney(p.get('list') || p.get('listPrice') || p.get('asking'));
  } catch { return null; }
}

export default function PriceGapPanel({
  dnaAdj, val, listPrice,
}: {
  dnaAdj: any;
  val: any;
  listPrice?: number | null;
}) {
  const dnaValue = parseMoney(dnaAdj?.adjMid) || parseMoney(val?.marketValue);
  if (!dnaValue) return null;

  const rawAvm = parseMoney(val?.marketValue);
  const list = parseMoney(listPrice) || readListParam();
  const drivers: any[] = Array.isArray(dnaAdj?.drivers) ? dnaAdj.drivers : [];

  const wrap: React.CSSProperties = { borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 32, marginBottom: 40 };
  const heading: React.CSSProperties = { fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 20 };
  const label: React.CSSProperties = { fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 4 };
  const figure: React.CSSProperties = { fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 22, fontWeight: 300, color: '#F0EBE0' };

  const DriverList = () => drivers.length > 0 ? (
    <div style={{ marginTop: 18 }}>
      <div style={{ ...label, marginBottom: 10 }}>What's driving the value</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {drivers.map((d: any) => (
          <div key={d.key} style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', padding: '6px 12px' }}>
            {d.pct != null ? (
              <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: d.pct > 0 ? '#74C69D' : '#B85245' }}>
                {d.pct > 0 ? '+' : ''}{d.pct}%
              </span>
            ) : d.dollar != null ? (
              <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: d.dollar > 0 ? '#74C69D' : '#B85245' }}>
                {d.dollar > 0 ? '+' : ''}{money(d.dollar)}
              </span>
            ) : null}
            <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', marginLeft: 6 }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  // ── Mode 1: explicit list price → over/under verdict ──────────────────────
  if (list) {
    const gap = list - dnaValue;
    const gapPct = (gap / dnaValue) * 100;
    const over = gapPct > 4;
    const under = gapPct < -4;
    const verdict = over ? 'Priced Above Value' : under ? 'Priced Below Value — Buyer Opportunity' : 'Priced In Line With Value';
    const color = over ? '#B85245' : under ? '#2D9142' : '#C9A84C';
    const dirWord = gap > 0 ? 'above' : 'below';

    return (
      <div style={wrap}>
        <div style={heading}>Pricing Gap Analysis — Why The Price Is Off</div>
        <div style={{ background: '#111', border: `1px solid ${color}44`, padding: 24 }}>
          <div style={{ display: 'inline-block', background: color, color: '#0A0908', fontFamily: 'Jost, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', padding: '6px 14px', marginBottom: 18 }}>
            {verdict}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 32px', marginBottom: 18 }}>
            <div><div style={label}>List / Asking Price</div><div style={figure}>{money(list)}</div></div>
            <div><div style={label}>PropertyDNA Adjusted Value</div><div style={{ ...figure, color: '#C9A84C' }}>{money(dnaValue)}</div></div>
            <div><div style={label}>Gap</div><div style={{ ...figure, color }}>{gap > 0 ? '+' : ''}{money(gap)} <span style={{ fontSize: 14 }}>({gapPct > 0 ? '+' : ''}{gapPct.toFixed(1)}%)</span></div></div>
          </div>
          <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300, color: '#F0EBE0', lineHeight: 1.8, margin: 0 }}>
            At {money(list)}, this home is listed <strong style={{ color }}>{Math.abs(gapPct).toFixed(1)}% ({money(Math.abs(gap))}) {dirWord}</strong> its PropertyDNA-adjusted value of {money(dnaValue)}
            {over ? ' — a gap that typically lengthens days-on-market until the price meets the data.' :
             under ? ' — a genuine opening for a prepared buyer.' :
             ' — well-supported by the comparable and feature-adjusted data.'}
          </p>
          <DriverList />
        </div>
      </div>
    );
  }

  // ── Mode 2: no list price → reconcile DNA value vs raw AVM ─────────────────
  const showReconcile = rawAvm && Math.abs(rawAvm - dnaValue) / dnaValue > 0.005;
  return (
    <div style={wrap}>
      <div style={heading}>What This Home Is Worth — And Why</div>
      <div style={{ background: '#111', border: '1px solid rgba(201,168,76,0.15)', padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: showReconcile ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: '0 32px', marginBottom: 16 }}>
          <div><div style={label}>PropertyDNA Adjusted Value</div><div style={{ ...figure, color: '#C9A84C' }}>{money(dnaValue)}</div></div>
          {showReconcile && (
            <>
              <div><div style={label}>Raw Automated Estimate</div><div style={figure}>{money(rawAvm)}</div></div>
              <div><div style={label}>Adjustment</div>
                <div style={{ ...figure, color: dnaValue >= rawAvm! ? '#74C69D' : '#B85245' }}>
                  {dnaValue >= rawAvm! ? '+' : ''}{money(dnaValue - rawAvm!)}
                </div>
              </div>
            </>
          )}
        </div>
        <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.7, margin: 0 }}>
          {showReconcile
            ? 'The PropertyDNA value adjusts the raw automated estimate for this property’s specific features, sale history, and market appreciation.'
            : 'Feature- and sale-adjusted value for this property.'}
          {' '}To compare against a specific asking price, add <code style={{ color: '#C9A84C' }}>?list=PRICE</code> to this report’s link.
        </p>
        <DriverList />
      </div>
    </div>
  );
}
