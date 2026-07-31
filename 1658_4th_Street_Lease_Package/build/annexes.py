# -*- coding: utf-8 -*-
"""Body HTML for house rules, additional terms, move-in forms, receipts, disclosure checklist."""
from helpers import fill, line, initials_clause, section, grid, blank_grid, numbered_blank_lines

ADDR = "1658 4th Street, Coachella, California 92236"

def _titleblock(title, subtitle, badge=None):
    bd = f'<span class="badge {badge[1]}">{badge[0]}</span><br>' if badge else ''
    sub = f'<div class="doc-subtitle">{subtitle}</div>' if subtitle else ''
    return (f'<div style="text-align:center">{bd}</div>'
            f'<div class="doc-title">{title}</div>{sub}<hr class="rule">')

# ---------------------------------------------------------------- House Rules
def house_rules_body():
    b = [_titleblock("HOUSE RULES AND MATERIAL TERMS",
                     "Attachment to the Month-to-Month Residential Rental Agreement")]
    b.append('<p class="caption">These House Rules are part of the Agreement. The Landlord and the Tenant '
             'initial each rule to show it was read and agreed. If any rule conflicts with California law or a '
             'local ordinance, the law or ordinance controls and the remaining rules stay in effect.</p>')

    rules = [
        ("A. Quiet Hours",
         "Quiet hours are from 10:00 p.m. until 8:00 a.m. During quiet hours, no excessive noise, amplified "
         "music, shouting, disruptive gatherings, or conduct that unreasonably disturbs neighbors is permitted."),
        ("B. Parties and Gatherings",
         "No wild, excessive, commercial, or disruptive parties are permitted. Gatherings must not create "
         "excessive noise, parking problems, property damage, illegal activity, nuisance conditions, or "
         "unreasonable disturbance. All gatherings must comply with quiet hours beginning at 10:00 p.m."),
        ("C. Bonfires and Open Flames",
         "No bonfires, fire pits, outdoor burning, fireworks, or other open flames are permitted unless: "
         "(1) the Landlord gives prior written approval; (2) the activity is legal under all applicable fire and "
         "municipal rules; (3) any required permit is obtained; and (4) no burn ban or fire restriction is in "
         "effect."),
        ("D. Guest Responsibility",
         "The Tenant is responsible for the conduct of guests and for damage, nuisance, or lease violations "
         "caused by guests, to the extent permitted by law."),
        ("E. No Additional Residents",
         "No additional relatives or other persons may move into or establish residency at the Premises without "
         "the Landlord&rsquo;s prior written approval."),
        ("F. No Illegal Activity",
         "No unlawful activity, nuisance, threats, violence, or substantial interference with neighbors&rsquo; "
         "peaceful enjoyment is permitted."),
        ("G. Property Care",
         "The Premises must be maintained in a clean, sanitary, and reasonably safe condition."),
    ]
    for head, text in rules:
        b.append(f'<div class="keepwith"><h3 class="subhead">{head}</h3>'
                 + initials_clause(f'<p class="tight">{text}</p>') + '</div>')

    b.append('<div class="keepwith"><h3 class="subhead">Acknowledgment</h3>'
             '<p class="tight">The Landlord and the Tenant have read and agree to the House Rules above.</p>'
             '<div class="sigrow">'
             '<div class="sigcol"><div style="height:16pt"></div><div class="sigline"></div>'
             '<div class="sigcap">Landlord signature / Date</div></div>'
             '<div class="sigcol"><div style="height:16pt"></div><div class="sigline"></div>'
             '<div class="sigcap">Tenant signature / Date</div></div></div></div>')
    return "\n".join(b)

# ---------------------------------------------------------------- Additional Terms
def additional_terms_body():
    b = [_titleblock("ADDITIONAL AGREED TERMS",
                     "Attachment to the Month-to-Month Residential Rental Agreement")]
    b.append('<div class="note">Any additional term must be lawful. Each term must be agreed to and initialed by '
             'both the Landlord and the Tenant. A handwritten or typed term does not override California law. An '
             'unenforceable additional term does not invalidate the rest of the Agreement.</div>')
    b.append(numbered_blank_lines(12))
    b.append('<div class="keepwith"><div class="sigrow">'
             '<div class="sigcol"><span class="ibox"><span class="line"></span>'
             '<span class="cap">Landlord initials</span></span></div>'
             '<div class="sigcol"><span class="ibox"><span class="line"></span>'
             '<span class="cap">Tenant initials</span></span></div></div>'
             '<div class="sigrow">'
             '<div class="sigcol"><div style="height:14pt"></div><div class="sigline"></div>'
             '<div class="sigcap">Landlord signature / Date</div></div>'
             '<div class="sigcol"><div style="height:14pt"></div><div class="sigline"></div>'
             '<div class="sigcap">Tenant signature / Date</div></div></div></div>')
    return "\n".join(b)

