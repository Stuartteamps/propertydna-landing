#!/usr/bin/env python3
"""
Gmail Spam Cleaner, Organizer & Unsubscriber
- Saves monthly bills and important work emails to labeled folders FIRST
- Then empties spam/trash and unsubscribes from newsletters
"""

import os
import sys
import json
import time
import base64
import argparse
import requests
import re
from pathlib import Path
from typing import Optional, Dict, List

try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print("Missing dependencies. Run: pip install -r requirements.txt")
    sys.exit(1)

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

# ── Keywords for smart labeling ──────────────────────────────────────────────

BILL_KEYWORDS = [
    "invoice", "bill", "statement", "payment due", "amount due",
    "receipt", "subscription", "renewal", "auto-pay", "autopay",
    "your receipt", "order confirmation", "charge", "transaction",
    "electric", "gas", "water", "utility", "utilities",
    "internet", "broadband", "phone", "wireless", "mobile",
    "rent", "mortgage", "hoa", "insurance", "premium",
    "netflix", "hulu", "spotify", "apple", "amazon prime",
    "at&t", "verizon", "t-mobile", "comcast", "xfinity",
    "pgne", "pg&e", "sce", "ladwp", "socal gas",
]

BILL_SENDERS = [
    "billing@", "invoices@", "noreply@", "no-reply@", "statements@",
    "payments@", "receipts@", "accounts@", "accountsreceivable@",
    "donotreply@", "do-not-reply@",
]

WORK_KEYWORDS = [
    # Real estate
    "escrow", "closing", "title", "listing", "mls", "offer",
    "purchase agreement", "contract", "counteroffer", "inspection",
    "appraisal", "contingency", "disclosure", "deed", "trust",
    "property", "real estate", "realtor", "agent", "broker",
    "commission", "transaction", "buyer", "seller", "tenant",
    "lease", "rental", "property management",
    # General business
    "proposal", "quote", "estimate", "signed", "docusign",
    "agreement", "partnership", "client", "meeting", "schedule",
    "follow up", "follow-up", "action required", "urgent",
    "deadline", "project", "deliverable", "milestone",
]

WORK_SENDERS_SKIP = [
    "noreply@", "no-reply@", "newsletter@", "marketing@",
    "news@", "updates@", "notifications@", "donotreply@",
]

# ─────────────────────────────────────────────────────────────────────────────

def log(msg, color=""):
    print(f"{color}{msg}{RESET}")


def get_service(account_name: str, creds_file: str = None):
    token_path = SCRIPT_DIR / f"token_{account_name}.json"
    creds = None

    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        elif creds_file and Path(creds_file).exists():
            flow = InstalledAppFlow.from_client_secrets_file(creds_file, SCOPES)
            creds = flow.run_local_server(port=0)
        else:
            import google.auth
            creds, _ = google.auth.default(scopes=SCOPES)
        token_path.write_text(creds.to_json())

    return build("gmail", "v1", credentials=creds)


def get_or_create_label(service, name: str) -> str:
    result = service.users().labels().list(userId="me").execute()
    for lbl in result.get("labels", []):
        if lbl["name"].lower() == name.lower():
            return lbl["id"]
    created = service.users().labels().create(
        userId="me",
        body={
            "name": name,
            "labelListVisibility": "labelShow",
            "messageListVisibility": "show",
        },
    ).execute()
    return created["id"]


def apply_label(service, message_ids: List[str], label_id: str):
    for i in range(0, len(message_ids), 1000):
        chunk = message_ids[i : i + 1000]
        service.users().messages().batchModify(
            userId="me",
            body={"ids": chunk, "addLabelIds": [label_id]},
        ).execute()
        time.sleep(0.1)


def batch_delete(service, message_ids: List[str]):
    if not message_ids:
        return
    for i in range(0, len(message_ids), 1000):
        chunk = message_ids[i : i + 1000]
        service.users().messages().batchDelete(
            userId="me", body={"ids": chunk}
        ).execute()
        time.sleep(0.2)


def is_bill(subject: str, sender: str, snippet: str) -> bool:
    text = f"{subject} {snippet}".lower()
    sender_lower = sender.lower()
    if any(k in text for k in BILL_KEYWORDS):
        return True
    if any(s in sender_lower for s in BILL_SENDERS) and any(
        k in text for k in ["invoice", "receipt", "bill", "statement", "charge", "payment", "order"]
    ):
        return True
    return False


def is_work(subject: str, sender: str, snippet: str) -> bool:
    sender_lower = sender.lower()
    if any(s in sender_lower for s in WORK_SENDERS_SKIP):
        return False
    text = f"{subject} {snippet}".lower()
    return any(k in text for k in WORK_KEYWORDS)


