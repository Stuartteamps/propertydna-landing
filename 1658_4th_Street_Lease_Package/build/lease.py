# -*- coding: utf-8 -*-
"""Body HTML for the Month-to-Month Residential Rental Agreement (lease core)."""
from helpers import fill, line, initials_clause, section, grid, blank_grid

ADDR = "1658 4th Street, Coachella, California 92236"

def lease_body():
    b = []

    # ---- Title block ----
    b.append('<div class="doc-title">CALIFORNIA MONTH-TO-MONTH<br>RESIDENTIAL RENTAL AGREEMENT</div>')
    b.append('<div class="doc-subtitle">Independently prepared for private use directly between Landlord and Tenant</div>')
    b.append('<hr class="rule">')
    b.append('<p class="caption">This Agreement concerns the residential property located at '
             f'<strong>{ADDR}</strong>. It is a direct agreement between the Landlord and the Tenant. '
             'No real estate broker, REALTOR&reg;, property manager, or agent is a party to this Agreement. '
             'This document is a template. It has not been prepared, approved, or reviewed by an attorney, '
             'and it is not legal advice. Complete every blank before signing.</p>')

    # 1. Parties
    inner = (
        '<p>This Month-to-Month Residential Rental Agreement (the &ldquo;Agreement&rdquo;) is entered into by:</p>'
        '<p><strong>Landlord:</strong><br>'
        'Full legal name: ' + line('LANDLORD FULL LEGAL NAME') +
        'Mailing address: ' + line('STREET, CITY, STATE, ZIP') +
        'Phone: ' + fill(150) + '&nbsp;&nbsp;Email: ' + fill(150) + '</p>'
        '<p><strong>Tenant:</strong><br>'
        'Full legal name: ' + line('TENANT FULL LEGAL NAME') +
        'Phone: ' + fill(150) + '&nbsp;&nbsp;Email: ' + fill(150) + '</p>'
        '<p>The word &ldquo;Landlord&rdquo; and the word &ldquo;Tenant&rdquo; include the plural where more '
        'than one person signs in that role, and each such person is jointly and individually responsible '
        'under this Agreement. The Landlord and the Tenant are together the &ldquo;parties.&rdquo;</p>'
    )
    b.append(section(1, "Parties", inner))

    # 2. Premises
    inner = (
        f'<p>The Landlord rents to the Tenant, and the Tenant rents from the Landlord, the residential '
        f'dwelling located at <strong>{ADDR}</strong> (the &ldquo;Premises&rdquo;).</p>'
        '<p>The Premises are rented for residential use only. The following are included with the Premises '
        '(describe any parking space, storage, appliances, furnishings, or areas; write &ldquo;none&rdquo; if none): '
        + line('ITEMS INCLUDED WITH THE PREMISES') + line() +
        '</p>'
        '<p>The following areas or facilities are <em>not</em> included and are reserved to the Landlord or shared '
        '(describe, or write &ldquo;none&rdquo;): ' + line('AREAS NOT INCLUDED / SHARED') + '</p>'
    )
    b.append(section(2, "Premises", inner))

    # 3. Month-to-Month Term
    inner = (
        '<p>The tenancy begins on ' + fill(120) + ', ' + fill(50) +
        ' (the &ldquo;Beginning Date&rdquo;) and continues from month to month.</p>'
        '<p>This is a <strong>month-to-month tenancy</strong>. It has no fixed ending date. The tenancy '
        'continues each month until it is lawfully terminated as described in Section 24 (Month-to-Month '
        'Termination). A month of tenancy runs from the day rent is due through the day before rent is next due, '
        'unless the parties agree otherwise in writing.</p>'
    )
    b.append(section(3, "Month-to-Month Term", inner))

    # 4. Rent
    inner = (
        '<p>The monthly rent is <strong>$1,000.00</strong> (one thousand dollars) per month.</p>'
        '<p>Rent is due in advance on the ' + fill(45) + ' day of each month (the &ldquo;Due Date&rdquo;). '
        'The first month&rsquo;s rent of $1,000.00 is due on or before the Beginning Date. If the tenancy begins '
        'on a day other than the Due Date, the first payment may be prorated by written agreement of the parties: '
        'prorated amount $ ' + fill(70) + ' for ' + fill(45) + ' days.</p>'
        '<p>Rent is payable to ' + line('NAME TO WHOM RENT IS PAID') +
        ' by the method stated in Section 6. Rent is considered paid when the Landlord actually receives it. '
        'The Tenant must pay the full rent even if the Landlord has not sent a reminder or invoice.</p>'
        '<p><em>Rent increases.</em> Any change in the amount of rent will be made only by a written notice given '
        'for the number of days and in the manner required by California law and any applicable local ordinance, '
        'and only in an amount permitted by law.</p>'
    )
    b.append(section(4, "Rent", inner))

    # 5. Security Deposit
    inner = (
        '<p>The Tenant will pay a security deposit of $ ' + fill(90) + ', due on or before the Beginning Date. '
        'The deposit secures the Tenant&rsquo;s performance of this Agreement.</p>'
        '<p>The amount of the security deposit must comply with California Civil Code section 1950.5 as it applies '
        'to this Landlord and this Premises. Under current law the security deposit generally may not exceed one '
        'month&rsquo;s rent, with a limited exception for certain small landlords who are natural persons. The '
        'parties should confirm the applicable limit before completing the amount above and must not exceed it.</p>'
        '<p>The Landlord may use the deposit only for purposes allowed by law, which currently include unpaid rent, '
        'repair of damage beyond normal wear and tear, cleaning the Premises to the level of cleanliness at the '
        'start of the tenancy, and restoring or replacing personal property or keys when the rental agreement '
        'allows. After the tenancy ends and the Tenant gives up possession, the Landlord will return the deposit '
        'and provide any required itemized statement within the time and in the manner required by California law '
        '(currently 21 calendar days). The security deposit is not the last month&rsquo;s rent, and the Tenant may '
        'not apply it to rent without the Landlord&rsquo;s written agreement.</p>'
    )
    b.append(section(5, "Security Deposit", inner))

    # 6. Payment Method
    inner = (
        '<p>Rent and other amounts are to be paid by the method or methods checked below, delivered to the place '
        'stated. The Landlord may change the method or place of payment on reasonable written notice, but may not '
        'require payment only in cash except as permitted by law.</p>'
        '<p>Accepted method(s) (check all that apply): '
        '&#9744; Personal check &nbsp; &#9744; Cashier&rsquo;s check / money order &nbsp; '
        '&#9744; Electronic transfer / online portal &nbsp; &#9744; Other: ' + fill(120) + '</p>'
        '<p>Make payment payable to: ' + line('PAYEE NAME') +
        'Deliver or send payment to (address, portal, or account details): ' + line('PAYMENT LOCATION / DETAILS') +
        line() + '</p>'
    )
    b.append(section(6, "Payment Method and Location", inner))

    # 7. Returned Payments and Late Charges
    inner = (
        '<p>If any rent is not received by the Landlord within ' + fill(45) + ' days after the Due Date, the Tenant '
        'agrees to pay a late charge of $ ' + fill(80) + '. If any check or electronic payment is returned or '
        'declined for any reason, the Tenant agrees to pay a returned-payment charge of $ ' + fill(80) + '.</p>'
        '<p>Any late charge or returned-payment charge must comply with California law and may be set only in a '
        'legally permissible amount. A late charge is valid only if it is a reasonable estimate of the costs the '
        'Landlord is likely to incur because the payment is late; a charge that is a penalty is not enforceable. '
        'A returned-payment charge may not exceed the amount allowed by California Civil Code section 1719. If any '
        'amount written above exceeds what the law allows, the charge is reduced to the maximum the law allows, '
        'and the rest of this Agreement stays in effect.</p>'
        '<p>Accepting a late payment, a late charge, or a partial payment does not waive the Landlord&rsquo;s right '
        'to insist on timely payment in the future or to pursue any remedy allowed by law.</p>'
    )
    b.append(section(7, "Returned Payments and Late Charges", inner))

    # 8. Occupants
    inner = (
        '<p>The Premises are rented for use as a private residence by the Tenant and by the following additional '
        'individuals expressly authorized to reside at the Premises (list full names; if none, write &ldquo;none&rdquo;):</p>'
        + line('AUTHORIZED OCCUPANT 1') + line('AUTHORIZED OCCUPANT 2') + line('AUTHORIZED OCCUPANT 3') +
        '<p>Only the Tenant and the individuals named above are authorized to reside at the Premises or to use the '
        'Premises as a primary residence. No relative, family member, friend, partner, guest, or other person may '
        'establish residency at the Premises or use it as a primary residence without the Landlord&rsquo;s prior '
        'written approval. A person does not become an authorized occupant merely because that person is related '
        'to the Landlord or to the Tenant. Nothing in this Section removes or limits any right created by California '
        'law, including any right regarding occupancy, family status, or reasonable accommodation.</p>'
    )
    b.append(section(8, "Occupants", inner))

    # 9. Guest Policy
    inner = (
        '<p>The Tenant may have reasonable, temporary guests. A guest is a person who stays at the Premises '
        'temporarily and does not use the Premises as a residence.</p>'
        '<p>No guest may remain for more than ' + fill(45) + ' consecutive nights, or more than ' + fill(45) +
        ' total nights during any twelve-month period, without the Landlord&rsquo;s prior written consent. A stay '
        'beyond these limits, or any attempt to establish residency, requires the Landlord&rsquo;s prior written '
        'approval and, if the parties agree, a written amendment adding the person as an authorized occupant.</p>'
        '<p>A guest does not become an authorized occupant merely because the guest is related to the Landlord or '
        'to the Tenant. The Tenant is responsible for the conduct of guests as stated in the House Rules, to the '
        'extent permitted by law. This Section does not eliminate any right created by California law.</p>'
    )
    b.append(section(9, "Guest Policy", inner))

    # 10. No Assignment / Subletting / STR
    inner = (
        '<p>The Tenant may not assign this Agreement and may not sublease, license, rent, advertise for rent, or '
        'otherwise transfer possession of all or any part of the Premises, in each case without the '
        'Landlord&rsquo;s prior written consent.</p>'
        '<p>The Tenant may not list, advertise, or offer the Premises, or any room or part of the Premises, on '
        'Airbnb, Vrbo, or any other short-term rental or home-sharing platform, and may not use the Premises for '
        'any short-term or transient rental. Any purported assignment, sublease, license, or transfer made without '
        'the Landlord&rsquo;s prior written consent is void and is a material breach of this Agreement. This Section '
        'does not eliminate any right created by California law.</p>'
    )
    b.append(section(10, "No Assignment, Subletting, Short-Term Rental, or Transfer", inner))

    # 11. Use of Premises
    inner = (
        '<p>The Tenant will use the Premises only as a private residence for the authorized occupants and for '
        'no other purpose. The Tenant will not use the Premises for any business, trade, or activity that is '
        'prohibited by law, that requires a permit the Tenant does not hold, or that materially increases the '
        'Landlord&rsquo;s insurance or the risk to the Premises, without the Landlord&rsquo;s prior written consent.</p>'
        '<p>The Tenant will not keep anything dangerous, flammable, or explosive on the Premises beyond normal '
        'household quantities, and will not create a nuisance or interfere with the quiet enjoyment of neighbors. '
        'This Section does not limit any lawful home occupation or accommodation the law requires the Landlord to '
        'allow.</p>'
    )
    b.append(section(11, "Use of Premises", inner))

    # 12. Utilities and Services (fill-in allocation table)
    inner = (
        '<p>Responsibility for utilities and services is allocated in the table below. For each item, mark who is '
        'responsible for placing the account in their name and paying it. Write &ldquo;N/A&rdquo; if the item does '
        'not apply to the Premises.</p>'
        + grid(
            ["Utility / Service", "Landlord Pays", "Tenant Pays", "Notes / Account or Provider"],
            [
                ["Electricity", "&#9744;", "&#9744;", "&nbsp;"],
                ["Gas / Propane", "&#9744;", "&#9744;", "&nbsp;"],
                ["Water", "&#9744;", "&#9744;", "&nbsp;"],
                ["Sewer", "&#9744;", "&#9744;", "&nbsp;"],
                ["Trash / Recycling", "&#9744;", "&#9744;", "&nbsp;"],
                ["Internet / Cable", "&#9744;", "&#9744;", "&nbsp;"],
                ["Landscaping / Yard", "&#9744;", "&#9744;", "&nbsp;"],
                ["Pest control (routine)", "&#9744;", "&#9744;", "&nbsp;"],
                ["Other: __________", "&#9744;", "&#9744;", "&nbsp;"],
            ],
            col_widths=["30%", "14%", "14%", "42%"],
        ) +
        '<p>If any utility serving the Premises also serves another area or unit through a shared meter, the '
        'parties must complete the shared-utility disclosure identified on the Disclosure Checklist and agree in '
        'writing how that utility is paid. The Tenant will place required accounts in the Tenant&rsquo;s name by '
        'the Beginning Date where the Tenant is responsible, and will not allow any utility the Tenant is '
        'responsible for to be shut off during the tenancy.</p>'
    )
    b.append(section(12, "Utilities and Services", inner))

    # 13. Parking and Vehicles
    inner = (
        '<p>Parking provided with the Premises (describe spaces, or write &ldquo;none&rdquo;): '
        + line('PARKING PROVIDED') +
        '</p>'
        '<p>Only operable, registered, and insured vehicles may be parked in an assigned space. The Tenant will '
        'not repair vehicles on the Premises except minor emergency work, will not store inoperable or unregistered '
        'vehicles, and will not block driveways, walkways, or access. Number of vehicles permitted: ' + fill(45) +
        '. The Tenant will follow all posted and legal parking rules.</p>'
    )
    b.append(section(13, "Parking and Vehicles", inner))

    # 14. Condition / move-in inspection
    inner = (
        '<p>The Tenant has examined the Premises and agrees they are in good, clean, and safe condition, except '
        'as noted on the Move-In Condition Checklist that is part of this package. The parties will complete and '
        'sign the Move-In Condition Checklist at or before move-in, and it becomes part of this Agreement.</p>'
        '<p>Before the tenancy ends, the Tenant may request an initial move-out inspection as allowed by California '
        'law so the Tenant has an opportunity to fix items that could otherwise be deducted from the deposit.</p>'
    )
    b.append(section(14, "Condition of Premises and Move-In Inspection", inner))

    # 15. Maintenance / cleanliness / repairs
    inner = (
        '<p>The Landlord will maintain the Premises in a habitable condition as required by California law, '
        'including keeping required systems and facilities in working order.</p>'
        '<p>The Tenant will keep the Premises clean and sanitary; properly use and operate plumbing, electrical, '
        'gas, and appliances; dispose of trash properly; and avoid causing damage. The Tenant will promptly tell '
        'the Landlord, in writing when possible, about any needed repair, leak, mold, pest problem, or unsafe '
        'condition. The Tenant will not withhold notice of a problem. Except for repairs the Tenant is allowed by '
        'law to make, the Tenant will not perform repairs and charge the Landlord without the Landlord&rsquo;s '
        'agreement or a legal basis. This Section does not waive any repair-and-deduct or habitability right the '
        'Tenant has under California law.</p>'
    )
    b.append(section(15, "Maintenance, Cleanliness, and Repairs", inner))

    # 16. Alterations
    inner = (
        '<p>The Tenant will not paint, alter, add locks, install fixtures, mount items that require significant '
        'holes, or make other changes to the Premises without the Landlord&rsquo;s prior written consent. Any '
        'permitted alteration becomes part of the Premises unless the parties agree in writing that the Tenant '
        'will remove it and repair any damage. The Tenant will not change or add a lock in a way that denies the '
        'Landlord lawful access, and will give the Landlord a key to any Landlord-approved new lock. This Section '
        'does not limit any modification the law requires the Landlord to allow, including a reasonable '
        'accommodation or accessibility modification.</p>'
    )
    b.append(section(16, "Alterations", inner))

    # 17. Landlord Entry
    inner = (
        '<p>The Landlord may enter the Premises only for reasons and in the manner allowed by California Civil '
        'Code section 1954. This generally means entry in an emergency; to make repairs, improvements, or '
        'agreed services; to show the Premises to buyers, lenders, workers, or prospective tenants; or as '
        'otherwise allowed by law or court order.</p>'
        '<p>Except in an emergency, when the Tenant has moved out, or where the law allows otherwise, the Landlord '
        'will give the Tenant reasonable written notice (normally at least 24 hours) and will enter during normal '
        'business hours. The Landlord will not abuse the right of entry or use entry to harass the Tenant.</p>'
    )
    b.append(section(17, "Landlord Entry", inner))

    # 18. Smoke / CO
    inner = (
        '<p>The Premises are equipped with working smoke alarms and, where required, carbon monoxide alarms as '
        'required by California law. The Tenant will not disable, remove, or tamper with any smoke or carbon '
        'monoxide alarm; will test the alarms; and will promptly tell the Landlord in writing if an alarm is not '
        'working or needs a battery. The Landlord will repair or replace alarms as required by law after receiving '
        'notice.</p>'
    )
    b.append(section(18, "Smoke and Carbon Monoxide Devices", inner))

    # 19. Insurance / personal property
    inner = (
        '<p>The Landlord&rsquo;s insurance does not cover the Tenant&rsquo;s personal property or liability. The '
        'Landlord is not responsible for loss of or damage to the Tenant&rsquo;s belongings except to the extent '
        'the law makes the Landlord responsible. The Tenant is encouraged to obtain renter&rsquo;s insurance. '
        'Renter&rsquo;s insurance required by this Agreement? &#9744; Yes &nbsp; &#9744; No. If yes, minimum '
        'liability coverage: $ ' + fill(90) + '.</p>'
    )
    b.append(section(19, "Insurance and Personal Property", inner))

    # 20. Compliance With Laws
    inner = (
        '<p>The Tenant and the Tenant&rsquo;s guests will obey all applicable federal, state, and local laws and '
        'ordinances while at the Premises, and will not use the Premises in any way that violates the law. The '
        'Landlord will comply with all laws that apply to the Landlord and the Premises. If any local ordinance of '
        'the City of Coachella or the County of Riverside applies to this tenancy, both parties will comply with '
        'it, and it controls over any conflicting term of this Agreement to the extent required by law.</p>'
    )
    b.append(section(20, "Compliance With Laws", inner))

    # 21. Prohibited Conduct
    inner = (
        '<p>The Tenant and the Tenant&rsquo;s guests will not: (a) engage in any unlawful activity on or from the '
        'Premises; (b) create a nuisance, or make threats or commit violence; (c) substantially interfere with the '
        'peaceful enjoyment of neighbors or other residents; (d) damage or allow damage to the Premises beyond '
        'normal wear and tear; (e) keep an unauthorized animal (pet policy, if any, is stated in the House Rules '
        'or an addendum); or (f) violate the House Rules. Conduct that is prohibited here may also be a breach '
        'under Section 23. This Section does not limit any right the Tenant has under California law.</p>'
    )
    b.append(section(21, "Prohibited Conduct", inner))

    # 22. House Rules
    inner = (
        '<p>The House Rules and Material Terms attached to this Agreement are part of this Agreement. The Tenant '
        'agrees to follow them. The Landlord and the Tenant will initial each House Rule where indicated. If a '
        'House Rule ever conflicts with California law or a local ordinance, the law or ordinance controls, and '
        'the rest of the House Rules stay in effect.</p>'
    )
    b.append(section(22, "House Rules", inner))

    # 23. Breach and Remedies
    inner = (
        '<p>If the Tenant fails to pay rent or breaks any other part of this Agreement, or if the Landlord breaks '
        'this Agreement, the other party may pursue the remedies allowed by California law.</p>'
        '<p>The Landlord may end the tenancy or seek to recover possession <strong>only</strong> by following the '
        'notice and legal procedures required by California law, including, when required, a written notice, a '
        'lawful reason, any required disclosures or relocation assistance, and a court action for unlawful detainer '
        'with a judgment and a writ carried out by the proper officer. The Landlord will not use any '
        '&ldquo;self-help&rdquo; method to remove the Tenant. The Landlord will not lock the Tenant out, remove or '
        'withhold the Tenant&rsquo;s belongings, shut off or cause the shut-off of any utility, remove doors or '
        'windows, or use force, threats, or other unlawful means to make the Tenant leave. These acts are '
        'prohibited by California law (including Civil Code sections 789.3 and 1940.2), and nothing in this '
        'Agreement permits them.</p>'
        '<p>Each party keeps every right and remedy the law gives. Choosing one remedy does not give up another. '
        'A delay in enforcing a right is not a waiver of that right.</p>'
    )
    b.append(section(23, "Breach and Remedies", inner))

    # 24. Month-to-Month Termination
    inner = (
        '<p>This is a month-to-month tenancy. It continues from month to month until it is lawfully terminated.</p>'
        '<p><strong>Tenant&rsquo;s termination.</strong> The Tenant may end the tenancy by giving the Landlord '
        'written notice for at least the number of days required by California law (currently at least 30 days for '
        'a month-to-month tenancy), delivered as described in Section 25.</p>'
        '<p><strong>Landlord&rsquo;s termination.</strong> The Landlord may end the tenancy only by giving the '
        'Tenant the written notice, and by satisfying every requirement, that California law and any applicable '
        'local ordinance require for this Premises and this tenancy. Depending on the facts, this may include a '
        'longer notice period (for example, 60 days when the Tenant has lived in the Premises a year or more), a '
        'legally sufficient reason (&ldquo;just cause&rdquo;) once the Tenant has occupied the Premises long '
        'enough for such protections to apply, required disclosures, and relocation assistance or a rent waiver '
        'for certain no-fault terminations.</p>'
        '<p><strong>No waiver of protections.</strong> Nothing in this Agreement waives, reduces, or limits any '
        'right or protection that California law or any applicable local ordinance gives the Tenant. Any term that '
        'would do so is void to that extent, and the rest of this Agreement stays in effect.</p>'
        '<p><strong>Tenant Protection Act not decided here.</strong> This Agreement does not decide whether the '
        'tenancy is or is not covered by, or exempt from, the California Tenant Protection Act (Civil Code sections '
        '1946.2 and 1947.12) or any local ordinance. Whether a protection or an exemption applies depends on facts '
        'such as the type of property, who owns it, how it is occupied, how long the Tenant has lived there, and '
        'whether a legally sufficient exemption notice was properly given. No exemption is assumed. Any exemption '
        'must be handled through the separate, optional exemption addendum and only after the owner confirms the '
        'property qualifies and obtains legal guidance.</p>'
    )
    b.append(section(24, "Month-to-Month Termination", inner))

    # 25. Notices
    inner = (
        '<p>Written notices under this Agreement are effective when delivered in a manner allowed by California '
        'law. Notices to the Tenant may be delivered at the Premises. Notices to the Landlord are to be delivered '
        'to the Landlord&rsquo;s name and address stated in Section 1 or on the Landlord Notice-Address Form in '
        'this package. Either party may change its notice address by written notice to the other. The parties may '
        'agree in writing to accept notices by email for routine, non-legal communications; legal notices must be '
        'given in the form and manner the law requires.</p>'
    )
    b.append(section(25, "Notices", inner))

    # 26. Entire Agreement
    inner = (
        '<p>This Agreement, together with the House Rules, the Additional Agreed Terms page, the Move-In Condition '
        'Checklist, any signed disclosures, and any signed addendum, is the entire agreement between the parties '
        'about the Premises. It replaces any earlier oral or written understanding. Any change must be in writing '
        'and signed by both parties, except a change the law allows one party to make by proper notice (such as a '
        'lawful rent change or a lawful termination notice).</p>'
    )
    b.append(section(26, "Entire Agreement", inner))

    # 27. Severability
    inner = (
        '<p>If any part of this Agreement is found to be unlawful or unenforceable, that part is limited or removed '
        'only to the extent needed, and the rest of the Agreement stays in full effect.</p>'
    )
    b.append(section(27, "Severability", inner))

    # 28. California Law
    inner = (
        '<p>This Agreement is governed by the laws of the State of California and any applicable local ordinance. '
        'Where a term of this Agreement and the law differ, the law controls. This Agreement is meant to be read '
        'and applied in a way that is consistent with California law.</p>'
    )
    b.append(section(28, "California Law", inner))

    # 29. Additional Written Terms
    inner = (
        '<p>Any additional terms agreed by the parties are written on the &ldquo;Additional Agreed Terms&rdquo; '
        'page in this package. To be effective, each additional term must be lawful and must be agreed to and '
        'initialed by both the Landlord and the Tenant. A handwritten or typed added term does not override '
        'California law, and an unenforceable added term does not invalidate the rest of this Agreement.</p>'
    )
    b.append(section(29, "Additional Written Terms", inner))

    # ---- Megan's Law statutory notice ----
    b.append('<div class="section-block"><h2 class="section">Required Statutory Notice &mdash; Database of '
             'Registered Offenders</h2>'
             '<div class="note">Notice: Pursuant to Section 290.46 of the Penal Code, information about specified '
             'registered sex offenders is made available to the public via an Internet Web site maintained by the '
             'Department of Justice at <strong>www.meganslaw.ca.gov</strong>. Depending on an offender&rsquo;s '
             'criminal history, this information will include either the address at which the offender resides or '
             'the community of residence and ZIP Code in which he or she resides.</div></div>')

    # 30. Signatures
    inner = (
        '<p>By signing below, each party states that they have read this Agreement, have completed the blanks that '
        'apply, understand it, and agree to it. This Agreement is not effective until signed by the Landlord and '
        'the Tenant. Each party should keep a signed copy.</p>'
        '<div class="sigrow">'
        '<div class="sigcol"><div class="big-space"></div><div class="sigline"></div>'
        '<div class="sigcap">Landlord signature</div>'
        '<div class="big-space"></div><div class="sigline"></div>'
        '<div class="sigcap">Landlord printed name</div>'
        '<div style="height:18pt"></div><div class="sigline"></div>'
        '<div class="sigcap">Date</div></div>'
        '<div class="sigcol"><div class="big-space"></div><div class="sigline"></div>'
        '<div class="sigcap">Tenant signature</div>'
        '<div class="big-space"></div><div class="sigline"></div>'
        '<div class="sigcap">Tenant printed name</div>'
        '<div style="height:18pt"></div><div class="sigline"></div>'
        '<div class="sigcap">Date</div></div>'
        '</div>'
    )
    b.append(section(30, "Signatures", inner))

    return "\n".join(b)
