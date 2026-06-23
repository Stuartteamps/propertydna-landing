import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Data Integrity Office sub-pages bundled in one file:
 *   /data-integrity/methodology      → DIOMethodology
 *   /data-integrity/data-standards   → DIODataStandards
 *   /data-integrity/owner-rights     → DIOOwnerRights
 *   /data-integrity/audit-trail      → DIOAuditTrail
 *   /data-integrity/report-error     → DIOReportError
 *
 * Static content + a form (Report Error) that POSTs to /report-data-error.
 */

// ── shared layout primitives ─────────────────────────────────────────────────
function Page({ title, children, eyebrow = 'Data Integrity Office' }: { title: string; children: React.ReactNode; eyebrow?: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ marginBottom: 16 }}><Link to="/data-integrity" style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none' }}>← Data Integrity Office</Link></div>
        <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>{eyebrow}</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 42, lineHeight: 1.15, margin: 0, fontWeight: 400, color: '#fafafa' }}>{title}</h1>
        <div style={{ marginTop: 28 }}>{children}</div>
        <div style={{ marginTop: 48, padding: 20, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
          <strong style={{ color: '#cbd5e1' }}>Disclaimer.</strong> PropertyDNA is an intelligence platform, not a regulated securities exchange, brokerage, or investment adviser. Valuations are estimates.
        </div>
      </div>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: '#fafafa', margin: '32px 0 12px', fontWeight: 400 }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.8, margin: '0 0 12px' }}>{children}</p>;
}
function UL({ children }: { children: React.ReactNode }) {
  return <ul style={{ paddingLeft: 18, lineHeight: 1.85, fontSize: 15, color: '#cbd5e1' }}>{children}</ul>;
}

