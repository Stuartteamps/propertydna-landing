import { Link } from 'react-router-dom';
import { useEffect } from 'react';

export default function NotFound() {
  useEffect(() => {
    document.title = '404 — PropertyDNA';
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 560, textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 14, fontWeight: 600 }}>404</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 42, color: '#fafafa', margin: '0 0 16px', fontWeight: 400 }}>That dossier doesn't exist (yet)</h1>
        <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
          The page you're looking for isn't here. Try one of these instead.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/pedigree-index" style={{ padding: '12px 22px', background: '#fbbf24', color: '#0a0a0a', textDecoration: 'none', borderRadius: 4, fontWeight: 600, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>Pedigree Index</Link>
          <Link to="/luxury-inventory" style={{ padding: '12px 22px', background: 'transparent', color: '#fbbf24', border: '1px solid #fbbf24', textDecoration: 'none', borderRadius: 4, fontWeight: 600, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>Browse Inventory</Link>
          <Link to="/" style={{ padding: '12px 22px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', textDecoration: 'none', borderRadius: 4, fontWeight: 600, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>Home</Link>
        </div>

        <div style={{ marginTop: 56, paddingTop: 24, borderTop: '1px solid #1f2937', fontSize: 13, color: '#94a3b8' }}>
          Want a dossier built for a specific Palm Springs estate? <Link to="/dossier-request" style={{ color: '#fbbf24' }}>Request one →</Link>
        </div>
      </div>
    </div>
  );
}
