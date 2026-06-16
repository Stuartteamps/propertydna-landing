#!/usr/bin/env python3
"""
parse-cma-pdf.py — extract SOLD comps (ground truth) from FlexMLS "statistical
CMA" PDF exports (closed/sold listings).

These PDFs are tabular; text-order extraction scrambles the columns, so we parse
by word COORDINATES. Column x-ranges were mapped from the header row:

  mls 0-80 | address 80-123 | city 123-163 | year 163-186 | P/S/G 186-207 |
  date 207-245 | BD 245-263 | BTH 263-290 | SqFt 290-326 | LotSz 326-362 |
  LP/SqFt 362-408 | OrigLP 408-471 | LP 471-527 | SP 527-565 | SP/SqFt 565-603 | SP/LP 603+

SP = the actual SOLD price = ground truth.

Usage:
  python3 parse-cma-pdf.py <file.pdf | folder> [out.csv]
  Default out: tools/backtest/solds-from-cma.csv  (appends/merges, de-dupes by MLS#)
"""
import sys, os, re, glob, csv
import fitz  # PyMuPDF

# Boundaries from VALUE x0 positions (numbers are right-aligned, so they sit
# left of the left-aligned header anchors). SP value column starts at x~510.
COLS = [
    ("mls", 0, 80), ("address", 80, 123), ("city", 123, 163), ("year", 163, 186),
    ("psg", 186, 206), ("date", 206, 245), ("bd", 245, 265), ("bth", 265, 287),
    ("sqft", 287, 325), ("lotsz", 325, 359), ("lp_sqft", 359, 401),
    ("orig_lp", 401, 454), ("lp", 454, 510), ("sp", 510, 562),
    ("sp_sqft", 562, 602), ("ratio", 602, 9999),
]
LISTING_RE = re.compile(r"^[A-Z0-9]{0,2}-?\d{6,9}$")
DATE_RE = re.compile(r"\d{2}/\d{2}/\d{4}")

def col_of(x):
    for name, lo, hi in COLS:
        if lo <= x < hi:
            return name
    return None

def num(s):
    s = re.sub(r"[^0-9.]", "", s or "")
    try:
        return float(s) if s else None
    except ValueError:
        return None

STREET_TYPES = {"avenue","ave","drive","dr","court","ct","lane","ln","way","road","rd",
    "boulevard","blvd","place","pl","circle","cir","terrace","ter","street","st","trail",
    "trl","point","pt","canyon","cyn","loop","run","path","cove","bend","ridge","real"}

def normalize_address(addr):
    """Reorder addresses where the street suffix wrapped above the number
    (e.g. 'Drive 57785 Black' -> '57785 Black Drive') so they geocode."""
    toks = addr.split()
    if not toks or toks[0].isdigit():
        return addr
    num_idx = next((i for i, t in enumerate(toks) if t.isdigit()), None)
    if num_idx is None:
        return addr
    number = toks[num_idx]
    rest = toks[:num_idx] + toks[num_idx + 1:]
    suffix = [t for t in rest if t.lower().strip(",.") in STREET_TYPES]
    names  = [t for t in rest if t.lower().strip(",.") not in STREET_TYPES]
    return " ".join([number] + names + suffix)

HEADER_LABELS = {"Listing": "mls", "Address": "address", "City": "city", "Year": "year",
                 "Date": "date", "BD": "bd", "BTH": "bth", "SqFt": "sqft", "LotSz": "lotsz"}
LEFT_ORDER = ["mls", "address", "city", "year", "psg", "date", "bd", "bth", "sqft", "lotsz"]
MONEY_RE = re.compile(r"^\$[\d,]+(?:\.\d+)?$")

