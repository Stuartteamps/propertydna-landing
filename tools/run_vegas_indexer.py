#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Drive the index-vegas Netlify function in a continuous loop until done.

- Polls for deploy readiness first
- Invokes function with batchSize=1000 per call
- Reads nextOffset from response
- Pauses briefly between calls (rate-limit safe for Clark County ArcGIS)
- Logs progress to tools/cv-indexer.log (shared log)
- Exits when done=true

Run in background:
  nohup python3 tools/run_vegas_indexer.py > tools/vegas-indexer.log 2>&1 &
"""
import requests, time, json, sys, datetime

URL = "https://thepropertydna.com/.netlify/functions/index-vegas"
KEY = "271d07f203bc34ba8574988ac272ab15ac60c5dbf25dd9391403d54c6a7fd977"
HEADERS = {"Content-Type": "application/json", "x-internal-key": KEY}
BATCH_SIZE = 1000
PAUSE = 2  # seconds between batches

def log(msg):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

def wait_for_deploy():
    log("Waiting for Netlify deploy of index-vegas...")
    for attempt in range(60):  # up to 15 minutes
        try:
            r = requests.post(URL, headers=HEADERS,
                              json={"dryRun": True, "batchSize": 1, "offset": 0},
                              timeout=20)
            if r.status_code == 200:
                try:
                    j = r.json()
                    if "parsed" in j or "fetched" in j:
                        log(f"Deploy ready. Dry-run: {j}")
                        return True
                except ValueError:
                    pass
            log(f"  attempt {attempt+1}: HTTP {r.status_code}, retrying in 15s")
        except Exception as e:
            log(f"  attempt {attempt+1}: {e}")
        time.sleep(15)
    return False

def run_indexer():
    total_done = 0
    total = None
    batch_n = 0
    consecutive_failures = 0
    last_offset = None
    while True:
        batch_n += 1
        try:
            r = requests.post(URL, headers=HEADERS,
                              json={"batchSize": BATCH_SIZE}, timeout=60)
            if r.status_code != 200:
                consecutive_failures += 1
                log(f"  batch {batch_n}: HTTP {r.status_code} — {r.text[:200]}")
                if consecutive_failures >= 5:
                    log("Too many consecutive failures, aborting")
                    return
                time.sleep(30)
                continue
            j = r.json()
            consecutive_failures = 0
            written = j.get("written", 0)
            offset = j.get("offset")
            next_offset = j.get("nextOffset")
            total = j.get("total", total)
            done = j.get("done", False)
            errors = j.get("errors")
            total_done += written
            pct = (next_offset / total * 100) if total else 0
            err_str = f" ERRORS={errors}" if errors else ""
            log(f"  batch {batch_n}: wrote {written} | offset {offset} -> {next_offset} | {pct:.1f}% of {total or '?'}{err_str}")
            # Watchdog: detect stuck offset
            if last_offset == next_offset:
                log("  WARNING: offset not advancing — function may be stuck")
                time.sleep(10)
            last_offset = next_offset
            if done:
                log(f"DONE — total written so far this session: {total_done}")
                return
            time.sleep(PAUSE)
        except Exception as e:
            consecutive_failures += 1
            log(f"  batch {batch_n}: exception {e}")
            if consecutive_failures >= 5:
                log("Too many consecutive failures, aborting")
                return
            time.sleep(15)

if __name__ == "__main__":
    if not wait_for_deploy():
        log("Deploy timeout — exiting")
        sys.exit(1)
    log("Starting Clark County NV index loop (target: ~948K parcels)...")
    run_indexer()
