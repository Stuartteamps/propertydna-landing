#!/usr/bin/env node
/**
 * update-n8n-nodes.js
 *
 * Programmatically patches the PropertyDNA n8n workflow to replace:
 *   Node 14 (Save to Supabase)  →  HTTP call to save-report Netlify function
 *   Node 15 (Gmail: Send Email) →  HTTP call to send-report-email Netlify function
 *
 * Usage:
 *   N8N_API_KEY=<your_key> N8N_BASE_URL=https://dillabean.app.n8n.cloud \
 *   NETLIFY_INTERNAL_KEY=<your_key> node update-n8n-nodes.js
 *
 * How to get your n8n API key:
 *   n8n Settings → API → Create new key
 *   https://dillabean.app.n8n.cloud/settings/api
 *
 * Run this ONCE. After it succeeds, delete the script or keep it for reference.
 */

const https = require('https');

const N8N_BASE_URL   = process.env.N8N_BASE_URL   || 'https://dillabean.app.n8n.cloud';
const N8N_API_KEY    = process.env.N8N_API_KEY;
const INTERNAL_KEY   = process.env.NETLIFY_INTERNAL_KEY;
const NETLIFY_BASE   = process.env.APP_BASE_URL    || 'https://thepropertydna.com';
const WORKFLOW_ID    = 'FQ0T3xhXyYubf8c6';

if (!N8N_API_KEY) {
  console.error('ERROR: N8N_API_KEY env var is required.');
  console.error('Get it at: https://dillabean.app.n8n.cloud/settings/api');
  process.exit(1);
}

if (!INTERNAL_KEY) {
  console.error('ERROR: NETLIFY_INTERNAL_KEY env var is required.');
  console.error('This must match the INTERNAL_API_KEY set in Netlify environment variables.');
  process.exit(1);
}

function n8nRequest(method, path, body) {
  const url = new URL(N8N_BASE_URL + path);
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`n8n ${res.statusCode}: ${raw.slice(0, 300)}`));
        } else {
          try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// HTTP Request node that calls save-report and extracts viewToken
const saveReportNode = {
  type: 'n8n-nodes-base.httpRequest',
  parameters: {
    method: 'POST',
    url: `${NETLIFY_BASE}/.netlify/functions/save-report`,
    authentication: 'genericCredentialType',
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'x-internal-key', value: INTERNAL_KEY },
        { name: 'Content-Type',   value: 'application/json' },
      ],
    },
    sendBody: true,
    bodyParameters: {
      parameters: [
        { name: 'email',          value: "={{ $('Normalize Intake').item.json.email }}" },
        { name: 'address',        value: "={{ $('Normalize Intake').item.json.address }}" },
        { name: 'city',           value: "={{ $('Normalize Intake').item.json.city }}" },
        { name: 'state',          value: "={{ $('Normalize Intake').item.json.state }}" },
        { name: 'zip',            value: "={{ $('Normalize Intake').item.json.zip }}" },
        { name: 'reportData',     value: "={{ $('Compose HTML Report').item.json.reportObject }}" },
        { name: 'status',         value: 'completed' },
        { name: 'n8nRequestId',   value: "={{ $execution.id }}" },
        { name: 'features',       value: "={{ $('Compose HTML Report').item.json.detectedFeatures || {} }}" },
      ],
    },
    responseFormat: 'json',
    options: {},
  },
  name: 'Save Report (Netlify)',
};

// HTTP Request node that calls send-report-email
const sendEmailNode = {
  type: 'n8n-nodes-base.httpRequest',
  parameters: {
    method: 'POST',
    url: `${NETLIFY_BASE}/.netlify/functions/send-report-email`,
    authentication: 'genericCredentialType',
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'x-internal-key', value: INTERNAL_KEY },
        { name: 'Content-Type',   value: 'application/json' },
      ],
    },
    sendBody: true,
    bodyParameters: {
      parameters: [
        { name: 'recipientEmail',    value: "={{ $('Normalize Intake').item.json.email }}" },
        { name: 'recipientName',     value: "={{ $('Normalize Intake').item.json.fullName }}" },
        { name: 'propertyAddress',   value: "={{ $('Normalize Intake').item.json.fullAddress || ($('Normalize Intake').item.json.address + ', ' + $('Normalize Intake').item.json.city + ', ' + $('Normalize Intake').item.json.state) }}" },
        { name: 'summary',           value: "={{ $('Compose HTML Report').item.json.executiveSummary || '' }}" },
        { name: 'viewToken',         value: "={{ $('Save Report (Netlify)').item.json.viewToken }}" },
        { name: 'reportId',          value: "={{ $('Save Report (Netlify)').item.json.reportId }}" },
        { name: 'ownerCopy',         value: 'true' },
      ],
    },
    responseFormat: 'json',
    options: {},
  },
  name: 'Send Report Email (Netlify)',
};

