'use strict';
/**
 * Zero-dependency Anthropic Messages API helper for repo tools.
 *
 * Matches the established codebase pattern (netlify/functions/intellagraph-ai.js):
 * raw Node `https` to api.anthropic.com — no SDK, so it runs under bare `node`
 * with no `npm install` (important for the cloud agents that invoke these tools).
 *
 * Defaults to claude-opus-4-8 with adaptive thinking. Supports prompt caching on
 * the system block and structured JSON output via output_config.format.
 *
 *   const { callClaude } = require('../_anthropic');
 *   const obj = await callClaude({ system, user, schema: MY_SCHEMA });   // -> parsed object
 *   const txt = await callClaude({ system, user });                      // -> string
 *
 * Env: ANTHROPIC_API_KEY (required). ANTHROPIC_MODEL overrides the model.
 */
const https = require('https');

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
const API_VERSION = '2023-06-01';

function request(payload, { timeoutMs = 240000 } = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Promise.reject(new Error('ANTHROPIC_API_KEY not set — export it before running this tool.'));
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let data;
        try { data = JSON.parse(raw); }
        catch (e) { return reject(new Error(`Anthropic parse error: ${raw.slice(0, 200)}`)); }
        if (res.statusCode >= 400) {
          return reject(new Error(`Anthropic ${res.statusCode}: ${data?.error?.message || raw.slice(0, 200)}`));
        }
        resolve(data);
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Anthropic request timed out after ${timeoutMs}ms`)));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * @param {object}   opts
 * @param {string}   opts.system     System prompt (cached, 1h TTL).
 * @param {string}   opts.user       User message.
 * @param {object}  [opts.schema]    JSON Schema → forces structured output; returns a parsed object.
 * @param {string}  [opts.model]     Default claude-opus-4-8 (or ANTHROPIC_MODEL).
 * @param {string}  [opts.effort]    low|medium|high|xhigh|max. Default 'high'.
 * @param {number}  [opts.maxTokens] Default 8000 (well under the streaming threshold).
 * @param {boolean} [opts.thinking]  Adaptive thinking. Default true.
 * @returns {Promise<object|string>} Parsed object when `schema` given, else the text.
 */
async function callClaude({ system, user, schema, model, effort = 'high', maxTokens = 8000, thinking = true } = {}) {
  const output_config = { effort };
  if (schema) output_config.format = { type: 'json_schema', schema };

  const payload = {
    model: model || DEFAULT_MODEL,
    max_tokens: maxTokens,            // < 16K → non-streaming is safe (no HTTP-timeout risk)
    output_config,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral', ttl: '1h' } }],
    messages: [{ role: 'user', content: user }],
  };
  if (thinking) payload.thinking = { type: 'adaptive' };   // omitted ⇒ no thinking on Opus 4.8

  const res = await request(payload);

  // Guard stop_reason before reading content (Claude 4+ can refuse / truncate).
  if (res.stop_reason === 'refusal') {
    const cat = res.stop_details?.category || 'unspecified';
    throw new Error(`Claude declined the request (refusal: ${cat}).`);
  }
  const text = (res.content || []).find((b) => b.type === 'text')?.text || '';
  if (res.stop_reason === 'max_tokens') {
    throw new Error(`Output hit max_tokens (${maxTokens}) — raise maxTokens and retry. Partial: ${text.slice(0, 120)}…`);
  }
  if (!schema) return text;
  try { return JSON.parse(text); }
  catch (e) { throw new Error(`Expected JSON but could not parse model output: ${text.slice(0, 200)}`); }
}

module.exports = { callClaude, DEFAULT_MODEL };
