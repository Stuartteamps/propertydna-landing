import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { listSavedReports, removeSavedReport, clearSavedReports, type SavedReport } from '@/lib/offlineReports';
import { isNative, tapHaptic } from '@/lib/nativeFeatures';

function formatSavedAt(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = Math.floor((now - ts) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function SavedReports() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listSavedReports();
    setReports(list);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleRemove = async (id: string) => {
    await tapHaptic();
    await removeSavedReport(id);
    refresh();
  };

  const handleClearAll = async () => {
    if (!confirm('Remove all saved reports from this device?')) return;
    await tapHaptic();
    await clearSavedReports();
    refresh();
  };

  const native = isNative();

  return (
    <div style={{ background: '#0A0908', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav />

      <section style={{ padding: '100px 24px 40px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 12 }}>
          Saved on this device
        </div>
        <h1 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(32px,5vw,52px)', fontWeight: 300, color: '#F0EBE0', margin: '0 0 12px', lineHeight: 1.1 }}>
          Your offline reports
        </h1>
        <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: 'rgba(244,240,232,0.55)', lineHeight: 1.8, margin: '0 0 40px', maxWidth: 540 }}>
          Reports you've saved are cached locally so you can open them when you're offline — in the field, on a showing, or anywhere without signal.
        </p>

        {!native && (
          <div style={{ border: '1px solid rgba(201,168,76,0.18)', background: 'rgba(201,168,76,0.04)', padding: '16px 18px', marginBottom: 32 }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 6 }}>
              Mobile app feature
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: 'rgba(244,240,232,0.55)', lineHeight: 1.7 }}>
              Offline report saving is available in the PropertyDNA iOS and Android apps. On web, every report you generate is already available from your dashboard.
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', padding: '24px 0' }}>Loading…</div>
        ) : reports.length === 0 ? (
          <div style={{ border: '1px solid rgba(255,255,255,0.06)', padding: 28, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 300, color: '#F0EBE0', marginBottom: 8 }}>
              No saved reports yet
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.7, marginBottom: 20, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
              Open any report and tap "Save for offline" to keep it on this device.
            </div>
            <Link
              to="/analyze"
              onClick={() => tapHaptic()}
              style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '12px 24px', textDecoration: 'none', display: 'inline-block' }}
            >
              Analyze a property →
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reports.map(r => (
                <div key={r.id} style={{ border: '1px solid rgba(255,255,255,0.07)', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <Link
                    to={r.reportUrl || `/report/${r.id}`}
                    onClick={() => tapHaptic()}
                    style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 17, fontWeight: 300, color: '#F0EBE0', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.address}
                    </div>
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 1, color: '#6B6252' }}>
                      Saved {formatSavedAt(r.savedAt)}
                    </div>
                  </Link>
                  <button
                    onClick={() => handleRemove(r.id)}
                    aria-label="Remove from saved"
                    style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#6B6252', padding: '8px 12px', fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 32, textAlign: 'center' }}>
              <button
                onClick={handleClearAll}
                style={{ background: 'none', border: 'none', color: '#6B6252', fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer', padding: 8 }}
              >
                Clear all
              </button>
            </div>
          </>
        )}
      </section>

      <Footer />
    </div>
  );
}
