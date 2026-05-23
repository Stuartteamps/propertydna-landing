import { useState, useRef, useEffect } from 'react';

const MONO   = "'Share Tech Mono', monospace";
const UI     = "'Rajdhani', sans-serif";
const G      = '#00ff88';
const R      = '#ff3355';
const GOLD   = '#ffb700';
const BG     = 'rgba(4,12,20,0.96)';
const BORDER = 'rgba(0,255,136,0.18)';
const T_M    = 'rgba(180,220,200,0.6)';
const T_P    = '#e8f4f0';

type Mode = 'qa' | 'query' | 'predict';

interface Props {
  premium: boolean;
  onUpgrade: () => void;
  /** Optional address to pre-fill (e.g. when user clicks a parcel) */
  presetAddress?: string;
}

interface QAResult { answer: string; property?: any; market?: any; }
interface QueryResult { summary: string; rows: any[]; count: number; filters?: any; error?: string | null; }
interface PredictResult { score: number | null; confidence: string; reasoning: string; property?: any; }

const TAB_DEFS: Array<{ id: Mode; label: string; tag: string }> = [
  { id: 'qa',      label: 'Ask About Property', tag: 'Q&A' },
  { id: 'query',   label: 'Find Properties',     tag: 'SEARCH' },
  { id: 'predict', label: 'Sell Likelihood',     tag: 'PREDICT' },
];

