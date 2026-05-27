#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Drive index-reno (Washoe County NV, ~188K parcels)."""
import requests, time, sys, datetime

URL = "https://thepropertydna.com/.netlify/functions/index-reno"
KEY = "271d07f203bc34ba8574988ac272ab15ac60c5dbf25dd9391403d54c6a7fd977"
H = {"Content-Type": "application/json", "x-internal-key": KEY}
BATCH = 1000
PAUSE = 2

def log(m):
    print(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {m}", flush=True)

def wait_for_deploy():
    log("Waiting for Netlify deploy of index-reno...")
    for i in range(60):
        try:
            r = requests.post(URL, headers=H, json={"dryRun": True, "batchSize": 1}, timeout=20)
            if r.status_code == 200:
                try:
                    j = r.json()
                    if "parsed" in j or "fetched" in j:
                        log(f"Deploy ready. {j}")
                        return True
                except ValueError: pass
            log(f"  attempt {i+1}: HTTP {r.status_code}")
        except Exception as e: log(f"  attempt {i+1}: {e}")
        time.sleep(15)
    return False

def run():
    total_done = batch_n = consec_fail = 0
    last_offset = None
    while True:
        batch_n += 1
        try:
            r = requests.post(URL, headers=H, json={"batchSize": BATCH}, timeout=60)
            if r.status_code != 200:
                consec_fail += 1
                log(f"  batch {batch_n}: HTTP {r.status_code} — {r.text[:200]}")
                if consec_fail >= 5: log("Aborting (5 consecutive failures)"); return
                time.sleep(30); continue
            j = r.json()
            consec_fail = 0
            written = j.get("written", 0); offset = j.get("offset"); nxt = j.get("nextOffset")
            total = j.get("total"); done = j.get("done", False); errs = j.get("errors")
            total_done += written
            pct = (nxt / total * 100) if total else 0
            err = f" ERR={errs}" if errs else ""
            log(f"  batch {batch_n}: wrote {written} | offset {offset} -> {nxt} | {pct:.1f}% of {total or '?'}{err}")
            if last_offset == nxt:
                log("  WARNING: offset not advancing")
                time.sleep(10)
            last_offset = nxt
            if done: log(f"DONE — wrote {total_done} this session"); return
            time.sleep(PAUSE)
        except Exception as e:
            consec_fail += 1
            log(f"  batch {batch_n}: {e}")
            if consec_fail >= 5: log("Aborting"); return
            time.sleep(15)

if __name__ == "__main__":
    if not wait_for_deploy(): log("Deploy timeout"); sys.exit(1)
    log("Starting Washoe County NV index loop (target ~188K)...")
    run()
