export interface MlsEnrichInput {
  idxUrl?: string;
  mlsNumber?: string;
  propertyAddress?: string;
}

export type MlsEnrichStatus = 'enriched' | 'pending_api_connection' | 'manual_review_required';

export interface MlsEnrichResult {
  status: MlsEnrichStatus;
  source: string;
  data: Record<string, unknown>;
  message: string;
}

// MLS feature priority order (highest to lowest confidence):
// 1. Manual override
// 2. MLS/IDX API data  ← this function
// 3. Property API data (county records, Attom, etc.)
// 4. AI extraction from public text/remarks
// 5. Fallback assumptions

export async function enrichFromIdxOrMls(input: MlsEnrichInput): Promise<MlsEnrichResult> {
  const { idxUrl, mlsNumber, propertyAddress } = input;

  if (!idxUrl && !mlsNumber) {
    return {
      status: 'pending_api_connection',
      source: 'none',
      data: {},
      message: 'No IDX URL or MLS number provided.',
    };
  }

  // Check for configured IDX API credentials (set in Netlify env vars)
  const idxApiKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_IDX_API_KEY) as string | undefined;

  if (idxApiKey) {
    // Real implementation: call your IDX API here (RETS feed, IDX Broker API, etc.)
    // Example: const res = await fetch(`${IDX_API_BASE}/listing?mls=${mlsNumber}`, { headers: { Authorization: idxApiKey } });
    console.log('[mlsEnrich] IDX API key found — wire up real API call here', { idxUrl, mlsNumber, propertyAddress });
    return {
      status: 'pending_api_connection',
      source: idxUrl || mlsNumber || 'unknown',
      data: { idx_url: idxUrl, mls_number: mlsNumber },
      message: 'IDX API key configured. Connect your IDX feed to enable live enrichment.',
    };
  }

  // No API access: store the link for n8n to process
  return {
    status: 'pending_api_connection',
    source: idxUrl || mlsNumber || 'unknown',
    data: { idx_url: idxUrl, mls_number: mlsNumber, address: propertyAddress },
    message: 'IDX URL stored. N8n will enrich when IDX API connection is established.',
  };
}

// Merge sources according to priority order
export function mergeMlsWithPropertyData(
  existingData: Record<string, unknown>,
  mlsData: Record<string, unknown>,
  manualOverrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...existingData,    // lowest: existing/county/API data
    ...mlsData,         // higher: MLS/IDX data
    ...manualOverrides, // highest: manual override
  };
}
