import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

const COUNTRY_NAMES: Record<string, string> = {
  GB: "the United Kingdom", AU: "Australia", CA: "Canada", IE: "Ireland",
  NZ: "New Zealand", DE: "Germany", FR: "France", ES: "Spain", IT: "Italy",
  PT: "Portugal", NL: "Netherlands", BE: "Belgium", CH: "Switzerland",
  SE: "Sweden", NO: "Norway", DK: "Denmark", FI: "Finland", AT: "Austria",
  JP: "Japan", SG: "Singapore", HK: "Hong Kong", AE: "the UAE", MX: "Mexico",
  BR: "Brazil", AR: "Argentina", ZA: "South Africa", IN: "India",
};

export default function Waitlist() {
  const [params] = useSearchParams();
  const initialEmail   = params.get("email") || "";
  const countryCode    = (params.get("country") || "").toUpperCase();
  const countryName    = COUNTRY_NAMES[countryCode] || (countryCode ? `your country (${countryCode})` : "your country");
  const alreadyJoined  = params.get("joined") === "1";

  const [email, setEmail]     = useState(initialEmail);
  const [status, setStatus]   = useState<"idle" | "submitting" | "done" | "error">(alreadyJoined ? "done" : "idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => { if (alreadyJoined) setStatus("done"); }, [alreadyJoined]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) { setErrorMsg("Please enter a valid email."); return; }
    setStatus("submitting");
    try {
      const res = await fetch("/.netlify/functions/join-waitlist", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email,
          country_code: countryCode || undefined,
          country_name: COUNTRY_NAMES[countryCode] || undefined,
          source: "waitlist_page",
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setErrorMsg(`Could not join (${res.status}). ${txt.slice(0, 200)}`);
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setErrorMsg(msg);
      setStatus("error");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F0E0D", color: "#F4F0E8", fontFamily: "Helvetica, Arial, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        <p style={{ color: "#E8B84B", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", margin: 0 }}>PropertyDNA</p>
        <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 38, lineHeight: 1.1, margin: "12px 0 18px" }}>
          We&rsquo;re coming to {countryName}.
        </h1>
        <p style={{ color: "#C7BFA9", fontSize: 16, lineHeight: 1.65, margin: "0 0 28px" }}>
          PropertyDNA reports rely on local MLS, parcel, permit, and valuation data &mdash;
          and we only ship reports we can stand behind. Today our coverage is the United States,
          with international markets rolling out next.
        </p>
        <p style={{ color: "#C7BFA9", fontSize: 16, lineHeight: 1.65, margin: "0 0 28px" }}>
          Drop your email and we&rsquo;ll tell you the moment {countryName} is live &mdash;
          and offer you a free report on day one.
        </p>

        {status === "done" ? (
          <div style={{ background: "#1A1714", border: "1px solid #E8B84B", padding: "18px 22px", marginBottom: 24 }}>
            <p style={{ margin: 0, color: "#E8B84B", fontWeight: 600 }}>You&rsquo;re on the list.</p>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#C7BFA9" }}>
              We&rsquo;ll email you as soon as we go live in {countryName}.
            </p>
          </div>
        ) : (
          <form onSubmit={join} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{ padding: "14px 16px", fontSize: 15, background: "#1A1714", border: "1px solid #3a342c", color: "#F4F0E8", borderRadius: 3, outline: "none" }}
            />
            <button
              type="submit"
              disabled={status === "submitting"}
              style={{ padding: "14px 22px", fontSize: 14, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", background: "#E8B84B", color: "#0F0E0D", border: "none", borderRadius: 3, cursor: status === "submitting" ? "wait" : "pointer" }}
            >
              {status === "submitting" ? "Joining…" : "Notify me when you launch here"}
            </button>
            {status === "error" && (
              <p style={{ color: "#E8B84B", fontSize: 13, margin: 0 }}>{errorMsg}</p>
            )}
          </form>
        )}

        <p style={{ fontSize: 12, color: "#7c6c5c", lineHeight: 1.6, marginTop: 32 }}>
          In the meantime, you can still browse our <Link to="/sample-report" style={{ color: "#C7BFA9" }}>sample report</Link>,{" "}
          <Link to="/blog" style={{ color: "#C7BFA9" }}>read the blog</Link>, or{" "}
          <Link to="/" style={{ color: "#C7BFA9" }}>return home</Link>.
        </p>
      </div>
    </div>
  );
}