# ---------------------------------------------------------------- Move-In Checklist
def movein_body():
    b = [_titleblock("MOVE-IN CONDITION CHECKLIST", "One-page record of the condition of the Premises at move-in")]
    b.append('<p class="caption">Property: <strong>' + ADDR + '</strong> &nbsp;&nbsp; Move-in date: '
             + fill(110) + '</p>')
    b.append('<p class="caption">For each item, note the condition (Good / Fair / Needs attention) and describe '
             'any existing damage or wear. This checklist becomes part of the Agreement.</p>')
    rooms = ["Entry / Doors / Locks", "Living areas", "Kitchen / Appliances", "Bedroom(s)",
             "Bathroom(s)", "Floors / Carpet", "Walls / Ceilings / Paint", "Windows / Screens / Blinds",
             "Plumbing / Water", "Electrical / Outlets / Lights", "Smoke & CO alarms", "Heating / Cooling",
             "Yard / Exterior / Parking", "Other"]
    rows = [[r, "&nbsp;", "&nbsp;"] for r in rooms]
    b.append(grid(["Area / Item", "Condition", "Notes on existing damage or wear"], rows,
                  col_widths=["26%", "18%", "56%"]))
    b.append('<div class="keepwith"><div class="sigrow">'
             '<div class="sigcol"><div style="height:16pt"></div><div class="sigline"></div>'
             '<div class="sigcap">Landlord signature / Date</div></div>'
             '<div class="sigcol"><div style="height:16pt"></div><div class="sigline"></div>'
             '<div class="sigcap">Tenant signature / Date</div></div></div></div>')
    return "\n".join(b)

# ---------------------------------------------------------------- Key & access receipt
def key_receipt_body():
    b = [_titleblock("KEY AND ACCESS-DEVICE RECEIPT", "Record of keys and access devices given to the Tenant")]
    b.append('<p class="caption">Property: <strong>' + ADDR + '</strong></p>')
    b.append(grid(["Item", "Quantity Issued", "Date Issued", "Quantity Returned", "Date Returned"],
                  [["House / door key", "&nbsp;", "&nbsp;", "&nbsp;", "&nbsp;"],
                   ["Mailbox key", "&nbsp;", "&nbsp;", "&nbsp;", "&nbsp;"],
                   ["Gate / community key or fob", "&nbsp;", "&nbsp;", "&nbsp;", "&nbsp;"],
                   ["Garage remote / opener", "&nbsp;", "&nbsp;", "&nbsp;", "&nbsp;"],
                   ["Other: __________", "&nbsp;", "&nbsp;", "&nbsp;", "&nbsp;"],
                   ["Other: __________", "&nbsp;", "&nbsp;", "&nbsp;", "&nbsp;"]],
                  col_widths=["30%", "16%", "18%", "18%", "18%"]))
    b.append('<p class="small">The Tenant acknowledges receiving the keys and access devices listed above and '
             'agrees to return all of them when the tenancy ends. The Tenant will not copy keys or give access '
             'to unauthorized persons.</p>')
    b.append('<div class="keepwith"><div class="sigrow">'
             '<div class="sigcol"><div style="height:16pt"></div><div class="sigline"></div>'
             '<div class="sigcap">Landlord signature / Date</div></div>'
             '<div class="sigcol"><div style="height:16pt"></div><div class="sigline"></div>'
             '<div class="sigcap">Tenant signature / Date</div></div></div></div>')
    return "\n".join(b)

