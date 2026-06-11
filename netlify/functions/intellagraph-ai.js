/**
 * intellagraph-ai — Multi-mode AI endpoint for the IntellaGraph page.
 *
 * Modes:
 *   qa      — Answer a question about a single property (address lookup + market context)
 *   query   — Natural language → structured filter → Supabase results (portfolio search)
 *   predict — Generate a 90-day sell-likelihood score with reasoning for a property
 *
 * POST body: { mode: 'qa'|'query'|'predict', ...modeArgs }
 * Returns:   { ok: boolean, answer?: string, results?: any[], score?: number, reasoning?: string }
 *
 * Uses prompt caching (1h TTL) on the system prompt — multiple turns from one user
 * hit the cache and run 90% cheaper. Model: claude-sonnet-4-6.
 */
const https = require('https');
const db    = require('./_supabase');

const MODEL          = 'claude-sonnet-4-6';
const ANTHROPIC_URL  = 'api.anthropic.com';
const ANTHROPIC_PATH = '/v1/messages';
const API_VERSION    = '2023-06-01';

// ── Anthropic HTTP helper ─────────────────────────────────────────────────────

function anthropicCall(payload) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Promise.reject(new Error('ANTHROPIC_API_KEY not set'));
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: ANTHROPIC_URL, path: ANTHROPIC_PATH, method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (res.statusCode >= 400) return reject(new Error(`Anthropic ${res.statusCode}: ${data?.error?.message || raw.slice(0, 200)}`));
          resolve(data);
        } catch (e) {
          reject(new Error(`Anthropic parse error: ${raw.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function extractText(response) {
  const block = (response?.content || []).find(b => b.type === 'text');
  return block?.text || '';
}

// ── Property lookup (for qa + predict modes) ──────────────────────────────────

async function findProperty(address) {
  if (!address || typeof address !== 'string') return null;
  const norm = address.trim();

  // Try property_master first (CA, well-indexed). Loose ilike match on address column.
  try {
    const ca = await db.from('property_master')
      .select('apn,address,city,state,zip,lat,lon,sqft,year_built,bedrooms,bathrooms,market_value,owner_name,mailing_address,is_absentee,has_pool,has_fairway,is_waterfront,pdna_renovation_ratio,pdna_condition_score')
      .ilike('address', `%${norm}%`)
      .limit(1).get();
    if (Array.isArray(ca) && ca.length) return { source: 'property_master', ...ca[0] };
  } catch { /* fall through */ }

  // Fallback: property_history (FL + others)
  try {
    const fl = await db.from('property_history')
      .select('apn,address,city,state,zip,snapshot,source')
      .ilike('address', `%${norm}%`)
      .limit(1).get();
    if (Array.isArray(fl) && fl.length) return { source: 'property_history', ...fl[0] };
  } catch { /* not found */ }

  return null;
}

async function fetchCityMarket(city, state) {
  if (!city) return null;
  const key = `${city.toLowerCase().replace(/\s+/g, '-')}-${(state || '').toLowerCase()}`;
  try {
    const rows = await db.from('market_snapshots')
      .select('geo_key,median_price,appreciation_rate_yoy,days_on_market,active_listings,absorption_rate,demand_score')
      .eq('geo_key', key)
      .order('snapshot_date', { ascending: false })
      .limit(1).get();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch { return null; }
}

// ── Mode: QA ──────────────────────────────────────────────────────────────────

async function modeQA({ address, question }) {
  if (!address) return { ok: false, error: 'address required' };
  if (!question) return { ok: false, error: 'question required' };

  const property = await findProperty(address);
  if (!property) {
    return {
      ok: true,
      answer: `I couldn't find "${address}" in the indexed dataset (3.58M+ properties across AZ, CA, NV, WA, TX, CT, FL, NY). Try the full street address with city, e.g. "1207 Palmas Rdg, Palm Springs, CA". This usually means the property is outside the indexed counties.`,
      property: null,
    };
  }

  const market = await fetchCityMarket(property.city, property.state);

  const system = [
    {
      type: 'text',
      text: `You are IntellaGraph AI — a real estate intelligence analyst for PropertyDNA. You analyze indexed property data and market signals to answer questions in plain English, like a senior analyst would.

Guidelines:
- Be concise and specific. Use numbers from the data. Don't hedge unnecessarily.
- If the data doesn't answer the question, say so clearly. Don't invent.
- Translate technical metrics into plain English (e.g. "renovation_ratio of 1.42 suggests a confirmed major remodel since the assessor re-valued the improvement column").
- Format: 2-4 short paragraphs max. No bullet lists unless the question explicitly asks for comparisons.
- Never claim to know owner phone numbers or skip-traced contact info — that data is not in your context.`,
      cache_control: { type: 'ephemeral', ttl: '1h' },
    },
  ];

  const userText = `PROPERTY DATA (from ${property.source}):
${JSON.stringify(property, null, 2)}

${market ? `MARKET CONTEXT (${property.city}, ${property.state}):\n${JSON.stringify(market, null, 2)}\n` : ''}

QUESTION: ${question}`;

  const resp = await anthropicCall({
    model: MODEL,
    max_tokens: 700,
    system,
    messages: [{ role: 'user', content: userText }],
  });

  return { ok: true, answer: extractText(resp), property, market };
}

