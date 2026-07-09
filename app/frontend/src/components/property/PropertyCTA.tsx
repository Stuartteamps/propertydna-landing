// ─────────────────────────────────────────────────────────────────────────────
// PropertyCTA — the gated "Full Report" teaser. The public summary above is
// genuinely useful; this card previews the deeper premium intelligence and
// invites the reader to run/unlock the full Property DNA report.
// ─────────────────────────────────────────────────────────────────────────────
import { Link } from 'react-router-dom';
import { T, eyebrow } from './_shared';

const LOCKED_MODULES = [
  'Interactive sales-activity map with every comparable',
  'Full 9-factor score breakdown with adjustment drivers',
  'Neighborhood demographics, schools, walk & transit scores',
  'Extended hazard profile — seismic, wildfire, air quality, flood',
  'Investment analysis: rental yield, cap rate, and ARV',
  'Downloadable PDF dossier and provenance records',
];

export default function PropertyCTA({ address }: { address: string }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: T.panel, border: `1px solid ${T.border}` }}>
      {/* Locked module preview (blurred teaser) */}
      <div
        aria-hidden="true"
        style={{
          padding: 'clamp(24px, 4vw, 40px)',
          filter: 'blur(3px)',
          opacity: 0.5,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {LOCKED_MODULES.map((m) => (
            <div key={m} style={{ background: T.bg, border: `1px solid ${T.border}`, padding: '18px 20px' }}>
              <div style={{ fontFamily: T.sans, fontSize: 13, color: T.cream, lineHeight: 1.6 }}>{m}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(15,14,13,0.55) 0%, rgba(15,14,13,0.95) 60%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 'clamp(28px, 5vw, 48px) 24px',
        }}
      >
        <div style={{ width: 42, height: 42, border: `1px solid rgba(201,168,76,0.45)`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="3" y="7" width="10" height="8" rx="1" stroke={T.gold} strokeWidth="1.2" />
            <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke={T.gold} strokeWidth="1.2" fill="none" />
          </svg>
        </div>
        <div style={{ ...eyebrow, marginBottom: 12 }}>Full Property DNA Report</div>
        <h2 style={{ fontFamily: T.serif, fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 300, color: T.cream2, margin: '0 0 12px', lineHeight: 1.15, maxWidth: 560 }}>
          The complete intelligence dossier for {address}
        </h2>
        <p style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 300, color: 'rgba(244,240,232,0.6)', lineHeight: 1.75, maxWidth: 480, margin: '0 0 26px' }}>
          Unlock the interactive map, full score breakdowns, neighborhood and hazard profiles, investment analysis,
          and a downloadable dossier — generated live for this address.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link
            to="/analyze"
            style={{
              fontFamily: T.sans,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: T.bg,
              background: T.gold,
              padding: '15px 32px',
              textDecoration: 'none',
            }}
          >
            Unlock the Full Report →
          </Link>
          <Link
            to="/pricing"
            style={{
              fontFamily: T.sans,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: T.cream,
              border: `1px solid rgba(255,255,255,0.2)`,
              padding: '15px 28px',
              textDecoration: 'none',
            }}
          >
            View Plans
          </Link>
        </div>
      </div>
    </div>
  );
}