# ---------------------------------------------------------------- Contact forms (combined page)
def contact_forms_body():
    b = [_titleblock("TENANT AND EMERGENCY CONTACT FORMS", "Tenant information, emergency contact, and landlord notice address")]
    # Tenant contact info
    b.append('<h3 class="subhead">Tenant Contact Information</h3>')
    b.append('<p class="tight">Full legal name: ' + line() +
             'Phone: ' + fill(150) + '&nbsp;&nbsp; Email: ' + fill(160) + '</p>'
             '<p class="tight">Employer / income source (optional): ' + line() +
             'Vehicle (make / model / plate): ' + line() + '</p>')
    b.append('<hr class="rule-thin">')
    # Emergency contact
    b.append('<h3 class="subhead">Emergency Contact</h3>')
    b.append('<p class="tight">Name: ' + line() +
             'Relationship: ' + fill(150) + '&nbsp;&nbsp; Phone: ' + fill(150) + '</p>'
             '<p class="tight">Alternate contact / phone: ' + line() + '</p>')
    b.append('<hr class="rule-thin">')
    # Landlord notice address
    b.append('<h3 class="subhead">Landlord Notice-Address Form</h3>')
    b.append('<p class="tight">The Tenant should send notices and rent-related mail to the Landlord at:</p>'
             '<p class="tight">Landlord name: ' + line() +
             'Mailing address: ' + line() + line() +
             'Phone: ' + fill(150) + '&nbsp;&nbsp; Email: ' + fill(160) + '</p>'
             '<p class="small">The Landlord may update this address by written notice to the Tenant.</p>')
    return "\n".join(b)

# ---------------------------------------------------------------- Rent receipt template
def rent_receipt_body():
    b = [_titleblock("RENT-PAYMENT RECEIPT", "Template &mdash; complete and give one copy to the Tenant for each payment")]
    b.append('<p class="caption">Property: <strong>' + ADDR + '</strong> &nbsp;&nbsp; Monthly rent: $1,000.00</p>')

    def one_receipt(n):
        return (
            f'<div class="keepwith" style="border:0.8px solid #b9c2d0;border-radius:3px;padding:10pt 12pt;margin-bottom:12pt">'
            f'<div style="font-family:\'Liberation Sans\',Arial,sans-serif;font-size:8pt;color:#667085;letter-spacing:0.4pt">RECEIPT No. {n}</div>'
            '<p class="tight">Date received: ' + fill(120) + '&nbsp;&nbsp; Amount received: $ ' + fill(90) + '</p>'
            '<p class="tight">Received from (Tenant): ' + line() + '</p>'
            '<p class="tight">For rent period: ' + fill(120) + ' to ' + fill(120) + '</p>'
            '<p class="tight">Payment method: &#9744; Check &#9744; Money order &#9744; Electronic &#9744; Other '
            + fill(90) + '&nbsp;&nbsp; Balance due, if any: $ ' + fill(80) + '</p>'
            '<p class="tight">Received by (Landlord): ' + line() + '</p>'
            '</div>')
    b.append(one_receipt(1))
    b.append(one_receipt(2))
    b.append(one_receipt(3))
    return "\n".join(b)

