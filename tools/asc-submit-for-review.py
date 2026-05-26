#!/usr/bin/env python3
"""
PropertyDNA — App Store Connect API submission helper.

After auto-submit-testflight.sh uploads a build, this script:
  1. Authenticates with the App Store Connect API (JWT signed by the .p8 key).
  2. Waits for the uploaded build to finish PROCESSING.
  3. Cancels any prior WAITING_FOR_REVIEW submission on the same version.
  4. Attaches the new build to the App Store version.
  5. Updates "What's New", Promotional Text, and App Review notes.
  6. Creates a new reviewSubmission, adds the version as an item, submits it.

Required env vars (same ones auto-submit-testflight.sh uses):
  APP_STORE_CONNECT_KEY_ID
  APP_STORE_CONNECT_ISSUER_ID
  APP_STORE_CONNECT_KEY_PATH

App-specific config is at the top of the file. Build number is read from
the iOS project automatically.
"""
from __future__ import annotations
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

import jwt  # pyjwt

# ── Config ──────────────────────────────────────────────────────────────────
APP_ID = "6768064079"
BUNDLE_ID = "com.thepropertydna.app"
TEAM_ID = "8NR9GCA6GQ"
PROJECT_PBXPROJ = "/Users/danstuart/propertydna-landing/app/frontend/ios/App/App.xcodeproj/project.pbxproj"
NOTES_FILE = "/Users/danstuart/propertydna-landing/BUILD_10_NOTES.md"

API_BASE = "https://api.appstoreconnect.apple.com/v1"


def log(msg: str) -> None:
    print(f"{datetime.now().strftime('%H:%M:%S')} {msg}", flush=True)


# ── JWT auth ────────────────────────────────────────────────────────────────
def make_jwt() -> str:
    key_id = os.environ["APP_STORE_CONNECT_KEY_ID"]
    issuer_id = os.environ["APP_STORE_CONNECT_ISSUER_ID"]
    key_path = os.path.expanduser(os.environ["APP_STORE_CONNECT_KEY_PATH"])
    with open(key_path, "rb") as f:
        private_key = f.read()
    now = datetime.now(tz=timezone.utc)
    payload = {
        "iss": issuer_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=18)).timestamp()),
        "aud": "appstoreconnect-v1",
    }
    headers = {"kid": key_id, "typ": "JWT"}
    return jwt.encode(payload, private_key, algorithm="ES256", headers=headers)


def api(method: str, path: str, body: dict | None = None, token: str | None = None) -> dict:
    if token is None:
        token = make_jwt()
    url = path if path.startswith("http") else f"{API_BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body_text = e.read().decode(errors="replace")
        log(f"HTTP {e.code} on {method} {url}")
        log(body_text)
        raise


# ── Build number helpers ────────────────────────────────────────────────────
def current_build_number() -> str:
    with open(PROJECT_PBXPROJ) as f:
        for line in f:
            m = re.search(r"CURRENT_PROJECT_VERSION = (\d+);", line)
            if m:
                return m.group(1)
    raise RuntimeError("Could not read CURRENT_PROJECT_VERSION from project.pbxproj")


def current_marketing_version() -> str:
    with open(PROJECT_PBXPROJ) as f:
        for line in f:
            m = re.search(r"MARKETING_VERSION = ([\d.]+);", line)
            if m:
                return m.group(1)
    raise RuntimeError("Could not read MARKETING_VERSION from project.pbxproj")


# ── Notes parsing ──────────────────────────────────────────────────────────
def load_notes() -> dict:
    with open(NOTES_FILE) as f:
        text = f.read()

    def section(name: str) -> str:
        pattern = rf"## {re.escape(name)}.*?\n\n(.*?)(?=\n## |\Z)"
        m = re.search(pattern, text, re.DOTALL)
        return m.group(1).strip() if m else ""

    return {
        "whats_new": section("What's New in This Version (≤4,000 chars; ASC versionString)"),
        "promo": section("Promotional Text (≤170 chars)"),
        "review_notes": section("App Review Notes (private — Apple reviewer only)"),
        "resolution_center": section("Resolution Center Reply (if Build 9 had open 4.2 ticket — paste in ASC UI)"),
    }


# ── Wait for build to finish processing ────────────────────────────────────
def find_build(build_number: str, marketing: str, timeout_min: int = 30) -> dict | None:
    deadline = time.time() + timeout_min * 60
    while time.time() < deadline:
        token = make_jwt()
        # Filter builds for this app + this version + this build number.
        path = (
            f"/builds?filter[app]={APP_ID}"
            f"&filter[preReleaseVersion.version]={marketing}"
            f"&filter[version]={build_number}"
            "&limit=10&include=preReleaseVersion"
        )
        resp = api("GET", path, token=token)
        builds = resp.get("data", [])
        if builds:
            b = builds[0]
            state = b["attributes"].get("processingState", "UNKNOWN")
            log(f"  build {build_number} state: {state}")
            if state == "VALID":
                return b
            if state in ("FAILED", "INVALID"):
                raise RuntimeError(f"Build {build_number} processing failed: {state}")
        else:
            log(f"  build {build_number} not yet visible in ASC")
        time.sleep(45)
    return None