def organize_important_emails(service, dry_run: bool, max_scan: int = 1000) -> dict:
    log(f"\n  Scanning inbox for bills and work emails (up to {max_scan})...", CYAN)

    bill_ids = []
    work_ids = []
    page_token = None
    scanned = 0

    while scanned < max_scan:
        batch = min(500, max_scan - scanned)
        kwargs = {
            "userId": "me",
            "labelIds": ["INBOX"],
            "maxResults": batch,
        }
        if page_token:
            kwargs["pageToken"] = page_token

        result = service.users().messages().list(**kwargs).execute()
        messages = result.get("messages", [])
        if not messages:
            break

        for msg_meta in messages:
            try:
                msg = service.users().messages().get(
                    userId="me",
                    id=msg_meta["id"],
                    format="metadata",
                    metadataHeaders=["Subject", "From"],
                ).execute()
            except HttpError:
                continue

            hdrs = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
            subject = hdrs.get("subject", "")
            sender  = hdrs.get("from", "")
            snippet = msg.get("snippet", "")

            if is_bill(subject, sender, snippet):
                bill_ids.append(msg_meta["id"])
            elif is_work(subject, sender, snippet):
                work_ids.append(msg_meta["id"])

        scanned += len(messages)
        page_token = result.get("nextPageToken")
        if not page_token:
            break

    log(f"  Found {len(bill_ids)} bill emails, {len(work_ids)} work emails", YELLOW)

    if not dry_run:
        if bill_ids:
            bill_label = get_or_create_label(service, "Monthly Bills")
            apply_label(service, bill_ids, bill_label)
            log(f"  Labeled {len(bill_ids)} emails → 'Monthly Bills'", GREEN)
        if work_ids:
            work_label = get_or_create_label(service, "Important - Work")
            apply_label(service, work_ids, work_label)
            log(f"  Labeled {len(work_ids)} emails → 'Important - Work'", GREEN)
    else:
        if bill_ids:
            log(f"  [DRY RUN] Would label {len(bill_ids)} emails → 'Monthly Bills'", YELLOW)
        if work_ids:
            log(f"  [DRY RUN] Would label {len(work_ids)} emails → 'Important - Work'", YELLOW)

    return {"bills": len(bill_ids), "work": len(work_ids)}


def empty_label_folder(service, label: str, label_name: str, dry_run: bool) -> int:
    log(f"\n  Scanning {label_name}...", CYAN)
    total = 0
    page_token = None

    while True:
        kwargs = {"userId": "me", "labelIds": [label], "maxResults": 500}
        if page_token:
            kwargs["pageToken"] = page_token

        result = service.users().messages().list(**kwargs).execute()
        messages = result.get("messages", [])
        total += len(messages)

        if messages and not dry_run:
            batch_delete(service, [m["id"] for m in messages])

        page_token = result.get("nextPageToken")
        if not page_token:
            break

    if total == 0:
        log(f"  {label_name}: nothing to delete.", GREEN)
    elif dry_run:
        log(f"  {label_name}: would delete {total} messages (dry run)", YELLOW)
    else:
        log(f"  {label_name}: deleted {total} messages", GREEN)

    return total


def get_headers(msg) -> dict:
    return {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}


def extract_mailto(header: str) -> Optional[str]:
    match = re.search(r"<mailto:([^>]+)>", header)
    return match.group(1) if match else None


def extract_http_url(header: str) -> Optional[str]:
    match = re.search(r"<(https?://[^>]+)>", header)
    return match.group(1) if match else None


