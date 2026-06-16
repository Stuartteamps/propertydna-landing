#!/usr/bin/env python3
"""
luxury-comp-model.py — a comp-based valuation for the luxury tier, where AVMs
(RentCast) break down because there are no algorithmic comps for trophy homes.

Idea: value each luxury home directly from REAL comparable sales. For a subject,
take same-micro-market solds, pick the nearest-by-size comps (kNN on sqft, since
$/sqft falls as size rises in luxury), and apply their median $/sqft to the
subject. Leave-one-out scored against actual sold price.

This is the model; the data is the CMA solds Dan feeds. Baseline to beat:
RentCast on this tier ~33–43% median error.

Usage: python3 luxury-comp-model.py [solds.csv] [--floor 2000000] [--k 8]
"""
import sys, csv, math, statistics, os

args = sys.argv[1:]
csv_path = next((a for a in args if not a.startswith("--")), os.path.join(os.path.dirname(__file__), "solds-from-cma.csv"))
def opt(name, default):
    for a in args:
        if a.startswith(f"--{name}"):
            return type(default)(a.split("=")[1]) if "=" in a else (args[args.index(a)+1] if args.index(a)+1 < len(args) else default)
    return default
FLOOR = int(opt("floor", 2_000_000))
K = int(opt("k", 8))

def norm_city(c):
    c = (c or "").strip()
    if c.lower().startswith("via "):   # parser artifact: 'Via La Quinta' -> 'La Quinta'
        c = c[4:]
    return c.lower()

rows = []
for r in csv.DictReader(open(csv_path)):
    try:
        sp = int(r["actual_price"]); sf = int(r["sqft"])
    except (ValueError, KeyError):
        continue
    if sp >= FLOOR and sf > 500:
        rows.append({"sp": sp, "sqft": sf, "city": norm_city(r["city"]),
                     "psf": sp / sf, "addr": r.get("address", ""),
                     "year": r.get("year_built", ""), "psg": r.get("pool_spa_gated", "")})

print(f"\n  Luxury comp model — {len(rows)} solds ≥ ${FLOOR:,}  (kNN on sqft, k={K}, leave-one-out)\n")

def predict(subj, pool):
    # same micro-market first; fall back to all if too thin
    same = [c for c in pool if c["city"] == subj["city"] and c is not subj]
    cand = same if len(same) >= 4 else [c for c in pool if c is not subj]
    # nearest by size (log-sqft distance), take K
    cand = sorted(cand, key=lambda c: abs(math.log(c["sqft"]) - math.log(subj["sqft"])))[:K]
    if not cand:
        return None
    return statistics.median(c["psf"] for c in cand) * subj["sqft"]

apes, signed, detail = [], [], []
for subj in rows:
    pred = predict(subj, rows)
    if not pred:
        continue
    s = (pred - subj["sp"]) / subj["sp"]
    apes.append(abs(s)); signed.append(s)
    detail.append((subj, pred, s))

apes_sorted = sorted(apes)
mdape = statistics.median(apes)
within = lambda t: sum(1 for a in apes if a <= t) / len(apes)
print("  Worst 5 (likely unique/non-comp homes):")
for subj, pred, s in sorted(detail, key=lambda d: -abs(d[2]))[:5]:
    print(f"    {('+' if s>0 else '')}{s*100:5.1f}%  actual=${subj['sp']:>11,}  comp_est=${round(pred):>11,}  {subj['addr'][:28]} ({subj['city']})")
print("\n  Best 5:")
for subj, pred, s in sorted(detail, key=lambda d: abs(d[2]))[:5]:
    print(f"    {('+' if s>0 else '')}{s*100:5.1f}%  actual=${subj['sp']:>11,}  comp_est=${round(pred):>11,}  {subj['addr'][:28]} ({subj['city']})")

print("\n  " + "=" * 70)
print(f"  LUXURY COMP MODEL  →  n={len(apes)}  MdAPE {mdape*100:.1f}%  | within10 {within(.10)*100:.0f}%  | within20 {within(.20)*100:.0f}%  | bias {statistics.median(signed)*100:+.1f}%")
print(f"  vs RentCast AVM baseline on this tier: ~33–43% MdAPE")
print(f"  DEFENSIBLE ACCURACY = {max(0, round((1-mdape)*100))}%  (median within {mdape*100:.1f}% of sold price)\n")
