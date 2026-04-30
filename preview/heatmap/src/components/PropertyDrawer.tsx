import React, { useState } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import type { Parcel } from '../types';
import { scoreToHex, scoreToRgba } from '../utils/colorScale';
import { scoreLabel, scoreBadgeColor } from '../utils/scoring';
import ReportProgress from './ReportProgress';

interface Props {
  parcel: Parcel | null;
  onClose: () => void;
}

export default function PropertyDrawer({ parcel, onClose }: Props) {
  const [generating, setGenerating] = useState(false);
  const [reportReady, setReportReady] = useState(false);

  function handleGenerate() {
    setGenerating(true);
    setReportReady(false);
  }

  function handleDone() {
    setGenerating(false);
    setReportReady(true);
  }

  const isOpen = parcel !== null;

  const radarData = parcel ? [
    { subject: 'Comps',       value: parcel.compsScore },
    { subject: 'Price Δ',     value: parcel.priceDeltaScore },
    { subject: 'DOM',         value: parcel.domScore },
    { subject: 'Permits',     value: parcel.permitsScore },
    { subject: 'Livability',  value: parcel.livability },
    { subject: 'Rental',      value: parcel.rentalDemand },
  ] : [];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 30,
          background: 'rgba(0,0,0,0.4)',
          opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 40,
        width: 380,
        background: '#0A0908',
        borderLeft: '1px solid rgba(184,147,85,0.2)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        overflowY: 'auto',
        fontFamily: 'Jost, sans-serif',
      }}>
        {parcel && (
          <>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid rgba(107,98,82,0.3)',
              background: `linear-gradient(180deg, ${scoreToRgba(parcel.score, 0.12)}, transparent)`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#F4F0E8', lineHeight: 1.3, marginBottom: 4 }}>
                    {parcel.street}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B6252' }}>
                    {parcel.city}, {parcel.state} {parcel.zip}
                  </div>
                </div>
                <button onClick={onClose} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6B6252', fontSize: 20, lineHeight: 1, padding: 0, marginLeft: 12,
                }}>×</button>
              </div>

              {/* Score ring */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: `conic-gradient(${scoreToHex(parcel.score)} ${parcel.score * 3.6}deg, rgba(107,98,82,0.2) 0)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', background: '#0A0908',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: scoreToHex(parcel.score),
                  }}>
                    {parcel.score}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: scoreBadgeColor(parcel.score) }}>
                    {scoreLabel(parcel.score)}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B6252' }}>
                    {Math.round(parcel.confidence * 100)}% model confidence
                  </div>
                  <div style={{ fontSize: 10, color: '#6B6252' }}>{parcel.neighborhood}</div>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(107,98,82,0.2)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                {[
                  { label: 'List Price', value: `$${parcel.price.toLocaleString()}` },
                  { label: 'Per Sqft', value: `$${parcel.pricePerSqft}` },
                  { label: 'Size', value: `${parcel.sqft.toLocaleString()} sqft` },
                  { label: 'Beds / Baths', value: `${parcel.bedrooms} / ${parcel.bathrooms}` },
                  { label: 'Year Built', value: `${parcel.yearBuilt}` },
                  { label: 'Days on Market', value: `${parcel.dom}d` },
                  { label: 'Recent Permits', value: `${parcel.permits}` },
                  { label: 'Type', value: parcel.propertyType.replace('_', ' ') },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 9, color: '#6B6252', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
                    <div style={{ fontSize: 13, color: '#F4F0E8', fontWeight: 500, marginTop: 2 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Radar chart */}
            <div style={{ padding: '16px 24px 0', borderBottom: '1px solid rgba(107,98,82,0.2)' }}>
              <div style={{ fontSize: 10, color: '#6B6252', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                Score Breakdown
              </div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(107,98,82,0.3)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B6252', fontSize: 10 }} />
                    <Radar dataKey="value" stroke={scoreToHex(parcel.score)} fill={scoreToHex(parcel.score)} fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Generate / Progress / Done */}
            <div style={{ padding: '20px 24px' }}>
              {!generating && !reportReady && (
                <>
                  <button
                    onClick={handleGenerate}
                    style={{
                      width: '100%', padding: '14px 0',
                      background: 'linear-gradient(135deg, #B89355, #C9A84C)',
                      border: 'none', borderRadius: 8, cursor: 'pointer',
                      fontSize: 13, fontWeight: 600, color: '#0F0E0D',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Generate Full DNA Report
                  </button>
                  <p style={{ fontSize: 10, color: '#6B6252', textAlign: 'center', marginTop: 8 }}>
                    ~8 second turnaround · Powered by PropertyDNA
                  </p>
                </>
              )}

              {generating && (
                <ReportProgress parcel={parcel} onDone={handleDone} />
              )}

              {reportReady && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
                  <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 600, marginBottom: 4 }}>
                    Report Ready
                  </div>
                  <div style={{ fontSize: 11, color: '#6B6252', marginBottom: 16 }}>
                    Full PropertyDNA analysis complete
                  </div>
                  <button
                    onClick={() => { setReportReady(false); }}
                    style={{
                      width: '100%', padding: '12px 0',
                      background: 'rgba(184,147,85,0.12)',
                      border: '1px solid rgba(184,147,85,0.4)',
                      borderRadius: 8, cursor: 'pointer',
                      fontSize: 12, fontWeight: 500, color: '#B89355',
                    }}
                  >
                    Run Another Report
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