async function main() {
  console.log(`\nFetching workflow ${WORKFLOW_ID}…`);
  let workflow;
  try {
    workflow = await n8nRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
  } catch (err) {
    console.error('Could not fetch workflow:', err.message);
    console.error('\nMake sure:');
    console.error('  1. N8N_API_KEY is correct');
    console.error('  2. The workflow ID FQ0T3xhXyYubf8c6 exists in your n8n instance');
    process.exit(1);
  }

  console.log(`Found workflow: "${workflow.name}" (${workflow.nodes?.length || 0} nodes)`);

  const nodes = workflow.nodes || [];
  let saveNodeIdx = -1;
  let emailNodeIdx = -1;

  nodes.forEach((n, i) => {
    const name = (n.name || '').toLowerCase();
    const type = (n.type || '').toLowerCase();
    if (name.includes('supabase') || name.includes('save') || (name.includes('http') && i === 13)) {
      saveNodeIdx = i;
    }
    if (name.includes('gmail') || name.includes('email') || name.includes('send')) {
      emailNodeIdx = i;
    }
  });

  console.log('\nNode detection:');
  console.log(`  Save node  → index ${saveNodeIdx} (${saveNodeIdx >= 0 ? nodes[saveNodeIdx]?.name : 'not found — will append'})`);
  console.log(`  Email node → index ${emailNodeIdx} (${emailNodeIdx >= 0 ? nodes[emailNodeIdx]?.name : 'not found — will append'})`);

  // Replace or append nodes
  const updatedNodes = [...nodes];

  const applySaveNode  = { ...saveReportNode, position: saveNodeIdx  >= 0 ? nodes[saveNodeIdx].position  : [900, 260] };
  const applyEmailNode = { ...sendEmailNode,  position: emailNodeIdx >= 0 ? nodes[emailNodeIdx].position : [1100, 260] };

  if (saveNodeIdx >= 0) {
    updatedNodes[saveNodeIdx] = { ...nodes[saveNodeIdx], ...applySaveNode };
    console.log(`\n  ✓ Replacing node [${saveNodeIdx}] "${nodes[saveNodeIdx].name}" → "Save Report (Netlify)"`);
  } else {
    updatedNodes.push(applySaveNode);
    console.log('\n  + Appending "Save Report (Netlify)" node');
  }

  if (emailNodeIdx >= 0) {
    updatedNodes[emailNodeIdx] = { ...nodes[emailNodeIdx], ...applyEmailNode };
    console.log(`  ✓ Replacing node [${emailNodeIdx}] "${nodes[emailNodeIdx].name}" → "Send Report Email (Netlify)"`);
  } else {
    updatedNodes.push(applyEmailNode);
    console.log('  + Appending "Send Report Email (Netlify)" node');
  }

  console.log('\nPatching workflow…');
  try {
    await n8nRequest('PATCH', `/api/v1/workflows/${WORKFLOW_ID}`, {
      nodes: updatedNodes,
      settings: workflow.settings,
    });
    console.log('✓ Workflow patched successfully.\n');
    console.log('Next steps:');
    console.log('  1. Open n8n and verify the two new HTTP Request nodes look correct');
    console.log('  2. Make sure INTERNAL_API_KEY in Netlify matches what you passed here');
    console.log('  3. Make sure RESEND_API_KEY is set in Netlify env vars');
    console.log('  4. Run a test report to verify end-to-end delivery');
  } catch (err) {
    console.error('Failed to patch workflow:', err.message);
    console.error('\nThe workflow was NOT modified. Check the error above and retry.');
    process.exit(1);
  }
}

main();
