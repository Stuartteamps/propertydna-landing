#!/usr/bin/env python3
"""
dial-in-model.py — push valuation accuracy toward 97% (MdAPE<=3%) per tier.

Tests several models, all leave-one-out vs actual sold price, no RentCast:
  A) feature-rich comp: weighted-kNN on sqft+lot+beds+baths+age, robust
     $/sqft median, non-arms-length comp filter (drop $/sqft outliers).
  B) list-anchor: list_price * tier/city median(sp_lp_ratio). VALID for the
     buyer use case (active listing => list price is known). This is how you
     judge "is this listing fairly priced".
  C) ensemble: blend A + B.

Reports per-tier MdAPE for each so we see the real ceiling per price point.
Usage: python3 dial-in-model.py [solds.csv] [--k 10]
"""
import sys, csv, math, statistics, os
from collections import defaultdict

args=sys.argv[1:]
csv_path=next((a for a in args if not a.startswith("--")), os.path.join(os.path.dirname(__file__),"solds-from-cma.csv"))
def opt(n,d):
    for a in args:
        if a==f"--{n}" and args.index(a)+1<len(args): return type(d)(args[args.index(a)+1])
        if a.startswith(f"--{n}="): return type(d)(a.split("=",1)[1])
    return d
K=int(opt("k",10))
TIERS=[("under_1M",0,1_000_000),("1M_2M",1_000_000,2_000_000),("2M_5M",2_000_000,5_000_000),("5M_plus",5_000_000,10**12)]
def tier_of(sp):
    for n,lo,hi in TIERS:
        if lo<=sp<hi: return n
    return "5M_plus"
def nc(c):
    c=(c or "").strip()
    return (c[4:] if c.lower().startswith("via ") else c).title()
def num(v):
    try: return float(str(v).replace(",","").replace("$","").strip())
    except: return None

rows=[]
for r in csv.DictReader(open(csv_path)):
    sp,sf,lot=num(r.get("actual_price")),num(r.get("sqft")),num(r.get("lot_sqft"))
    lp,ratio=num(r.get("list_price")),num(r.get("sp_lp_ratio"))
    if not (sp and sf and sf>500): continue
    yr=num(r.get("year_built")); age=(2026-yr) if yr and yr>1900 else None
    rows.append({"sp":sp,"sqft":sf,"lot":lot,"beds":num(r.get("beds")),"baths":num(r.get("baths")),
                 "age":age,"city":nc(r.get("city")),"psf":sp/sf,"lp":lp,
                 "ratio":(ratio if ratio and 0.5<ratio<1.5 else (sp/lp if lp and lp>0 else None)),
                 "pool":1 if str(r.get("pool_spa_gated","")).strip() not in("","0","False","false") else 0,
                 "tier":tier_of(sp),"addr":r.get("address","")})

# neighborhood median $/sqft for outlier filtering
nbr_psf=defaultdict(list)
for r in rows: nbr_psf[r["city"]].append(r["psf"])
nbr_med={c:statistics.median(v) for c,v in nbr_psf.items()}

def comp_predict(subj,pool,k=K):
    cand=[c for c in pool if c["city"]==subj["city"] and c is not subj]
    if len(cand)<4: cand=[c for c in pool if c is not subj]
    # non-arms-length / bad-comp filter: drop $/sqft far from neighborhood median
    med=nbr_med.get(subj["city"]) or statistics.median([c["psf"] for c in cand])
    cand=[c for c in cand if 0.4*med<=c["psf"]<=2.5*med]
    if not cand: return None
    def dist(c):
        d=abs(math.log(c["sqft"])-math.log(subj["sqft"]))
        if c["lot"] and subj["lot"]: d+=0.6*abs(math.log(max(c["lot"],1))-math.log(max(subj["lot"],1)))
        if c["beds"] and subj["beds"]: d+=0.25*abs(c["beds"]-subj["beds"])
        if c["baths"] and subj["baths"]: d+=0.20*abs(c["baths"]-subj["baths"])
        if c["age"] and subj["age"]: d+=0.15*abs(math.log(max(c["age"],1))-math.log(max(subj["age"],1)))
        if c["pool"]!=subj["pool"]: d+=0.4
        return d
    near=sorted(cand,key=dist)[:k]
    # weighted median of feature-adjusted comp prices (scale by size)
    ests=[]
    for c in near:
        scale=0.6*(subj["sqft"]/c["sqft"]) + (0.4*(subj["lot"]/c["lot"]) if c["lot"] and subj["lot"] else 0.4*(subj["sqft"]/c["sqft"]))
        w=1.0/(dist(c)+0.05)
        ests.append((c["sp"]*scale,w))
    ests.sort()
    tot=sum(w for _,w in ests); acc=0
    for v,w in ests:
        acc+=w
        if acc>=tot/2: return v
    return ests[-1][0]

def list_predict(subj,pool):
    if not (subj["lp"] and subj["lp"]>0): return None
    # tier+city median sp/lp from OTHER solds (leave-one-out)
    peers=[c["ratio"] for c in pool if c is not subj and c["ratio"] and c["tier"]==subj["tier"] and c["city"]==subj["city"]]
    if len(peers)<5: peers=[c["ratio"] for c in pool if c is not subj and c["ratio"] and c["tier"]==subj["tier"]]
    if len(peers)<5: peers=[c["ratio"] for c in pool if c is not subj and c["ratio"]]
    if not peers: return None
    return subj["lp"]*statistics.median(peers)

def run(predfn,label):
    by=defaultdict(list); allape=[]
    for s in rows:
        p=predfn(s)
        if not p: continue
        a=abs((p-s["sp"])/s["sp"]); by[s["tier"]].append(a); allape.append(a)
    res={t:(statistics.median(v),len(v)) for t,v in by.items()}
    res["ALL"]=(statistics.median(allape),len(allape))
    return res

def ens(s):
    a=comp_predict(s,rows); b=list_predict(s,rows)
    if a and b: return 0.45*a+0.55*b
    return a or b

A=run(lambda s:comp_predict(s,rows),"comp")
B=run(lambda s:list_predict(s,rows),"list")
C=run(ens,"ensemble")

print(f"\n{'='*72}\n  DIAL-IN — {len(rows)} solds, k={K} (leave-one-out, no RentCast). target MdAPE<=3%\n{'='*72}")
print(f"\n  {'tier':<10}{'A: comp':>12}{'B: list-anchor':>18}{'C: ensemble':>14}{'n':>6}")
for t,_,_ in TIERS+[("ALL",0,0)]:
    a,b,c=A.get(t),B.get(t),C.get(t)
    if not a: continue
    f=lambda x:f"{x[0]*100:.1f}%" if x else "-"
    star="  <=3 OK" if c and c[0]<=0.03 else ""
    print(f"  {t:<10}{f(a):>12}{f(b):>18}{f(c):>14}{a[1]:>6}{star}")
print(f"\n  Read: B (list-anchor) = accuracy when a list price exists (the BUYER case).")
print(f"        A (comp) = independent fair value (judges if the list is too high).\n")
