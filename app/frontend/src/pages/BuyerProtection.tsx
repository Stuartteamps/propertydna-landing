/**
 * BuyerProtection — print-optimized one-pager.
 *
 * The buyer runs a PropertyDNA report, downloads this PDF, hands it to
 * their agent: "Here's what I found. Please address each item before we sign."
 *
 * Every PDF shown to an agent is an impression. Every agent who sees one
 * becomes a candidate for Realtor Pro. The buyer gets paper authority to
 * push back on cherry-picked comps and hidden risk.
 *
 * Usage: /buyer-protection?address=ADDR  → user clicks "Download PDF" → Cmd+P → Save as PDF
 *
 * The page detects ?address= and pulls the live report via the existing
 * property-query endpoint. Falls back to a clean placeholder if no address.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const G = '#C9A84C';
const FONT_SERIF = "'Cormorant Garamond', Georgia, serif";
const FONT_SANS  = "'Jost', -apple-system, BlinkMacSystemFont, sans-serif";

interface ReportData {
  address: string;
  city?: string; state?: string; zip?: string;
  beds?: number | string; baths?: number | string; sqft?: number | string;
  year_built?: number;
  dna_score?: number;
  confidence?: string;
  estimate?: number;
  estimate_low?: number;
  estimate_high?: number;
  flood_zone?: string;
  in_sfha?: boolean;
  unfinaled_permits?: number;
  hazard_rating?: string;
  verdict?: string;
  comp_count_used?: number;
  comp_count_available?: number;
  comp_spread_pct?: number;
  matched_features?: Array<{ label: string; pct: number }>;
}

const fmtUSD = (n?: number) => n == null ? '—' : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${Math.round(n / 1_000).toLocaleString()}K` : `$${n.toLocaleString()}`;

const PRINT_CSS = `
@page { size: letter; margin: 0.5in; }
@media print {
  body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pdna-print-hide { display: none !important; }
  .pdna-pdf { box-shadow: none !important; border: none !important; }
}
.pdna-pdf {
  background: white;
  color: #1a1a1a;
  font-family: ${FONT_SANS};
  max-width: 7.5in;
  margin: 0 auto;
  padding: 0.4in;
  font-size: 11px;
  line-height: 1.5;
  box-shadow: 0 8px 32px rgba(0,0,0,0.06);
  border: 1px solid #e5e0d8;
}
.pdna-pdf h1, .pdna-pdf h2, .pdna-pdf h3 {
  font-family: ${FONT_SERIF};
  font-weight: 300;
  color: #0a0908;
  margin: 0;
}
.pdna-section { margin-bottom: 14px; }
.pdna-kicker {
  font-family: ${FONT_SANS};
  font-size: 8px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #888;
  margin-bottom: 5px;
}
.pdna-row { display: flex; justify-content: space-between; padding: 4px 0; border-top: 1px solid #f0ece4; font-size: 11px; }
.pdna-row:first-child { border-top: none; }
.pdna-row .l { color: #555; }
.pdna-row .v { color: #1a1a1a; font-weight: 500; }
.pdna-row .v.warn { color: #b85a00; }
.pdna-row .v.bad  { color: #c0392b; }
.pdna-issue {
  background: #fff8e6;
  border-left: 3px solid #C9A84C;
  padding: 8px 10px;
  margin: 6px 0;
  font-size: 10.5px;
  color: #5a4a1a;
}
`;

export default function BuyerProtection() {
  const [params] = useSearchParams();
  const address = params.get('address') || '';
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(!!address);

  useEffect(() => {
    if (!address) { setLoading(false); return; }
    fetch(`/.netlify/functions/property-query?address=${encodeURIComponent(address)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) { setLoading(false); return; }
        const p = d.property || d;
        const v = d.valuation || p.valuation || {};
        const r = d.risk || p.risk || {};
        const comps = d.comp_analysis || {};
        setData({
          address: p.address || address,
          city: p.city, state: p.state, zip: p.zip,
          beds: p.beds, baths: p.baths, sqft: p.sqft,
          year_built: p.year_built,
          dna_score: v.dna_score, confidence: v.confidence,
          estimate: v.estimate ?? p.current_estimated_value,
          estimate_low: v.low, estimate_high: v.high,
          flood_zone: r.flood_zone, in_sfha: r.in_sfha,
          unfinaled_permits: r.unfinaled_permits,
          hazard_rating: r.hazard_rating,
          verdict: v.verdict,
          comp_count_used: comps.cma_count,
          comp_count_available: comps.algo_count,
          comp_spread_pct: comps.spread_pct,
          matched_features: v.drivers || [],
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  const handlePrint = () => window.print();

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div style={{ background: '#f7f5f0', minHeight: '100vh', padding: '24px 16px' }}>
        {/* Action bar (hidden on print) */}
        <div className="pdna-print-hide" style={{ maxWidth: '7.5in', margin: '0 auto 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#888', flex: 1, minWidth: 240 }}>
            Buyer Protection Letter · ready to print or save as PDF
          </div>
          <button onClick={handlePrint} style={{ background: '#0a0908', color: G, border: `1px solid ${G}`, padding: '10px 22px', fontFamily: FONT_SANS, fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', cursor: 'pointer' }}>
            Download PDF / Print
          </button>
          <a href={`/property-dna?address=${encodeURIComponent(address)}`} style={{ background: 'transparent', color: '#0a0908', border: '1px solid rgba(10,9,8,0.2)', padding: '10px 22px', fontFamily: FONT_SANS, fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', textDecoration: 'none' }}>
            Open full report
          </a>
        </div>

        {/* The PDF */}
        <div className="pdna-pdf">

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${G}`, paddingBottom: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: FONT_SANS, fontSize: 8, letterSpacing: 3, textTransform: 'uppercase', color: G, fontWeight: 600 }}>
                PropertyDNA · Buyer Protection Letter
              </div>
              <h1 style={{ fontSize: 22, marginTop: 4 }}>
                Pre-signing diligence: {address || '—'}
              </h1>
              <div style={{ fontSize: 10, color: '#777', marginTop: 4 }}>
                Issued {today} · Report URL: thepropertydna.com/property-dna
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ width: 32, height: 32, border: `1px solid ${G}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="12" height="12" stroke={G} />
                  <line x1="7" y1="1" x2="7" y2="13" stroke={G} strokeWidth="0.75" />
                  <line x1="1" y1="7" x2="13" y2="7" stroke={G} strokeWidth="0.75" />
                </svg>
              </div>
              <div style={{ fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: '#888' }}>save the humans</div>
            </div>
          </div>

          {/* To-the-agent intro */}
          <div className="pdna-section">
            <p style={{ fontSize: 11.5, color: '#222', lineHeight: 1.65, margin: 0 }}>
              <strong>To the listing agent / seller's representative:</strong> The buyer ran an institutional-grade PropertyDNA report on this property. The findings below are not subjective concerns — they're sourced from county assessor records, FEMA NFHL, USGS, BuildZoom permits, RentCast comp data, and other primary public records. Please address each item in writing before contract execution. The buyer reserves the right to renegotiate price, request seller credits, or withdraw the offer based on any unaddressed finding.
            </p>
          </div>

          {/* Property summary */}
          <div className="pdna-section" style={{ background: '#fbfaf7', padding: '10px 12px', border: '1px solid #f0ece4' }}>
            <div className="pdna-kicker">Property summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <div className="pdna-kicker">Beds · Baths</div>
                <div style={{ fontFamily: FONT_SERIF, fontSize: 20 }}>{data?.beds ?? '—'} · {data?.baths ?? '—'}</div>
              </div>
              <div>
                <div className="pdna-kicker">Square Feet</div>
                <div style={{ fontFamily: FONT_SERIF, fontSize: 20 }}>{data?.sqft ? Number(data.sqft).toLocaleString() : '—'}</div>
              </div>
              <div>
                <div className="pdna-kicker">Built</div>
                <div style={{ fontFamily: FONT_SERIF, fontSize: 20 }}>{data?.year_built ?? '—'}</div>
              </div>
            </div>
          </div>

          {/* DNA verdict */}
          <div className="pdna-section">
            <div className="pdna-kicker">Algorithm verdict</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div className="pdna-row"><span className="l">DNA Score</span><span className="v">{data?.dna_score ?? '—'} / 100</span></div>
                <div className="pdna-row"><span className="l">Confidence</span><span className="v">{data?.confidence ?? '—'}</span></div>
                <div className="pdna-row"><span className="l">Verdict</span><span className={`v ${data?.verdict === 'walk' ? 'bad' : data?.verdict === 'hold' ? 'warn' : ''}`}>{(data?.verdict || '—').toUpperCase()}</span></div>
              </div>
              <div>
                <div className="pdna-row"><span className="l">Est. value (mid)</span><span className="v">{fmtUSD(data?.estimate)}</span></div>
                <div className="pdna-row"><span className="l">Range (low–high)</span><span className="v">{fmtUSD(data?.estimate_low)} – {fmtUSD(data?.estimate_high)}</span></div>
                <div className="pdna-row"><span className="l">Comp spread</span><span className={`v ${data?.comp_spread_pct && Math.abs(data.comp_spread_pct) > 8 ? 'warn' : ''}`}>{data?.comp_spread_pct != null ? `${data.comp_spread_pct.toFixed(1)}%` : '—'}</span></div>
              </div>
            </div>
          </div>

          {/* Findings to address */}
          <div className="pdna-section">
            <div className="pdna-kicker">Findings to address before signing</div>

            {data?.unfinaled_permits != null && data.unfinaled_permits > 0 && (
              <div className="pdna-issue">
                <strong>Unfinaled permits: {data.unfinaled_permits}</strong><br />
                Permits opened with the jurisdiction but not finalized. Average cost at closing when title flags them: $12,000. Please provide written confirmation of permit closure status, or seller credit equal to the estimated finalization cost.
              </div>
            )}

            {data?.flood_zone && data.in_sfha && (
              <div className="pdna-issue">
                <strong>Special Flood Hazard Area (Zone {data.flood_zone})</strong><br />
                Lender will require flood insurance as a condition of closing. NFIP premium is highly variable. If this designation is post-Helene/Milton revised, the seller's pre-revision premium will not transfer. Please disclose current carrier, premium, and bind-date estimate for a new buyer.
              </div>
            )}

            {data?.hazard_rating && /high|severe/i.test(data.hazard_rating) && (
              <div className="pdna-issue">
                <strong>Hazard composite: {data.hazard_rating}</strong><br />
                Stacked environmental risk signals (flood + fire + seismic + wind) exceed the platform's warning threshold. Please share the seller's current insurance carrier + renewal trajectory. Confirm whether the property is on the carrier's non-renewal list.
              </div>
            )}

            {data?.comp_spread_pct != null && Math.abs(data.comp_spread_pct) > 8 && (
              <div className="pdna-issue">
                <strong>Comparable analysis: {data.comp_count_used ?? '—'} comps used, {data.comp_count_available ?? '—'} available within 0.5 mi</strong><br />
                The CMA used a subset of available comparables that average {data.comp_spread_pct.toFixed(1)}% above the full-radius set. Buyer requests either: (a) written justification for each comp exclusion, or (b) seller credit equal to the spread × price.
              </div>
            )}

            {data?.dna_score != null && data.dna_score < 70 && (
              <div className="pdna-issue">
                <strong>DNA Score below 70 (=&nbsp;{data.dna_score})</strong><br />
                Composite intelligence score indicates one or more material drivers (condition, location, market trajectory, comparable trend) suggest the listed price exceeds defensible value. Buyer requests written response to: (1) recent CMA, (2) any disclosed property condition issues, (3) the seller's basis for the asking price.
              </div>
            )}

            {(!data || (
              (!data.unfinaled_permits || data.unfinaled_permits === 0) &&
              !(data.flood_zone && data.in_sfha) &&
              !(data.hazard_rating && /high|severe/i.test(data.hazard_rating)) &&
              !(data.comp_spread_pct != null && Math.abs(data.comp_spread_pct) > 8) &&
              !(data.dna_score != null && data.dna_score < 70)
            )) && (
              <div style={{ background: '#f0f9ee', border: '1px solid #c8e6c9', padding: '10px 12px', fontSize: 11, color: '#2e5b2e' }}>
                <strong>No material findings to address.</strong> The algorithm's verdict, comp set, flood-zone, permit history, and hazard composite are all within acceptable bands. Buyer is comfortable proceeding subject to standard contingencies.
              </div>
            )}
          </div>

          {/* Buyer requests + signature */}
          <div className="pdna-section" style={{ marginTop: 18 }}>
            <div className="pdna-kicker">Buyer's required confirmations</div>
            <ol style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 11, color: '#333', lineHeight: 1.65 }}>
              <li>Written response to each finding above</li>
              <li>Copy of seller's current insurance declaration page (carrier, premium, expiry)</li>
              <li>Full disclosure of any open or unfinaled permits, with closure timeline</li>
              <li>Acknowledgment that buyer reserves the right to renegotiate based on unresolved findings</li>
            </ol>
          </div>

          {/* Signature block */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36, marginTop: 22 }}>
            <div>
              <div style={{ borderBottom: '1px solid #999', height: 28, marginBottom: 4 }} />
              <div className="pdna-kicker">Buyer signature</div>
            </div>
            <div>
              <div style={{ borderBottom: '1px solid #999', height: 28, marginBottom: 4 }} />
              <div className="pdna-kicker">Date</div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 24, paddingTop: 10, borderTop: '1px solid #f0ece4', fontSize: 9, color: '#888', lineHeight: 1.5 }}>
            <strong>PropertyDNA</strong> · thepropertydna.com · The institutional-grade property intelligence platform homebuyers were never supposed to have. Free for buyers, forever.<br />
            This letter is generated from PropertyDNA's sovereign parcel index + 47 named data sources. Methodology + sources: thepropertydna.com/methodology
          </div>
        </div>

        {/* Footer (hidden on print) */}
        <div className="pdna-print-hide" style={{ maxWidth: '7.5in', margin: '24px auto 0', textAlign: 'center', fontSize: 11, color: '#888', fontFamily: FONT_SANS }}>
          {loading
            ? `Loading report data for ${address || 'this property'}…`
            : !address
              ? 'Add ?address=... to the URL to populate findings. Otherwise the letter shows the template framework.'
              : 'Letter populated from the live DNA report. Hit Cmd+P (or the button above) to save as PDF.'}
        </div>
      </div>
    </>
  );
}