// ── Mode: QUERY (portfolio search via Claude tool use) ────────────────────────

// Whitelist of safe filter fields and tables. We don't let the model write raw SQL.
const QUERY_SCHEMAS = {
  property_master: {
    fields: ['city', 'state', 'zip', 'is_absentee', 'has_pool', 'is_waterfront', 'pdna_condition_score', 'market_value', 'year_built', 'sqft'],
    select: 'apn,address,city,state,zip,sqft,year_built,market_value,owner_name,is_absentee,pdna_condition_score,pdna_renovation_ratio',
  },
  v_skip_trace_priority: {
    fields: ['city', 'state', 'priority_tier', 'is_absentee', 'market_value'],
    select: 'apn,address,city,state,owner_name,mailing_addr,market_value,priority_tier,is_absentee,renovation_recognized',
  },
};

const QUERY_TOOL = {
  name: 'query_properties',
  description: 'Filter the indexed property dataset and return a small page of results. Always use the most specific table for the question.',
  input_schema: {
    type: 'object',
    properties: {
      table: { type: 'string', enum: Object.keys(QUERY_SCHEMAS), description: 'Use property_master for general lookups. Use v_skip_trace_priority when the user asks about outreach, absentee owners, or priority targets.' },
      filters: {
        type: 'array',
        description: 'Array of filter clauses. Each is { field, op, value }. op is one of: eq, gte, lte, ilike. ilike accepts %wildcards%.',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            op:    { type: 'string', enum: ['eq', 'gte', 'lte', 'ilike'] },
            value: { type: ['string', 'number', 'boolean'] },
          },
          required: ['field', 'op', 'value'],
        },
      },
      order_by: { type: 'string', description: 'Optional sort field. Use the same names as filter fields. Defaults to market_value desc when relevant.' },
      order_desc: { type: 'boolean' },
      limit: { type: 'number', description: 'Max results, default 25, hard cap 100.' },
    },
    required: ['table', 'filters'],
  },
};

async function runQueryTool(input) {
  const schema = QUERY_SCHEMAS[input.table];
  if (!schema) return { error: `unknown table: ${input.table}` };

  let q = db.from(input.table).select(schema.select);
  for (const f of (input.filters || [])) {
    if (!schema.fields.includes(f.field)) continue;        // silently drop unknown fields
    if (f.op === 'eq')    q = q.eq(f.field, f.value);
    if (f.op === 'gte')   q = q.gte(f.field, f.value);
    if (f.op === 'lte')   q = q.lte(f.field, f.value);
    if (f.op === 'ilike') q = q.ilike(f.field, f.value);
  }
  if (input.order_by && schema.fields.includes(input.order_by)) {
    q = q.order(input.order_by, { ascending: !input.order_desc });
  }
  q = q.limit(Math.min(100, Math.max(1, input.limit || 25)));

  try {
    const rows = await q.get();
    return { rows: rows || [], count: (rows || []).length };
  } catch (e) {
    return { error: e.message };
  }
}

