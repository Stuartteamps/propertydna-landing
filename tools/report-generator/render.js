'use strict';
/**
 * PropertyDNA Buyer Intelligence Report — reusable renderer.
 *
 * Pure, dependency-free. Takes a normalized `data` object and returns a single
 * self-contained HTML string (web + mobile responsive + print-optimized) that
 * matches the shipped 50220 Via Puente and 9520 Ekwanok reports.
 *
 * Design goals:
 *  - One template, many properties. All chrome (header, expiry gate, footer,
 *    print CSS, source-chip styling) lives here; callers only supply content.
 *  - Graceful missing data: any field left out renders nothing; use the
 *    `unavail()` helper / "Data unavailable." text for fields that are unknown.
 *  - Never invents: the renderer formats what it is given and nothing else.
 *
 * See README.md for the full data model. Block types supported per section:
 *   stats | cards | table | scores | kv | list | prose | note | ribbon | legend
 */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Inline source chip, e.g. src('mls') -> <span class="src mls">MLS</span> */
function src(tag) {
  const t = String(tag || '').toLowerCase();
  const label = { mls: 'MLS', dna: 'DNA', mkt: 'MKT', risk: 'RISK', cmty: 'CMTY', geo: 'GEO' }[t] || tag;
  const cls = ['mls', 'dna', 'risk'].includes(t) ? `src ${t}` : 'src';
  return `<span class="${cls}">${esc(label)}</span>`;
}
const unavail = (s) => `<span class="unavail">${esc(s || 'Data unavailable.')}</span>`;

// ---- block renderers -------------------------------------------------------

function renderStats(tiles = []) {
  return `<div class="stats">` + tiles.map((t) => `
    <div class="stat"><div class="lab">${esc(t.lab)}</div>
      <div class="val${t.tone ? ' ' + t.tone : ''}">${t.val}</div>
      ${t.sub ? `<div class="sub">${t.sub}</div>` : ''}</div>`).join('') + `</div>`;
}

function renderCards(cards = [], cols = 2, keep = false) {
  const cls = `grid g${cols}${keep ? ' keep' : ''}`;
  return `<div class="${cls}">` + cards.map((c) => `
    <div class="card">${c.h3 ? `<h3>${c.h3}</h3>` : ''}${c.h4 ? `<h4>${c.h4}</h4>` : ''}${c.html || ''}</div>`).join('') + `</div>`;
}