# ── App Store version helpers ──────────────────────────────────────────────
def find_or_create_version(marketing: str) -> dict:
    token = make_jwt()
    resp = api("GET", f"/apps/{APP_ID}/appStoreVersions?limit=10", token=token)
    versions = resp.get("data", [])
    # States Apple considers "editable" for a resubmission: PREPARE_FOR_SUBMISSION,
    # METADATA_REJECTED, REJECTED, DEVELOPER_REJECTED, INVALID_BINARY,
    # WAITING_FOR_REVIEW (we'll cancel review first), etc. READY_FOR_SALE means
    # the version already shipped — we should create a new one for that.
    SHIPPED = {"READY_FOR_SALE", "PROCESSING_FOR_APP_STORE", "PENDING_DEVELOPER_RELEASE", "PENDING_APPLE_RELEASE"}
    for v in versions:
        if v["attributes"]["versionString"] == marketing:
            state = v["attributes"]["appStoreState"]
            if state in SHIPPED:
                log(f"Existing v{marketing} is {state} — must create new version")
                continue
            log(f"Found existing editable v{marketing} (state={state})")
            return v
    log(f"Creating new appStoreVersion v{marketing}")
    body = {
        "data": {
            "type": "appStoreVersions",
            "attributes": {
                "platform": "IOS",
                "versionString": marketing,
                "copyright": f"© {datetime.now().year} PropertyDNA",
                "releaseType": "MANUAL",
            },
            "relationships": {
                "app": {"data": {"type": "apps", "id": APP_ID}},
            },
        }
    }
    return api("POST", "/appStoreVersions", body=body, token=token)["data"]


def cancel_open_review(version_id: str) -> None:
    token = make_jwt()
    resp = api("GET", f"/reviewSubmissions?filter[app]={APP_ID}&filter[platform]=IOS&limit=20", token=token)
    # States that lock the appStoreVersion and need to be cancelled before
    # we can attach it to a new submission. UNRESOLVED_ISSUES is the
    # post-rejection state where Apple is waiting for a Resolution Center
    # response — for an API-driven flow we cancel it instead. READY_FOR_REVIEW
    # is a draft that hasn't been submitted; Apple doesn't allow cancelling
    # it via the API, but it also doesn't block new submissions.
    LOCKING = {"WAITING_FOR_REVIEW", "IN_REVIEW", "UNRESOLVED_ISSUES"}
    cancelled_ids: list[str] = []
    for sub in resp.get("data", []):
        state = sub["attributes"].get("state", "")
        if state in LOCKING:
            log(f"  cancelling blocking review submission {sub['id']} (state={state})")
            try:
                api(
                    "PATCH",
                    f"/reviewSubmissions/{sub['id']}",
                    body={"data": {"type": "reviewSubmissions", "id": sub["id"], "attributes": {"canceled": True}}},
                    token=token,
                )
                cancelled_ids.append(sub["id"])
            except urllib.error.HTTPError as e:
                log(f"    (could not cancel {sub['id']}: HTTP {e.code} — continuing)")

    # Wait briefly for CANCELING → CANCELED so the version becomes free.
    if cancelled_ids:
        log("  waiting for cancellation to finalize…")
        for _ in range(24):  # up to ~2 min
            time.sleep(5)
            tok = make_jwt()
            still_pending = False
            for sid in cancelled_ids:
                try:
                    r = api("GET", f"/reviewSubmissions/{sid}", token=tok)
                    st = r["data"]["attributes"].get("state")
                    if st == "CANCELING":
                        still_pending = True
                except urllib.error.HTTPError as e:
                    if e.code == 404:
                        # Submission was deleted after cancel — finalized
                        continue
                    raise
            if not still_pending:
                log("  cancellation finalized")
                return
        log("  (cancellation still pending — continuing anyway)")


def attach_build_to_version(version_id: str, build_id: str) -> None:
    token = make_jwt()
    body = {"data": {"type": "builds", "id": build_id}}
    api("PATCH", f"/appStoreVersions/{version_id}/relationships/build", body=body, token=token)