def parse_pdf(path):
    doc = fitz.open(path)
    records = []
    for page in doc:
        words = page.get_text("words")  # x0,y0,x1,y1,text,...
        # Column anchors derived PER PAGE from the header row — the table
        # auto-fits column widths, so x-positions shift between files. Only the
        # LEFT-side fields use x-columns; prices are read by pattern below.
        anchors = {}
        for w in words:
            lab = w[4].strip().rstrip(":")
            if w[0] < 470 and lab in HEADER_LABELS and HEADER_LABELS[lab] not in anchors:
                anchors[HEADER_LABELS[lab]] = w[0]
            elif w[0] < 470 and lab.startswith("P/S") and "psg" not in anchors:
                anchors["psg"] = w[0]
        if "mls" not in anchors or "sqft" not in anchors:
            continue  # not a listings page

        left = [(f, anchors[f]) for f in LEFT_ORDER if f in anchors]
        max_left_x = max(x for _, x in left) + 25  # ignore right-side noise (ratio, counts)
        def nearest(x):
            return min(left, key=lambda fa: abs(fa[1] - x))[0]

        mls_x = anchors["mls"]
        lw = sorted([w for w in words if abs(w[0] - mls_x) < 32 and LISTING_RE.match(w[4])], key=lambda w: w[1])
        ys = []
        for a in lw:
            if not ys or abs(a[1] - ys[-1]) > 6:
                ys.append(a[1])
        for i, yL in enumerate(ys):
            # Adaptive band: midpoint between consecutive rows — luxury rows wrap
            # 3 lines (wide) while cheaper homes are single-line and tight.
            top = (ys[i - 1] + yL) / 2 if i > 0 else yL - 15
            bot = (yL + ys[i + 1]) / 2 if i + 1 < len(ys) else yL + 15
            band = sorted([w for w in words if top <= w[1] < bot], key=lambda w: (round(w[1]), w[0]))
            cells = {f: [] for f, _ in left}
            money = []
            for w in band:
                if MONEY_RE.match(w[4]):
                    money.append((w[0], num(w[4])))
                elif w[0] <= max_left_x:
                    cells[nearest(w[0])].append(w[4])
            # Prices by PATTERN (layout-independent): big-dollar values in x-order
            # are Orig LP, LP, SP — SP is the last. The two $/sqft values are
            # small (<$50k) and excluded.
            money.sort()
            big = [v for _, v in money if v and v > 50_000]
            sp = big[-1] if big else None
            lp = big[-2] if len(big) >= 2 else None
            rec = {k: re.sub(r"\s+", " ", " ".join(v)).strip() for k, v in cells.items()}
            date_m = DATE_RE.search(rec.get("date", "").replace(" ", ""))
            if sp and 50_000 < sp < 100_000_000 and rec.get("address"):
                records.append({
                    "mls": rec.get("mls", "").strip(),
                    "address": normalize_address(rec.get("address", "")),
                    "city": rec.get("city", ""),
                    "state": "CA",
                    "actual_price": int(sp),
                    "sold_date": date_m.group(0) if date_m else "",
                    "beds": rec.get("bd", ""),
                    "baths": rec.get("bth", ""),
                    "sqft": (num(rec.get("sqft")) and int(num(rec.get("sqft")))) or "",
                    "lot_sqft": (num(rec.get("lotsz")) and int(num(rec.get("lotsz")))) or "",
                    "year_built": rec.get("year", ""),
                    "list_price": int(lp) if lp else "",
                    "sp_lp_ratio": (round(sp / lp, 2) if lp else ""),
                    "pool_spa_gated": rec.get("psg", "").replace(" ", ""),
                    "source_file": os.path.basename(path),
                })
    return records

def main():
    if len(sys.argv) < 2:
        print("usage: parse-cma-pdf.py <file.pdf|folder> [out.csv]"); sys.exit(1)
    target = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "solds-from-cma.csv")
    pdfs = ([target] if target.lower().endswith(".pdf")
            else sorted(glob.glob(os.path.join(target, "*.pdf"))))
    if not pdfs:
        print(f"no PDFs found at {target}"); sys.exit(1)

    # merge with existing, de-dupe by MLS#
    existing = {}
    if os.path.exists(out):
        with open(out, newline="") as f:
            for row in csv.DictReader(f):
                existing[row["mls"]] = row

    fields = ["mls","address","city","state","actual_price","sold_date","beds","baths",
              "sqft","lot_sqft","year_built","list_price","sp_lp_ratio","pool_spa_gated","source_file"]
    new = 0
    for pdf in pdfs:
        recs = parse_pdf(pdf)
        for r in recs:
            if r["mls"] and r["mls"] not in existing:
                existing[r["mls"]] = r; new += 1
        print(f"  {os.path.basename(pdf):45s} → {len(recs):3d} solds parsed")

    rows = [r for r in existing.values() if r.get("actual_price")]
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fields})

    prices = [int(r["actual_price"]) for r in rows if str(r.get("actual_price")).isdigit()]
    print(f"\n  Total unique solds: {len(rows)}  (+{new} new)")
    if prices:
        prices.sort()
        print(f"  Price range: ${min(prices):,} – ${max(prices):,}  | median ${prices[len(prices)//2]:,}")
    print(f"  Wrote → {out}")

if __name__ == "__main__":
    main()