# ---------------------------------------------------------------- Disclosure Checklist
def disclosure_checklist_body(sources_note=""):
    b = [_titleblock("REQUIRED DISCLOSURE WORKSHEET",
                     "Owner-completion checklist &mdash; confirm which disclosures apply before signing")]
    b.append('<div class="note-strong">This worksheet lists disclosures that <em>may</em> be required depending on '
             'the property and the facts. Do not mark a fact-dependent disclosure as &ldquo;Applies&rdquo; unless '
             'you have verified it for this property. When a disclosure applies, attach the completed disclosure to '
             'the signed Agreement. If you are unsure, ask a California landlord-tenant attorney.</div>')
    rows = [
        ["Lead-based paint disclosure & EPA pamphlet",
         "Required if any part of the housing was built before 1978 (federal law).",
         "&#9744; Applies &nbsp; &#9744; N/A"],
        ["Megan&rsquo;s Law database notice",
         "Statutory notice; included in the lease body. Confirm it stays in the signed copy.",
         "&#9744; Included &nbsp; &#9744; Verify"],
        ["Bedbug information",
         "Written information about bedbugs is generally required for residential leases (Civ. Code &sect; 1954.603).",
         "&#9744; Applies &nbsp; &#9744; N/A"],
        ["Mold information",
         "Disclosure of known mold and/or the state booklet where required (Health &amp; Safety Code &sect; 26147).",
         "&#9744; Applies &nbsp; &#9744; N/A"],
        ["Flood hazard disclosure",
         "Required (Gov. Code &sect; 8589.45) when the owner has actual knowledge the unit is in a FEMA special flood hazard or potential-flooding area. Verify the flood zone.",
         "&#9744; Applies &nbsp; &#9744; N/A"],
        ["Shared-utility / submeter disclosure",
         "Required if a gas or electric meter serving the unit also serves other areas through a shared meter (Civ. Code &sect; 1940.9), or for water submeter billing (Civ. Code &sect; 1954.204).",
         "&#9744; Applies &nbsp; &#9744; N/A"],
        ["Smoking policy disclosure",
         "Disclose any policy limiting smoking, or that smoking is prohibited/permitted (Civ. Code &sect; 1947.5).",
         "&#9744; Applies &nbsp; &#9744; N/A"],
        ["Pest-control / periodic treatment notice",
         "Required when a pest-control company treats the property on a schedule (Civ. Code &sect; 1940.8 / 1940.8.5).",
         "&#9744; Applies &nbsp; &#9744; N/A"],
        ["Demolition-permit disclosure",
         "Required if the owner has applied for a permit to demolish the unit (Civ. Code &sect; 1940.6).",
         "&#9744; Applies &nbsp; &#9744; N/A"],
        ["Death on the property disclosure",
         "A death on the premises within the prior three years is generally a material fact to disclose; deaths more than three years earlier fall within the safe harbor, and HIV/AIDS status is never disclosed (Civ. Code &sect; 1710.2).",
         "&#9744; Applies &nbsp; &#9744; N/A"],
        ["Methamphetamine / fentanyl contamination notice",
         "Required if a local health officer has ordered the property not be occupied for contamination; attach the order and a signed acknowledgment (Health &amp; Safety Code &sect; 25400.28).",
         "&#9744; Applies &nbsp; &#9744; N/A"],
        ["Military ordnance notice",
         "Required if the property is within one mile of a former military ordnance location known to the owner (Civ. Code &sect; 1940.7).",
         "&#9744; Applies &nbsp; &#9744; N/A"],
        ["Tenant Protection Act notice OR exemption notice",
         "The correct notice depends on whether the tenancy is covered by, or exempt from, Civ. Code &sect; 1946.2 / 1947.12. Do not assume an exemption. Use the optional exemption addendum only after confirming qualification and obtaining legal guidance.",
         "&#9744; TPA notice &nbsp; &#9744; Exemption &nbsp; &#9744; Verify"],
        ["City of Coachella / Riverside County requirements",
         "Confirm whether the City of Coachella or the County of Riverside imposes any rental registration, business license, local just-cause, or tenant-protection requirement before signing.",
         "&#9744; Verify &nbsp; &#9744; N/A"],
    ]
    b.append(grid(["Disclosure", "When it may be required", "Owner marks"], rows,
                  col_widths=["24%", "54%", "22%"]))
    b.append('<p class="small">' + sources_note + '</p>')
    b.append('<div class="keepwith"><p class="tight">Owner confirms this worksheet was reviewed for this property:</p>'
             '<div class="sigrow"><div class="sigcol"><div style="height:14pt"></div><div class="sigline"></div>'
             '<div class="sigcap">Landlord signature / Date</div></div>'
             '<div class="sigcol"><div style="height:14pt"></div><div class="sigline"></div>'
             '<div class="sigcap">Tenant acknowledgment / Date</div></div></div></div>')
    return "\n".join(b)

# ---------------------------------------------------------------- Optional TPA exemption addendum
def optional_exemption_body():
    b = [_titleblock("OPTIONAL &mdash; TENANT PROTECTION ACT EXEMPTION ADDENDUM",
                     "Use ONLY after confirming the property qualifies and obtaining legal guidance",
                     badge=("OPTIONAL &mdash; DO NOT USE UNLESS VERIFIED", "optional"))]
    b.append('<div class="note-strong">Do not sign or attach this addendum unless the owner has confirmed that the '
             'property qualifies for an exemption from the California Tenant Protection Act and has received legal '
             'guidance. Signing this addendum when the property does not qualify can be ineffective and can expose '
             'the owner to liability. If in doubt, leave this page out of the signed package.</div>')
    b.append('<p>Some single-family homes and condominiums are exempt from the just-cause and rent-cap provisions '
             'of Civil Code sections 1946.2 and 1947.12, but only if the property is not owned by a real estate '
             'investment trust, a corporation, or a limited liability company with a corporate member, and only if '
             'the owner gives the tenant the specific written notice the statute requires. Other exemptions exist '
             'for certain new construction and owner-occupied situations. Whether an exemption applies is a legal '
             'question that depends on the facts.</p>')
    b.append('<p>If, after verification and legal guidance, the owner claims the single-family / condominium '
             'exemption, California law currently requires substantially the following notice to be provided:</p>')
    b.append('<div class="note">This property is not subject to the rent limits imposed by Section 1947.12 of the '
             'Civil Code and is not subject to the just cause requirements of Section 1946.2 of the Civil Code. '
             'This property meets the requirements of Sections 1947.12 (d)(5) and 1946.2 (e)(8) of the Civil Code '
             'and the owner is not any of the following: (1) a real estate investment trust, as defined by Section '
             '856 of the Internal Revenue Code; (2) a corporation; or (3) a limited liability company in which at '
             'least one member is a corporation.</div>')
    b.append('<p class="small">The exact required wording is set by statute and can change. Confirm the current '
             'statutory language before use. This addendum does not itself determine that the property is exempt.</p>')
    b.append('<div class="keepwith"><div class="sigrow">'
             '<div class="sigcol"><div style="height:16pt"></div><div class="sigline"></div>'
             '<div class="sigcap">Landlord signature / Date</div></div>'
             '<div class="sigcol"><div style="height:16pt"></div><div class="sigline"></div>'
             '<div class="sigcap">Tenant signature / Date</div></div></div></div>')
    return "\n".join(b)

