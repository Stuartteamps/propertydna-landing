#!/usr/bin/env python3
"""
tier-neighborhood-backtest.py — accuracy broken down by PRICE TIER x NEIGHBORHOOD.

Same proven comp engine as luxury-comp-model.py (leave-one-out, same-city comps,
kNN on sqft, median $/sqft), but reports MdAPE per (neighborhood x tier) cell so
we can dial the algorithm in for each bracket and each community separately — the
path from ~13% toward the 97% (<=3% MdAPE) target.

Usage: python3 tier-neighborhood-backtest.py [solds.csv] [--k 8] [--mincell 5]
"""
import sys, csv, math, statistics, os
from collections import defaultdict

args = sys.argv[1:]
csv_path = next((a for a in args if not a.startswith("--")),
                os.path.join(os.path.dirname(__file__), "solds-from-cma.csv"))
def opt(name, d):
    for a in args:
        if a == f"--{name}":
            i = args.index(a)
            return type(d)(args[i+1]) if i+1 < len(args) else d
        if a.startswith(f"--{name}="):
            return type(d)(a.split("=", 1)[1])
    return d
K = int(opt("k", 8))
MINCELL = int(opt("mincell", 5))

TIERS = [("under_1M", 0, 1_000_000), ("1M_2M", 1_000_000, 2_000_000),
         ("2M_5M", 2_000_000, 5_000_000), ("5M_plus", 5_000_000, 10**12)]
def tier_of(sp):
    for name, lo, hi in TIERS:
        if lo <= sp < hi:
            return name
    return "5M_plus"

def norm_city(c):
    c = (c or "").strip()
    if c.lower().startswith("via "):
        c = c[4:]
    return c.title()

rows = []
for r in csv.DictReader(open(csv_path)):
    try:
        sp = int(r["actual_price"]); sf = int(r["sqft"])
    except (ValueError, KeyError):
        continue
    if sp > 0 and sf > 500:
        rows.append({"sp": sp, "sqft": sf, "city": norm_city(r["city"]),
                     "psf": sp / sf, "addr": r.get("address", ""),
                     "tier": tier_of(sp)})

def predict(subj, pool):
    same = [c for c in pool if c["city"] == subj["city"] and c is not subj]
    cand = same if len(same) >= 4 else [c for c in pool if c is not subj]
    cand = sorted(cand, key=lambda c: abs(math.log(c["sqft"]) - math.log(subj["sqft"])))[:K]
    return statistics.median(c["psf"] for c in cand) * subj["sqft"] if cand else None

# Score every sold (leave-one-out)
for subj in rows:
    pred = predict(subj, rows)
    subj["ape"] = abs((pred - subj["sp"]) / subj["sp"]) if pred else None
    subj["signed"] = (pred - subj["sp"]) / subj["sp"] if pred else None

def stats(group):
    apes = [g["ape"] for g in group if g["ape"] is not None]
    if not apes:
        return None
    md = statistics.median(apes)
    sg = statistics.median([g["signed"] for g in group if g["signed"] is not None])
    w10 = sum(1 for a in apes if a <= .10) / len(apes)
    return {"n": len(apes), "mdape": md, "bias": sg, "w10": w10}

def fmt(s):
    if not s:
        return "    (no data)"
    flag = "OK " if s["mdape"] <= 0.03 else ("..." if s["mdape"] <= 0.10 else "!! ")
    return f"n={s['n']:>3} MdAPE {s['mdape']*100:5.1f}%  w10 {s['w10']*100:3.0f}%  bias {s['bias']*100:+5.1f}%  {flag}"

print(f"\n{'='*78}\n  PropertyDNA accuracy — {len(rows)} solds — by TIER x NEIGHBORHOOD (k={K}, target MdAPE <=3%)\n{'='*78}")

# Overall per tier
print("\n  ── BY PRICE TIER (all neighborhoods) ──")
for name, _, _ in TIERS:
    print(f"   {name:<10} {fmt(stats([r for r in rows if r['tier']==name]))}")

# Overall per neighborhood
print("\n  ── BY NEIGHBORHOOD (all tiers) ──")
cities = sorted({r["city"] for r in rows})
city_stats = [(c, stats([r for r in rows if r["city"] == c])) for c in cities]
for c, s in sorted([cs for cs in city_stats if cs[1]], key=lambda x: -x[1]["n"]):
    if s["n"] >= MINCELL:
        print(f"   {c:<18} {fmt(s)}")

# Matrix: neighborhood x tier
print(f"\n  ── MATRIX: NEIGHBORHOOD x TIER (cells with n>={MINCELL}) ──")
hdr = "   " + f"{'neighborhood':<18}" + "".join(f"{t:>16}" for t, _, _ in TIERS)
print(hdr)
for c, s in sorted([cs for cs in city_stats if cs[1]], key=lambda x: -x[1]["n"]):
    if s["n"] < MINCELL:
        continue
    cells = []
    for tname, _, _ in TIERS:
        cs = stats([r for r in rows if r["city"] == c and r["tier"] == tname])
        cells.append(f"{cs['mdape']*100:>6.0f}%({cs['n']})" if cs and cs["n"] >= MINCELL else "       -")
    print(f"   {c:<18}" + "".join(f"{cell:>16}" for cell in cells))

ov = stats(rows)
print(f"\n  OVERALL  {fmt(ov)}  DEFENSIBLE {max(0, round((1-ov['mdape'])*100))}%\n")