def update_version_metadata(version_id: str, marketing: str, notes: dict) -> None:
    token = make_jwt()
    # Update localization. For v1.0 (initial release) whatsNew is null and
    # cannot be set — Apple rejects with STATE_ERROR "cannot be edited at
    # this time". Only set whatsNew if the version already has a previous
    # whatsNew value (i.e. this is an update, not initial submission).
    locs = api("GET", f"/appStoreVersions/{version_id}/appStoreVersionLocalizations", token=token)
    for loc in locs.get("data", []):
        locale = loc["attributes"].get("locale")
        existing_whats_new = loc["attributes"].get("whatsNew")
        if not (locale and (locale.startswith("en") or len(locs.get("data", [])) == 1)):
            continue
        attrs = {"promotionalText": notes["promo"][:170]}
        if existing_whats_new is not None:
            attrs["whatsNew"] = notes["whats_new"][:4000]
        log(f"  updating localization {loc['id']} ({locale}) with {list(attrs)}")
        try:
            api(
                "PATCH",
                f"/appStoreVersionLocalizations/{loc['id']}",
                body={"data": {"type": "appStoreVersionLocalizations", "id": loc["id"], "attributes": attrs}},
                token=token,
            )
        except urllib.error.HTTPError as e:
            log(f"    (localization update failed: HTTP {e.code} — continuing)")

    # Update App Review notes via appStoreReviewDetails
    rev = api("GET", f"/appStoreVersions/{version_id}/appStoreReviewDetail", token=token)
    rev_data = rev.get("data")
    if rev_data:
        log(f"  updating appStoreReviewDetail {rev_data['id']} with new notes")
        try:
            api(
                "PATCH",
                f"/appStoreReviewDetails/{rev_data['id']}",
                body={
                    "data": {
                        "type": "appStoreReviewDetails",
                        "id": rev_data["id"],
                        "attributes": {
                            "notes": notes["review_notes"][:4000],
                            "demoAccountRequired": False,
                        },
                    }
                },
                token=token,
            )
        except urllib.error.HTTPError as e:
            log(f"    (review detail update failed: HTTP {e.code} — continuing)")
    else:
        log("  no appStoreReviewDetail found (skipping notes update)")


def submit_for_review(version_id: str) -> str:
    token = make_jwt()
    log("Creating reviewSubmission")
    create = api(
        "POST",
        "/reviewSubmissions",
        body={
            "data": {
                "type": "reviewSubmissions",
                "attributes": {"platform": "IOS"},
                "relationships": {"app": {"data": {"type": "apps", "id": APP_ID}}},
            }
        },
        token=token,
    )
    sub_id = create["data"]["id"]
    log(f"  reviewSubmission id={sub_id}")

    log("Adding version as submission item")
    api(
        "POST",
        "/reviewSubmissionItems",
        body={
            "data": {
                "type": "reviewSubmissionItems",
                "relationships": {
                    "appStoreVersion": {"data": {"type": "appStoreVersions", "id": version_id}},
                    "reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sub_id}},
                },
            }
        },
        token=token,
    )

    log("Submitting review")
    api(
        "PATCH",
        f"/reviewSubmissions/{sub_id}",
        body={"data": {"type": "reviewSubmissions", "id": sub_id, "attributes": {"submitted": True}}},
        token=token,
    )
    return sub_id


# ── Main flow ───────────────────────────────────────────────────────────────
def main() -> int:
    for var in ("APP_STORE_CONNECT_KEY_ID", "APP_STORE_CONNECT_ISSUER_ID", "APP_STORE_CONNECT_KEY_PATH"):
        if not os.environ.get(var):
            log(f"ERROR: env var {var} is required")
            return 1

    build_number = current_build_number()
    marketing = current_marketing_version()
    log(f"Target: PropertyDNA v{marketing} (build {build_number})")

    notes = load_notes()
    log(f"Notes loaded: whatsNew={len(notes['whats_new'])} chars, promo={len(notes['promo'])} chars, review={len(notes['review_notes'])} chars")

    log(f"Waiting for build {build_number} to finish processing on ASC…")
    build = find_build(build_number, marketing, timeout_min=30)
    if not build:
        log("ERROR: build did not appear / finish processing within timeout")
        return 2
    build_id = build["id"]
    log(f"  build VALID, id={build_id}")

    version = find_or_create_version(marketing)
    version_id = version["id"]
    log(f"App Store version id={version_id} state={version['attributes']['appStoreState']}")

    cancel_open_review(version_id)
    attach_build_to_version(version_id, build_id)
    update_version_metadata(version_id, marketing, notes)
    sub_id = submit_for_review(version_id)

    log("═══════════════════════════════════════════════════")
    log(f"✅ SUBMITTED FOR REVIEW")
    log(f"   reviewSubmission id: {sub_id}")
    log(f"   appStoreVersion id:  {version_id}")
    log(f"   build id:            {build_id}")
    log(f"   v{marketing} (build {build_number})")
    log("═══════════════════════════════════════════════════")
    return 0


if __name__ == "__main__":
    sys.exit(main())
