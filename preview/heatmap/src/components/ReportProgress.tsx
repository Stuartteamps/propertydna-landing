import React, { useState, useEffect } from 'react';
import type { Parcel } from '../types';

interface Props {
  parcel: Parcel;
  onDone: () => void;
}

const STEPS = [
  { label: 'Pulling RentCast comps',           ms: 800  },
  { label: 'Geocoding parcel boundaries',       ms: 600  },
  { label: 'Fetching permit history',           ms: 900  },
  { label: 'Running valuation model',           ms: 1100 },
  { label: 'Enriching with Census ACS data',    ms: 700  },
  { label: 'Scoring flood & hazard exposure',   ms: 800  },
  { label: 'Generating DNA narrative (AI)',     ms: 1600 },
  { label: 'Composing report',                  ms: 500  },
];

export default function ReportProgress({ parcel, onDone }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let step = 0;
    let mounted = true;

    function advance() {
      if (!mounted) return;
      if (step >= STEPS.length) {
        setDone(true);
        setTimeout(() => mounted && onDone(), 600);
        return;
      }
      setActiveStep(step);
      setTimeout(() => { step++; advance(); }, STEPS[step].ms);
    }
    advance();
    return () => { mounted = false; };
  }, [onDone]);

  const pct = done ? 100 : Math.round((activeStep / STEPS.length) * 100);

  return (
    <div style={{ fontFamily: 'Jost, sans-serif' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#6B6252', marginBottom: 4 }}>
          Generating report for
        </div>
        <div style={{ fontSize: 13, color: '#F4F0E8', fontWeight: 600 }}>
          {parcel.street}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4, background: 'rgba(107,98,82,0.3)', borderRadius: 2, marginBottom: 20, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: 'linear-gradient(90deg, #B89355, #C9A84C)',
          width: `${pct}%`,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Step list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {STEPS.map((step, i) => {
          const completed = i < activeStep || done;
          const active = i === activeStep && !done;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: completed ? '#B89355' : active ? 'rgba(184,147,85,0.2)' : 'rgba(107,98,82,0.2)',
                border: active ? '1px solid #B89355' : 'none',
                transition: 'background 0.3s',
              }}>
                {completed ? (
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <polyline points="2,5 4.5,7.5 8,2.5" stroke="#0F0E0D" strokeWidth="1.5" fill="none" />
                  </svg>
                ) : active ? (
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#B89355',
                    animation: 'pulse 0.8s ease-in-out infinite',
                  }} />
                ) : null}
              </div>
              <span style={{
                fontSize: 12,
                color: completed ? '#F4F0E8' : active ? '#B89355' : '#6B6252',
                transition: 'color 0.3s',
                fontWeight: active ? 500 : 400,
              }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
    </div>
  );
}
