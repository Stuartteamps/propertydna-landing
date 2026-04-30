import { useState, useEffect, useCallback } from 'react';
import type { Parcel, FilterWeights } from '../types';
import { MOCK_PARCELS } from '../data/mockParcels';
import { computeScore } from '../utils/scoring';

export function useParcelData(weights: FilterWeights) {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);

  const applyWeights = useCallback((raw: Parcel[], w: FilterWeights): Parcel[] => {
    return raw.map(p => ({ ...p, score: computeScore(p, w) }));
  }, []);

  useEffect(() => {
    // Simulate async load from mock-api
    const t = setTimeout(() => {
      setParcels(applyWeights(MOCK_PARCELS, weights));
      setLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading) {
      setParcels(prev => applyWeights(prev, weights));
    }
  }, [weights, loading, applyWeights]);

  return { parcels, loading };
}
