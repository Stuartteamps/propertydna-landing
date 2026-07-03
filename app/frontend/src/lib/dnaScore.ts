export interface DNAScoreCategory {
  name: string;
  weight: number;
  score: number;
  contribution: number;
  confidence?: number;
}

export interface DNAScoreResult {
  total: number;
  grade: string;
  color: 'red' | 'yellow' | 'green';
  hex: string;
  categories: DNAScoreCategory[];
  summary: string;
}

function clamp(v: number, min = 0, max = 100) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

/** Coerce a possibly-undefined/NaN value to a finite number, else the fallback. */
function num(v: any, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 83) return 'A';
  if (score >= 76) return 'A-';
  if (score >= 70) return 'B+';
  if (score >= 63) return 'B';
  if (score >= 57) return 'B-';
  if (score >= 50) return 'C+';
  if (score >= 43) return 'C';
  if (score >= 36) return 'C-';
  if (score >= 28) return 'D';
  return 'F';
}

function floodRiskScore(zone: string): number {
  if (!zone || zone === '—') return 60;
  const z = zone.toUpperCase();
  if (z.startsWith('X')) return 90;
  if (z === 'B' || z === 'C') return 78;
  if (z.startsWith('AE') || z === 'A' || z === 'AH' || z === 'AO') return 32;
  if (z.startsWith('VE') || z === 'V') return 18;
  return 60;
}

