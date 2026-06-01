#!/usr/bin/env python3
"""Patch the Property DNA n8n workflow:
1. Forward viewToken + reportId + propertyType from webhook → save-report.
2. Branch the Claude prompt in "OpenAI Narrative" by propertyType so the
   narrative reads as commercial / multi-family / land / residential.
PUTs the updated workflow back via the n8n API.
"""
import json, os, sys, copy, urllib.request, urllib.error
N8N_HOST = "dillabean.app.n8n.cloud"
WF_ID    = "FQ0T3xhXyYubf8c6"
N8N_KEY  = os.environ.get("N8N_API_KEY") or sys.argv[1] if len(sys.argv) > 1 else os.environ.get("N8N_API_KEY","")
if not N8N_KEY: print("usage: N8N_API_KEY=... n8n-patch-workflow.py"); sys.exit(1)

def api(method, path, body=None):
    url = f"https://{N8N_HOST}/api/v1{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("X-N8N-API-KEY", N8N_KEY); req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e: return e.code, e.read().decode()

s, wf = api("GET", f"/workflows/{WF_ID}")
if s != 200: print(f"GET workflow failed {s}: {wf}"); sys.exit(2)
print(f"loaded workflow '{wf.get('name')}' ({len(wf['nodes'])} nodes)")

# backup current
with open("automation-workflows/n8n-workflow-FQ0T3xhXyYubf8c6.backup.json","w") as f:
    json.dump(wf, f, indent=2)
print("backup -> automation-workflows/n8n-workflow-FQ0T3xhXyYubf8c6.backup.json")

# ── Patch 1: Save to Supabase — forward viewToken + reportId + propertyType ──
save = next(n for n in wf["nodes"] if n["name"] == "Save to Supabase")
params = save["parameters"].setdefault("bodyParameters", {}).setdefault("parameters", [])
existing_names = {p["name"] for p in params}
additions = [
    {"name": "viewToken",    "value": "={{ $('Webhook').item.json.body.viewToken }}"},
    {"name": "reportId",     "value": "={{ $('Webhook').item.json.body.reportId }}"},
    {"name": "propertyType", "value": "={{ $('Webhook').item.json.body.propertyType || ($('Property Lookup').item.json[0] && $('Property Lookup').item.json[0].propertyType) || '' }}"},
]
added = []
for a in additions:
    if a["name"] in existing_names: print(f"  Save to Supabase already has {a['name']}"); continue
    params.append(a); added.append(a["name"])
print(f"Save to Supabase: added {added}")

# ── Patch 2: OpenAI Narrative — propertyType-aware role + framing ──
oa = next(n for n in wf["nodes"] if n["name"] == "OpenAI Narrative")
new_body = (
    "={{ JSON.stringify((function(){"
    " var pt=(($('Webhook').item.json.body.propertyType)||"
    "($('Property Lookup').item.json[0]&&$('Property Lookup').item.json[0].propertyType)||'Residential').toString().toLowerCase();"
    " var isC=/commercial|office|retail|industrial|warehouse|mixed/.test(pt);"
    " var isM=/multi|duplex|triplex|fourplex|apartment|2-4/.test(pt);"
    " var isL=/land|lot|vacant/.test(pt);"
    " var role=isC?'commercial real-estate analyst (cap rate, NOI, tenant credit, zoning compliance)':"
    "isM?'multi-family investment analyst (unit mix, gross rent, NOI, cap rate, cash-on-cash)':"
    "isL?'land-development analyst (entitlements, zoning, highest-and-best-use, raw-land comps)':"
    "'luxury residential real-estate analyst';"
    " var focus=isC?'Frame investmentAngle around CAP RATE, NOI, GRM, and tenant credit. PropertyDNA does not yet ingest commercial lease rolls — call out the data limit explicitly in dataQualityNote.':"
    "isM?'Frame investmentAngle around NOI, cap rate, cash-on-cash, and the 1% rule. Default to estimated rents if rent-roll data is absent.':"
    "isL?'There are no income or comp models for raw land — anchor analysis to entitlement risk, zoning, and recent raw-land sales. State limits in dataQualityNote.':"
    "'';"
    " return { model:'claude-opus-4-5', max_tokens:1800, messages:[{ role:'user', content:["
    "'You are a '+role+'. Use ONLY the verified data below.',"
    "'PROPERTY TYPE: '+pt+(focus?(' — '+focus):''),"
    "'RULES: Never invent facts. Do NOT state the property is for sale unless listing data confirms it.',"
    "'wouldWeBuyItReason: 2-3 sentences citing score, comps, flood risk, income. 50-70 words.',"
    "'Return ONLY valid JSON: executiveSummary, sellerAngle, buyerAngle, investmentAngle, dataQualityNote, wouldWeBuyIt (Yes/Maybe/Needs Review), wouldWeBuyItReason. Max 80 words each.',"
    "'PROPERTY: '+JSON.stringify($json.normalized.subject),"
    "'VITALS: '+JSON.stringify($json.normalized.property),"
    "'VALUATION: '+JSON.stringify($json.normalized.valuation),"
    "'COMPS: '+JSON.stringify(($json.normalized.comps||[]).slice(0,3)),"
    "'FLOOD: '+JSON.stringify($json.normalized.flood),"
    "'DEMOGRAPHICS: '+JSON.stringify($json.normalized.demographics),"
    "'SCORE: '+$json.score+' RATING: '+$json.rating"
    "].join(' ') }] };"
    "})()) }}"
)
oa["parameters"]["jsonBody"] = new_body
print("OpenAI Narrative: prompt updated with propertyType branching")

# ── PUT back. n8n public-api PUT only accepts a strict allowlist of settings keys ──
ALLOWED = {"executionOrder","saveDataErrorExecution","saveDataSuccessExecution","saveExecutionProgress","saveManualExecutions","timezone","errorWorkflow"}
filtered_settings = {k:v for k,v in (wf.get("settings") or {}).items() if k in ALLOWED}
put_body = {
    "name":        wf["name"],
    "nodes":       wf["nodes"],
    "connections": wf["connections"],
    "settings":    filtered_settings,
}
s, resp = api("PUT", f"/workflows/{WF_ID}", put_body)
print(f"\nPUT workflow HTTP {s}")
if s not in (200,201):
    print(f"  body: {str(resp)[:500]}"); sys.exit(3)
# save the new workflow back to the repo for version control
with open("automation-workflows/n8n-workflow-FQ0T3xhXyYubf8c6.json","w") as f:
    json.dump(resp, f, indent=2)
print("updated workflow JSON written to repo")