def one_click_unsubscribe(service, msg_id: str, url: str) -> bool:
    try:
        resp = requests.post(
            url,
            data="List-Unsubscribe=One-Click",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
        return resp.status_code < 400
    except Exception:
        return False


def mailto_unsubscribe(service, to_addr: str, from_addr: str) -> bool:
    subject = "Unsubscribe"
    if "?" in to_addr:
        to_addr, qs = to_addr.split("?", 1)
        for part in qs.split("&"):
            if part.lower().startswith("subject="):
                subject = part.split("=", 1)[1]

    raw_msg = f"From: me\r\nTo: {to_addr}\r\nSubject: {subject}\r\n\r\nUnsubscribe"
    encoded = base64.urlsafe_b64encode(raw_msg.encode()).decode()
    try:
        service.users().messages().send(
            userId="me", body={"raw": encoded}
        ).execute()
        return True
    except Exception:
        return False


def find_and_unsubscribe(service, dry_run: bool, max_scan: int = 500) -> dict:
    log(f"\n  Scanning inbox for newsletters (up to {max_scan} emails)...", CYAN)

    result = service.users().messages().list(
        userId="me", q="in:inbox has:list-unsubscribe", maxResults=max_scan
    ).execute()
    messages = result.get("messages", [])

    if not messages:
        log("  No newsletter emails found.", GREEN)
        return {"found": 0, "unsubscribed": 0, "deleted": 0}

    log(f"  Found {len(messages)} newsletter emails", YELLOW)

    senders: Dict[str, dict] = {}

    for msg_meta in messages:
        try:
            msg = service.users().messages().get(
                userId="me",
                id=msg_meta["id"],
                format="metadata",
                metadataHeaders=["List-Unsubscribe", "List-Unsubscribe-Post", "From", "Subject"],
            ).execute()
        except HttpError:
            continue

        hdrs = get_headers(msg)
        unsub_header = hdrs.get("list-unsubscribe", "")
        if not unsub_header:
            continue

        from_addr = hdrs.get("from", "unknown")
        if from_addr not in senders:
            senders[from_addr] = {
                "ids": [],
                "unsub_header": unsub_header,
                "post_header": hdrs.get("list-unsubscribe-post", ""),
                "subject": hdrs.get("subject", ""),
            }
        senders[from_addr]["ids"].append(msg_meta["id"])

    unsubscribed = 0
    deleted = 0
    ids_to_delete = []

    for sender, info in senders.items():
        header      = info["unsub_header"]
        mailto      = extract_mailto(header)
        http_url    = extract_http_url(header)
        is_one_click = "one-click" in info["post_header"].lower()

        if dry_run:
            log(f"  [DRY RUN] Would unsubscribe from: {sender[:60]}", YELLOW)
            unsubscribed += 1
            deleted += len(info["ids"])
            continue

        success = False
        action  = ""

        if is_one_click and http_url:
            success = one_click_unsubscribe(service, info["ids"][0], http_url)
            action = "one-click HTTP"
        elif mailto:
            success = mailto_unsubscribe(service, mailto, sender)
            action = "mailto"
        elif http_url:
            success = True
            action = "web-only (deleted)"

        if success:
            unsubscribed += 1
            ids_to_delete.extend(info["ids"])
            log(f"  Unsubscribed [{action}]: {sender[:60]}", GREEN)
        else:
            log(f"  Skipped (couldn't unsubscribe): {sender[:50]}", YELLOW)

    if ids_to_delete and not dry_run:
        batch_delete(service, ids_to_delete)
        deleted = len(ids_to_delete)
        log(f"\n  Deleted {deleted} newsletter emails", GREEN)

    return {"found": len(messages), "unsubscribed": unsubscribed, "deleted": deleted}


def run_account(account_name: str, creds_file: str, dry_run: bool, skip_unsub: bool, max_scan: int):
    log(f"\n{'='*55}", BOLD)
    log(f"  Account: {account_name}", BOLD)
    log(f"{'='*55}", BOLD)

    service = get_service(account_name, creds_file)

    # Step 1: Label and protect important emails FIRST
    log("\n[ Step 1: Saving bills & work emails to folders ]", BOLD)
    org = organize_important_emails(service, dry_run, max_scan)

    # Step 2: Empty spam and trash
    log("\n[ Step 2: Cleaning spam & trash ]", BOLD)
    empty_label_folder(service, "SPAM",  "Spam folder",  dry_run)
    empty_label_folder(service, "TRASH", "Trash folder", dry_run)

    # Step 3: Unsubscribe from newsletters
    if not skip_unsub:
        log("\n[ Step 3: Unsubscribing from newsletters ]", BOLD)
        stats = find_and_unsubscribe(service, dry_run, max_scan)
        log(
            f"\n  Unsubscribe summary: {stats['unsubscribed']} unsubscribed, "
            f"{stats['deleted']} emails deleted",
            GREEN,
        )
    else:
        log("\n  Skipped unsubscribe scan (--no-unsub)", YELLOW)

    log(
        f"\n  Organized: {org['bills']} bills, {org['work']} work emails labeled",
        GREEN,
    )


def main():
    parser = argparse.ArgumentParser(description="Gmail Organizer, Spam Cleaner & Unsubscriber")
    parser.add_argument("--accounts", nargs="+", default=["personal"],
                        help="Account nicknames matching credentials_NAME.json files")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview actions without making any changes")
    parser.add_argument("--no-unsub", action="store_true",
                        help="Skip newsletter unsubscribe scan")
    parser.add_argument("--max-scan", type=int, default=1000,
                        help="Max emails to scan per account (default: 1000)")
    args = parser.parse_args()

    if args.dry_run:
        log("\n[DRY RUN MODE — no changes will be made]\n", YELLOW + BOLD)

    for account in args.accounts:
        creds_file = str(SCRIPT_DIR / f"credentials_{account}.json")
        if not Path(creds_file).exists():
            log(f"\nMissing: {creds_file}", RED)
            continue
        try:
            run_account(account, creds_file, args.dry_run, args.no_unsub, args.max_scan)
        except Exception as e:
            log(f"\nError on account {account}: {e}", RED)

    log("\nAll done.", GREEN + BOLD)


if __name__ == "__main__":
    main()
