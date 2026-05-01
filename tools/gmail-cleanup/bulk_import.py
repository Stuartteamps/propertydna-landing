#!/usr/bin/env python3
"""
Bulk Contact Importer — PropertyDNA
Reads all CSV files in a folder, auto-detects format, deduplicates,
tags source, and imports into Supabase via import-contacts API.
"""

import csv
import json
import time
import re
import sys
import requests
from pathlib import Path

NETLIFY_URL      = "https://thepropertydna.com"
INTERNAL_API_KEY = "271d07f203bc34ba8574988ac272ab15ac60c5dbf25dd9391403d54c6a7fd977"

# ── Helpers ───────────────────────────────────────────────────────────────────

def clean(v):
    return (v or "").strip()

def title(v):
    return clean(v).title()

def lower(v):
    return clean(v).lower()

def valid_email(e):
    return bool(e and re.match(r"[^\s@]+@[^\s@]+\.[^\s@]+", e))

def split_name(full):
    parts = clean(full).split(None, 1)
    return (parts[0].title() if parts else "", parts[1].title() if len(parts) > 1 else "")

def zip5(v):
    return clean(v).split("-")[0][:5]

# ── Format detectors & parsers ────────────────────────────────────────────────

def detect_format(headers: list[str]) -> str:
    h = [x.lower().strip() for x in headers]
    if "agentname" in h or "list unit" in h:
        return "agent_list"
    if "last name" in h and "first name" in h and "email address" in h:
        return "farm_scrubbed"
    if "owner1 first name" in h and "site address city" in h:
        return "property_owner"
    if "vortex id" in h or "lead status" in h and "listing status" in h and "vortex" in " ".join(h):
        return "vortex"
    if "lead status" in h and "lead score" in h and "property address" in h:
        return "farm_export"
    if "deal type" in h or ("first name" in h and "source" in h and "agent notes" in h):
        return "crm_export"
    if "tags" in h and "company" in h and "first name" in h:
        return "constant_contact"
    if "phone status" in h and "mls name" in h:
        return "vortex_expired"
    if "first name" in h and "last name" in h and "email" in h:
        return "generic"
    return "unknown"


def parse_agent_list(row):
    raw = clean(row.get("AGENTNAME", ""))
    if "," in raw:
        last, first = raw.split(",", 1)
    else:
        first, last = split_name(raw)
    return {
        "firstName": title(first), "lastName": title(last),
        "email": lower(row.get("EMAIL", "")),
        "phone": clean(row.get("PHONE", "")),
        "address": title(row.get("ADDRESS", "")),
        "city": title(row.get("CITY", "")),
        "state": "CA", "zip": zip5(row.get("ZIP", "")),
        "brokerage": title(row.get("COMPANY", "")),
    }


def parse_farm_scrubbed(row):
    return {
        "firstName": title(row.get("First Name", "")),
        "lastName":  title(row.get("Last Name", "")),
        "email":     lower(row.get("Email Address", "")),
        "phone":     clean(row.get("Cell Phone", "") or row.get("Home Phone", "")),
        "address":   " ".join(filter(None, [
            clean(row.get("House Number", "")),
            clean(row.get("Dir", "")),
            title(row.get("Street Name", "")),
            clean(row.get("Address 2", "")),
        ])),
        "city":  title(row.get("City", "")),
        "state": clean(row.get("ST", "CA")).upper(),
        "zip":   zip5(row.get("ZIP", "")),
    }


def parse_property_owner(row):
    first = title(row.get("Owner1 First Name", ""))
    last  = title(row.get("Owner1 Last Name",  ""))
    if not first and not last:
        first, last = split_name(row.get("Owner Name2", "") or row.get("Owner Name", ""))
    house  = clean(row.get("Site Address House Number", ""))
    prefix = clean(row.get("Site Address Street Prefix", ""))
    street = title(row.get("Site Address Street Name", ""))
    unit   = clean(row.get("Site Address Unit Number", ""))
    addr   = " ".join(filter(None, [house, prefix, street, unit]))
    if not addr:
        addr = title(row.get("Full Site Address", ""))
    return {
        "firstName": first, "lastName": last,
        "email": lower(row.get("Email", "")),
        "phone": clean(row.get("Phone", "") or row.get("PHONE", "")),
        "address": addr,
        "city":  title(row.get("Site Address City", "")),
        "state": clean(row.get("Site Address State", "CA")).upper(),
        "zip":   zip5(row.get("Site Address Zip", "") or row.get("Site Address Zip+4", "")),
    }


