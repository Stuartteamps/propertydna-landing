# Product-Market-Fit Scorecard

**Date:** 2026-07-11. Separates genuine demand from temporary attention. **A traffic spike is not PMF.** Every metric: definition · source · calc · owner · cadence · baseline · target · confidence · limitation. All baselines currently **UNKNOWN** (instrumentation just landed; no fabrication).

| Metric | Definition | Source / calc | Cadence | Baseline | Target (initial hyp) | Confidence | Limitation |
|---|---|---|---|---|---|---|---|
| Core-outcome completion | % of report requests that reach `report_viewed` with a real value | GA4 `form_submitted`→`report_viewed{has_value:true}` | weekly | UNKNOWN | ≥60% | low | GA cross-device gaps |
| Repeat search | % users with ≥2 searches in 30d | GA4 user id / email in reports | weekly | UNKNOWN | ≥25% | low | anon→auth stitching |
| Saved-property engagement | watchlist adds / activated users | `watched_properties` | weekly | UNKNOWN | ≥20% | low | needs event B-09 |
| Organic referral | `share_click` → new session | GA4 | weekly | UNKNOWN | ≥5% | low | attribution |
| Willingness to pay | % report-viewers who purchase (7d) | `purchase` / `report_viewed` | weekly | UNKNOWN | ≥3% | low | small n early |
| Paid retention | month-2 retained subs | Stripe | monthly | UNKNOWN | ≥70% | low | early cohort size |
| Report usefulness | rating on report (add 1–5 prompt) | new UI (backlog) | continuous | none | ≥4.0 | none | not built |
| Sean-Ellis disappointment | % "very disappointed" without PropertyDNA | survey (backlog) | quarterly | none | ≥40% | none | not run |
| Pro time saved | agent minutes saved vs manual CMA | interview/log | monthly | none | ≥30 min/report | none | not measured |
| Lead quality | % opted-in leads meeting criteria | lead-qual scoring | weekly | UNKNOWN | define | low | needs criteria |
| Unsolicited requests | inbound asks for features/access | inbox/CRM tally | weekly | UNKNOWN | trend up | low | manual |

## Reading it
- **PMF signal = the RIGHT of this table** (retention, WTP, disappointment, unsolicited demand), not visits.
- Gate cycle-2 experiments on getting ≥2 weeks of the top-5 rows populated first.

## Owner
Founder (Daniel) reviews weekly; Founder-OS auto-populates from GA4 + `kpi_events` + Stripe once B-06 dashboard lands.
