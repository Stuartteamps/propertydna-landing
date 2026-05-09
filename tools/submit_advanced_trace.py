#!/usr/bin/env python3
"""
Submits the 3 absentee-owner CSVs to Tracerfy advanced trace.
Requires ~18,600 credits (~$372). Run after topping up.

Usage:
    python3 tools/submit_advanced_trace.py
    python3 tools/submit_advanced_trace.py --check-balance   # just show balance
"""

import csv, io, os, sys, time, requests
from pathlib import Path

TKEY = os.environ.get("TRACERFY_API_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjozMjQ2ODIyNzk2LCJpYXQiOjE3NzgwMjI3OTYsImp0aSI6Ijk0ZjMwMjFkMGFhNjQzYmM5OTRhZGIxYzRjY2Q2ZjE1IiwidXNlcl9pZCI6NzE4OH0.r35Njjld2cWPGm1rdpfIFWOvzkXeC3ATdaUeaoXQHK0")
BASE  = "https://tracerfy.com/v1/api"
HDRS  = {"Authorization": f"Bearer {TKEY}"}
SRC   = Path("tools/gmail-cleanup/contacts/from_index")

BATCHES = [
    ("needs_skiptracing_indian_wells_absentee_2026-05-08.csv",
     "Indian Wells — Absentee Owners (Advanced Skip-Traced)", 2140),
    ("needs_skiptracing_rancho_mirage_absentee_2026-05-08.csv",
     "Rancho Mirage — Absentee Owners (Advanced Skip-Traced)", 3062),
    ("needs_skiptracing_palm_springs_absentee_2026-05-08.csv",
     "Palm Springs — Absentee Owners (Advanced Skip-Traced)", 5910),
]

def build_csv(rows):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=["address","city","state","zip"])
    w.writeheader()
    for r in rows:
        w.writerow({"address": r.get("address",""), "city": r.get("city",""),
                    "state": r.get("state","CA"), "zip": r.get("zip","")})
    return buf.getvalue()

def check_balance():
    r = requests.get(f"{BASE}/analytics/", headers=HDRS, timeout=15)
    return r.json().get("balance", 0) if r.ok else 0

def main():
    balance = check_balance()
    needed  = sum(n * 2 for _, _, n in BATCHES)
    print(f"Tracerfy balance: {balance:,} credits")
    print(f"Credits needed:   {needed:,} (advanced trace, all 3 batches)")
    print(f"Credits needed:   {BATCHES[0][2]*2:,} (Indian Wells only)")

    if "--check-balance" in sys.argv:
        return

    if balance < BATCHES[0][2] * 2:
        print(f"\nNeed at least {BATCHES[0][2]*2:,} credits to start.")
        print(f"Top up at: tracerfy.com → Account → Add Credits")
        print(f"Add $135 → ~6,750 credits → runs IW + RM batch")
        print(f"Add $372 → ~18,600 credits → runs all 3 cities")
        sys.exit(1)

    queue_ids = []
    for fname, label, count in BATCHES:
        credits_needed = count * 2
        if balance - sum(q[2]*2 for q in queue_ids) < credits_needed:
            print(f"\nSkipping {label} — not enough credits remaining")
            continue

        path = SRC / fname
        if not path.exists():
            print(f"Missing: {fname}")
            continue

        with open(path, newline="") as f:
            rows = list(csv.DictReader(f))

        print(f"\nSubmitting: {label} ({len(rows):,} records, {credits_needed:,} credits)")
        csv_content = build_csv(rows)

        r = requests.post(f"{BASE}/trace/",
            headers=HDRS,
            data={
                "trace_type":     "advanced",
                "address_column": "address",
                "city_column":    "city",
                "state_column":   "state",
                "zip_column":     "zip",
            },
            files={"csv_file": (fname, csv_content.encode(), "text/csv")},
            timeout=60)

        if r.status_code not in (200, 201):
            print(f"  ERROR {r.status_code}: {r.json().get('error','')[:150]}")
            continue

        d = r.json()
        qid = d.get("queue_id") or d.get("id")
        print(f"  ✓ Queue {qid} | Rows: {d.get('rows_uploaded','?')} | Wait: {d.get('estimated_wait_seconds','?')}s")
        queue_ids.append((qid, label, count))
        time.sleep(3)

    if queue_ids:
        print(f"\n{'='*50}")
        print(f"Submitted {len(queue_ids)} batches:")
        for qid, label, n in queue_ids:
            print(f"  Queue {qid}: {label} ({n:,} records)")
        print(f"\nWhen complete (~15-30 min), run:")
        print(f"  python3 tools/fetch_skiptrace_results.py --queue-ids {','.join(str(q[0]) for q in queue_ids)}")

if __name__ == "__main__":
    main()