function renderTable(t = {}) {
  const head = (t.head || []).map((h) => {
    const n = typeof h === 'object' ? h : { label: h };
    return `<th${n.num ? ' class="num"' : ''}>${esc(n.label)}</th>`;
  }).join('');
  const rows = (t.rows || []).map((r, i) => {
    const cells = r.cells || r;
    const isSub = r.subject || t.subjectRow === i;
    const tds = cells.map((c) => {
      const cell = typeof c === 'object' ? c : { html: c };
      return `<td${cell.num ? ' class="num"' : ''}>${cell.html != null ? cell.html : esc(cell)}</td>`;
    }).join('');
    return `<tr${isSub ? ' class="sub"' : ''}>${tds}</tr>`;
  }).join('');
  return `<div class="tbl-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderScores(rows = []) {
  return `<div class="card">` + (rows.title ? `<h4>${rows.title}</h4>` : '') + (rows.items || rows).map((s) => {
    const max = s.max || 10;
    const pct = Math.max(0, Math.min(100, (Number(s.val) / max) * 100));
    return `<div class="scorerow"><span class="nm">${esc(s.nm)}</span>
      <div class="bar${s.warn ? ' warn' : ''}"><i style="width:${pct.toFixed(0)}%"></i></div>
      <span class="vv">${esc(s.val)}</span></div>`;
  }).join('') + `</div>`;
}

function renderKv(card = {}) {
  const items = (card.items || card).map((kv) =>
    `<div class="kv"><span class="k">${kv.k}</span><span class="v">${kv.v}</span></div>`).join('');
  return `<div class="card">${card.title ? `<h3>${card.title}</h3>` : ''}${items}</div>`;
}

function renderList(card = {}) {
  const tone = card.tone ? ` ${card.tone}` : '';
  const items = (card.items || []).map((li) => `<li>${li}</li>`).join('');
  return `<div class="card">${card.h3 ? `<h3${card.color ? ` style="color:${card.color}"` : ''}>${card.h3}</h3>` : ''}<ul class="clean${tone}">${items}</ul></div>`;
}

function renderBlock(b) {
  switch (b.type) {
    case 'stats': return renderStats(b.tiles);
    case 'cards': return renderCards(b.cards, b.cols || 2, b.keep);
    case 'table': return renderTable(b);
    case 'scores': return renderScores(b);
    case 'kv': return renderKv(b);
    case 'list': return renderList(b);
    case 'prose': return `<p class="lead">${b.html}</p>`;
    case 'html': return b.html || '';
    case 'note': return `<div class="note">${b.html}</div>`;
    case 'ribbon': return `<div class="ribbon">` + (b.badges || []).map((x) =>
      `<span class="badge ${x.tone || 'g'}">${x.text}</span>`).join('') + `</div>`;
    case 'legend': return `<div class="legend">` + (b.tags || []).map(src).join('') + `</div>`;
    default: return b.html || '';
  }
}

function renderSection(s) {
  const blocks = (s.blocks || []).map(renderBlock).join('\n');
  return `
<section${s.id ? ` id="${s.id}"` : ''}${s.page ? ' class="page"' : ''}><div class="wrap">
  <div class="sec-head"><span class="sec-num">${esc(s.num)}</span><div>
    <h2>${esc(s.title)}</h2>
    ${s.subtitle ? `<p>${esc(s.subtitle)}</p>` : ''}
  </div></div>
  ${blocks}
</div></section>`;
}

// ---- full document ---------------------------------------------------------

function renderReport(data = {}) {
  const meta = data.meta || {};
  const hero = data.hero || {};
  const theme = data.theme === 'gold' ? 'gold' : 'teal'; // accent for hero glow + table tint
  const glow = theme === 'gold'
    ? `radial-gradient(1200px 700px at 78% -8%, rgba(201,168,106,.10), transparent 55%),
       radial-gradient(900px 600px at 8% 4%, rgba(67,198,183,.06), transparent 50%),`
    : `radial-gradient(1200px 700px at 78% -8%, rgba(67,198,183,.09), transparent 55%),
       radial-gradient(900px 600px at 8% 4%, rgba(201,168,106,.06), transparent 50%),`;
  const subTint = theme === 'gold' ? 'rgba(201,168,106,.05)' : 'rgba(67,198,183,.06)';
  const expISO = meta.expiresISO || '';

  const tags = (hero.tags || []).map((t) =>
    `<span class="tag">${t.b ? `<b>${esc(t.b)}</b> ` : ''}${esc(t.text || '')}</span>`).join('\n    ');
  const badges = (hero.badges || []).map((x) =>
    `<span class="badge ${x.tone || 'gold'}">${esc(x.text)}</span>`).join('\n    ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(meta.title || 'PropertyDNA Buyer Intelligence Report')}</title>
<meta name="description" content="${esc(meta.description || '')}" />
<meta name="robots" content="noindex,nofollow" />
<link rel="icon" href="/favicon.svg" />
<style>
  :root{
    --bg:#070a0f;--bg2:#0c111a;--panel:#10161f;--panel2:#141c28;
    --line:#1e2836;--line2:#283446;--ink:#eef2f7;--ink2:#aab4c2;--ink3:#7f8b9c;
    --gold:#c9a86a;--gold2:#e6c98a;--teal:#43c6b7;--green:#46c98a;--red:#e1685f;--amber:#e0b24c;--blue:#5fa8e1;
    --radius:16px;--maxw:1080px;
    --shadow:0 1px 0 rgba(255,255,255,.03) inset,0 18px 50px rgba(0,0,0,.45);
    --font:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;
    --mono:"SF Mono",ui-monospace,"JetBrains Mono",Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box}html{scroll-behavior:smooth}
  body{margin:0;background:${glow}var(--bg);color:var(--ink);font-family:var(--font);
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;line-height:1.55;letter-spacing:.005em}
  .wrap{max-width:var(--maxw);margin:0 auto;padding:0 22px}
  a{color:var(--gold2);text-decoration:none}
  h1,h2,h3,h4{margin:0;font-weight:650;letter-spacing:-.01em;line-height:1.2}
  p{margin:0 0 14px}small{color:var(--ink3)}
  .topbar{position:sticky;top:0;z-index:40;backdrop-filter:saturate(140%) blur(14px);background:rgba(7,10,15,.72);border-bottom:1px solid var(--line)}
  .topbar .wrap{display:flex;align-items:center;gap:14px;height:58px}
  .brand{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:.02em}
  .brand .dot{width:11px;height:11px;border-radius:3px;background:conic-gradient(from 210deg,var(--gold),var(--teal),var(--gold));box-shadow:0 0 14px rgba(201,168,106,.6)}
  .brand b{color:var(--ink)}.brand span{color:var(--gold2)}
  .topbar .spacer{flex:1}
  .pill{font-size:11.5px;color:var(--ink2);border:1px solid var(--line);padding:5px 11px;border-radius:999px;white-space:nowrap}
  .btn{font:inherit;font-size:12.5px;font-weight:600;color:#0a0d12;background:linear-gradient(180deg,var(--gold2),var(--gold));border:0;border-radius:999px;padding:8px 15px;cursor:pointer;white-space:nowrap}
  .btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line2)}
  .hero{padding:46px 0 14px;border-bottom:1px solid var(--line)}
  .kicker{display:inline-flex;align-items:center;gap:9px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold2);font-weight:600}
  .kicker::before{content:"";width:26px;height:1px;background:linear-gradient(90deg,var(--gold),transparent)}
  .hero h1{font-size:clamp(28px,5vw,46px);margin:14px 0 6px}
  .hero .addr2{color:var(--ink2);font-size:clamp(15px,2.4vw,19px);font-weight:500}
  .hero .meta{display:flex;flex-wrap:wrap;gap:8px 10px;margin-top:18px}
  .tag{font-size:12px;color:var(--ink2);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:6px 10px}
  .tag b{color:var(--ink);font-weight:600}
  section{padding:40px 0;border-bottom:1px solid var(--line)}
  .sec-head{display:flex;align-items:baseline;gap:14px;margin-bottom:22px}
  .sec-num{font-family:var(--mono);font-size:12px;color:var(--gold2);border:1px solid var(--line2);border-radius:7px;padding:3px 8px;flex:none}
  .sec-head h2{font-size:clamp(20px,3vw,27px)}.sec-head p{margin:6px 0 0;color:var(--ink3);font-size:13.5px}
  .lead{font-size:16px;color:var(--ink2);max-width:74ch}
  .grid{display:grid;gap:16px}.g2{grid-template-columns:repeat(2,1fr)}.g3{grid-template-columns:repeat(3,1fr)}.g4{grid-template-columns:repeat(4,1fr)}
  .card{background:linear-gradient(180deg,var(--panel),var(--bg2));border:1px solid var(--line);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow)}
  .card h3{font-size:15px;margin-bottom:8px;display:flex;align-items:center;gap:8px}
  .card h4{font-size:13px;color:var(--ink2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:8px}
  .stat{background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:14px;padding:18px;position:relative;overflow:hidden}
  .stat::after{content:"";position:absolute;inset:0 0 auto auto;width:90px;height:90px;background:radial-gradient(circle at 80% 10%,${subTint.replace('.05', '.16').replace('.06', '.16')},transparent 60%)}
  .stat .lab{font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink3)}
  .stat .val{font-size:clamp(22px,3.4vw,30px);font-weight:700;margin-top:8px;letter-spacing:-.02em}
  .stat .sub{font-size:12.5px;color:var(--ink2);margin-top:4px}
  .stat .val.gold{color:var(--gold2)}.stat .val.teal{color:var(--teal)}.stat .val.green{color:var(--green)}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  th,td{text-align:left;padding:11px 12px;border-bottom:1px solid var(--line)}
  th{color:var(--ink3);font-weight:600;font-size:11.5px;letter-spacing:.05em;text-transform:uppercase}
  td.num,th.num{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums}
  tr.sub td{background:${subTint}}
  .tbl-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px}
  .tbl-wrap table th,.tbl-wrap table td{padding:12px 14px}.tbl-wrap table tr:last-child td{border-bottom:0}
  .bar{height:7px;border-radius:6px;background:#0a0f17;border:1px solid var(--line);overflow:hidden}
  .bar>i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,var(--teal),var(--gold2))}
  .bar.warn>i{background:linear-gradient(90deg,var(--amber),var(--red))}
  .scorerow{display:grid;grid-template-columns:170px 1fr 46px;gap:12px;align-items:center;margin:9px 0}
  .scorerow .nm{font-size:13.5px;color:var(--ink2)}.scorerow .vv{font-family:var(--mono);font-size:13px;text-align:right;color:var(--ink)}
  .kv{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px dashed var(--line)}
  .kv:last-child{border-bottom:0}.kv .k{color:var(--ink3);font-size:13px}.kv .v{color:var(--ink);font-size:13.5px;font-weight:550;text-align:right}
  ul.clean{list-style:none;padding:0;margin:0}
  ul.clean li{position:relative;padding:8px 0 8px 24px;border-bottom:1px solid var(--line);font-size:14px;color:var(--ink2)}
  ul.clean li:last-child{border-bottom:0}
  ul.clean li::before{content:"";position:absolute;left:2px;top:14px;width:7px;height:7px;border-radius:2px;background:var(--gold2)}
  ul.clean.pos li::before{background:var(--green)}ul.clean.con li::before{background:var(--amber)}
  .src{font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;color:var(--ink3);border:1px solid var(--line);border-radius:5px;padding:1px 5px;margin-left:6px;vertical-align:1.5px;white-space:nowrap}
  .src.mls{color:var(--gold2);border-color:rgba(201,168,106,.4)}
  .src.dna{color:var(--teal);border-color:rgba(67,198,183,.4)}
  .src.risk{color:var(--amber);border-color:rgba(224,178,76,.35)}
  .note{font-size:12.5px;color:var(--ink3);border-left:2px solid var(--line2);padding:4px 0 4px 12px;margin:14px 0}
  .unavail{color:var(--ink3);font-style:italic}
  .badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;border-radius:999px;padding:4px 11px}
  .badge.g{color:var(--green);background:rgba(70,201,138,.10);border:1px solid rgba(70,201,138,.28)}
  .badge.a{color:var(--amber);background:rgba(224,178,76,.10);border:1px solid rgba(224,178,76,.28)}
  .badge.gold{color:var(--gold2);background:rgba(201,168,106,.1);border:1px solid rgba(201,168,106,.3)}
  .ribbon{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 2px}
  .conf{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ink2)}
  .conf .ring{width:46px;height:46px;border-radius:50%;flex:none;background:conic-gradient(var(--teal) calc(var(--p,70)*1%),#16202c 0);display:grid;place-items:center;position:relative}
  .conf .ring::before{content:"";position:absolute;inset:5px;border-radius:50%;background:var(--bg2)}
  .conf .ring b{position:relative;font-family:var(--mono);font-size:12px;color:var(--ink)}
  @media (max-width:820px){.g2,.g3,.g4,.stats{grid-template-columns:1fr}.g3.keep,.g4.keep{grid-template-columns:1fr 1fr}.scorerow{grid-template-columns:130px 1fr 40px}.hide-sm{display:none}}
  footer{padding:40px 0 70px;color:var(--ink3);font-size:12.5px}footer .wrap>div{max-width:80ch}
  .legend{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.legend .src{margin:0}
  #expired{display:none;position:fixed;inset:0;z-index:99;background:rgba(5,8,12,.96);place-items:center;text-align:center;padding:30px}
  #expired.show{display:grid}#expired .box{max-width:440px}#expired h2{font-size:24px;margin-bottom:10px}
  @media print{
    :root{--bg:#fff;--bg2:#fff;--panel:#fff;--panel2:#f6f7f9;--line:#d9dee6;--line2:#c5ccd6;--ink:#10151c;--ink2:#33414f;--ink3:#5f6b79;--gold2:#9a7d3e;--teal:#1f8d7f;--green:#1f8d56;--shadow:none}
    body{background:#fff}.topbar,.no-print,.btn{display:none!important}.hero{padding-top:8px}
    section{padding:18px 0;break-inside:avoid}.card,.stat,.tbl-wrap,.scorerow{break-inside:avoid}
    section.page{break-before:page}a{color:var(--ink)}.src{color:#7a8290!important}.stat::after,.stat::before{display:none}
    @page{margin:14mm 12mm}
  }
</style>
</head>
<body>
<div id="expired"><div class="box">
  <div class="brand" style="justify-content:center;margin-bottom:14px"><span class="dot"></span><b>Property</b><span>DNA</span></div>
  <h2>This shareable report has expired</h2>
  <p style="color:var(--ink2)">For privacy, public PropertyDNA reports are available for 30 days. This link expired on <b id="expDate"></b>. Please request a refreshed report.</p>
</div></div>

<div class="topbar no-print"><div class="wrap">
  <div class="brand"><span class="dot"></span><b>Property</b><span>DNA</span></div>
  <span class="pill hide-sm">Buyer Intelligence · Confidential</span>
  <div class="spacer"></div>
  <span class="pill" id="expPill">Valid through —</span>
  <button class="btn ghost" onclick="navigator.clipboard&&navigator.clipboard.writeText(location.href);this.textContent='Link copied'">Share</button>
  <button class="btn" onclick="window.print()">Save PDF</button>
</div></div>

<header class="hero"><div class="wrap">
  <div class="kicker">PropertyDNA · Buyer Intelligence Report</div>
  <h1>${esc(hero.title || '')}</h1>
  <div class="addr2">${esc(hero.addr2 || '')}</div>
  <div class="meta">
    ${tags}
  </div>
  ${badges ? `<div class="ribbon">\n    ${badges}\n  </div>` : ''}
  ${hero.note ? `<p class="note" style="margin-top:18px">${hero.note}</p>` : ''}
</div></header>

${(data.sections || []).map(renderSection).join('\n')}

<footer><div class="wrap"><div>
  <div class="brand" style="margin-bottom:12px"><span class="dot"></span><b>Property</b><span>DNA</span>
    <span style="color:var(--ink3);font-weight:400;font-size:12px;margin-left:8px">powered by IntellaGraph AI</span></div>
  <p>${data.footer && data.footer.line ? data.footer.line : ''} <b id="expFooter">Shareable link valid through —</b>.</p>
  <p>${data.footer && data.footer.disclaimer ? data.footer.disclaimer : 'This report is decision-support and is confidential. It is not an appraisal, a guarantee of value, a loan or insurance commitment, or a solicitation where prohibited. Buyer should independently confirm all material facts and conduct professional inspections before relying on any figure herein. Information believed reliable but not guaranteed. © 2026 PropertyDNA / IntellaGraph AI.'}</p>
</div></div></footer>

<script>
  (function(){
    var EXP = ${JSON.stringify(expISO)};
    if(!EXP) return;
    var expD = new Date(EXP);
    var pretty = expD.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
    var setTxt=function(id,t){var e=document.getElementById(id);if(e)e.textContent=t;};
    setTxt('expPill','Valid through '+pretty);
    setTxt('expDate',pretty);
    setTxt('expFooter','Shareable link valid through '+pretty+' (30 days from issue)');
    if(Date.now() > expD.getTime()){
      var ov=document.getElementById('expired'); if(ov) ov.classList.add('show');
      document.body.style.overflow='hidden';
    }
  })();
</script>
</body>
</html>`;
}

module.exports = { renderReport, src, unavail, esc };
