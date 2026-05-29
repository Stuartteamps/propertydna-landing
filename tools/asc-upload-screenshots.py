#!/usr/bin/env python3
"""Replace the App Store screenshots in the en-US APP_IPHONE_67 set.

Deletes the existing screenshots, then reservation-uploads the new native
captures (create -> PUT to upload operations -> commit with md5 -> poll).
"""
import json, sys, time, hashlib, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone
import jwt

KEY_ID="QWGUF3DZ4F"; ISSUER="a3b6d4a4-760b-4e37-846e-6c2a9f2f536d"
KEY_PATH="/Users/danstuart/.appstoreconnect/private_keys/AuthKey_QWGUF3DZ4F.p8"
SET_ID="3b4c25e2-1d37-42cd-8807-46c67fa10c40"
BASE="https://api.appstoreconnect.apple.com/v1"
SHOTS=[
  ("/tmp/pdna-final-1-home.png","01-home.png"),
  ("/tmp/pdna-final-2-map.png","02-map.png"),
  ("/tmp/pdna-final-3-settings.png","03-settings.png"),
  ("/tmp/pdna-final-4-search.png","04-analyze.png"),
]

def tok():
    k=open(KEY_PATH,'rb').read(); now=datetime.now(tz=timezone.utc)
    return jwt.encode({"iss":ISSUER,"iat":int(now.timestamp()),"exp":int((now+timedelta(minutes=18)).timestamp()),"aud":"appstoreconnect-v1"},k,algorithm="ES256",headers={"kid":KEY_ID,"typ":"JWT"})

def api(method, path, body=None):
    url = path if path.startswith("http") else BASE+path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization","Bearer "+tok())
    req.add_header("Content-Type","application/json")
    try:
        with urllib.request.urlopen(req,timeout=60) as r:
            raw=r.read().decode(); return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} {method} {url}\n{e.read().decode()[:500]}"); raise

def put_bytes(url, headers, payload):
    req = urllib.request.Request(url, data=payload, method="PUT")
    for h in headers: req.add_header(h["name"], h["value"])
    with urllib.request.urlopen(req,timeout=120) as r:
        return r.status

# 1. delete old screenshots in the set
existing = api("GET", f"/appScreenshotSets/{SET_ID}/appScreenshots?limit=50")
for sc in existing.get("data",[]):
    print("deleting old screenshot", sc["id"])
    api("DELETE", f"/appScreenshots/{sc['id']}")

# 2. upload each new screenshot
for path, name in SHOTS:
    blob=open(path,"rb").read(); size=len(blob)
    md5=hashlib.md5(blob).hexdigest()
    print(f"\nreserving {name} ({size} bytes)")
    res=api("POST","/appScreenshots",{"data":{"type":"appScreenshots","attributes":{"fileName":name,"fileSize":size},"relationships":{"appScreenshotSet":{"data":{"type":"appScreenshotSets","id":SET_ID}}}}})
    sid=res["data"]["id"]
    ops=res["data"]["attributes"]["uploadOperations"]
    for op in ops:
        chunk=blob[op["offset"]:op["offset"]+op["length"]]
        st=put_bytes(op["url"], op.get("requestHeaders",[]), chunk)
        print(f"  PUT part offset={op['offset']} len={op['length']} -> {st}")
    api("PATCH", f"/appScreenshots/{sid}", {"data":{"type":"appScreenshots","id":sid,"attributes":{"uploaded":True,"sourceFileChecksum":md5}}})
    # poll asset delivery
    for _ in range(20):
        time.sleep(3)
        chk=api("GET", f"/appScreenshots/{sid}")
        state=chk["data"]["attributes"].get("assetDeliveryState",{}).get("state")
        if state in ("COMPLETE","UPLOAD_COMPLETE"):
            print(f"  {name} -> {state}"); break
        if state in ("FAILED",):
            print(f"  {name} FAILED:", json.dumps(chk["data"]["attributes"].get("assetDeliveryState",{}))); sys.exit(2)
    else:
        print(f"  {name} still processing (state={state}) — continuing")

print("\nDONE — verifying final set contents")
final=api("GET", f"/appScreenshotSets/{SET_ID}/appScreenshots?limit=50")
for sc in final.get("data",[]):
    a=sc["attributes"]
    print("  -", a.get("fileName"), a.get("assetDeliveryState",{}).get("state"))
