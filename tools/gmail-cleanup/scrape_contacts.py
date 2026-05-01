#!/usr/bin/env python3
"""
Gmail Contact Scraper
Extracts all unique contacts from specified Gmail accounts and imports them
into the PropertyDNA campaign system via the import-contacts API.
"""

import re
import json
import time
import argparse
import requests
from pathlib import Path
from typing import Optional
from email.utils import parseaddr, getaddresses

try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print("Missing dependencies. Run: pip install -r requirements.txt")
    exit(1)

try:
    from colorama import Fore, Style, init
    init(autoreset=True)
    GREEN  = Fore.GREEN
    RED    = Fore.RED
    YELLOW = Fore.YELLOW
    CYAN   = Fore.CYAN
    BOLD   = Style.BRIGHT
    RESET  = Style.RESET_ALL
except ImportError:
    GREEN = RED = YELLOW = CYAN = BOLD = RESET = ""

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://mail.google.com/",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]

SCRIPT_DIR = Path(__file__).parent

NETLIFY_URL      = "https://thepropertydna.com"
INTERNAL_API_KEY = "271d07f203bc34ba8574988ac272ab15ac60c5dbf25dd9391403d54c6a7fd977"

# Addresses to always skip
SKIP_PATTERNS = [
    r"noreply", r"no-reply", r"donotreply", r"do-not-reply",
    r"mailer-daemon", r"postmaster", r"bounce", r"notifications?@",
    r"newsletter", r"marketing", r"updates@", r"news@",
    r"support@", r"help@", r"admin@", r"info@",
    r"automated", r"system@", r"robot@",
    r"@.*googlemail", r"@.*gmail.*google",
]

OWN_EMAILS = {
    "stuartteamps@gmail.com",
    "missinglink.solution@gmail.com",
    "danstuart.vp.ins@gmail.com",
    "unitycoldbrew@gmail.com",
    "cvrevival@gmail.com",
}


def log(msg, color=""):
    print(f"{color}{msg}{RESET}")


def get_service(account_name: str):
    token_path   = SCRIPT_DIR / f"token_{account_name}.json"
    creds_path   = SCRIPT_DIR / f"credentials_{account_name}.json"
    creds        = None

    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow  = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
            creds = flow.run_local_server(port=0)
        token_path.write_text(creds.to_json())

    return build("gmail", "v1", credentials=creds)


def should_skip(email: str) -> bool:
    email = email.lower()
    if email in OWN_EMAILS:
        return True
    for pat in SKIP_PATTERNS:
        if re.search(pat, email):
            return True
    return False


def extract_contacts_from_headers(headers: list) -> list[dict]:
    contacts = []
    for h in headers:
        name_lower = h.get("name", "").lower()
        if name_lower not in ("from", "to", "cc", "reply-to"):
            continue
        parsed = getaddresses([h.get("value", "")])
        for display_name, email in parsed:
            email = email.strip().lower()
            if not email or "@" not in email:
                continue
            if should_skip(email):
                continue
            name_parts = display_name.strip().split(None, 1)
            contacts.append({
                "email":      email,
                "firstName":  name_parts[0].title() if name_parts else "",
                "lastName":   name_parts[1].title() if len(name_parts) > 1 else "",
            })
    return contacts


ACCOUNT_SOURCES = {
    "personal":    "stuartteamps@gmail.com",
    "missinglink": "missinglink.solution@gmail.com",
    "danstuart":   "danstuart.vp.ins@gmail.com",
    "unity":       "unitycoldbrew@gmail.com",
    "cvrevival":   "cvrevival@gmail.com",
}


def scrape_account(account_name: str, max_scan: int = 2000) -> dict:
    source = ACCOUNT_SOURCES.get(account_name, account_name)
    log(f"\n  Scraping contacts from '{source}' (up to {max_scan} emails)...", CYAN)
    service    = get_service(account_name)
    contacts   = {}
    page_token = None
    scanned    = 0

    while scanned < max_scan:
        batch  = min(500, max_scan - scanned)
        kwargs = {"userId": "me", "maxResults": batch}
        if page_token:
            kwargs["pageToken"] = page_token

        try:
            result   = service.users().messages().list(**kwargs).execute()
            messages = result.get("messages", [])
        except HttpError as e:
            log(f"  API error: {e}", RED)
            break

        if not messages:
            break

        for msg_meta in messages:
            try:
                msg = service.users().messages().get(
                    userId="me",
                    id=msg_meta["id"],
                    format="metadata",
                    metadataHeaders=["From", "To", "Cc", "Reply-To"],
                ).execute()
            except HttpError:
                continue

            hdrs = msg.get("payload", {}).get("headers", [])
            for c in extract_contacts_from_headers(hdrs):
                email = c["email"]
                if email not in contacts:
                    c["source"] = source
                    contacts[email] = c
                elif not contacts[email]["firstName"] and c["firstName"]:
                    contacts[email]["firstName"] = c["firstName"]
                    contacts[email]["lastName"]  = c["lastName"]

            time.sleep(0.01)

        scanned   += len(messages)
        page_token = result.get("nextPageToken")
        if not page_token:
            break

    log(f"  Found {len(contacts)} unique contacts in '{source}'", GREEN)
    return contacts


