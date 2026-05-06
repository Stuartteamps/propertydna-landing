#!/usr/bin/env python3
"""
Batch skip tracer using Tracerfy API.
Submits all needs_skiptracing_*.csv files, fetches results,
and merges phone/email back into each CSV.

Usage:
    TRACERFY_API_KEY=your_key_here python3 tools/skip_trace.py

    # Fetch already-submitted queues without re-submitting:
    TRACERFY_API_KEY=your_key_here python3 tools/skip_trace.py --fetch-only

Sign up at https://www.tracerfy.com (~$0.02/record).
"""

import csv
import io
import os
import sys
import time
from pathlib import Path

import requests

API_KEY = os.environ.get("TRACERFY_API_KEY", "")
BASE_URL = "https://tracerfy.com/v1/api"
CONTACTS_DIR = Path(__file__).parent / "gmail-cleanup" / "contacts"
RESULTS_DIR = CONTACTS_DIR / "skip_trace_results"

HEADERS = {"Authorization": f"Bearer {API_KEY}"}

# Queue IDs from already-submitted batches (2026-05-05)
EXISTING_QUEUES = [
    ("needs_skiptracing_el_cajon_2026-05-01",              84882),
    ("needs_skiptracing_movie_colony_absentee_2026-05-01", 84883),
    ("needs_skiptracing_movie_colony_occupied_2026-05-01", 84884),
    ("needs_skiptracing_oasis_palmdesert_2026-05-01",      84885),
    ("needs_skiptracing_ps_commercial_2026-05-01",         84886),
    ("needs_skiptracing_ps_homes_2026-05-01",              84887),
    ("needs_skiptracing_ps_multifamily_2026-05-01",        84888),
    ("needs_skiptracing_quincy_farm_2026-05-01",           84889),
]


def build_tracerfy_csv(records):
    buf = io.StringIO()
    fieldnames = [
        "first_name", "last_name",
        "address", "city", "state", "zip",
        "mail_address", "mail_city", "mail_state", "mail_zip",
    ]
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    for r in records:
        addr = r.get("address", "")
        city = r.get("city", "")
        state = r.get("state", "")
        zp = r.get("zip", "")
        writer.writerow({
            "first_name": r.get("firstName", ""),
            "last_name": r.get("lastName", ""),
            "address": addr, "city": city, "state": state, "zip": zp,
            "mail_address": addr, "mail_city": city, "mail_state": state, "mail_zip": zp,
        })
    return buf.getvalue()


def submit_batch(csv_content, label):
    resp = requests.post(
        f"{BASE_URL}/trace/",
        headers=HEADERS,
        data={
            "trace_type": "normal",
            "address_column": "address", "city_column": "city",
            "state_column": "state", "zip_column": "zip",
            "first_name_column": "first_name", "last_name_column": "last_name",
            "mail_address_column": "mail_address", "mail_city_column": "mail_city",
            "mail_state_column": "mail_state", "mail_zip_column": "mail_zip",
        },
        files={"csv_file": (f"{label}.csv", csv_content.encode(), "text/csv")},
        timeout=60,
    )
    if resp.status_code not in (200, 201):
        print(f"  ERROR submitting {label}: {resp.status_code} {resp.text[:300]}")
        return None
    data = resp.json()
    queue_id = data.get("id") or data.get("queue_id")
    print(f"  Submitted {label} → queue {queue_id}")
    return queue_id


def fetch_queue_results(queue_id, label, max_wait=300, interval=15):
    """GET /queue/:id — returns a list of enriched records. Polls until populated."""
    deadline = time.time() + max_wait
    while time.time() < deadline:
        resp = requests.get(f"{BASE_URL}/queue/{queue_id}", headers=HEADERS, timeout=30)
        if resp.status_code != 200:
            print(f"  Poll error {queue_id}: {resp.status_code} {resp.text[:200]}")
            time.sleep(interval)
            continue
        data = resp.json()
        if isinstance(data, list) and len(data) > 0:
            return data
        # Empty list or unexpected shape — still processing
        print(f"  [{label}] waiting for results ({len(data) if isinstance(data, list) else type(data).__name__})...")
        time.sleep(interval)
    print(f"  [{label}] Timed out after {max_wait}s")
    return []