# ---------------------------------------------------------------- Owner guidance
def owner_guidance_body(assumptions_html):
    b = [_titleblock("IMPORTANT INFORMATION FOR THE PROPERTY OWNER",
                     "Not Part of the Lease",
                     badge=("NOT PART OF THE LEASE", "notlease"))]
    b.append('<div class="note-strong">This page is guidance for the property owner. It is not part of the lease, '
             'is not legal advice, and has not been prepared or reviewed by an attorney. Do not give this page to '
             'the tenant as part of the signed agreement.</div>')

    b.append('<h3 class="subhead">1. This lease does not permit &ldquo;self-help&rdquo; eviction</h3>'
             '<p>Once you deliver possession and a tenancy exists, you cannot remove a tenant yourself. You may not '
             'lock the tenant out, remove or withhold their belongings, shut off utilities, remove doors or '
             'windows, or use threats or force. California law (including Civil Code sections 789.3 and 1940.2) '
             'prohibits these acts and provides penalties. To recover possession you must use the lawful process, '
             'which normally ends in a court judgment (unlawful detainer) carried out by the sheriff.</p>')

    b.append('<h3 class="subhead">2. Labels do not create a right to remove someone immediately</h3>'
             '<p>Calling a person a &ldquo;guest,&rdquo; a &ldquo;relative,&rdquo; an &ldquo;unauthorized '
             'occupant,&rdquo; or a &ldquo;squatter&rdquo; does not, by itself, let you remove that person '
             'immediately. A month-to-month agreement does not prevent someone from establishing a tenancy or '
             'other possessory right. Once a person is in lawful possession, you generally must use the applicable '
             'California termination and eviction procedures. Do not assume a quick or automatic removal.</p>')

    b.append('<h3 class="subhead">3. The correct termination notice depends on the facts</h3>'
             '<p>The right notice depends on the law, the type of property, the ownership structure, the reason for '
             'ending the tenancy, whether any exemption from the Tenant Protection Act applies, and how long the '
             'tenant has lived there. Depending on the facts you may need a 30-day or 60-day notice, a legally '
             'sufficient reason (&ldquo;just cause&rdquo;), specific disclosures, and relocation assistance or a '
             'rent waiver for certain no-fault terminations. Do not assume the tenancy is exempt from the Tenant '
             'Protection Act; use the optional exemption addendum only after you confirm the property qualifies and '
             'get legal guidance.</p>')

    b.append('<h3 class="subhead">4. Keep good records</h3>'
             '<p>Document rent payments (use the receipt template), written communications, every notice you give '
             'or receive, who is living at the property, inspections, and any lease violation with dates and '
             'details. Good records protect you if a dispute arises.</p>')

    b.append('<h3 class="subhead">5. Do not allow informal changes</h3>'
             '<p>Do not accept additional occupants, informal substitutions of who lives there, or any sublease '
             'without a signed written agreement. Handle every change in writing, signed by both parties.</p>')

    b.append('<h3 class="subhead">6. Have an attorney review before you serve any notice</h3>'
             '<p>Consult a California landlord-tenant attorney before serving a termination or eviction notice, and '
             'before completing the deposit, fee, and disclosure blanks. This template is a starting point, not a '
             'substitute for advice about your particular property and situation.</p>')

    b.append('<h3 class="subhead">7. Assumptions and unresolved questions to confirm</h3>')
    b.append(assumptions_html)
    return "\n".join(b)
