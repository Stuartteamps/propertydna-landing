import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { HeatHoverState } from '@/types/heatmap';
import { heatScoreToHex, heatScoreToRgba } from '@/lib/colorScaleHeatmap';
import { heatScoreLabel } from '@/lib/scoringHeatmap';

interface Props { hover: HeatHoverState | null; }

export default function HoverTooltip({ hover }: Props) {
  if (!hover) return null;
  const { parcel: p, x, y } = hover;
  const hex = heatScoreToHex(p.score);
  const sparkData = p.sparkline.map((v, i) => ({ i, v }));
  const tipW = 220, tipH = 180;
  const left = x + 16 + tipW > window.innerWidth ? x - tipW - 8 : x + 16;
  const top  = y + tipH > window.innerHeight ? y - tipH - 8 : y + 8;

  return (
    <div style={{
      position: 'fixed', left, top, zIndex: 9999, pointerEvents: 'none',
      background: 'rgba(10,9,8,0.96)', backdropFilter: 'blur(16px)',
      border: `1px solid ${heatScoreToRgba(p.score, 0.5)}`,
      borderRadius: 10, padding: '14px 16px', width: tipW,
      fontFamily: 'Jost, sans-serif', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: `radial-gradient(circle, ${hex}dd, ${hex}88)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#fff',
        }}>{p.score}</div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: hex }}>{heatScoreLabel(p.score)}</div>
          <div style={{ fontSize: 10, color: '#6B6252' }}>{Math.round(p.confidence * 100)}% confidence</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#F4F0E8', fontWeight: 500, marginBottom: 2, lineHeight: 1.3 }}>{p.street}</div>
      <div style={{ fontSize: 10, color: '#6B6252', marginBottom: 10 }}>
        {p.neighborhood} · {p.propertyType.replace('_', ' ')}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#F4F0E8', fontFamily: 'Cormorant Garamond, serif' }}>
          ${p.price.toLocaleString()}
        </span>
        <span style={{ fontSize: 10, color: '#6B6252', alignSelf: 'flex-end' }}>
          ${p.pricePerSqft}/sf · {p.dom}d
        </span>
      </div>
      <div style={{ height: 36 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparkData}>
            <Line type="monotone" dataKey="v" stroke={hex} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 9, color: '#6B6252', textAlign: 'right', marginTop: 2 }}>30-day price index</div>
    </div>
  );
}
