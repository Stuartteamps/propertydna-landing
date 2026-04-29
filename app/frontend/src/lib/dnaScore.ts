export interface DNAScoreCategory {
  name: string;
  weight: number;
  score: number;
  contribution: number;
}

export interface DNAScoreResult {
  total: number;
  color: 'red' | 'yellow' | 'green';
  hex: string;
  categories: DNAScoreCategory[];
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function floodRiskScore(zone: string): number {
  if (!zone || zone === '—') return 60;
  const z = zone.toUpperCase();
  if (z.startsWith('X')) return 90;
  if (z === 'B' || z === 'C') return 80;
  if (z.startsWith('AE') || z === 'A') return 35;
  if (z.startsWith('VE') || z === 'V') return 20;
  return 60;
}

export function computeDNAScore(dna: any): DNAScoreResult {
  const n      = dna?.normalized ?? {};
  const flood  = n.flood ?? {};
  const demo   = n.demographics ?? {};
  const val    = n.valuation ?? {};
  const prop   = n.property ?? {};
  const comps: any[] = n.comps ?? [];
  const hazard = n.hazard ?? {};
  const sub    = n.subject ?? {};

  // 1. Location Quality (20%)
  let loc = 45;
  if (sub.lat && sub.lat !== '—') loc += 20;
  if (demo.population || demo.medianIncome) loc += 20;
  if (n.neighborhood || demo.neighborhood) loc += 15;
  loc = clamp(loc);

  // 2. Market Value Accuracy (20%)
  let mva = 40;
  const cc = comps.length;
  if (cc >= 5) mva += 30;
  else if (cc >= 3) mva += 20;
  else if (cc >= 1) mva += 10;
  if (val.estimate && val.estimate !== '—') mva += 20;
  if (dna.confidence) {
    const c = String(dna.confidence).toLowerCase();
    if (c.includes('high')) mva += 10;
    else if (c.includes('med') || c.includes('mod')) mva += 5;
  }
  mva = clamp(mva);

  // 3. Risk Score (15%) — lower risk = higher score
  let risk = 62;
  if (flood.zone) risk = (risk + floodRiskScore(flood.zone)) / 2;
  if (hazard.score != null) risk = (risk + (100 - clamp(Number(hazard.score)))) / 2;
  if (hazard.crime != null) risk = (risk + (100 - clamp(Number(hazard.crime)))) / 2;
  risk = clamp(risk);

  // 4. Rental Yield Potential (15%)
  let rental = 55;
  const medInc = Number(demo.medianIncome || demo.median_income || 0);
  const valEst = Number(val.estimate || 0);
  if (medInc > 0 && valEst > 0) {
    const yieldPct = ((medInc * 0.2) / valEst) * 100;
    if (yieldPct >= 8) rental = 90;
    else if (yieldPct >= 6) rental = 78;
    else if (yieldPct >= 4) rental = 65;
    else if (yieldPct >= 2) rental = 52;
    else rental = 38;
  }
  rental = clamp(rental);

  // 5. Neighborhood Trajectory (15%)
  let traj = 55;
  const popG = Number(demo.populationGrowth || demo.population_growth || 0);
  const incG = Number(demo.incomeGrowth || demo.income_growth || 0);
  if (popG > 0) traj += 15; else if (popG < 0) traj -= 10;
  if (incG > 0) traj += 15; else if (incG < 0) traj -= 10;
  const avgRatio = cc > 0 ? comps.reduce((s, c) => s + (c.ratio || 1), 0) / cc : 1;
  if (avgRatio > 1.02) traj += 10; else if (avgRatio < 0.97) traj -= 10;
  traj = clamp(traj);

  // 6. Property Condition (10%)
  let cond = 60;
  const yr = Number(prop.yearBuilt || prop.year_built || 0);
  if (yr > 0) {
    const age = new Date().getFullYear() - yr;
    if (age < 5) cond = 95;
    else if (age < 15) cond = 85;
    else if (age < 30) cond = 72;
    else if (age < 50) cond = 60;
    else cond = 48;
  }
  if (prop.type && prop.type !== '—') cond = clamp(cond + 5);
  cond = clamp(cond);

  // 7. Unique / Prestige (5%)
  let prestige = 50;
  if (valEst > 0) {
    const areaMedian = Number(val.areaMedian || val.area_median || val.medianPrice || 0);
    if (areaMedian > 0) {
      const ratio = valEst / areaMedian;
      if (ratio > 2) prestige = 95;
      else if (ratio > 1.5) prestige = 80;
      else if (ratio > 1.2) prestige = 68;
      else prestige = 55;
    }
  }
  prestige = clamp(prestige);

  const categories: DNAScoreCategory[] = [
    { name: 'Location Quality',        weight: 0.20, score: loc,      contribution: Math.round(0.20 * loc) },
    { name: 'Market Value Accuracy',   weight: 0.20, score: mva,      contribution: Math.round(0.20 * mva) },
    { name: 'Risk Profile',            weight: 0.15, score: risk,     contribution: Math.round(0.15 * risk) },
    { name: 'Rental Yield Potential',  weight: 0.15, score: rental,   contribution: Math.round(0.15 * rental) },
    { name: 'Neighborhood Trajectory', weight: 0.15, score: traj,     contribution: Math.round(0.15 * traj) },
    { name: 'Property Condition',      weight: 0.10, score: cond,     contribution: Math.round(0.10 * cond) },
    { name: 'Unique / Prestige',       weight: 0.05, score: prestige, contribution: Math.round(0.05 * prestige) },
  ];

  const total = clamp(categories.reduce((s, c) => s + c.contribution, 0));

  let color: 'red' | 'yellow' | 'green';
  let hex: string;
  if (total >= 70) { color = 'green'; hex = '#2D9142'; }
  else if (total >= 45) { color = 'yellow'; hex = '#C9A84C'; }
  else { color = 'red'; hex = '#B85245'; }

  return { total, color, hex, categories };
}

// Deterministic teaser score from address string (for non-authenticated preview)
function addrHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

export function teaserScore(address: string) {
  const score = 52 + (addrHash(address.trim().toLowerCase()) % 37);
  let color: 'red' | 'yellow' | 'green';
  let hex: string;
  if (score >= 70) { color = 'green'; hex = '#2D9142'; }
  else if (score >= 52) { color = 'yellow'; hex = '#C9A84C'; }
  else { color = 'red'; hex = '#B85245'; }
  return { score, color, hex };
}
