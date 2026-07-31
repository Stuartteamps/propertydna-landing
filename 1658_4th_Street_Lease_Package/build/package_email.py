# -*- coding: utf-8 -*-
"""Create the delivery ZIP and a ready-to-send .eml with attachments."""
import os, zipfile, base64
from email.message import EmailMessage

PKG = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

TO = "stuartteamps@gmail.com"
FROM = "stuartteamps@gmail.com"
SUBJECT = "1658 4th Street — Month-to-Month Lease Package"
BODY = """Hi Daniel,

Attached is the draft month-to-month residential lease package for 1658 4th Street, Coachella, California 92236. The proposed rent is $1,000 per month.

The package includes the lease, house rules, additional-terms page, move-in documents, disclosure checklist, and owner guidance. The landlord and tenant should complete all blanks and confirm which disclosures apply before signing.

This is an independently prepared template and has not been represented as legal advice or as an attorney-reviewed document. Because California landlord-tenant law and termination requirements depend on the property and circumstances, the owner should have a California landlord-tenant attorney review it before use.

Thank you.
"""

ALL_FILES = [
    "1658_4th_Street_Month_to_Month_Lease.docx",
    "1658_4th_Street_Month_to_Month_Lease.pdf",
    "1658_4th_Street_Owner_Guidance.pdf",
    "1658_4th_Street_Disclosure_Checklist.pdf",
    "1658_4th_Street_Complete_Lease_Package.pdf",
    "California_Law_Sources.txt",
]
# Attachments for the email itself (per task instructions)
ATTACH = [
    "1658_4th_Street_Complete_Lease_Package.pdf",
    "1658_4th_Street_Month_to_Month_Lease.docx",
]

def build_zip():
    zpath = os.path.join(PKG, "1658_4th_Street_Lease_Package.zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for f in ALL_FILES:
            z.write(os.path.join(PKG, f), arcname=f)
    return zpath

def build_eml():
    msg = EmailMessage()
    msg["Subject"] = SUBJECT
    msg["From"] = FROM
    msg["To"] = TO
    msg.set_content(BODY)
    for f in ATTACH:
        p = os.path.join(PKG, f)
        with open(p, "rb") as fh:
            data = fh.read()
        if f.endswith(".pdf"):
            maintype, subtype = "application", "pdf"
        elif f.endswith(".docx"):
            maintype, subtype = ("application",
                                 "vnd.openxmlformats-officedocument.wordprocessingml.document")
        else:
            maintype, subtype = "application", "octet-stream"
        msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=f)
    epath = os.path.join(PKG, "1658_4th_Street_Lease_Package.eml")
    with open(epath, "wb") as fh:
        fh.write(bytes(msg))
    return epath

if __name__ == "__main__":
    z = build_zip()
    e = build_eml()
    print("ZIP:", z, os.path.getsize(z), "bytes")
    print("EML:", e, os.path.getsize(e), "bytes")
    # emit base64 sizes for the two attachments (for the Gmail draft attempt)
    for f in ATTACH:
        p = os.path.join(PKG, f)
        b64 = base64.b64encode(open(p, "rb").read()).decode()
        print(f"B64 {f}: {len(b64)} chars ({os.path.getsize(p)} bytes)")