async function modeQuery({ question }) {
  if (!question) return { ok: false, error: 'question required' };

  const system = [
    {
      type: 'text',
      text: `You are IntellaGraph AI's portfolio query agent. Given a natural-language real estate question, decide whether to call the query_properties tool and what filters to use.

Available tables (use the most specific one):
- property_master: 3.58M+ residential properties (AZ Maricopa, CA Coachella Valley + LA + SF + SD, NV Clark, WA Snohomish, TX Austin/DFW/Houston, CT Fairfield, FL statewide, NY Manhattan + Westchester). Fields: ${QUERY_SCHEMAS.property_master.fields.join(', ')}.
- v_skip_trace_priority: 8-tier outreach priority view for owner contact campaigns. Tiers 1-2 are luxury absentee. Fields: ${QUERY_SCHEMAS.v_skip_trace_priority.fields.join(', ')}.

Translation rules:
- "absentee" / "non-owner-occupied" → is_absentee = true
- "luxury" alone → market_value >= 1000000
- "high-end" or "premium" → market_value >= 750000
- "renovated" → pdna_condition_score >= 70 (property_master) or renovation_recognized = true (priority view)
- "pool" → has_pool = true
- "waterfront" → is_waterfront = true
- Always order by market_value desc when the user asks for "top" / "best" / "most valuable" / similar.
- City names: use the exact city name (e.g. "Indian Wells", "Palm Springs") in eq filter — case sensitive.

After getting results, summarize what you found in one sentence. Don't repeat all rows; the UI will render them.`,
      cache_control: { type: 'ephemeral', ttl: '1h' },
    },
  ];

  // First turn: model decides to call the tool
  const first = await anthropicCall({
    model: MODEL,
    max_tokens: 1024,
    system,
    tools: [QUERY_TOOL],
    messages: [{ role: 'user', content: question }],
  });

  const toolUse = (first.content || []).find(b => b.type === 'tool_use');
  if (!toolUse) {
    // Model answered without tool — return the text
    return { ok: true, summary: extractText(first), rows: [], filters: null };
  }

  const toolResult = await runQueryTool(toolUse.input);

  // Second turn: feed tool result back, get a summary
  const second = await anthropicCall({
    model: MODEL,
    max_tokens: 400,
    system,
    tools: [QUERY_TOOL],
    messages: [
      { role: 'user',      content: question },
      { role: 'assistant', content: first.content },
      { role: 'user',      content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(toolResult).slice(0, 8000) }] },
    ],
  });

  return {
    ok: true,
    summary: extractText(second),
    rows: toolResult.rows || [],
    count: toolResult.count || 0,
    filters: toolUse.input,
    error: toolResult.error || null,
  };
}

// ── Mode: PREDICT (90-day sell likelihood) ────────────────────────────────────

async function modePredict({ address }) {
  if (!address) return { ok: false, error: 'address required' };
  const property = await findProperty(address);
  if (!property) return { ok: true, score: null, reasoning: `Property "${address}" not in indexed dataset.` };

  const market = await fetchCityMarket(property.city, property.state);

  const system = [
    {
      type: 'text',
      text: `You are IntellaGraph AI's sell-likelihood predictor. Given a property's data and its local market, estimate the probability that the property will list for sale within the next 90 days, on a 0-100 integer scale.

Reasoning framework (use what's available):
- Absentee owners (is_absentee=true) score higher (+15-25 pts vs owner-occupied)
- Recent renovations (pdna_renovation_ratio > 1.3) indicate "fix and flip" intent — +10-20 pts
- Long-held properties (no recent activity) tend to score moderate
- Hot market signals (low days_on_market, high absorption_rate) raise the floor for all properties +5-10
- Luxury (market_value > 1.5M) properties turn over slower — cap upper estimates
- Confidence: be honest. If data is thin, score around 30-45 and say so.

Return STRICTLY in this format (no prose before or after):
SCORE: <integer 0-100>
CONFIDENCE: <LOW|MEDIUM|HIGH>
REASONING: <2-3 sentences explaining the drivers>`,
      cache_control: { type: 'ephemeral', ttl: '1h' },
    },
  ];

  const userText = `PROPERTY:
${JSON.stringify(property, null, 2)}

${market ? `MARKET:\n${JSON.stringify(market, null, 2)}\n` : ''}

Estimate 90-day sell likelihood.`;

  const resp = await anthropicCall({
    model: MODEL,
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: userText }],
  });

  const text = extractText(resp);
  const scoreMatch = text.match(/SCORE:\s*(\d{1,3})/i);
  const confMatch  = text.match(/CONFIDENCE:\s*(LOW|MEDIUM|HIGH)/i);
  const reasonMatch = text.match(/REASONING:\s*([\s\S]+)/i);

  return {
    ok: true,
    score: scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))) : null,
    confidence: confMatch ? confMatch[1].toUpperCase() : 'MEDIUM',
    reasoning: reasonMatch ? reasonMatch[1].trim() : text,
    property,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'POST only' }) };
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid JSON' }) }; }

  const mode = (body.mode || '').toLowerCase();

  try {
    let result;
    if (mode === 'qa')      result = await modeQA(body);
    else if (mode === 'query')   result = await modeQuery(body);
    else if (mode === 'predict') result = await modePredict(body);
    else return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'mode must be qa | query | predict' }) };

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, error: e.message || String(e) }),
    };
  }
};