// ── /data-integrity/methodology ──────────────────────────────────────────────
export function DIOMethodology() {
  useEffect(() => { document.title = 'Valuation Methodology — Data Integrity Office'; }, []);
  return (
    <Page title="Valuation Methodology">
      <P>The PropertyDNA score is a composite of 847 attributes across six families. Each attribute is sourced, weighted, and time-decayed.
        This page documents the families, the inputs, the model versions, and how confidence is computed.</P>
      <H2>The six attribute families</H2>
      <UL>
        <li><strong style={{ color: '#fbbf24' }}>Structural</strong> — beds, baths, sqft, lot, year built, year effective, construction type, roof, systems.</li>
        <li><strong style={{ color: '#fbbf24' }}>Contextual</strong> — micro-location, view, walkability, school overlap, comparable density, neighborhood index.</li>
        <li><strong style={{ color: '#fbbf24' }}>Temporal</strong> — recency-weighted comparable sales, 30/90/365-day market drift, seasonality.</li>
        <li><strong style={{ color: '#fbbf24' }}>Risk</strong> — flood, wildfire, seismic, insurance availability, claims history (when available), tax burden growth.</li>
        <li><strong style={{ color: '#fbbf24' }}>Provenance</strong> — architect attribution, notable ownership history, pedigree tier, scarcity index.</li>
        <li><strong style={{ color: '#fbbf24' }}>Owner-verified</strong> — improvements, permits, carrying costs verified through the Owner Portal. Only counted once a claim is verified.</li>
      </UL>
      <H2>Confidence score</H2>
      <P>Every valuation carries a confidence score from 0–100. Confidence reflects: (a) the completeness of source data for the property,
        (b) the recency of the most relevant comparables, (c) the agreement between independent valuation methods (cost approach, comparable
        sales approach, income approach where applicable), and (d) the presence of owner-verified facts.</P>
      <P>Low confidence does not mean "wrong" — it means "rely less on this number." We surface confidence on every report.</P>
      <H2>What the model does not do</H2>
      <UL>
        <li>It does not include MLS list price or seller asking price as an input.</li>
        <li>It does not weight social media or sentiment signals.</li>
        <li>It does not use predicted future buyer demand as a present-value input (that's surfaced separately as a liquidity signal).</li>
        <li>It does not allow owner-submitted facts to feed valuation until those facts are verified by a reviewer.</li>
      </UL>
      <H2>Model versioning</H2>
      <P>Every DNA score is stamped with the model version that produced it (e.g. <code style={{ color: '#fbbf24' }}>dna_v3.2</code>). When the
        model changes materially, old scores remain queryable at the old version and new scores are computed at the new version. See the
        <Link to="/data-integrity/audit-trail" style={{ color: '#fbbf24' }}> Audit Trail</Link> for the version history.</P>
    </Page>
  );
}

// ── /data-integrity/data-standards ───────────────────────────────────────────
export function DIODataStandards() {
  useEffect(() => { document.title = 'Data Standards — Data Integrity Office'; }, []);
  return (
    <Page title="Data Standards">
      <P>Where our data comes from, how often we refresh it, what we do when sources disagree, and how we mark gaps.</P>
      <H2>Primary sources</H2>
      <UL>
        <li><strong style={{ color: '#fbbf24' }}>County assessor offices</strong> — parcel data, ownership, assessed values, tax history. Source of truth where available.</li>
        <li><strong style={{ color: '#fbbf24' }}>County recorder offices</strong> — deed transfers, sale prices, ownership chains.</li>
        <li><strong style={{ color: '#fbbf24' }}>State open data portals + ArcGIS feature services</strong> — bulk parcel indexes for nationwide coverage.</li>
        <li><strong style={{ color: '#fbbf24' }}>Permit registries</strong> — municipal permit data, BuildZoom enrichment.</li>
        <li><strong style={{ color: '#fbbf24' }}>RentCast + comparable APIs</strong> — comparable sales, rent comps where MLS is closed.</li>
        <li><strong style={{ color: '#fbbf24' }}>Census + flood/wildfire/seismic maps</strong> — risk overlays.</li>
        <li><strong style={{ color: '#fbbf24' }}>Verified press + archive sources</strong> — provenance dossiers (architect attribution, ownership history).</li>
        <li><strong style={{ color: '#fbbf24' }}>Owner Portal submissions</strong> — only after a reviewer accepts the evidence.</li>
      </UL>
      <H2>Refresh cadence</H2>
      <UL>
        <li>Assessor + recorder data: monthly per county, sooner when staleness is detected.</li>
        <li>Comparable sales: per-request enrichment; cached up to 7 days for the same property.</li>
        <li>Risk overlays: annual for flood + wildfire, on-event for seismic.</li>
        <li>Permit registries: weekly where supported.</li>
      </UL>
      <H2>When sources disagree</H2>
      <P>We use a precedence order: county recorder &gt; county assessor &gt; state aggregator &gt; commercial API &gt; owner-submitted. When the
        higher-precedence source is silent, we fall through. When two equal-precedence sources conflict, we surface the conflict on the report
        rather than picking one silently.</P>
      <H2>Marking gaps</H2>
      <P>Missing data is shown as <em style={{ color: '#94a3b8' }}>not on file</em>, never inferred. We never invent a square-foot count when it
        isn't available. We never carry forward a stale sale price past 18 months without flagging it.</P>
    </Page>
  );
}

// ── /data-integrity/owner-rights ─────────────────────────────────────────────
export function DIOOwnerRights() {
  useEffect(() => { document.title = 'Owner Rights — Data Integrity Office'; }, []);
  return (
    <Page title="Owner Rights">
      <P>If you are the owner of a property in our index, you have the following rights regarding the data we show about it.</P>
      <H2>Right to claim</H2>
      <P>You may claim any property in our index via the <Link to="/owner-portal" style={{ color: '#fbbf24' }}>Owner Portal</Link>. A claim does
        not by itself grant any verified status. It enters a queue for review.</P>
      <H2>Right to correct</H2>
      <P>You may submit a correction for any field we display about your property — square footage, year built, beds, baths, permits,
        improvements, carrying costs. Corrections are reviewed before they are accepted. Once accepted, the correction is reflected on the
        property's public page and the prior value is recorded in the property history.</P>
      <H2>Right to dispute the valuation</H2>
      <P>If you believe a displayed valuation is materially wrong, you may file a dispute via the <Link to="/data-integrity/report-error" style={{ color: '#fbbf24' }}>Report
        a Data Error</Link> form. Disputes are reviewed by a human. If the dispute is resolved in your favor, the valuation is recomputed and the
        change is logged in the <Link to="/data-integrity/audit-trail" style={{ color: '#fbbf24' }}>Audit Trail</Link>.</P>
      <H2>Right to suppress personal information</H2>
      <P>By default, public property pages and dossiers do not show your name or contact information unless that information is already public
        record (deed) or you have explicitly opted in to public attribution. You may request removal of personal identifying information from
        any dossier we host.</P>
      <H2>Right to withdraw a claim</H2>
      <P>You may withdraw a claim at any time. Withdrawing a claim removes pending owner-submitted facts from the review queue but does not
        retroactively change facts that were already verified and accepted (those go back through the standard correction process).</P>
      <H2>Right to know how AI decided</H2>
      <P>Every IntellaGraph AI decision about your property is logged with the input hash, model version, and confidence. You may request the
        audit record for any decision via the <Link to="/data-integrity/audit-trail" style={{ color: '#fbbf24' }}>Audit Trail</Link>.</P>
      <H2>Right to export</H2>
      <P>You may export everything we hold about your claimed property as JSON. Available from the Owner Portal once a claim is verified.</P>
    </Page>
  );
}

// ── /data-integrity/audit-trail ──────────────────────────────────────────────
export function DIOAuditTrail() {
  useEffect(() => { document.title = 'AI Audit Trail — Data Integrity Office'; }, []);
  return (
    <Page title="AI Audit Trail">
      <P>Every IntellaGraph AI decision is logged. This page documents the schema, the access model, and the rollback policy.</P>
      <H2>What gets logged</H2>
      <UL>
        <li>DNA score computations (every recomputation, not just initial)</li>
        <li>Valuation revisions (cause: data refresh, owner correction, dispute resolution, model upgrade)</li>
        <li>Owner-claim decisions (accepted, rejected, more-info)</li>
        <li>Data dispute resolutions (corrected, no-change, rejected)</li>
        <li>IntellaGraph AI predictions (90-day sell likelihood, market drift forecast)</li>
      </UL>
      <H2>Log record shape</H2>
      <UL>
        <li><strong style={{ color: '#fbbf24' }}>event_type</strong> — what kind of decision</li>
        <li><strong style={{ color: '#fbbf24' }}>apn</strong> — which property</li>
        <li><strong style={{ color: '#fbbf24' }}>model_version</strong> — which model produced the output (e.g. <code>dna_v3.2</code>, <code>intellagraph_sonnet_4_6</code>)</li>
        <li><strong style={{ color: '#fbbf24' }}>input_hash</strong> — sha256 of the input payload, for reproducibility</li>
        <li><strong style={{ color: '#fbbf24' }}>confidence</strong> — 0–100</li>
        <li><strong style={{ color: '#fbbf24' }}>actor_type</strong> — system / admin / owner / dispute_reviewer</li>
        <li><strong style={{ color: '#fbbf24' }}>created_at</strong> — UTC timestamp</li>
      </UL>
      <H2>Access</H2>
      <P>Audit logs for a property are visible on a "Show audit trail" toggle on the property's public page. Personally identifying actor IDs are
        suppressed in the public view; admins and the claimant owner see the full record.</P>
      <H2>Rollback policy</H2>
      <P>If a model upgrade produces a DNA score that diverges from the prior score by more than a configurable threshold, both scores are
        retained and the prior score remains queryable for 18 months. This lets owners and analysts compare across model versions and prevents
        silent revisions.</P>
      <H2>Status</H2>
      <P>The audit trail backend is being wired into existing IntellaGraph AI calls (Claude Sonnet 4.6 with prompt caching). Phase 1 ships the
        transparency page; full read-side surfacing on property pages ships in Phase 2 alongside identity verification.</P>
    </Page>
  );
}

// ── /data-integrity/report-error ─────────────────────────────────────────────
export function DIOReportError() {
  const [apn, setApn] = useState('');
  const [viewToken, setViewToken] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('owner');
  const [field, setField] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [proposedValue, setProposedValue] = useState('');
  const [evidence, setEvidence] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { document.title = 'Report a Data Error — Data Integrity Office'; }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError('Email is required'); return; }
    if (!apn.trim() && !viewToken.trim()) { setError('Provide an APN or a report view token'); return; }
    setSubmitting(true);
    try {
      const r = await fetch('/.netlify/functions/report-data-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apn: apn.trim() || null,
          view_token: viewToken.trim() || null,
          reporter_email: email.trim(),
          reporter_role: role,
          field_in_error: field.trim() || null,
          current_value: currentValue.trim() || null,
          proposed_value: proposedValue.trim() || null,
          evidence_text: evidence.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setError(d.error || 'Submission failed'); return; }
      setDone(d.dispute_id || 'received');
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page title="Report a Data Error">
      <P>Found something wrong on a property page or report? Submit a correction. Each report is reviewed by a human, and outcomes are logged
        in the <Link to="/data-integrity/audit-trail" style={{ color: '#fbbf24' }}>Audit Trail</Link>.</P>

      {done ? (
        <div style={{ marginTop: 24, background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 28 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: '#34d399', margin: '0 0 10px', fontWeight: 400 }}>Report received.</h2>
          <P>Reference: <code style={{ color: '#fbbf24' }}>{done}</code></P>
          <P>We've sent a confirmation to <strong>{email}</strong>. You'll hear from a reviewer within ~5 business days.</P>
        </div>
      ) : (
        <form onSubmit={submit} style={{ marginTop: 24, background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 28 }}>
          <Field label="Property APN (or leave blank if using report token)">
            <input value={apn} onChange={(e) => setApn(e.target.value)} style={inputStyle} placeholder="e.g. 504292010" />
          </Field>
          <Field label="…or report view token (from /report/view/...)">
            <input value={viewToken} onChange={(e) => setViewToken(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Your email *">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} required />
          </Field>
          <Field label="Your role">
            <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
              <option value="owner">Owner</option>
              <option value="buyer">Buyer</option>
              <option value="agent">Real estate professional</option>
              <option value="researcher">Researcher / press</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Which field is wrong (e.g. sqft, year_built, dna_score, owner_name)">
            <input value={field} onChange={(e) => setField(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Current value shown">
            <input value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Proposed value (what it should be)">
            <input value={proposedValue} onChange={(e) => setProposedValue(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Evidence (cite a source, link, or describe how you know)">
            <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={4} style={{ ...inputStyle, fontFamily: 'inherit' }} />
          </Field>
          {error && <div style={{ color: '#f87171', fontSize: 14, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={submitting} style={{ padding: '12px 24px', background: '#fbbf24', color: '#0a0a0a', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}>
            {submitting ? 'Submitting…' : 'Submit Correction'}
          </button>
        </form>
      )}
    </Page>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', background: '#0a0a0a', border: '1px solid #374151',
  borderRadius: 4, color: '#fafafa', fontSize: 15,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, letterSpacing: 2, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}
