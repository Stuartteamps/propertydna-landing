import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    });
  }, [navigate]);

  return (
    <div style={{ minHeight: '100vh', background: '#0A0908', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: '#F0EBE0', marginBottom: 12 }}>
          Signing you in…
        </div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C' }}>
          PropertyDNA
        </div>
      </div>
    </div>
  );
}
