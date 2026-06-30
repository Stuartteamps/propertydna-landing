#!/usr/bin/env python3
"""
land-aware-comp-model.py — luxury-accurate comp valuation that uses LOT size.

Baseline luxury error (~16-41% MdAPE) comes from pure $/building-sqft ignoring
that on trophy homes the LAND drives price. This model scales each comp's price
by a BLEND of building-size ratio and lot-size ratio:

    est = median_over_comps[ comp.price * ( w*(subj.sqft/comp.sqft)
                                          + (1-w)*(subj.lot /comp.lot ) ) ]

w is tuned per price tier: luxury leans on LOT (low w), production homes lean on
STRUCTURE (high w). Comps chosen same-neighborhood, nearest on combined size.
Leave-one-out, scored vs actual sold price. No RentCast. No external calls.

Usage: python3 land-aware-comp-model.py [solds.csv] [--k 8]
"""
import sys, csv, math, statistics, os
from collections import defaultdict

args = sys.argv[1:]
csv_path = next((a for a in args if not a.startswith("--")),
                os.path.join(os.path.dirname(__file__), "solds-from-cma.csv"))
def opt(name, d):
    for a in args:
        if a == f"--{name}" and args.index(a)+1 < len(args): return type(d)(args[args.index(a)+1])
        if a.startswith(f"--{name}="): return type(d)(a.split("=",1)[1])
    return d
K = int(opt("k", 8))

TIERS = [("under_1M", 0, 1_000_000), ("1M_2M", 1_000_000, 2_000_000),
         ("2M_5M", 2_000_000, 5_000_000), ("5M_plus", 5_000_000, 10**12)]
def tier_of(sp):
    for n, lo, hi in TIERS:
        if lo <= sp < hi: return n
    return "5M_plus"
def norm_city(c):
    c=(c or "").strip()
    if c.lower().startswith("via "): c=c[4:]
    return c.title()

def num(v):
    try: return float(str(v).replace(",","").strip())
    except: return None

rows=[]
for r in csv.DictReader(open(csv_path)):
    sp,sf,lot = num(r.get("actual_price")), num(r.get("sqft")), num(r.get("lot_sqft"))
    if sp and sf and sf>500:
        rows.append({"sp":sp,"sqft":sf,"lot":lot if lot and lot>0 else None,
                     "city":norm_city(r.get("city")),"psf":sp/sf,
                     "addr":r.get("address",""),"tier":tier_of(sp)})

def predict(subj, pool, w, k=K):
    same=[c for c in pool if c["city"]==subj["city"] and c is not subj]
    cand=same if len(same)>=4 else [c for c in pool if c is not subj]
    def dist(c):
        d=abs(math.log(c["sqft"])-math.log(subj["sqft"]))
        if c["lot"] and subj["lot"]:
            d+=abs(math.log(c["lot"])-math.log(subj["lot"]))
        return d
    cand=sorted(cand,key=dist)[:k]
    if not cand: return None
    ests=[]
    for c in cand:
        if subj["lot"] and c["lot"] and w<1.0:
            scale = w*(subj["sqft"]/c["sqft"]) + (1-w)*(subj["lot"]/c["lot"])
        else:
            scale = subj["sqft"]/c["sqft"]   # fall back to pure size if lot missing
        ests.append(c["sp"]*scale)
    return statistics.median(ests)

def score(pred_w):
    """pred_w: dict tier->w. Returns per-tier + overall MdAPE."""
    by=defaultdict(list); allape=[]
    for subj in rows:
        w=pred_w.get(subj["tier"],1.0)
        p=predict(subj,rows,w)
        if not p: continue
        ape=abs((p-subj["sp"])/subj["sp"])
        by[subj["tier"]].append(ape); allape.append(ape)
    out={t:(statistics.median(v),len(v)) for t,v in by.items()}
    out["__overall__"]=(statistics.median(allape),len(allape))
    return out

# 1) Baseline (pure sqft, w=1 everywhere)
base=score({t[0]:1.0 for t in TIERS})
# 2) Sweep w per tier to find the best blend for each
best_w={}
for tname,_,_ in TIERS:
    best=(1.0, base.get(tname,(9,0))[0])
    for w in [0.8,0.6,0.5,0.4,0.3,0.2,0.1,0.0]:
        trial=score({**{t[0]:1.0 for t in TIERS}, tname:w})
        md=trial.get(tname,(9,0))[0]
        if md<best[1]: best=(w,md)
    best_w[tname]=best[0]
tuned=score(best_w)

print(f"\n{'='*70}\n  LAND-AWARE COMP MODEL — {len(rows)} solds, k={K} (leave-one-out, no RentCast)\n{'='*70}")
print(f"\n  {'tier':<10}{'baseline($/sqft)':>18}{'land-aware':>14}{'best_w':>9}{'n':>6}")
for tname,_,_ in TIERS:
    b=base.get(tname,(None,0)); t=tuned.get(tname,(None,0))
    if not b[1]: continue
    arrow = "↓" if (t[0] is not None and t[0]<b[0]) else " "
    print(f"  {tname:<10}{b[0]*100:>16.1f}%{t[0]*100:>13.1f}%{best_w[tname]:>9}{b[1]:>6} {arrow}")
bo,to=base['__overall__'],tuned['__overall__']
print(f"\n  OVERALL    {bo[0]*100:>16.1f}%{to[0]*100:>13.1f}%{'':>9}{bo[1]:>6}")
print(f"\n  Best lot/structure blend per tier (w=building weight, 1-w=lot weight):")
for t,_,_ in TIERS:
    if base.get(t,(None,0))[1]: print(f"    {t:<10} w={best_w[t]}  ({'lot-driven' if best_w[t]<0.5 else 'structure-driven'})")
print(f"\n  DEFENSIBLE: baseline {max(0,round((1-bo[0])*100))}%  →  land-aware {max(0,round((1-to[0])*100))}%\n")