def parse_vortex(row):
    first = title(row.get("First Name", ""))
    last  = title(row.get("Last Name", ""))
    if not first and not last:
        first, last = split_name(row.get("Name", ""))
    return {
        "firstName": first, "lastName": last,
        "email": lower(row.get("Email", "")),
        "phone": clean(row.get("Phone", "") or row.get("Phone 2", "")),
        "address": title(row.get("Mailing Street", "") or row.get("Address", "")),
        "city":  title(row.get("Mailing City", "")),
        "state": clean(row.get("Mailing State", "CA")).upper(),
        "zip":   zip5(row.get("Mailing Zip", "")),
    }


def parse_farm_export(row):
    raw_name = clean(row.get("Owner Name", "") or row.get("Owner", ""))
    # Format: "LAST FIRST & SPOUSE / TRUST NAME"
    raw_name = raw_name.split("/")[0].split("&")[0].strip()
    first, last = split_name(raw_name)
    return {
        "firstName": first, "lastName": last,
        "email": lower(row.get("Email", "")),
        "phone": clean(row.get("Phone", "") or row.get("Mobile", "")),
        "address": title(row.get("Property Address", "") + " " + clean(row.get("Property Address 2", ""))).strip(),
        "city":  title(row.get("Property City", "")),
        "state": clean(row.get("Property State", "CA")).upper(),
        "zip":   zip5(row.get("Property Zip", "")),
    }


def parse_crm_export(row):
    return {
        "firstName": title(row.get("First Name", "")),
        "lastName":  title(row.get("Last Name", "")),
        "email":     lower(row.get("Email", "")),
        "phone":     clean(row.get("Cell Phone 1", "") or row.get("Work Phone", "") or row.get("Home Phone", "")),
        "address":   title(row.get("Address", "") or row.get("Property Address", "")),
        "city":      title(row.get("City", "")),
        "state":     clean(row.get("State", "CA")).upper(),
        "zip":       zip5(row.get("Zip", "") or row.get("ZIP", "")),
    }


def parse_constant_contact(row):
    return {
        "firstName": title(row.get("First Name", "")),
        "lastName":  title(row.get("Last Name", "")),
        "email":     lower(row.get("Email", "")),
        "phone":     clean(row.get("Phone", "")),
        "address":   "",
        "city":      "",
        "state":     "CA",
        "zip":       "",
        "brokerage": title(row.get("Company", "")),
    }


def parse_vortex_expired(row):
    first = title(row.get("First Name", ""))
    last  = title(row.get("Last Name", ""))
    if not first and not last:
        first, last = split_name(row.get("Name", ""))
    return {
        "firstName": first, "lastName": last,
        "email": lower(row.get("Email", "")),
        "phone": clean(row.get("Phone", "") or row.get("Phone 2", "")),
        "address": title(row.get("Mailing Street", "") or row.get("Address", "")),
        "city":  title(row.get("Mailing City", "")),
        "state": "CA",
        "zip":   zip5(row.get("Mailing Zip", "")),
    }


def parse_generic(row):
    return {
        "firstName": title(row.get("First Name", "") or row.get("firstName", "")),
        "lastName":  title(row.get("Last Name",  "") or row.get("lastName",  "")),
        "email":     lower(row.get("Email", "") or row.get("email", "")),
        "phone":     clean(row.get("Phone", "") or row.get("phone", "") or row.get("Mobile", "")),
        "address":   title(row.get("Address", "") or row.get("Street", "")),
        "city":      title(row.get("City", "")),
        "state":     clean(row.get("State", "CA")).upper(),
        "zip":       zip5(row.get("Zip", "") or row.get("ZIP", "")),
    }


PARSERS = {
    "agent_list":       parse_agent_list,
    "farm_scrubbed":    parse_farm_scrubbed,
    "property_owner":   parse_property_owner,
    "vortex":           parse_vortex,
    "farm_export":      parse_farm_export,
    "crm_export":       parse_crm_export,
    "constant_contact": parse_constant_contact,
    "vortex_expired":   parse_vortex_expired,
    "generic":          parse_generic,
}

# ── Importer ──────────────────────────────────────────────────────────────────

def import_batch(contacts: list, campaign_name: str, campaign_id: str = None) -> dict:
    url     = f"{NETLIFY_URL}/.netlify/functions/import-contacts"
    payload = {
        "campaignName":    campaign_name,
        "campaignType":    "homeowner",
        "campaignSubject": "PropertyDNA — Your Home's DNA Report",
        "contacts":        contacts,
    }
    if campaign_id:
        payload["campaignId"] = campaign_id

    headers = {"Content-Type": "application/json", "x-internal-key": INTERNAL_API_KEY}
    resp = requests.post(url, json=payload, headers=headers, timeout=30)
    if resp.status_code == 200:
        return resp.json()
    else:
        print(f"    API error {resp.status_code}: {resp.text[:200]}")
        return {}


