export interface IdxParseResult {
  source: string | null;
  mlsNumber: string | null;
  addressSlug: string | null;
  domain: string | null;
  isRecognized: boolean;
}

const KNOWN_SOURCES: Array<{ name: string; pattern: RegExp }> = [
  // Coldwell Banker agent sites (dsteamps.com uses this platform + CRMLS data)
  { name: 'CRMLS/Coldwell Banker', pattern: /coldwellbankerhomes\.com|dsteamps\.com/i },
  { name: 'FlexMLS',               pattern: /flexmls\.com/i },
  { name: 'CRMLS/Matrix',          pattern: /crmls\.org|matrixondemand\.com/i },
  { name: 'MoxiWorks/IDX',         pattern: /moxiworks\.com|idxbroker\.com|idxlogic\.com/i },
  { name: 'Realtor.com',           pattern: /realtor\.com/i },
  { name: 'Zillow',                pattern: /zillow\.com/i },
  { name: 'Redfin',                pattern: /redfin\.com/i },
  { name: 'HomesAndLand',          pattern: /homesandland\.com/i },
  { name: 'MLSListings',           pattern: /mlslistings\.com/i },
  { name: 'Bright MLS',            pattern: /brightmls\.com/i },
  { name: 'HAR',                   pattern: /har\.com/i },
  { name: 'FMLS',                  pattern: /fmls\.com/i },
  { name: 'NWMLS',                 pattern: /nwmls\.com|windermere\.com/i },
  { name: 'California RES',        pattern: /car\.org|carets\.com/i },
];

const MLS_NUMBER_PATTERNS = [
  // Coldwell Banker / CRMLS hash-based URL: #!/listing:219143834DA
  /#!\/listing:([A-Z0-9]{6,})/i,
  // Query params
  /[?&]ListingId=([A-Z0-9\-]+)/i,
  /[?&]listingId=([A-Z0-9\-]+)/i,
  /[?&]mls=([A-Z0-9\-]+)/i,
  /[?&]mlsId=([A-Z0-9\-]+)/i,
  /[?&]mlsnum=([A-Z0-9\-]+)/i,
  // Path-based
  /\/listing[s]?\/([A-Z0-9\-]{6,})/i,
  /\/([A-Z0-9]{8,})\/?(?:\?|#|$)/i,
  /-(\d{7,})\/?(?:\?|#|$)/,
];

export function parseIdxUrl(rawUrl: string): IdxParseResult {
  const url = rawUrl?.trim();
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return { source: null, mlsNumber: null, addressSlug: null, domain: null, isRecognized: false };
  }

  let parsed: URL;
  try { parsed = new URL(url); } catch {
    return { source: null, mlsNumber: null, addressSlug: null, domain: null, isRecognized: false };
  }

  const domain = parsed.hostname.replace(/^www\./, '');

  let source: string | null = domain;
  let isRecognized = false;
  for (const { name, pattern } of KNOWN_SOURCES) {
    if (pattern.test(url)) { source = name; isRecognized = true; break; }
  }

  // Include hash fragment in match source (URL constructor strips it from pathname/search)
  const fullUrl = url;

  let mlsNumber: string | null = null;
  for (const pattern of MLS_NUMBER_PATTERNS) {
    const m = fullUrl.match(pattern);
    if (m?.[1]) { mlsNumber = m[1].toUpperCase(); break; }
  }

  // CRMLS MLS# format validation: digits followed by optional 2-letter area code
  // e.g. 219143834DA (Desert Area), 219141780PS (Palm Springs)
  if (mlsNumber && !/^\d{6,}[A-Z]{0,2}$/.test(mlsNumber)) {
    mlsNumber = null; // reject non-MLS-looking extractions
  }

  // Extract address-like slug from path (contains hyphens and is substantive)
  const pathParts = parsed.pathname.split('/').filter(Boolean);
  const addressSlug = pathParts.find(p => p.includes('-') && p.length > 10 && !/^\d+$/.test(p)) || null;

  return { source, mlsNumber, addressSlug, domain, isRecognized };
}
