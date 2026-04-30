import { useState, useEffect } from 'react';
import type { HeatParcel } from '@/types/heatmap';

interface Props { parcel: HeatParcel; onDone: () => void; }

const STEPS = [
  { label: 'Pulling RentCast comps',        ms: 800  },
  { label: 'Geocoding parcel boundaries',    ms: 600  },
  { label: 'Fetching permit history',        ms: 900  },
  { label: 'Running valuation model',        ms: 1100 },
  { label: 'Enriching with Census ACS data', ms: 700  },
  { label: 'Scoring flood & hazard exposure',ms: 800  },
  { label: 'Generating DNA narrative (AI)',  ms: 1600 },
  { label: 'Composing report',               ms: 500  },
];

export default function ReportProgress({ parcel, onDone }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let step = 0, mounted = true;
    function advance() {
      if (!mounted) return;
      if (step >= STEPS.length) { setDone(true); setTimeout(() => mounted && onDone(), 600); return; }
      setActiveStep(step);
      setTimeout(() => { step++; advance(); }, STEPS[step].ms);
    }
    advance();
    return () => { mounted = false; };
  }, [onDone]);

  const pct = done ? 100 : Math.round((activeStep / STEPS.length) * 100);

  return (
    <div style={{ fontFamily: 'Jost, sans-serif' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: '#6B6252', marginBottom: 3 }}>Generating report for</div>
        <div style={{ fontSize: 12, color: '#F4F0E8', fontWeight: 600 }}>{parcel.street}</div>
      </div>
      <div style={{ height: 3, background: 'rgba(107,98,82,0.3)', borderRadius: 2, marginBottom: 18, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg,#B89355,#C9A84C)', width: `${pct}%`, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {STEPS.map((step, i) => {
          const completed = i < activeStep || done;
          const active = i === activeStep && !done;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: completed ? '#B89355' : active ? 'rgba(184,147,85,0.2)' : 'rgba(107,98,82,0.2)',
                border: active ? '1px solid #B89355' : 'none',
              }}>
                {completed ? (
                  <svg width="8" height="8" viewBox="0 0 10 10">
                    <polyline points="2,5 4.5,7.5 8,2.5" stroke="#0F0E0D" strokeWidth="1.5" fill="none" />
                  </svg>
                ) : active ? (
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#B89355', animation: 'pulse 0.8s ease-in-out infinite' }} />
                ) : null}
              </div>
              <span style={{
                fontSize: 11, color: completed ? '#F4F0E8' : active ? '#B89355' : '#6B6252',
                fontWeight: active ? 500 : 400, transition: 'color 0.3s',
              }}>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