def process_file(path: Path, seen_emails: set, seen_phones: set, campaign_id: str) -> dict:
    source = path.stem
    print(f"\n  [{source}]")

    try:
        with open(path, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []
            fmt = detect_format(headers)
            parser = PARSERS.get(fmt)
            if not parser:
                print(f"    Unknown format — skipping")
                return {"imported": 0, "skipped": 0, "dupes": 0}

            print(f"    Format: {fmt}")
            contacts = []
            skipped = dupes = 0

            for row in reader:
                try:
                    c = parser(row)
                except Exception:
                    skipped += 1
                    continue

                c["source"] = source
                email = c.get("email", "")
                phone = re.sub(r"\D", "", c.get("phone", ""))

                # Dedup by email > phone > address
                addr_key = re.sub(r"\s+", " ", (c.get("address","") + c.get("city","")).lower().strip())
                if email and valid_email(email):
                    if email in seen_emails:
                        dupes += 1
                        continue
                    seen_emails.add(email)
                elif phone and len(phone) >= 10:
                    if phone in seen_phones:
                        dupes += 1
                        continue
                    seen_phones.add(phone)
                elif addr_key and len(addr_key) > 5:
                    if addr_key in seen_emails:  # reuse set for addr dedup
                        dupes += 1
                        continue
                    seen_emails.add(addr_key)
                else:
                    skipped += 1
                    continue

                if phone:
                    seen_phones.add(phone)

                contacts.append(c)

    except Exception as e:
        print(f"    Error reading file: {e}")
        return {"imported": 0, "skipped": 0, "dupes": 0}

    if not contacts:
        print(f"    No valid contacts found")
        return {"imported": 0, "skipped": skipped, "dupes": dupes}

    # Send in batches of 500
    total_imported = 0
    for i in range(0, len(contacts), 500):
        chunk = contacts[i : i + 500]
        result = import_batch(chunk, "Palm Springs Area — All Contacts", campaign_id)
        imported = result.get("imported", 0)
        total_imported += imported
        if not campaign_id:
            campaign_id = result.get("campaignId")
        time.sleep(0.3)

    print(f"    {total_imported} imported, {dupes} dupes, {skipped} skipped")
    return {"imported": total_imported, "skipped": skipped, "dupes": dupes, "campaign_id": campaign_id}


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--folder", default="/Users/danstuart/Downloads",
                        help="Folder containing CSV files")
    parser.add_argument("--files", nargs="*",
                        help="Specific files to import (relative to folder)")
    parser.add_argument("--campaign", default="Palm Springs Area — All Contacts")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    folder = Path(args.folder)

    if args.files:
        csv_files = [folder / f for f in args.files]
    else:
        # Import all relevant CSVs, skip examples and reports
        skip_patterns = ["example_", "report_details", "Market_Summary", "vortex-", "CSV_Calls"]
        csv_files = sorted([
            p for p in folder.glob("*.csv")
            if not any(p.name.startswith(s) or s in p.name for s in skip_patterns)
        ])

    print(f"\nFound {len(csv_files)} CSV files to process")
    if args.dry_run:
        print("[DRY RUN — showing formats only, not importing]")

    seen_emails: set = set()
    seen_phones: set = set()
    campaign_id = None
    totals = {"imported": 0, "skipped": 0, "dupes": 0}

    for path in csv_files:
        if not path.exists():
            print(f"\n  MISSING: {path.name}")
            continue

        if args.dry_run:
            try:
                with open(path, newline="", encoding="utf-8-sig") as f:
                    headers = csv.DictReader(f).fieldnames or []
                fmt = detect_format(headers)
                rows = sum(1 for _ in open(path, encoding="utf-8-sig")) - 1
                print(f"  {path.name[:55]:<55} {fmt} ({rows} rows)")
            except Exception as e:
                print(f"  {path.name[:55]:<55} ERROR: {e}")
            continue

        result = process_file(path, seen_emails, seen_phones, campaign_id)
        if result.get("campaign_id"):
            campaign_id = result["campaign_id"]
        totals["imported"] += result.get("imported", 0)
        totals["skipped"]  += result.get("skipped", 0)
        totals["dupes"]    += result.get("dupes", 0)

    print(f"\n{'='*50}")
    print(f"TOTAL: {totals['imported']} imported, {totals['dupes']} duplicates, {totals['skipped']} invalid")
    if campaign_id:
        print(f"Campaign ID: {campaign_id}")


if __name__ == "__main__":
    main()