export default function IntellaGraphAIPanel({ premium, onUpgrade, presetAddress }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('qa');

  // QA state
  const [qaAddress, setQaAddress] = useState(presetAddress || '');
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaResult, setQaResult] = useState<QAResult | null>(null);

  // Query state
  const [queryText, setQueryText] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);

  // Predict state
  const [predictAddress, setPredictAddress] = useState(presetAddress || '');
  const [predictResult, setPredictResult] = useState<PredictResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (presetAddress) {
      setQaAddress(presetAddress);
      setPredictAddress(presetAddress);
    }
  }, [presetAddress]);

  useEffect(() => {
    if (qaResult || queryResult || predictResult) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [qaResult, queryResult, predictResult]);

  async function run() {
    if (!premium) { onUpgrade(); return; }
    setError('');
    setLoading(true);
    try {
      const body: any = { mode };
      if (mode === 'qa')      { body.address = qaAddress.trim(); body.question = qaQuestion.trim(); }
      if (mode === 'query')   { body.question = queryText.trim(); }
      if (mode === 'predict') { body.address = predictAddress.trim(); }

      const res = await fetch('/.netlify/functions/intellagraph-ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || 'Request failed'); return; }

      if (mode === 'qa')      setQaResult({ answer: data.answer, property: data.property, market: data.market });
      if (mode === 'query')   setQueryResult({ summary: data.summary, rows: data.rows || [], count: data.count || 0, filters: data.filters, error: data.error });
      if (mode === 'predict') setPredictResult({ score: data.score, confidence: data.confidence, reasoning: data.reasoning, property: data.property });
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setQaResult(null); setQueryResult(null); setPredictResult(null); setError('');
  }

  // Collapsed: floating button bottom-right
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        data-globe-ui
        style={{
          position: 'absolute', bottom: 196, right: 290, zIndex: 95,
          background: BG, border: `1px solid ${G}`, color: G,
          fontFamily: MONO, fontSize: 10, letterSpacing: 2,
          padding: '10px 16px', cursor: 'pointer', backdropFilter: 'blur(12px)',
          boxShadow: `0 0 12px rgba(0,255,136,0.3)`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: G, boxShadow: `0 0 6px ${G}`, animation: 'tg-pulse 2s infinite' }} />
        ASK INTELLAGRAPH AI
      </button>
    );
  }

  // Expanded panel
  return (
    <div
      data-globe-ui
      style={{
        position: 'absolute', bottom: 196, right: 290, zIndex: 200,
        width: 460, maxWidth: 'calc(100vw - 580px)', maxHeight: 'calc(100vh - 280px)',
        background: BG, border: `1px solid ${BORDER}`, backdropFilter: 'blur(14px)',
        display: 'flex', flexDirection: 'column',
        boxShadow: `0 0 30px rgba(0,255,136,0.15)`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, gap: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: G, boxShadow: `0 0 6px ${G}` }} />
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 3, color: G, flex: 1, textTransform: 'uppercase' }}>
          IntellaGraph AI · {TAB_DEFS.find(t => t.id === mode)?.tag}
        </span>
        <button
          onClick={() => { setOpen(false); clear(); }}
          style={{ background: 'none', border: 'none', color: T_M, fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}
        >×</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid rgba(0,255,136,0.06)` }}>
        {TAB_DEFS.map(t => (
          <button
            key={t.id}
            onClick={() => { setMode(t.id); clear(); }}
            style={{
              flex: 1, padding: '9px 4px', fontFamily: MONO, fontSize: 9, letterSpacing: 1.5,
              background: mode === t.id ? 'rgba(0,255,136,0.08)' : 'transparent',
              color: mode === t.id ? G : T_M,
              border: 'none', borderBottom: mode === t.id ? `2px solid ${G}` : '2px solid transparent',
              cursor: 'pointer', textTransform: 'uppercase',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Body */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, scrollbarWidth: 'thin' as const }}>

        {/* QA inputs */}
        {mode === 'qa' && (
          <>
            <Field label="ADDRESS">
              <input value={qaAddress} onChange={e => setQaAddress(e.target.value)}
                placeholder='e.g. "1207 Palmas Rdg, Palm Springs"'
                onKeyDown={e => { if (e.key === 'Enter' && qaQuestion) run(); }}
                style={inputStyle} />
            </Field>
            <Field label="QUESTION">
              <textarea value={qaQuestion} onChange={e => setQaQuestion(e.target.value)}
                placeholder='e.g. "What does the DNA score tell me about this property?"'
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' as const, minHeight: 60 }} />
            </Field>
          </>
        )}

        {/* Query input */}
        {mode === 'query' && (
          <Field label="DESCRIBE WHAT YOU'RE LOOKING FOR">
            <textarea value={queryText} onChange={e => setQueryText(e.target.value)}
              placeholder='e.g. "absentee owners in Indian Wells with renovated homes over $1.5M"'
              rows={3}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) run(); }}
              style={{ ...inputStyle, resize: 'vertical' as const, minHeight: 80 }} />
          </Field>
        )}

        {/* Predict input */}
        {mode === 'predict' && (
          <Field label="ADDRESS TO SCORE">
            <input value={predictAddress} onChange={e => setPredictAddress(e.target.value)}
              placeholder='e.g. "775 S La Mirada Rd, Palm Springs"'
              onKeyDown={e => { if (e.key === 'Enter') run(); }}
              style={inputStyle} />
          </Field>
        )}

        <button
          onClick={run}
          disabled={loading || (mode === 'qa' && (!qaAddress || !qaQuestion)) || (mode === 'query' && !queryText) || (mode === 'predict' && !predictAddress)}
          style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
            background: loading ? 'rgba(0,255,136,0.3)' : G, color: '#000',
            border: 'none', padding: '10px 16px',
            cursor: loading ? 'not-allowed' : 'pointer', alignSelf: 'flex-start',
            opacity: (!premium ? 0.85 : 1),
          }}
        >
          {loading ? 'ANALYZING…' : !premium ? 'UNLOCK PREMIUM →' : mode === 'qa' ? 'ASK' : mode === 'query' ? 'FIND' : 'PREDICT'}
        </button>

        {error && (
          <div style={{ padding: '8px 10px', background: 'rgba(255,51,85,0.1)', border: `1px solid ${R}`, color: R, fontFamily: MONO, fontSize: 10 }}>
            {error}
          </div>
        )}

        {/* QA result */}
        {mode === 'qa' && qaResult && (
          <div style={{ borderTop: `1px solid rgba(0,255,136,0.1)`, paddingTop: 10, marginTop: 4 }}>
            <div style={{ fontFamily: UI, fontSize: 13, color: T_P, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {qaResult.answer}
            </div>
            {qaResult.property && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ fontFamily: MONO, fontSize: 9, color: T_M, cursor: 'pointer', letterSpacing: 1.5 }}>
                  VIEW SOURCE DATA
                </summary>
                <pre style={{ fontFamily: MONO, fontSize: 9, color: T_M, background: 'rgba(0,0,0,0.3)', padding: 8, marginTop: 6, overflow: 'auto', maxHeight: 200 }}>
                  {JSON.stringify(qaResult.property, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Query result */}
        {mode === 'query' && queryResult && (
          <div style={{ borderTop: `1px solid rgba(0,255,136,0.1)`, paddingTop: 10, marginTop: 4 }}>
            <div style={{ fontFamily: UI, fontSize: 12, color: T_P, lineHeight: 1.5, marginBottom: 10 }}>
              {queryResult.summary}
            </div>
            {queryResult.error && (
              <div style={{ fontFamily: MONO, fontSize: 10, color: R, marginBottom: 8 }}>Error: {queryResult.error}</div>
            )}
            {queryResult.rows.length > 0 && (
              <div style={{ border: `1px solid rgba(0,255,136,0.08)` }}>
                {queryResult.rows.slice(0, 50).map((r: any, i: number) => (
                  <div key={i} style={{ padding: '7px 9px', borderBottom: i < queryResult.rows.length - 1 ? '1px solid rgba(0,255,136,0.05)' : 'none', display: 'flex', gap: 10, alignItems: 'center', fontFamily: MONO, fontSize: 10 }}>
                    <span style={{ flex: 1, color: T_P, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.address || r.apn}
                    </span>
                    {r.market_value != null && (
                      <span style={{ color: GOLD, fontWeight: 600 }}>${(r.market_value / 1000).toFixed(0)}k</span>
                    )}
                    {r.priority_tier != null && (
                      <span style={{ color: G, fontSize: 9 }}>T{r.priority_tier}</span>
                    )}
                  </div>
                ))}
                {queryResult.rows.length > 50 && (
                  <div style={{ padding: '6px 9px', fontFamily: MONO, fontSize: 9, color: T_M, textAlign: 'center' }}>
                    + {queryResult.rows.length - 50} more — narrow your query for more detail
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Predict result */}
        {mode === 'predict' && predictResult && (
          <div style={{ borderTop: `1px solid rgba(0,255,136,0.1)`, paddingTop: 14, marginTop: 4 }}>
            {predictResult.score == null ? (
              <div style={{ fontFamily: UI, fontSize: 13, color: T_M }}>{predictResult.reasoning}</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <div style={{
                    width: 70, height: 70, borderRadius: '50%',
                    border: `3px solid ${scoreColor(predictResult.score)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: MONO, fontSize: 24, fontWeight: 700, color: scoreColor(predictResult.score),
                  }}>{predictResult.score}</div>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: T_M, marginBottom: 4 }}>
                      90-DAY SELL LIKELIHOOD
                    </div>
                    <div style={{ fontFamily: UI, fontSize: 16, color: T_P, fontWeight: 600 }}>
                      {sellLabel(predictResult.score)}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: T_M, marginTop: 2 }}>
                      {predictResult.confidence} confidence
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: UI, fontSize: 12, color: T_P, lineHeight: 1.6 }}>
                  {predictResult.reasoning}
                </div>
              </>
            )}
          </div>
        )}

        {!premium && (
          <div style={{ marginTop: 'auto', padding: '8px 10px', background: 'rgba(255,183,0,0.08)', border: `1px solid ${GOLD}`, fontFamily: MONO, fontSize: 9, color: GOLD, letterSpacing: 1 }}>
            ⓘ AI access requires Premium. Click button above to unlock.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: T_M, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(0,0,0,0.4)', border: `1px solid ${BORDER}`,
  color: T_P, fontFamily: MONO, fontSize: 11,
  padding: '8px 10px', outline: 'none',
};

function scoreColor(s: number) {
  if (s >= 70) return '#00ff88';
  if (s >= 45) return '#ffb700';
  return '#ff3355';
}

function sellLabel(s: number) {
  if (s >= 75) return 'Very Likely';
  if (s >= 55) return 'Likely';
  if (s >= 35) return 'Possible';
  return 'Unlikely';
}