def import_to_campaign(contacts: list[dict], campaign_name: str, dry_run: bool) -> dict:
    log(f"\n  Importing {len(contacts)} contacts → campaign '{campaign_name}'...", CYAN)

    if dry_run:
        log(f"  [DRY RUN] Would import {len(contacts)} contacts", YELLOW)
        return {"imported": 0, "duplicates": 0, "skipped": 0}

    url     = f"{NETLIFY_URL}/.netlify/functions/import-contacts"
    payload = {
        "campaignName":    campaign_name,
        "campaignType":    "general",
        "campaignSubject": "PropertyDNA Update",
        "contacts":        contacts,
    }
    headers = {
        "Content-Type":  "application/json",
        "x-internal-key": INTERNAL_API_KEY,
    }

    # Send in batches of 500
    total_imported = 0
    total_dupes    = 0
    total_skipped  = 0
    campaign_id    = None

    for i in range(0, len(contacts), 500):
        chunk = contacts[i : i + 500]
        body  = {**payload, "contacts": chunk}
        if campaign_id:
            body["campaignId"] = campaign_id

        try:
            resp = requests.post(url, json=body, headers=headers, timeout=30)
            data = resp.json()
            if resp.status_code == 200:
                total_imported += data.get("imported", 0)
                total_dupes    += data.get("duplicates", 0)
                total_skipped  += data.get("skipped", 0)
                if not campaign_id:
                    campaign_id = data.get("campaignId")
                log(f"  Batch {i//500 + 1}: +{data.get('imported',0)} imported, {data.get('duplicates',0)} dupes", GREEN)
            else:
                log(f"  Batch {i//500 + 1} error: {data}", RED)
        except Exception as e:
            log(f"  Batch {i//500 + 1} failed: {e}", RED)

        time.sleep(0.5)

    return {"imported": total_imported, "duplicates": total_dupes, "skipped": total_skipped, "campaignId": campaign_id}


def main():
    parser = argparse.ArgumentParser(description="Gmail Contact Scraper → PropertyDNA Campaign")
    parser.add_argument("--accounts",  nargs="+", default=["danstuart", "missinglink"],
                        help="Account names to scrape (must have token files)")
    parser.add_argument("--max-scan",  type=int, default=2000,
                        help="Max emails to scan per account (default: 2000)")
    parser.add_argument("--dry-run",   action="store_true",
                        help="Preview only — don't import")
    parser.add_argument("--campaign",  default="Gmail Contacts Import",
                        help="Campaign name to import into")
    parser.add_argument("--output-csv", action="store_true",
                        help="Also save contacts to contacts_export.csv")
    args = parser.parse_args()

    if args.dry_run:
        log("\n[DRY RUN — no changes will be made]\n", YELLOW + BOLD)

    all_contacts: dict[str, dict] = {}

    for account in args.accounts:
        token_path = SCRIPT_DIR / f"token_{account}.json"
        if not token_path.exists():
            log(f"\nNo token for '{account}' — run cleanup.py --accounts {account} first", RED)
            continue
        contacts = scrape_account(account, args.max_scan)
        for email, c in contacts.items():
            if email not in all_contacts:
                all_contacts[email] = c

    log(f"\n  Total unique contacts across all accounts: {len(all_contacts)}", BOLD)

    # Always save dated CSV to contacts/ folder
    import csv
    from datetime import datetime
    contacts_dir = SCRIPT_DIR / "contacts"
    contacts_dir.mkdir(exist_ok=True)
    date_str  = datetime.now().strftime("%Y-%m-%d")
    csv_path  = contacts_dir / f"contacts_{date_str}.csv"
    latest    = contacts_dir / "contacts_latest.csv"
    fieldnames = ["firstName", "lastName", "email", "source"]
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_contacts.values())
    with open(latest, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_contacts.values())
    log(f"  Saved {len(all_contacts)} contacts → {csv_path}", GREEN)
    log(f"  Also updated contacts_latest.csv", GREEN)

    if all_contacts:
        result = import_to_campaign(list(all_contacts.values()), args.campaign, args.dry_run)
        log(f"\n  Final: {result['imported']} imported, {result['duplicates']} already existed, {result['skipped']} invalid", GREEN + BOLD)
        if result.get("campaignId"):
            log(f"  Campaign ID: {result['campaignId']}", CYAN)

    log("\nDone.", GREEN + BOLD)


if __name__ == "__main__":
    main()
