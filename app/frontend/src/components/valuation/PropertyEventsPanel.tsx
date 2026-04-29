import React, { useEffect, useState } from 'react';

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_KTTgVO3mROxubE_A9OQ7Kg_aRrnzPVT';

interface PropertyEvent {
  id: string;
  event_type: string;
  event_date: string | null;
  event_source: string | null;
  event_value: number | null;
  event_notes: string | null;
}

interface Props {
  address?: string;
}

const EVENT_COLORS: Record<string, string> = {
  sale: '#C9A84C',
  listing: '#74C69D',
  price_change: '#A07850',
  permit: '#95D5B2',
  renovation: '#40916C',
  addition: '#2D6A4F',
  hoa_update: '#6B6252',
  tax_update: '#6B6252',
  rent_update: '#C9A84C',
  valuation_update: '#C9A84C',
  market_adjustment: '#6B6252',
};

const EVENT_LABELS: Record<string, string> = {
  sale: 'Sale',
  listing: 'Listed',
  price_change: 'Price Change',
  permit: 'Permit Filed',
  renovation: 'Renovation',
  addition: 'Addition',
  hoa_update: 'HOA Update',
  tax_update: 'Tax Update',
  rent_update: 'Rent Update',
  valuation_update: 'Valuation Updated',
  market_adjustment: 'Market Adjustment',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

function fmtValue(v: number | null, type: string) {
  if (v == null) return '';
  if (type === 'sale' || type === 'rent_update' || type === 'listing' || type === 'price_change') {
    return `$${Math.round(v).toLocaleString()}`;
  }
  return v.toLocaleString();
}

export const PropertyEventsPanel: React.FC<Props> = ({ address }) => {
  const [events, setEvents] = useState<PropertyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) { setLoading(false); return; }

    fetch(`${SUPA_URL}/rest/v1/properties?select=${encodeURIComponent('id')}&address=eq.${encodeURIComponent(address)}&limit=1`, {
      headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` },
    })
      .then(r => r.json())
      .then(async (rows: any[]) => {
        if (!Array.isArray(rows) || !rows.length) return;
        const propertyId = rows[0].id;
        const eqs = [
          `select=${encodeURIComponent('id,event_type,event_date,event_source,event_value,event_notes')}`,
          `property_id=eq.${encodeURIComponent(propertyId)}`,
          'order=event_date.desc',
          'limit=20',
        ].join('&');
        const eRes = await fetch(`${SUPA_URL}/rest/v1/property_events?${eqs}`, {
          headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` },
        });
        const eRows = await eRes.json();
        if (Array.isArray(eRows)) setEvents(eRows);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) {
    return <div style={{ color: '#6B6252', fontFamily: 'Jost, sans-serif', fontSize: 13, padding: '24px 0' }}>Loading event history…</div>;
  }

  if (!events.length) {
    return (
      <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)', padding: 28 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: '#F0EBE0', marginBottom: 8 }}>
          No events recorded yet.
        </div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.7 }}>
          As sales, permits, renovations, and market adjustments are recorded, they will appear here.
          Events are sourced from county records, MLS history, and permit databases.
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', paddingLeft: 20 }}>
      {/* Timeline spine */}
      <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 1, background: 'rgba(255,255,255,0.08)' }} />

      {events.map((ev, i) => {
        const color = EVENT_COLORS[ev.event_type] || '#6B6252';
        const label = EVENT_LABELS[ev.event_type] || ev.event_type;
        const val = fmtValue(ev.event_value, ev.event_type);

        return (
          <div key={ev.id || i} style={{ display: 'flex', gap: 16, marginBottom: 24, position: 'relative' }}>
            <div style={{ position: 'absolute', left: -17, top: 4, width: 10, height: 10, borderRadius: '50%', background: color, border: '2px solid #0A0908', flexShrink: 0 }} />
            <div style={{ flex: 1, paddingLeft: 4 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 2 }}>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color }}>
                  {label}
                </div>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252' }}>
                  {fmtDate(ev.event_date)}
                </div>
                {ev.event_source && (
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, color: 'rgba(107,98,82,0.5)' }}>
                    via {ev.event_source}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {val && (
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, color: '#F0EBE0', fontWeight: 300 }}>
                    {val}
                  </div>
                )}
                {ev.event_notes && (
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', lineHeight: 1.5 }}>
                    {ev.event_notes}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