def merge_results(original_records, result_records):
    result_map = {}
    for r in result_records:
        addr = (r.get("address", "") or "").strip().lower()
        if addr:
            result_map[addr] = r

    enriched = []
    matched = 0
    for orig in original_records:
        addr_key = (orig.get("address", "") or "").strip().lower()
        result = result_map.get(addr_key)
        row = dict(orig)
        if result:
            matched += 1
            phone = (
                result.get("mobile_1")
                or result.get("primary_phone")
                or result.get("landline_1")
                or ""
            )
            # Collect all emails (up to 5)
            emails = [
                result.get(f"email_{i}", "") for i in range(1, 6)
                if result.get(f"email_{i}", "")
            ]
            email = emails[0] if emails else ""

            if phone and not row.get("phone"):
                row["phone"] = phone
            if email and not row.get("email"):
                row["email"] = email
            if not row.get("firstName") and result.get("first_name"):
                row["firstName"] = result["first_name"]
            if not row.get("lastName") and result.get("last_name"):
                row["lastName"] = result["last_name"]

        enriched.append(row)
    return enriched, matched


def save_enriched_csv(path, records):
    fieldnames = ["firstName", "lastName", "email", "phone", "address", "city", "state", "zip", "source", "notes"]
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)


def main():
    if not API_KEY:
        print("ERROR: Set TRACERFY_API_KEY environment variable.")
        sys.exit(1)

    RESULTS_DIR.mkdir(exist_ok=True)

    fetch_only = "--fetch-only" in sys.argv

    if fetch_only:
        # Use already-submitted queue IDs
        jobs = []
        for label, queue_id in EXISTING_QUEUES:
            csv_path = CONTACTS_DIR / f"{label}.csv"
            if not csv_path.exists():
                print(f"  Missing source CSV: {csv_path.name}")
                continue
            with open(csv_path, newline="") as f:
                records = list(csv.DictReader(f))
            jobs.append((label, csv_path, queue_id, records))
        print(f"Fetching results for {len(jobs)} existing queues...\n")
    else:
        csv_files = sorted(CONTACTS_DIR.glob("needs_skiptracing_*.csv"))
        if not csv_files:
            print("No skip-trace CSV files found.")
            sys.exit(1)

        print(f"Found {len(csv_files)} CSV files to process.\n")
        jobs = []
        for csv_path in csv_files:
            label = csv_path.stem
            with open(csv_path, newline="") as f:
                records = list(csv.DictReader(f))
            if not records:
                print(f"Skipping {label} — empty")
                continue
            print(f"Submitting {label} ({len(records)} records)...")
            csv_content = build_tracerfy_csv(records)
            queue_id = submit_batch(csv_content, label)
            if queue_id:
                jobs.append((label, csv_path, queue_id, records))
            time.sleep(2)

        if not jobs:
            print("No jobs submitted.")
            sys.exit(1)
        print(f"\nSubmitted {len(jobs)} batches. Fetching results...\n")

    total_records = 0
    total_matched = 0
    total_with_email = 0
    total_with_phone = 0

    for label, original_path, queue_id, original_records in jobs:
        print(f"Fetching {label} (queue {queue_id})...")
        result_records = fetch_queue_results(queue_id, label)

        if not result_records:
            print(f"  No results for {label}\n")
            continue

        enriched, matched = merge_results(original_records, result_records)
        with_email = sum(1 for r in enriched if r.get("email"))
        with_phone = sum(1 for r in enriched if r.get("phone"))

        out_path = RESULTS_DIR / original_path.name
        save_enriched_csv(out_path, enriched)

        print(f"  {matched}/{len(original_records)} matched | {with_email} emails | {with_phone} phones → {out_path.name}\n")
        total_records += len(original_records)
        total_matched += matched
        total_with_email += with_email
        total_with_phone += with_phone

    print("=" * 60)
    print(f"DONE: {total_matched}/{total_records} records enriched")
    print(f"      {total_with_email} have email  |  {total_with_phone} have phone")
    print(f"Enriched CSVs: {RESULTS_DIR}")
    print("\nNext: upload enriched CSVs via /admin/campaigns to launch email campaigns.")


if __name__ == "__main__":
    main()
