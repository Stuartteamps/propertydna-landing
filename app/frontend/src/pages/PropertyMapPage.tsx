// ─────────────────────────────────────────────────────────────────────────────
// PropertyMapPage — full-screen host for the premium PropertyMap experience.
//
// Mounted at /map. Currently fed by mock data (mockMapData.ts). To go live, swap
// getMockMapData() inside PropertyMap for a fetch that runs the payload through
// normalizePropertyData() — the UI contract (PropertyDNAAsset) does not change.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertyMap from '@/components/map/PropertyMap';

export default function PropertyMapPage() {
  const navigate = useNavigate();

  // Lock background scroll while the immersive map is open.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return <PropertyMap onExit={() => navigate('/')} />;
}
