import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth';

const OWNER     = 'stuartteamps@gmail.com';
const ADMIN_KEY = import.meta.env.VITE_INTERNAL_API_KEY || '';
const API = (fn: string) => `/.netlify/functions/${fn}`;

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const vals: string[] = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    vals.push(cur.trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));
  }).filter(r => Object.values(r).some(v => v));
}

// ── Column auto-detection ─────────────────────────────────────────────────────
const COL_PATTERNS: Record<string, RegExp> = {
  first_name:  /^(first.?name|first|fname|f_name)$/i,
  last_name:   /^(last.?name|last|lname|l_name|surname)$/i,
  email:       /^(email|e.?mail|email.?address)$/i,
  phone:       /^(phone|cell|mobile|tel|telephone|phone.?number)$/i,
  address:     /^(address|street|property.?address|home.?address|street.?address)$/i,
  city:        /^(city|market|farm|location|metro)$/i,
  state:       /^(state|st|province)$/i,
  zip:         /^(zip|zip.?code|postal|postal.?code)$/i,
  brokerage:   /^(brokerage|company|office|broker|firm|agency)$/i,
  license:     /^(license|dre|lic|dre.?number|license.?number)$/i,
};

function autoMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const header of headers) {
    for (const [field, pattern] of Object.entries(COL_PATTERNS)) {
      if (pattern.test(header) && !map[field]) { map[field] = header; break; }
    }
  }
  return map;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page:   { background: '#0A0908', minHeight: '100vh', padding: '40px clamp(16px,4vw,48px)', fontFamily: 'Jost, sans-serif', color: '#F4F0E8' },
  card:   { background: '#111', border: '1px solid rgba(184,147,85,0.2)', borderRadius: 12, padding: '28px 32px', marginBottom: 24 },
  label:  { fontSize: 10, color: '#6B6252', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' },
  input:  { background: '#1a1a1a', border: '1px solid rgba(107,98,82,0.4)', borderRadius: 8, padding: '10px 14px', color: '#F4F0E8', fontSize: 13, width: '100%', boxSizing: 'border-box' as const },
  select: { background: '#1a1a1a', border: '1px solid rgba(107,98,82,0.4)', borderRadius: 8, padding: '10px 14px', color: '#F4F0E8', fontSize: 13, width: '100%', boxSizing: 'border-box' as const },
  btn:    { background: 'linear-gradient(135deg,#B89355,#C9A84C)', border: 'none', borderRadius: 8, padding: '12px 28px', color: '#0F0E0D', fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em' },
  btnGhost: { background: 'transparent', border: '1px solid rgba(184,147,85,0.4)', borderRadius: 8, padding: '10px 22px', color: '#B89355', fontSize: 12, cursor: 'pointer' },
  tag:    { display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 600 },
  th:     { padding: '8px 14px', textAlign: 'left' as const, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#6B6252', borderBottom: '1px solid rgba(107,98,82,0.2)' },
  td:     { padding: '9px 14px', fontSize: 12, borderBottom: '1px solid rgba(107,98,82,0.1)', color: '#F4F0E8' },
};

const statusColor: Record<string, string> = {
  pending: '#6B6252', sent: '#3b82f6', opened: '#B89355',
  clicked: '#22c55e', converted: '#22c55e', bounced: '#ef4444',
  unsubscribed: '#6B6252', skipped: '#6B6252', draft: '#6B6252',
  sending: '#B89355', complete: '#22c55e', cancelled: '#ef4444',
};

type Step = 'upload' | 'map' | 'preview' | 'configure' | 'launch' | 'monitor';

interface Contact { [key: string]: string; }
interface MappedContact {
  first_name: string; last_name: string; email: string; phone: string;
  address: string; city: string; state: string; zip: string;
  brokerage: string; license: string;
}

export default function CampaignManager() {
  const { user } = useAuth();
  const [step, setStep]       = useState<Step>('upload');
  const [raw, setRaw]         = useState<Contact[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [colMap, setColMap]   = useState<Record<string, string>>({});
  const [campaignName, setCampaignName] = useState('');
  const [campaignType, setCampaignType] = useState('agent');
  const [subject, setSubject] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [saving, setSaving]   = useState(false);
  const [sending, setSending] = useState(false);
  const [stats, setStats]     = useState<any>(null);
  const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [error, setError]     = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing campaigns on mount
  useEffect(() => {
    fetch(API('get-campaign-stats'), { headers: { 'x-internal-key': ADMIN_KEY } })
      .then(r => r.json())
      .then(d => setAllCampaigns(d.campaigns || []))
      .catch(() => {});
  }, []);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCsv(text);
      if (!rows.length) { setError('Could not parse CSV — check the file format.'); return; }
      const hdrs = Object.keys(rows[0]);
      setRaw(rows);
      setHeaders(hdrs);
      setColMap(autoMap(hdrs));
      setCampaignName(file.name.replace(/\.csv$/i, '').replace(/[_-]/g, ' '));
      setStep('map');
      setError('');
    };
    reader.readAsText(file);
  }, []);

  function mapRow(row: Contact): MappedContact {
    const g = (field: string) => (colMap[field] ? row[colMap[field]] : '') || '';
    return {
      first_name: g('first_name') || (g('email').split('@')[0] || ''),
      last_name: g('last_name'),
      email: g('email'),
      phone: g('phone'),
      address: g('address'),
      city: g('city'),
      state: g('state') || 'CA',
      zip: g('zip'),
      brokerage: g('brokerage'),
      license: g('license'),
    };
  }

  const mapped = raw.map(mapRow).filter(r => r.email && r.email.includes('@'));
  const dupes = raw.length - mapped.length;

  async function saveCampaign() {
    if (!campaignName || !mapped.length) return;
    setSaving(true); setError('');
    try {
      const res = await fetch(API('save-campaign'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': ADMIN_KEY },
        body: JSON.stringify({ name: campaignName, type: campaignType, subject, template: campaignType, contacts: mapped }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCampaignId(data.campaignId);
      setStep('launch');
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  async function launchCampaign() {
    if (!campaignId) return;
    setSending(true); setError('');
    setStep('monitor');
    await sendBatch();
  }

  async function sendBatch() {
    try {
      const res = await fetch(API('send-campaign-emails'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': ADMIN_KEY },
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json();
      await refreshStats();
      if (!data.done) {
        pollRef.current = setTimeout(sendBatch, 2500);
      } else {
        setSending(false);
      }
    } catch { setSending(false); }
  }

  async function refreshStats() {
    const res = await fetch(`${API('get-campaign-stats')}?id=${campaignId}`, {
      headers: { 'x-internal-key': ADMIN_KEY },
    });
    const data = await res.json();
    setStats(data);
  }

  async function loadCampaign(c: any) {
    setSelectedCampaign(c);
    setCampaignId(c.id);
    const res = await fetch(`${API('get-campaign-stats')}?id=${c.id}`, {
      headers: { 'x-internal-key': ADMIN_KEY },
    });
    const data = await res.json();
    setStats(data);
    setStep('monitor');
  }

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!user || user.email !== OWNER) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', color: '#6B6252', fontFamily: 'Jost, sans-serif' }}>
        <div style={{ fontSize: 28, color: '#F4F0E8', marginBottom: 8 }}>Access Restricted</div>
        <div style={{ fontSize: 13 }}>Sign in as the account owner to access Campaign Manager.</div>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 400, letterSpacing: '-0.5px' }}>
              Campaign Manager
            </div>
            <div style={{ fontSize: 11, color: '#6B6252', marginTop: 4 }}>PropertyDNA · Email + SMS blast system</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['upload','map','preview','configure','launch','monitor'] as Step[]).map((s, i) => (
              <div key={s} style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600,
                background: s === step ? '#B89355' : ['upload','map','preview','configure','launch','monitor'].indexOf(s) < ['upload','map','preview','configure','launch','monitor'].indexOf(step) ? 'rgba(184,147,85,0.3)' : 'rgba(107,98,82,0.2)',
                color: s === step ? '#0F0E0D' : '#6B6252',
              }}>{i + 1}</div>
            ))}
          </div>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '12px 16px', color: '#ef4444', fontSize: 12, marginBottom: 20 }}>{error}</div>}

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Upload new */}
            <div style={S.card}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Upload New CSV</div>
              <div style={{ fontSize: 11, color: '#6B6252', marginBottom: 20 }}>Agent lists, buyer lists, homeowner lists — any CSV format</div>
              <div
                onClick={() => fileRef.current?.click()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onDragOver={e => e.preventDefault()}
                style={{ border: '2px dashed rgba(184,147,85,0.3)', borderRadius: 10, padding: '40px 24px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s' }}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 13, color: '#F4F0E8', marginBottom: 6 }}>Drop CSV here or click to browse</div>
                <div style={{ fontSize: 11, color: '#6B6252' }}>Accepts any column format — auto-maps name, email, phone, address, city, zip</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            {/* Previous campaigns */}
            <div style={S.card}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Previous Campaigns</div>
              {allCampaigns.length === 0 ? (
                <div style={{ fontSize: 12, color: '#6B6252' }}>No campaigns yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {allCampaigns.map(c => (
                    <div key={c.id} onClick={() => loadCampaign(c)}
                      style={{ padding: '12px 14px', background: '#1a1a1a', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{c.name}</div>
                        <div style={{ fontSize: 10, color: '#6B6252', marginTop: 2 }}>
                          {c.total_contacts?.toLocaleString()} contacts · {c.sent_count?.toLocaleString()} sent
                        </div>
                      </div>
                      <span style={{ ...S.tag, background: `${statusColor[c.status]}22`, color: statusColor[c.status] }}>{c.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Column Mapping ── */}
        {step === 'map' && (
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Map Columns</div>
            <div style={{ fontSize: 11, color: '#6B6252', marginBottom: 20 }}>Auto-detected from your CSV. Adjust any that are wrong.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
              {Object.keys(COL_PATTERNS).map(field => (
                <div key={field}>
                  <label style={S.label}>{field.replace(/_/g, ' ')}</label>
                  <select style={S.select} value={colMap[field] || ''} onChange={e => setColMap(p => ({ ...p, [field]: e.target.value }))}>
                    <option value="">— skip —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ background: '#1a1a1a', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 12 }}>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>{mapped.length.toLocaleString()} valid contacts</span>
              {dupes > 0 && <span style={{ color: '#6B6252', marginLeft: 12 }}>{dupes} skipped (no email)</span>}
              <span style={{ color: '#6B6252', marginLeft: 12 }}>from {raw.length.toLocaleString()} rows</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={S.btn} onClick={() => setStep('preview')}>Preview Sample →</button>
              <button style={S.btnGhost} onClick={() => setStep('upload')}>← Back</button>
            </div>
          </div>
        )}

        {/* ── Step 3: Preview ── */}
        {step === 'preview' && (
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Preview — First 10 Rows</div>
            <div style={{ fontSize: 11, color: '#6B6252', marginBottom: 20 }}>Verify the data looks right before configuring.</div>
            <div style={{ overflowX: 'auto', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>{['Name','Email','Phone','City','Zip','Brokerage','Score'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {mapped.slice(0, 10).map((r, i) => {
                    const city = (r.city || '').toLowerCase();
                    const scores: Record<string, number> = { 'palm springs': 74, 'palm desert': 71, 'rancho mirage': 76, 'la quinta': 73, 'indio': 65 };
                    const score = scores[city] || 66;
                    return (
                      <tr key={i}>
                        <td style={S.td}>{r.first_name} {r.last_name}</td>
                        <td style={S.td}>{r.email}</td>
                        <td style={S.td}>{r.phone || '—'}</td>
                        <td style={S.td}>{r.city || '—'}</td>
                        <td style={S.td}>{r.zip || '—'}</td>
                        <td style={S.td}>{r.brokerage || '—'}</td>
                        <td style={S.td}><span style={{ ...S.tag, background: 'rgba(184,147,85,0.15)', color: '#B89355' }}>{score}/100</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={S.btn} onClick={() => setStep('configure')}>Configure Campaign →</button>
              <button style={S.btnGhost} onClick={() => setStep('map')}>← Back</button>
            </div>
          </div>
        )}

        {/* ── Step 4: Configure ── */}
        {step === 'configure' && (
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Configure Campaign</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div>
                <label style={S.label}>Campaign Name</label>
                <input style={S.input} value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Palm Springs Agents April 2026" />
              </div>
              <div>
                <label style={S.label}>Audience Type</label>
                <select style={S.select} value={campaignType} onChange={e => setCampaignType(e.target.value)}>
                  <option value="agent">Real Estate Agents</option>
                  <option value="buyer">Buyers / Recent Purchasers</option>
                  <option value="homeowner">Homeowners</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Email Subject Line <span style={{ color: '#6B6252' }}>(leave blank for auto-generated with DNA score)</span></label>
              <input style={S.input} value={subject} onChange={e => setSubject(e.target.value)}
                placeholder={campaignType === 'agent' ? '[City] DNA Score: 74/100 — see what it means for your clients' : 'Your neighborhood scored 74/100 — claim your free report'} />
            </div>

            {/* Template preview */}
            <div style={{ background: '#1a1a1a', borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#6B6252', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Template Preview</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1, fontSize: 12, lineHeight: 1.6, color: '#9ca3af' }}>
                  {campaignType === 'agent' ? (
                    <>
                      <strong style={{ color: '#F4F0E8' }}>Hi [First Name],</strong><br />
                      The [City] market just scored [Score]/100 on PropertyDNA's index — ranked [Label].<br /><br />
                      Your clients get a personalized DNA report — comps, hazard exposure, renovation ROI, 5-year trajectory. <strong style={{ color: '#F4F0E8' }}>First report per client is free.</strong><br /><br />
                      → See the [City] Live Heat Map<br />
                      → Partner with PropertyDNA
                    </>
                  ) : (
                    <>
                      <strong style={{ color: '#F4F0E8' }}>Hi [First Name],</strong><br />
                      Your neighborhood in [City] scored [Score]/100 — ranked [Label].<br /><br />
                      Your full DNA report covers: comps, flood risk, renovation ROI, 5-year trajectory.<br />
                      <strong style={{ color: '#F4F0E8' }}>First report is free.</strong><br /><br />
                      → Claim Your Free DNA Report
                    </>
                  )}
                </div>
                <div style={{ width: 1, background: 'rgba(107,98,82,0.3)' }} />
                <div style={{ width: 180, fontSize: 11, color: '#6B6252', lineHeight: 1.7 }}>
                  <div>✓ Personalized subject</div>
                  <div>✓ City DNA score</div>
                  <div>✓ Unsubscribe link</div>
                  <div>✓ Mobile responsive</div>
                  <div>✓ Sent from {import.meta.env.VITE_SENDER_EMAIL || 'reports@thepropertydna.com'}</div>
                </div>
              </div>
            </div>

            <div style={{ background: '#1a1a1a', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 32 }}>
              {[['Total contacts', mapped.length.toLocaleString()], ['With phone', mapped.filter(r => r.phone).length.toLocaleString()], ['With address', mapped.filter(r => r.address).length.toLocaleString()], ['Estimated time', `~${Math.ceil(mapped.length / 50 * 2.5 / 60)} min`]].map(([l, v]) => (
                <div key={String(l)}>
                  <div style={{ fontSize: 9, color: '#6B6252', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#B89355', marginTop: 3 }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button style={S.btn} onClick={saveCampaign} disabled={saving || !campaignName}>
                {saving ? 'Saving…' : `Save Campaign (${mapped.length.toLocaleString()} contacts) →`}
              </button>
              <button style={S.btnGhost} onClick={() => setStep('preview')}>← Back</button>
            </div>
          </div>
        )}

        {/* ── Step 5: Launch ── */}
        {step === 'launch' && (
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Ready to Launch</div>
            <div style={{ fontSize: 11, color: '#6B6252', marginBottom: 24 }}>Campaign saved. Review then fire when ready.</div>
            <div style={{ background: '#1a1a1a', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{campaignName}</div>
              <div style={{ display: 'flex', gap: 32 }}>
                {[['Contacts', mapped.length.toLocaleString()], ['Type', campaignType], ['Template', campaignType === 'agent' ? 'Agent outreach' : 'Buyer/homeowner'], ['From', 'reports@thepropertydna.com']].map(([l, v]) => (
                  <div key={String(l)}>
                    <div style={{ fontSize: 9, color: '#6B6252', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</div>
                    <div style={{ fontSize: 13, color: '#F4F0E8', marginTop: 3 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#6B6252', marginBottom: 20 }}>
              Emails are sent in batches of 50. The page will show live progress. You can leave and come back — sending continues in the background.
            </div>
            <button style={{ ...S.btn, fontSize: 15, padding: '16px 40px' }} onClick={launchCampaign}>
              🚀 Launch Campaign
            </button>
          </div>
        )}

        {/* ── Step 6: Monitor ── */}
        {step === 'monitor' && (stats || selectedCampaign) && (
          <div>
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{stats?.campaign?.name || selectedCampaign?.name}</div>
                  <div style={{ fontSize: 11, color: '#6B6252', marginTop: 3 }}>Campaign ID: {campaignId.slice(0, 8)}</div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {sending && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#B89355', animation: 'pulse 1s ease-in-out infinite' }} />}
                  <span style={{ ...S.tag, background: `${statusColor[stats?.campaign?.status || 'sending']}22`, color: statusColor[stats?.campaign?.status || 'sending'] }}>
                    {stats?.campaign?.status || 'sending'}
                  </span>
                  <button style={S.btnGhost} onClick={refreshStats}>Refresh</button>
                </div>
              </div>

              {/* Big stat row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  ['Total', stats?.campaign?.total_contacts || 0, '#F4F0E8'],
                  ['Sent', stats?.counts?.sent || 0, '#3b82f6'],
                  ['Pending', stats?.counts?.pending || 0, '#6B6252'],
                  ['Opened', stats?.counts?.opened || 0, '#B89355'],
                  ['Clicked', stats?.counts?.clicked || 0, '#22c55e'],
                  ['Bounced', stats?.counts?.bounced || 0, '#ef4444'],
                ].map(([l, v, c]) => (
                  <div key={String(l)} style={{ background: '#1a1a1a', borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: String(c), fontFamily: 'Cormorant Garamond, serif' }}>{Number(v).toLocaleString()}</div>
                    <div style={{ fontSize: 9, color: '#6B6252', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>{l}</div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              {stats?.campaign && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6B6252', marginBottom: 6 }}>
                    <span>Progress</span>
                    <span>{Math.round(((stats.campaign.sent_count || 0) / Math.max(1, stats.campaign.total_contacts || 1)) * 100)}%</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(107,98,82,0.3)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'linear-gradient(90deg,#B89355,#C9A84C)', borderRadius: 3, width: `${Math.round(((stats.campaign.sent_count || 0) / Math.max(1, stats.campaign.total_contacts || 1)) * 100)}%`, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              )}

              {sending && (
                <div style={{ fontSize: 11, color: '#B89355' }}>
                  ⚡ Sending in progress — {stats?.counts?.pending || '…'} remaining. Page will update automatically.
                </div>
              )}
              {stats?.campaign?.status === 'complete' && (
                <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>
                  ✓ Campaign complete — all emails delivered.
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center' }}>
              <button style={S.btnGhost} onClick={() => { setStep('upload'); setStats(null); setSelectedCampaign(null); }}>
                ← Start New Campaign
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}
