# -*- coding: utf-8 -*-
"""Finalize build with verified owner-guidance assumptions and disclosure sources note."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from build_all import build

SOURCES_NOTE = (
    "Legal basis reviewed against current California statutes (see California_Law_Sources.txt). "
    "This worksheet is a checklist only; it does not itself satisfy any disclosure. Confirm which items "
    "apply to this property before signing, and attach each completed disclosure to the signed Agreement."
)

ASSUMPTIONS_HTML = """
<p>The blanks in this template were intentionally left for the parties to complete. The following facts were
not supplied and must be confirmed before the lease is signed or relied upon. These notes are for the owner
and are not part of the signed lease.</p>
<ul class="clean">
  <li><strong>Rent shown as $1,000.00 per month.</strong> This figure was provided; confirm it is correct and
      that any future increase follows the applicable law (for a covered unit, the annual cap is the lower of
      5% plus regional CPI or 10% under Civil Code &sect; 1947.12).</li>
  <li><strong>Landlord and Tenant identities, contact information, beginning date, rent due date, security-deposit
      amount, payment location, late-fee and returned-payment amounts, grace period, guest-night limits, and
      utility allocation</strong> were all left blank and must be completed.</li>
  <li><strong>Security deposit.</strong> Under current law (Civil Code &sect; 1950.5, as amended by AB 12) the
      deposit generally may not exceed one month&rsquo;s rent. A limited exception allows up to two months for a
      landlord who is a natural person (or an LLC of natural persons) owning no more than two residential rental
      properties totaling no more than four units &mdash; but never two months where the tenant is an active-duty
      service member. Confirm which cap applies before filling in the amount.</li>
  <li><strong>Tenant Protection Act status is undetermined.</strong> Whether this tenancy is covered by, or exempt
      from, Civil Code &sect;&sect; 1946.2 and 1947.12 depends on the ownership entity, whether the unit is a
      separately alienable single-family home or condominium, whether the building received its certificate of
      occupancy within the last 15 years, how long the tenant occupies the unit (the just-cause protection attaches
      after 12 months), and whether a legally sufficient written exemption notice is given. <em>No exemption is
      assumed.</em> Use the optional exemption addendum only after confirming the property qualifies and obtaining
      legal guidance; if the required notice is not given, the unit is treated as covered.</li>
  <li><strong>Termination notice period.</strong> For a month-to-month tenancy, the landlord&rsquo;s notice is
      generally 30 days, but 60 days if any tenant has lived in the unit a year or more; a covered tenancy past 12
      months also requires just cause and, for a no-fault termination, relocation assistance equal to one
      month&rsquo;s rent. The correct notice is determined at the time of termination, not in this lease.</li>
  <li><strong>Local rules &mdash; City of Coachella / Riverside County.</strong> Research indicated the property
      sits inside the incorporated City of Coachella and that, as of mid-2026, no local residential rent-control,
      rent-stabilization, or just-cause eviction ordinance, and no long-term residential rental-registration or
      landlord-licensing requirement, was found for the City of Coachella or for unincorporated Riverside County.
      (The City&rsquo;s licensing rules apply to short-term / vacation rentals of 30 days or less, which this lease
      is not.) Confirm the exact parcel and reconfirm current local ordinances before serving any notice.</li>
  <li><strong>Building age (lead-based paint).</strong> Whether any part of the dwelling was built before 1978 was
      not confirmed. If it was, the federal lead-based paint disclosure and EPA pamphlet are required.</li>
  <li><strong>Flood zone, mold, pest-control contract, prior death, contamination order, military-ordnance
      proximity, shared meters, and smoking policy</strong> are fact-dependent. Complete the Disclosure Worksheet
      for this specific property.</li>
  <li><strong>Verification limitation.</strong> The statutory citations in this package were checked against
      current California law using automated research. During that research, direct access to the primary
      legislative website was limited, so the exact statutory wording &mdash; especially the verbatim
      Tenant Protection Act exemption notice, the Megan&rsquo;s Law notice, and any contamination acknowledgment
      &mdash; should be confirmed against the official primary sources (leginfo.legislature.ca.gov) before use.
      This template is not legal advice and has not been reviewed by an attorney.</li>
</ul>
<p>Have a California landlord-tenant attorney review this package for your specific property and situation before
you use it, complete the fee and deposit blanks, or serve any notice.</p>
"""

if __name__ == "__main__":
    complete = build(SOURCES_NOTE, ASSUMPTIONS_HTML)
    print("COMPLETE PACKAGE:", complete)
