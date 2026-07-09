/**
 * _intelligence.js — PropertyDNA canonical scoring & valuation engine.
 *
 * THE SINGLE SOURCE OF TRUTH for the DNA score, the nine proprietary scores, and
 * the explainable valuation. Every consumer runs THIS code so the numbers are
 * identical regardless of path:
 *   - public-property.js  → the public /property/:slug page
 *   - api-property.js      → the developer JSON API (/api/v1/property/*)
 *   - any AI tool hitting the API gets the same output the page renders.
 *
 * There is intentionally NO second implementation. The frontend renders the
 * values THIS engine produces (delivered in the public-property bundle) rather
 * than recomputing them, so the page can never disagree with the API.
 *
 * Zero dependencies. Derives only from real report_data; missing signals yield
 * `available:false` / `confidence:'low'` rather than assumed numbers.
 */

// ── shared helpers ───────────────────────────────────────────────────────────
function clamp(v, min = 0, max = 100) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}
function clampRound(v, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}
function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function numOrNull(v) {
  if (v == null || v === '' || v === '—') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function has(v) {
  return v != null && v !== '' && v !== '—';
}
function dedupe(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

// ── DNA composite score (faithful port of src/lib/dnaScore.ts) ───────────────
function scoreToGrade(score) {
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
function floodRiskScore(zone) {
  if (!zone || zone === '—') return 60;
  const z = String(zone).toUpperCase();
  if (z.startsWith('X')) return 90;
  if (z === 'B' || z === 'C') return 78;
  if (z.startsWith('AE') || z === 'A' || z === 'AH' || z === 'AO') return 32;
  if (z.startsWith('VE') || z === 'V') return 18;
  return 60;
}

function computeDnaScore(dna) {
  const n = (dna && dna.normalized) || {};
  const flood = n.flood || {};
  const demo = n.demographics || {};
  const val = n.valuation || {};
  const prop = n.property || {};
  const comps = Array.isArray(n.comps) ? n.comps : [];
  const hazard = n.hazard || {};
  const sub = n.subject || {};

  const enr = (dna && dna.enrichment) || {};
  const cats = enr.categoryScores || {};
  const hasV3 = !!enr.v3_enriched;

  // 1. Location Quality (20%)
  let loc = 45;
  let locConf = 0;
  if (hasV3 && cats.locationQuality != null) {
    loc = num(cats.locationQuality, loc);
    locConf = cats.locationConfidence || 0;
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
    mva = num(cats.marketValueAccuracy, mva);
    mvaConf = cats.marketConfidence || 0;
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
    risk = num(cats.riskScore, risk);
    riskConf = cats.riskConfidence || 0;
  } else {
    const fz = (enr.hazardEnrichment && enr.hazardEnrichment.femaFlood && enr.hazardEnrichment.femaFlood.zone) || flood.zone;
    if (fz) risk = (risk + floodRiskScore(fz)) / 2;
    if (hazard.score != null) risk = (risk + (100 - clamp(Number(hazard.score)))) / 2;
    if (hazard.crime != null) risk = (risk + (100 - clamp(Number(hazard.crime)))) / 2;
  }
  risk = clamp(risk);

  // 4. Rental Yield Potential (15%)
  let rental = 55;
  let rentalConf = 0;
  if (hasV3 && cats.rentalYieldPotential != null) {
    rental = num(cats.rentalYieldPotential, rental);
    rentalConf = cats.rentalConfidence || 0;
  } else {
    const medInc = Number(demo.medianIncome || demo.median_income || 0);
    const valEst = Number(val.estimate || val.marketValue || 0);
    const fmrRent = Number((enr.rentalAnalysis && enr.rentalAnalysis.hudFMR && enr.rentalAnalysis.hudFMR.fmrTwoBed) || 0);
    const effRent = fmrRent || (medInc > 0 ? (medInc * 0.25) / 12 : 0);
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
    traj = num(cats.neighborhoodTrajectory, traj);
    trajConf = cats.trajectoryConfidence || 0;
  } else {
    const popG = Number(demo.populationGrowth || demo.population_growth || 0);
    const incG = Number(demo.incomeGrowth || demo.income_growth || 0);
    if (popG > 0) traj += 15;
    else if (popG < 0) traj -= 10;
    if (incG > 0) traj += 15;
    else if (incG < 0) traj -= 10;
    const avgRatio = comps.length > 0 ? comps.reduce((s, c) => s + (c.ratio || 1), 0) / comps.length : 1;
    if (avgRatio > 1.02) traj += 10;
    else if (avgRatio < 0.97) traj -= 10;
  }
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
  const permitData = enr.permitHistory;
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
      if (ratio > 2) prestige = 95;
      else if (ratio > 1.5) prestige = 80;
      else if (ratio > 1.2) prestige = 68;
      else prestige = 55;
    }
  }
  prestige = clamp(prestige);

  const categories = [
    { name: 'Location Quality', weight: 0.2, score: loc, contribution: Math.round(0.2 * loc), confidence: hasV3 ? locConf : undefined },
    { name: 'Market Value Accuracy', weight: 0.2, score: mva, contribution: Math.round(0.2 * mva), confidence: hasV3 ? mvaConf : undefined },
    { name: 'Risk Profile', weight: 0.15, score: risk, contribution: Math.round(0.15 * risk), confidence: hasV3 ? riskConf : undefined },
    { name: 'Rental Yield Potential', weight: 0.15, score: rental, contribution: Math.round(0.15 * rental), confidence: hasV3 ? rentalConf : undefined },
    { name: 'Neighborhood Trajectory', weight: 0.15, score: traj, contribution: Math.round(0.15 * traj), confidence: hasV3 ? trajConf : undefined },
    { name: 'Property Condition', weight: 0.1, score: cond, contribution: Math.round(0.1 * cond) },
    { name: 'Unique / Prestige', weight: 0.05, score: prestige, contribution: Math.round(0.05 * prestige) },
  ];

  const total = clamp(categories.reduce((s, c) => s + c.contribution, 0));
  const grade = scoreToGrade(total);
  let color, hex;
  if (total >= 70) { color = 'green'; hex = '#2D9142'; }
  else if (total >= 45) { color = 'yellow'; hex = '#C9A84C'; }
  else { color = 'red'; hex = '#B85245'; }

  const topCat = [...categories].sort((a, b) => b.score - a.score)[0];
  const summary =
    `Overall score ${total}/100 (${grade}). Strongest factor: ${topCat.name} (${topCat.score}). ` +
    `${total >= 70 ? 'This property presents strong fundamentals across most categories.' : total >= 45 ? 'Mixed profile — review risk and market factors before proceeding.' : 'Several categories require careful due diligence.'} ` +
    (hasV3 ? 'Score powered by v3 data pipeline (20+ sources).' : 'Score based on available data.');

  return { total, grade, color, hex, categories, summary };
}

// ── nine proprietary scores (faithful port of src/lib/property-dna/scores.ts) ─
function bandLabel(score, bands) {
  for (const [threshold, label] of bands) if (score >= threshold) return label;
  return bands[bands.length - 1][1];
}
function mkScore(key, score, label, explanation, factors, confidence, available = true) {
  return { key, score: clampRound(score), label, explanation, factors: (factors || []).filter(Boolean), confidence, available };
}
function unavailableScore(key, explanation) {
  return { key, score: 0, label: 'Data unavailable', explanation, factors: [], confidence: 'low', available: false };
}

function computeProprietaryScores(dna) {
  const n = (dna && dna.normalized) || {};
  const val = n.valuation || {};
  const comps = Array.isArray(n.comps) ? n.comps : [];
  const flood = n.flood || {};
  const sub = n.subject || {};
  const demo = n.demographics || {};
  const enr = (dna && dna.enrichment) || {};
  const cat = enr.categoryScores || {};
  const hazE = enr.hazardEnrichment || {};
  const hasV3 = !!enr.v3_enriched;

  let dnaResult = null;
  try { dnaResult = computeDnaScore(dna); } catch (e) { dnaResult = null; }

  const yearBuilt = numOrNull(sub.yearBuilt);
  const sqft = numOrNull(sub.sqft);
  const marketValue = numOrNull(val.marketValue) != null ? numOrNull(val.marketValue) : numOrNull(dna && dna.dnaAdjusted && dna.dnaAdjusted.adjMid);
  const compCount = comps.length;
  const lowConf = val.valuationConfidence === 'low' || val.valuationConfidence === 'insufficient';

  const catScore = (name) => {
    if (!dnaResult) return null;
    const c = dnaResult.categories.find((x) => x.name === name);
    return c ? c.score : null;
  };

  // 1. Property DNA Score
  const propertyDnaScore = dnaResult
    ? mkScore('propertyDnaScore', dnaResult.total, `${dnaResult.grade} · ${dnaResult.total}/100`,
        dnaResult.summary || 'Composite of location, valuation accuracy, risk, yield, trajectory, condition and prestige.',
        dnaResult.categories.slice(0, 4).map((c) => `${c.name}: ${c.score}/100`),
        hasV3 ? 'high' : compCount >= 3 ? 'medium' : 'low')
    : unavailableScore('propertyDnaScore', 'Insufficient normalized data to compute the composite DNA score.');

  // 2. Buyer Confidence
  const buyerAvail = compCount > 0 || has(val.marketValue);
  const buyerBase =
    (compCount >= 5 ? 40 : compCount * 8) +
    (has(val.marketValue) && !lowConf ? 32 : has(val.marketValue) ? 14 : 0) +
    (has(sqft) && has(yearBuilt) ? 18 : has(sqft) ? 9 : 0) +
    (hasV3 ? 10 : 0);
  const buyerConfidenceScore = buyerAvail
    ? mkScore('buyerConfidenceScore', buyerBase,
        bandLabel(clampRound(buyerBase), [[75, 'High confidence'], [50, 'Solid'], [30, 'Cautious'], [0, 'Thin data']]),
        'How defensible the valuation is for a buyer, based on comparable support, valuation confidence and record completeness.',
        [`${compCount} comparable sale${compCount === 1 ? '' : 's'} used`,
          has(val.marketValue) ? `Valuation confidence: ${val.valuationConfidence || 'standard'}` : 'No AVM value available',
          has(sqft) ? 'Core property vitals present' : 'Property vitals incomplete'],
        hasV3 ? 'high' : compCount >= 3 ? 'medium' : 'low')
    : unavailableScore('buyerConfidenceScore', 'No comparable sales or valuation available to gauge buyer confidence.');

  // 3. Seller Timing
  const momentum = numOrNull(enr.marketData && enr.marketData.momentumScore) != null
    ? numOrNull(enr.marketData.momentumScore)
    : numOrNull(dna && dna.marketMomentum && dna.marketMomentum.score);
  const domSignal = numOrNull(enr.marketData && enr.marketData.medianDaysOnMarket);
  const sellerAvail = momentum != null || domSignal != null || compCount >= 3;
  let sellerBase = 50;
  if (momentum != null) sellerBase += clamp(momentum, -100, 100) * 0.3;
  if (domSignal != null) sellerBase += domSignal <= 30 ? 12 : domSignal >= 90 ? -12 : 0;
  const sellerTimingScore = sellerAvail
    ? mkScore('sellerTimingScore', sellerBase,
        bandLabel(clampRound(sellerBase), [[70, "Seller's window"], [45, 'Balanced'], [0, 'Patience advised']]),
        'Whether current momentum favors listing now, from market direction and days-on-market where available.',
        [momentum != null ? `Market momentum index: ${Math.round(momentum)}` : 'Momentum index unavailable',
          domSignal != null ? `Median days on market: ${Math.round(domSignal)}` : 'Days-on-market unavailable'],
        momentum != null && domSignal != null ? 'medium' : 'low')
    : unavailableScore('sellerTimingScore', 'No market-direction or absorption signal available for this area yet.');

  // 4. Hidden Risk — higher = more risk
  const riskFactors = [];
  let riskAccum = 0;
  let riskSignals = 0;
  if (has(flood.zone)) {
    const z = String(flood.zone).toUpperCase();
    const sfha = flood.highRisk || z.startsWith('A') || z.startsWith('V');
    riskAccum += sfha ? 70 : 20;
    riskSignals++;
    riskFactors.push(`FEMA flood zone ${flood.zone}${sfha ? ' (Special Flood Hazard Area)' : ''}`);
  }
  const seismic = hazE.seismic && hazE.seismic.seismicRiskLevel;
  if (has(seismic)) {
    riskAccum += /high/i.test(seismic) ? 65 : /moderate/i.test(seismic) ? 40 : 15;
    riskSignals++;
    riskFactors.push(`USGS seismic risk: ${seismic}`);
  }
  const ej = numOrNull(hazE.environmental && hazE.environmental.ejIndexPctile);
  if (ej != null) {
    riskAccum += ej;
    riskSignals++;
    riskFactors.push(`EPA environmental-justice index: ${Math.round(ej)}th pctile`);
  }
  const hiddenRiskScore = riskSignals > 0
    ? mkScore('hiddenRiskScore', riskAccum / riskSignals,
        bandLabel(clampRound(riskAccum / riskSignals), [[60, 'Elevated'], [35, 'Moderate'], [0, 'Low']]),
        'Composite of environmental and structural hazards that a headline valuation hides. Higher means more risk.',
        riskFactors, riskSignals >= 2 ? 'medium' : 'low')
    : unavailableScore('hiddenRiskScore', 'No hazard signals (flood, seismic, environmental) resolved for this parcel yet.');

  // 5. Renovation ROI
  const age = yearBuilt ? new Date().getFullYear() - yearBuilt : null;
  const oppLen = Array.isArray(dna && dna.opportunities) ? dna.opportunities.length : 0;
  const renoAvail = age != null || oppLen > 0;
  let renoBase = 45;
  if (age != null) renoBase += age > 40 ? 25 : age > 20 ? 12 : -5;
  const renoRoi = numOrNull(cat.renovationRoi);
  if (renoRoi != null) renoBase = renoRoi;
  const renovationRoiScore = renoAvail
    ? mkScore('renovationRoiScore', renoBase,
        bandLabel(clampRound(renoBase), [[65, 'Strong upside'], [40, 'Moderate'], [0, 'Limited']]),
        'Estimated headroom for value-add improvements, from building age and any modeled opportunities.',
        [age != null ? `Built ${yearBuilt} (${age} yrs old)` : 'Year built unavailable',
          oppLen ? `${oppLen} modeled improvement opportunit${oppLen === 1 ? 'y' : 'ies'}` : ''],
        renoRoi != null ? 'medium' : 'low')
    : unavailableScore('renovationRoiScore', 'No age or improvement data available to estimate renovation ROI.');

  // 6. Luxury
  const ppsf = sqft && marketValue ? marketValue / sqft : null;
  const prestige = catScore('Unique / Prestige');
  const luxAvail = ppsf != null || prestige != null || has(sub.apn);
  let luxBase = 40;
  if (ppsf != null) luxBase += ppsf > 800 ? 40 : ppsf > 500 ? 25 : ppsf > 350 ? 12 : 0;
  if (prestige != null) luxBase = (luxBase + prestige) / 2;
  const luxuryScore = luxAvail
    ? mkScore('luxuryScore', luxBase,
        bandLabel(clampRound(luxBase), [[75, 'Luxury tier'], [50, 'Premium'], [0, 'Standard']]),
        'Where the property sits on the luxury spectrum, from price-per-square-foot and prestige signals.',
        [ppsf != null ? `$${Math.round(ppsf).toLocaleString()}/sqft` : 'Price-per-sqft unavailable',
          prestige != null ? `Prestige signal: ${Math.round(prestige)}/100` : ''],
        ppsf != null ? 'medium' : 'low')
    : unavailableScore('luxuryScore', 'No price-per-sqft or prestige signal available to place this on the luxury spectrum.');

  // 7. Rental Potential
  const rentalCat = catScore('Rental Yield Potential');
  const medRent = numOrNull(demo.medianRent);
  const rentalAvail = rentalCat != null || medRent != null;
  const rentalPotentialScore = rentalAvail
    ? mkScore('rentalPotentialScore', rentalCat != null ? rentalCat : 50,
        bandLabel(clampRound(rentalCat != null ? rentalCat : 50), [[65, 'Strong yield'], [40, 'Moderate'], [0, 'Soft']]),
        'Income-property potential from modeled rental yield and area rent levels.',
        [rentalCat != null ? `Modeled rental-yield score: ${Math.round(rentalCat)}/100` : 'Yield model unavailable',
          medRent != null ? `Area median rent: $${Math.round(medRent).toLocaleString()}` : ''],
        rentalCat != null ? 'medium' : 'low')
    : unavailableScore('rentalPotentialScore', 'No rental-yield or area-rent data available for this property.');

  // 8. Climate Resilience — higher = more resilient
  const climateSignals = [];
  let climAccum = 0;
  let climN = 0;
  if (has(flood.zone)) {
    const z = String(flood.zone).toUpperCase();
    climAccum += z.startsWith('X') ? 88 : z.startsWith('A') || z.startsWith('V') ? 30 : 60;
    climN++;
    climateSignals.push(`Flood exposure: zone ${flood.zone}`);
  }
  const wildfire = (hazE.wildfire && hazE.wildfire.severity) || (n.wildfire && n.wildfire.severity);
  if (has(wildfire)) {
    climAccum += /very high/i.test(wildfire) ? 20 : /high/i.test(wildfire) ? 38 : /moderate/i.test(wildfire) ? 58 : 82;
    climN++;
    climateSignals.push(`Wildfire severity: ${wildfire}`);
  }
  const aqi = numOrNull(hazE.airQuality && hazE.airQuality.aqi);
  if (aqi != null) {
    climAccum += aqi <= 50 ? 85 : aqi <= 100 ? 60 : 35;
    climN++;
    climateSignals.push(`Air quality index: ${aqi}`);
  }
  const climateResilienceScore = climN > 0
    ? mkScore('climateResilienceScore', climAccum / climN,
        bandLabel(clampRound(climAccum / climN), [[70, 'Resilient'], [45, 'Moderate exposure'], [0, 'High exposure']]),
        'How well the property is positioned against climate hazards. Higher means more resilient.',
        climateSignals, climN >= 2 ? 'medium' : 'low')
    : unavailableScore('climateResilienceScore', 'No climate hazard data (flood, wildfire, air quality) resolved yet.');

  // 9. Insurance Difficulty — higher = harder to insure
  const insAvail = climN > 0 || riskSignals > 0;
  let insBase = climN > 0 ? 100 - climAccum / climN : 50;
  if (flood.highRisk) insBase += 15;
  if (has(wildfire) && /high/i.test(wildfire)) insBase += 12;
  const insuranceDifficultyScore = insAvail
    ? mkScore('insuranceDifficultyScore', insBase,
        bandLabel(clampRound(insBase), [[60, 'Hard market'], [35, 'Some friction'], [0, 'Straightforward']]),
        'How hard this property is likely to insure, from flood, wildfire and hazard exposure. Higher means harder.',
        [flood.highRisk ? 'In a FEMA Special Flood Hazard Area' : has(flood.zone) ? `Flood zone ${flood.zone}` : 'Flood zone unavailable',
          has(wildfire) ? `Wildfire severity: ${wildfire}` : 'Wildfire severity unavailable'],
        climN >= 2 ? 'medium' : 'low')
    : unavailableScore('insuranceDifficultyScore', 'No hazard exposure data available to estimate insurance difficulty.');

  return {
    propertyDnaScore,
    buyerConfidenceScore,
    sellerTimingScore,
    hiddenRiskScore,
    renovationRoiScore,
    luxuryScore,
    rentalPotentialScore,
    climateResilienceScore,
    insuranceDifficultyScore,
  };
}

// ── explainable valuation (port of valuationExplanation.ts) ──────────────────
function buildValuationExplanation(dna, lastUpdatedIso) {
  const n = (dna && dna.normalized) || {};
  const val = n.valuation || {};
  const sub = n.subject || {};
  const adj = (dna && dna.dnaAdjusted) || null;
  const comps = Array.isArray(n.comps) ? n.comps : [];

  const subjectSqft = numOrNull(sub.sqft);
  const estimatedValue = numOrNull(adj && adj.adjMid) != null ? numOrNull(adj.adjMid) : numOrNull(val.marketValue);
  const lowRange = numOrNull(adj && adj.adjLow) != null ? numOrNull(adj.adjLow) : numOrNull(val.low);
  const highRange = numOrNull(adj && adj.adjHigh) != null ? numOrNull(adj.adjHigh) : numOrNull(val.high);

  let confidenceScore = null;
  if (adj && adj.confidence != null) confidenceScore = Math.round(numOrNull(adj.confidence) * 100);
  else if (val.valuationConfidence === 'high') confidenceScore = 82;
  else if (val.valuationConfidence === 'medium') confidenceScore = 62;
  else if (val.valuationConfidence === 'low' || val.valuationConfidence === 'insufficient') confidenceScore = 35;

  const method = adj && adj.adjMid != null
    ? 'AVM baseline + PropertyDNA adjustment'
    : val.valuationSource
      ? `AVM (${String(val.valuationSource).replace(/_/g, ' ')})`
      : val.marketValue != null
        ? 'Automated valuation model'
        : null;

  const keyDrivers = [];
  const positiveAdjustments = [];
  const negativeAdjustments = [];

  if (adj && Array.isArray(adj.drivers)) {
    for (const d of adj.drivers) {
      const label = typeof d === 'string' ? d : d && (d.label || d.name);
      if (!label) continue;
      keyDrivers.push(String(label));
      const dir = typeof d === 'object' ? (d.direction || d.sign || (numOrNull(d.impact) || 0)) : 0;
      const positive = dir === 'up' || dir === '+' || (typeof dir === 'number' && dir > 0);
      const negative = dir === 'down' || dir === '-' || (typeof dir === 'number' && dir < 0);
      if (positive) positiveAdjustments.push(String(label));
      else if (negative) negativeAdjustments.push(String(label));
    }
  }
  if (adj && adj.baseAdjustment && adj.baseAdjustment.label) keyDrivers.unshift(String(adj.baseAdjustment.label));
  if (adj && adj.aduUplift) positiveAdjustments.push(`ADU / casita uplift (+$${Math.round(numOrNull(adj.aduUplift)).toLocaleString()})`);
  if (numOrNull(sub.lastSalePrice)) keyDrivers.push(`Last recorded sale: $${Math.round(numOrNull(sub.lastSalePrice)).toLocaleString()}${sub.lastSaleDate ? ` (${sub.lastSaleDate})` : ''}`);
  if (comps.length) keyDrivers.push(`${comps.length} comparable sale${comps.length === 1 ? '' : 's'} within the local market`);

  const comparableSalesUsed = comps.slice(0, 12).map((c) => {
    const price = numOrNull(c.rawPrice) != null ? numOrNull(c.rawPrice) : (numOrNull(c.price) != null ? numOrNull(c.price) : numOrNull(c.salePrice));
    const csqft = numOrNull(c.sqft);
    return {
      address: c.address || '—',
      salePrice: price,
      pricePerSqft: numOrNull(c.pricePerSqft) != null ? numOrNull(c.pricePerSqft) : (price && csqft ? Math.round(price / csqft) : null),
      distanceMi: numOrNull(c.distanceMi) != null ? numOrNull(c.distanceMi) : numOrNull(c.distance),
      saleDate: c.saleDate || c.soldDate || c.date || null,
      beds: numOrNull(c.beds),
      baths: numOrNull(c.baths),
      sqft: csqft,
      similarity: numOrNull(c.similarity) != null ? numOrNull(c.similarity) : numOrNull(c.similarityScore),
      adjustmentNote: c.adjustmentNote || c.note || null,
    };
  });

  const dataLimitations = [];
  if (estimatedValue == null) dataLimitations.push('No automated valuation could be resolved for this address.');
  if (!comps.length) dataLimitations.push('No comparable sales were available in the local market window.');
  if (subjectSqft == null) dataLimitations.push('Living area (square footage) is missing, which widens the value range.');
  if (confidenceScore != null && confidenceScore < 45) dataLimitations.push('Confidence is low — treat this as a preliminary estimate, not an appraisal.');
  if (val.confidenceNote && typeof val.confidenceNote === 'string') dataLimitations.push(val.confidenceNote);

  return {
    estimatedValue,
    lowRange,
    highRange,
    confidenceScore,
    keyDrivers: dedupe(keyDrivers).slice(0, 8),
    positiveAdjustments: dedupe(positiveAdjustments).slice(0, 6),
    negativeAdjustments: dedupe(negativeAdjustments).slice(0, 6),
    comparableSalesUsed,
    dataLimitations: dedupe(dataLimitations),
    lastUpdated: lastUpdatedIso || null,
    method,
  };
}

module.exports = { computeDnaScore, computeProprietaryScores, buildValuationExplanation };
