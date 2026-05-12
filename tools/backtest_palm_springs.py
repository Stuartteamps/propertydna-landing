#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Back-test PropertyDNA valuation accuracy against actual sold prices.

Strategy: Use comps from existing completed reports as the test set.
Each comp is a real recent sale with full property attributes.

For each comp (test property):
  1. Find the 4 OTHER comps in the same report as "comps for this property"
  2. Use them to simulate the AVM (average price by correlation)
  3. Run our adjustment pipeline (sale anchor, comp anchor, features)
  4. Compare DNA-adjusted mid to the actual sold price (the comp's price)
  5. Compute error

Then iterate on weights to minimize average error.
"""
import sys, json, math, requests, statistics, datetime, re

SUPA_URL = "https://neccpdfhmfnvyjgyrysy.supabase.co"
SUPA_KEY = "sb_publishable_KTTgVO3mROxubE_A9OQ7Kg_aRrnzPVT"
HEADERS = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"}

# ---------- Port of save-report.js adjustment logic ----------

def months_between(date_str):
    if not date_str:
        return None
    try:
        d = datetime.datetime.fromisoformat(date_str.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None
    return max(0, (datetime.datetime.now() - d).days / 30.44)

def parse_num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r"[^0-9.]", "", str(v))
    try:
        return float(s) if s else None
    except Exception:
        return None

def compute_smart_base(avm_mid, last_sale_price=None, last_sale_date=None,
                      annual_rate=0.048, sale_weights=None):
    """Sale-anchored base. Returns (smart_mid, label_or_None)."""
    if not avm_mid or not last_sale_price or not last_sale_date:
        return avm_mid, None
    months = months_between(last_sale_date)
    if months is None or months >= 42:
        return avm_mid, None
    years_frac = months / 12.0
    appreciated = round(last_sale_price * ((1 + annual_rate) ** years_frac))
    gap = (avm_mid - appreciated) / appreciated  # negative if AVM low
    sw = sale_weights or {12: 0.85, 24: 0.80, 36: 0.70, 999: 0.60}
    sale_weight = sw[12] if months < 12 else sw[24] if months < 24 else sw[36] if months < 36 else sw[999]
    avm_weight = 1 - sale_weight
    if gap < -0.10:
        blend = round(appreciated * sale_weight + avm_mid * avm_weight)
        return blend, f"sale_anchor_override sw={sale_weight}"
    elif gap < 0:
        blend = round(avm_mid * 0.70 + appreciated * 0.30)
        return blend, f"sale_anchor_soft"
    return avm_mid, None

def compute_comp_anchor(avm_mid, comps, dist_max=0.30, corr_min=95,
                       max_weight=0.45, base_weight=0.30, per_comp_weight=0.05,
                       psf_filter=True):
    """Closest high-correlation comp anchor with non-arms-length filter."""
    if not avm_mid or not comps:
        return avm_mid, None
    enriched = []
    for c in comps:
        price = parse_num(c.get("rawPrice") or c.get("price"))
        dist  = parse_num(c.get("distance"))
        corr  = parse_num(c.get("correlation"))
        sqft  = parse_num(c.get("sqft"))
        if corr is not None and corr <= 1:
            corr *= 100
        if price and price > 50000:
            psf = price / sqft if sqft and sqft > 0 else None
            enriched.append({"price": price, "dist": dist, "corr": corr, "psf": psf})

    # Filter non-arms-length: PSF must be within 0.5x-2.0x median PSF of cohort
    if psf_filter and enriched:
        psfs = [c["psf"] for c in enriched if c["psf"]]
        if len(psfs) >= 3:
            psfs.sort()
            median_psf = psfs[len(psfs) // 2]
            enriched = [c for c in enriched if not c["psf"] or 0.5 * median_psf <= c["psf"] <= 2.0 * median_psf]

    # Tier 1: tight filter
    qual = [c for c in enriched if c["dist"] is not None and c["dist"] <= dist_max
            and c["corr"] is not None and c["corr"] >= corr_min]
    if len(qual) < 2:
        # Tier 2: top 3 by correlation
        qual = sorted([c for c in enriched if c["corr"] is not None and c["corr"] >= 90],
                      key=lambda x: -x["corr"])[:3]
    if len(qual) < 2:
        return avm_mid, None

    avg = round(sum(c["price"] for c in qual) / len(qual))
    gap = (avg - avm_mid) / avm_mid
    if gap < 0.10:
        return avm_mid, None
    weight = min(max_weight, base_weight + len(qual) * per_comp_weight)
    blend = round(avm_mid * (1 - weight) + avg * weight)
    return blend, f"comp_anchor n={len(qual)} w={weight:.2f}"

DNA_PCT = {
    "waterfront": 12, "lakefront": 10, "golf_course": 5, "mountain_view": 4,
    "premium_community": 6, "fully_remodeled": 8, "updated": 4,
    "original_condition": -5, "pool": 4, "no_pool_desert_penalty": -2,
    "corner_lot": 0, "oversized_lot": 5, "gated_community": 4,
    "short_term_rental_friendly": 6,
}
LUXURY_PREMIUM = 4

def apply_pct_adjustments(mid, features, luxury=False, weights=None):
    weights = weights or DNA_PCT
    total = 0
    for k, active in features.items():
        if active and k in weights:
            total += weights[k]
    if luxury:
        total += LUXURY_PREMIUM
    total = max(-40, min(40, total))
    return round(mid * (1 + total / 100))

def apply_uplifts(mid, adu_sqft=None, pool_cost=None, reno_cost=None, reno_year=None, luxury=False):
    out = mid
    if adu_sqft and adu_sqft > 100:
        ppsf = 300 if luxury else 220
        out += min(min(adu_sqft, 1200) * ppsf, 450000)
    if pool_cost and pool_cost > 10000:
        rate = 0.65 if luxury else 0.55
        out += round(min(pool_cost, 250000) * rate)
    if reno_cost and reno_cost > 5000:
        years_ago = max(0, datetime.datetime.now().year - (reno_year or datetime.datetime.now().year))
        rate = 0.80 if years_ago < 2 else 0.70 if years_ago < 5 else 0.55
        out += round(min(reno_cost, 500000) * rate)
    return out

def run_pipeline(avm_mid, last_sale_price=None, last_sale_date=None,
                 comps=None, features=None, adu_sqft=None, pool_cost=None,
                 weights=None):
    """Apply the full PropertyDNA adjustment pipeline."""
    features = features or {}
    mid = avm_mid
    smart_mid, sale_label = compute_smart_base(mid, last_sale_price, last_sale_date,
                                                annual_rate=(weights or {}).get("annual_rate", 0.048))
    mid = smart_mid
    comp_mid, comp_label = compute_comp_anchor(mid, comps or [],
                                                dist_max=(weights or {}).get("dist_max", 0.30),
                                                corr_min=(weights or {}).get("corr_min", 95),
                                                max_weight=(weights or {}).get("comp_max_w", 0.45),
                                                base_weight=(weights or {}).get("comp_base_w", 0.30),
                                                per_comp_weight=(weights or {}).get("comp_per_w", 0.05))
    if comp_mid > mid:
        mid = comp_mid
    luxury = mid >= 1500000
    mid = apply_pct_adjustments(mid, features, luxury, weights=weights and weights.get("pct"))
    mid = apply_uplifts(mid, adu_sqft, pool_cost, luxury=luxury)
    return mid, {"sale_anchor": sale_label, "comp_anchor": comp_label, "luxury": luxury}

# ---------- Load test data ----------

def load_reports():
    r = requests.get(
        f"{SUPA_URL}/rest/v1/property_reports",
        headers=HEADERS,
        params={
            "select": "report_data,address,city,created_at",
            "status": "eq.completed",
            "order": "created_at.desc",
            "limit": 200,
        },
        timeout=30,
    )
    return r.json() or []

def build_test_set(reports):
    """For each report, treat each comp as a test property.
    Test property's actual price = comp's sold price (ground truth).
    AVM proxy = average of OTHER comps (price-per-sqft filtered).

    Deduplicate by comp address (same comp appears in multiple reports).
    Filter non-arms-length sales: PSF must be within 0.5x-2.0x cohort median.
    """
    seen_addresses = set()
    test_set = []
    for rep in reports:
        rd = rep.get("report_data") or {}
        norm = rd.get("normalized") or {}
        comps = norm.get("comps") or []
        if len(comps) < 3:
            continue

        # Compute cohort median price-per-sqft (for non-arms-length detection)
        cohort_psfs = []
        for c in comps:
            p = parse_num(c.get("rawPrice") or c.get("price"))
            s = parse_num(c.get("sqft"))
            if p and s and s > 500:
                cohort_psfs.append(p / s)
        cohort_psfs.sort()
        median_psf = cohort_psfs[len(cohort_psfs) // 2] if cohort_psfs else None

        for i, target in enumerate(comps):
            price = parse_num(target.get("rawPrice") or target.get("price"))
            sqft = parse_num(target.get("sqft"))
            if not price or price < 200000:
                continue
            if not sqft or sqft < 500:
                continue
            target_psf = price / sqft
            # Skip non-arms-length: PSF outside 0.5x-2.0x of cohort median
            if median_psf and (target_psf < 0.5 * median_psf or target_psf > 2.0 * median_psf):
                continue
            # Dedupe by address
            addr = target.get("address", "").strip().lower()
            if not addr or addr in seen_addresses:
                continue
            seen_addresses.add(addr)

            others = [c for j, c in enumerate(comps) if j != i]
            # Filter others by PSF too
            clean_others = []
            for c in others:
                p = parse_num(c.get("rawPrice") or c.get("price"))
                s = parse_num(c.get("sqft"))
                if p and s and median_psf and 0.5 * median_psf <= p / s <= 2.0 * median_psf:
                    clean_others.append(c)
            if len(clean_others) < 2:
                continue

            other_prices = [parse_num(c.get("rawPrice") or c.get("price")) for c in clean_others]
            other_prices = [p for p in other_prices if p]
            avm_proxy = round(statistics.mean(other_prices))

            city = (norm.get("subject") or {}).get("city") or rep.get("city", "")
            test_set.append({
                "address": target.get("address", ""),
                "city": city,
                "actual_price": int(price),
                "avm_proxy": avm_proxy,
                "comps_for_pipeline": clean_others,
                "sqft": sqft,
                "psf": target_psf,
                "cohort_psf": median_psf,
            })
    return test_set

def evaluate(test_set, weights=None, verbose=False):
    errors = []
    pct_errors = []
    within_3 = within_5 = within_10 = 0
    for t in test_set:
        actual = t["actual_price"]
        adjusted, debug = run_pipeline(
            avm_mid=t["avm_proxy"],
            comps=t["comps_for_pipeline"],
            weights=weights,
        )
        err = adjusted - actual
        pct = abs(err) / actual * 100
        errors.append(err)
        pct_errors.append(pct)
        if pct <= 3: within_3 += 1
        if pct <= 5: within_5 += 1
        if pct <= 10: within_10 += 1
        if verbose and pct > 15:
            print(f"  off {pct:.1f}%: actual=${actual:,} adjusted=${adjusted:,} proxy=${t['avm_proxy']:,} {t['address'][:50]}")
    n = len(test_set)
    if n == 0:
        return None
    return {
        "n": n,
        "mape": statistics.mean(pct_errors),
        "median_pct": statistics.median(pct_errors),
        "within_3": within_3 / n * 100,
        "within_5": within_5 / n * 100,
        "within_10": within_10 / n * 100,
        "mean_err": statistics.mean(errors),
    }

def main():
    print("Loading completed reports...")
    reports = load_reports()
    print(f"  loaded: {len(reports)} reports")
    if not reports:
        print("No reports to test against."); sys.exit(1)

    test_set = build_test_set(reports)
    print(f"Built test set: {len(test_set)} sold properties (comps from reports)")

    # By city
    from collections import Counter
    city_dist = Counter(t["city"] for t in test_set)
    print("By subject city:")
    for c, n in city_dist.most_common(10):
        print(f"  {n:>4} | {c}")

    # Filter to Palm Springs first (priority per user)
    ps_set = [t for t in test_set if "palm springs" in (t["city"] or "").lower()]
    print(f"\nPalm Springs test set: {len(ps_set)} properties")

    if not ps_set:
        print("No Palm Springs test data."); sys.exit(1)

    print("\n=== Baseline (current production weights) ===")
    baseline = evaluate(ps_set, verbose=True)
    if baseline:
        print(f"  n={baseline['n']}  MAPE={baseline['mape']:.2f}%  median_err={baseline['median_pct']:.2f}%")
        print(f"  within 3%: {baseline['within_3']:.1f}%  | within 5%: {baseline['within_5']:.1f}%  | within 10%: {baseline['within_10']:.1f}%")
        print(f"  mean signed error: ${baseline['mean_err']:+,.0f}")

    # ---------- Grid search for calibrated weights ----------
    print("\n=== Grid search ===")
    best = None
    grid = []
    for annual_rate in [0.04, 0.048, 0.06, 0.075]:
        for comp_max_w in [0.35, 0.45, 0.55, 0.65]:
            for comp_base_w in [0.20, 0.30, 0.40]:
                for dist_max in [0.25, 0.30, 0.40]:
                    for corr_min in [90, 95]:
                        w = {
                            "annual_rate": annual_rate,
                            "comp_max_w": comp_max_w,
                            "comp_base_w": comp_base_w,
                            "comp_per_w": 0.05,
                            "dist_max": dist_max,
                            "corr_min": corr_min,
                        }
                        result = evaluate(ps_set, weights=w)
                        if not result: continue
                        # objective: maximize within_5 while keeping MAPE low
                        score = result["within_5"] - result["mape"] * 0.5
                        grid.append((score, w, result))
                        if not best or score > best[0]:
                            best = (score, w, result)
    grid.sort(key=lambda x: -x[0])
    print(f"\nTop 5 weight configurations (by score):")
    for score, w, r in grid[:5]:
        print(f"  score={score:.2f} MAPE={r['mape']:.2f}% w3={r['within_3']:.1f}% w5={r['within_5']:.1f}% w10={r['within_10']:.1f}% | {w}")

    if best:
        score, w, r = best
        print(f"\n=== Recommended weights ===")
        print(json.dumps(w, indent=2))
        print(f"\nProjected: MAPE={r['mape']:.2f}%, within 3%={r['within_3']:.1f}%, within 5%={r['within_5']:.1f}%, within 10%={r['within_10']:.1f}%")

if __name__ == "__main__":
    main()