export function computeDNAScore(dna: any): DNAScoreResult {
  const n       = dna?.normalized ?? {};
  const flood   = n.flood ?? {};
  const demo    = n.demographics ?? {};
  const val     = n.valuation ?? {};
  const prop    = n.property ?? {};
  const comps: any[] = n.comps ?? [];
  const hazard  = n.hazard ?? {};
  const sub     = n.subject ?? {};

  // v3 enrichment — use when available, fall back to v1 estimates
  const enr   = dna?.enrichment ?? {};
  const cats  = enr?.categoryScores ?? {};
  const hasV3 = !!enr?.v3_enriched;

  // 1. Location Quality (20%)
  let loc = 45;
  let locConf = 0;
  if (hasV3 && cats.locationQuality != null) {
    loc     = num(cats.locationQuality, loc);
    locConf = cats.locationConfidence ?? 0;
  } else {
    if (sub.lat && sub.lat !== '—') loc += 20;
    if (demo.population || demo.medianIncome) loc += 20;
    if (n.neighborhood || demo.neighborhood) loc += 15;
  }
  loc = clamp(loc);

  // 2. Market Value Accuracy (20%)
  let mva = 40;
  let mvaConf = 0;
  if (hasV3 && cats.marketValueAccuracy != null) {
    mva     = num(cats.marketValueAccuracy, mva);
    mvaConf = cats.marketConfidence ?? 0;
  } else {
    const cc = comps.length;
    if (cc >= 5) mva += 30;
    else if (cc >= 3) mva += 20;
    else if (cc >= 1) mva += 10;
    if ((val.estimate || val.marketValue) && (val.estimate || val.marketValue) !== '—') mva += 20;
    if (dna.confidence) {
      const c = String(dna.confidence).toLowerCase();
      if (c.includes('high')) mva += 10;
      else if (c.includes('med') || c.includes('mod')) mva += 5;
    }
  }
  mva = clamp(mva);

  // 3. Risk Score (15%) — higher = safer
  let risk = 62;
  let riskConf = 0;
  if (hasV3 && cats.riskScore != null) {
    risk     = num(cats.riskScore, risk);
    riskConf = cats.riskConfidence ?? 0;
  } else {
    const fz = enr?.hazardEnrichment?.femaFlood?.zone || flood.zone;
    if (fz) risk = (risk + floodRiskScore(fz)) / 2;
    if (hazard.score != null) risk = (risk + (100 - clamp(Number(hazard.score)))) / 2;
    if (hazard.crime  != null) risk = (risk + (100 - clamp(Number(hazard.crime)))) / 2;
  }
  risk = clamp(risk);

  // 4. Rental Yield Potential (15%)
  let rental = 55;
  let rentalConf = 0;
  if (hasV3 && cats.rentalYieldPotential != null) {
    rental     = num(cats.rentalYieldPotential, rental);
    rentalConf = cats.rentalConfidence ?? 0;
  } else {
    const medInc  = Number(demo.medianIncome || demo.median_income || 0);
    const valEst  = Number(val.estimate || val.marketValue || 0);
    const fmrRent = Number(enr?.rentalAnalysis?.hudFMR?.fmrTwoBed || 0);
    const effRent = fmrRent || (medInc > 0 ? medInc * 0.25 / 12 : 0);
    if (effRent > 0 && valEst > 0) {
      const yieldPct = ((effRent * 12) / valEst) * 100;
      if (yieldPct >= 8) rental = 90;
      else if (yieldPct >= 6) rental = 78;
      else if (yieldPct >= 4) rental = 65;
      else if (yieldPct >= 2) rental = 52;
      else rental = 38;
    }
  }
  rental = clamp(rental);

  // 5. Neighborhood Trajectory (15%)
  let traj = 55;
  let trajConf = 0;
  if (hasV3 && cats.neighborhoodTrajectory != null) {
    traj     = num(cats.neighborhoodTrajectory, traj);
    trajConf = cats.trajectoryConfidence ?? 0;
  } else {
    const popG = Number(demo.populationGrowth || demo.population_growth || 0);
    const incG = Number(demo.incomeGrowth || demo.income_growth || 0);
    if (popG > 0) traj += 15; else if (popG < 0) traj -= 10;
    if (incG > 0) traj += 15; else if (incG < 0) traj -= 10;
    const avgRatio = comps.length > 0 ? comps.reduce((s, c) => s + (c.ratio || 1), 0) / comps.length : 1;
    if (avgRatio > 1.02) traj += 10; else if (avgRatio < 0.97) traj -= 10;
  }
  traj = clamp(traj);

  // 6. Property Condition (10%) — age baseline + permit-based upgrades
  let cond = 60;
  const yr = Number(prop.yearBuilt || prop.year_built || 0);
  if (yr > 0) {
    const age = new Date().getFullYear() - yr;
    if (age < 5)  cond = 95;
    else if (age < 15) cond = 85;
    else if (age < 30) cond = 72;
    else if (age < 50) cond = 60;
    else cond = 48;
  }
  if (prop.type && prop.type !== '—') cond = clamp(cond + 5);

  // Boost from permit history (Riverside County public data)
  const permitData = enr?.permitHistory;
  if (permitData) {
    const autoFeats = permitData.autoDetectedFeatures || {};
    if (autoFeats.fully_remodeled) cond = clamp(cond + 15);
    else if ((permitData.recentPermits || 0) >= 2) cond = clamp(cond + 8);
    else if ((permitData.recentPermits || 0) >= 1) cond = clamp(cond + 4);
    if (autoFeats.addition) cond = clamp(cond + 5);
  }
  cond = clamp(cond);

  // 7. Unique / Prestige (5%)
  let prestige = 50;
  const valEst2 = Number(val.estimate || val.marketValue || 0);
  if (valEst2 > 0) {
    const areaMedian = Number(val.areaMedian || val.area_median || val.medianPrice || 0);
    if (areaMedian > 0) {
      const ratio = valEst2 / areaMedian;
      if (ratio > 2)        prestige = 95;
      else if (ratio > 1.5) prestige = 80;
      else if (ratio > 1.2) prestige = 68;
      else prestige = 55;
    }
  }
  prestige = clamp(prestige);

  const categories: DNAScoreCategory[] = [
    { name: 'Location Quality',        weight: 0.20, score: loc,      contribution: Math.round(0.20 * loc),     confidence: hasV3 ? locConf    : undefined },
    { name: 'Market Value Accuracy',   weight: 0.20, score: mva,      contribution: Math.round(0.20 * mva),     confidence: hasV3 ? mvaConf    : undefined },
    { name: 'Risk Profile',            weight: 0.15, score: risk,     contribution: Math.round(0.15 * risk),    confidence: hasV3 ? riskConf   : undefined },
    { name: 'Rental Yield Potential',  weight: 0.15, score: rental,   contribution: Math.round(0.15 * rental),  confidence: hasV3 ? rentalConf : undefined },
    { name: 'Neighborhood Trajectory', weight: 0.15, score: traj,     contribution: Math.round(0.15 * traj),    confidence: hasV3 ? trajConf   : undefined },
    { name: 'Property Condition',      weight: 0.10, score: cond,     contribution: Math.round(0.10 * cond) },
    { name: 'Unique / Prestige',       weight: 0.05, score: prestige, contribution: Math.round(0.05 * prestige) },
  ];

  const total = clamp(categories.reduce((s, c) => s + c.contribution, 0));
  const grade = scoreToGrade(total);

  let color: 'red' | 'yellow' | 'green';
  let hex: string;
  if (total >= 70) { color = 'green';  hex = '#2D9142'; }
  else if (total >= 45) { color = 'yellow'; hex = '#C9A84C'; }
  else { color = 'red'; hex = '#B85245'; }

  // Plain-English summary
  const topCat = [...categories].sort((a, b) => b.score - a.score)[0];
  const weakCat = [...categories].sort((a, b) => a.score - b.score)[0];
  const summary = `Overall score ${total}/100 (${grade}). Strongest factor: ${topCat.name} (${topCat.score}). ` +
    `${total >= 70 ? 'This property presents strong fundamentals across most categories.' : total >= 45 ? 'Mixed profile — review risk and market factors before proceeding.' : 'Several categories require careful due diligence.'} ` +
    (hasV3 ? 'Score powered by v3 data pipeline (20+ sources).' : 'Score based on available data.');

  return { total, grade, color, hex, categories, summary };
}

// Deterministic teaser score from address string (for non-authenticated preview)
function addrHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

export function teaserScore(address: string) {
  const score = 52 + (addrHash(address.trim().toLowerCase()) % 37);
  const grade = score >= 70 ? 'B+' : score >= 57 ? 'B' : 'C+';
  let color: 'red' | 'yellow' | 'green';
  let hex: string;
  if (score >= 70) { color = 'green';  hex = '#2D9142'; }
  else if (score >= 52) { color = 'yellow'; hex = '#C9A84C'; }
  else { color = 'red'; hex = '#B85245'; }
  return { score, grade, color, hex };
}
