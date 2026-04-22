import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import PropertyForm from '@/components/PropertyForm';
import FadeUp from '@/components/FadeUp';

const scrollTo = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const partners = ['Meridian Capital', 'Thornfield AM', 'Ashbury REIT', 'Folio Group', 'Citadel Lending'];

const metrics = [
  ['14.3M PROPERTIES INDEXED'],
  ['ACCURACY RATE 97.6%'],
  ['AVG VALUATION SPEED 1.8S'],
  ['RISK SIGNALS TRACKED 312'],
  ['DATA PARTNERS 47'],
  ['MARKETS COVERED 2,800+'],
];

const stats = [
  ['14.3', 'M', 'PROPERTIES PROFILED'],
  ['847', '', 'DATA ATTRIBUTES PER PROPERTY'],
  ['97.6', '%', 'VALUATION ACCURACY'],
  ['2,800', '+', 'MARKETS COVERED'],
];

const capabilities = [
  ['01', 'CORE ENGINE', 'Genetic Valuation Engine', 'Our model dissects 847 property attributes — structural, contextual, temporal — to derive a living valuation that breathes with the market.'],
  ['02', 'RISK INTELLIGENCE', 'Risk Strand Analysis', 'Identify hidden risk sequences before they manifest. Flood exposure, subsidence probability, planning pressure, and 60+ environmental markers.'],
  ['03', 'COMP ANALYSIS', 'Comparative Sequencing', 'Run deep comparables across 12 dimensions simultaneously. See not just what sold nearby — but why it sold at that price.'],
  ['04', 'FORECASTING', 'Temporal Drift Modelling', "Track how a property's value markers shift over 5, 10, 25 year windows. Understand the trajectory, not just the snapshot."],
  ['05', 'PORTFOLIO', 'Portfolio Genome Mapping', 'Visualise your entire portfolio as an interconnected genetic map. Spot concentration risk, diversification gaps, and hidden correlations.'],
  ['06', 'DATA LAYER', 'Live Data Splicing', 'Real-time feeds from 47 verified data partners: land registry, planning portals, flood authorities, energy ratings, and census data.'],
];

const steps = [
  ['01', 'INPUT', 'Address or Portfolio', 'Submit a single address, a CSV, or connect via API. PropertyDNA accepts any scale of input.'],
  ['02', 'SEQUENCE', 'Deep Data Ingestion', 'Our engine cross-references 47 live data sources and 14.3M historical property records in under 2 seconds.'],
  ['03', 'DECODE', 'DNA Profile Generated', 'A complete property genome emerges: valuation, risk profile, yield potential, comparative position, and trajectory.'],
  ['04', 'DEPLOY', 'Act With Confidence', 'Make acquisition, disposal, or lending decisions backed by the most complete property intelligence available.'],
];

const testimonials = [
  ['"PropertyDNA reduced our due diligence cycle from three weeks to four hours. The risk strand analysis alone is worth the subscription."', 'Fiona Ashworth', 'Head of Acquisitions, Meridian Capital'],
  ['"We\'ve tried every valuation tool on the market. Nothing comes close to the depth of the comparative sequencing. Our models are sharper than ever."', 'Marcus Osei-Bonsu', 'Director, Thornfield Asset Management'],
];

const reportFeatures = [
  ['01', 'Data quality score A+ through C, graded on completeness and source confidence'],
  ['02', 'Live market valuation with range low, range high, and confidence level'],
  ['03', 'Buyer, seller, and investment narrative based purely on verified data'],
  ['04', 'A direct "Would We Buy It?" verdict — Yes, Maybe, or Needs Review'],
];

export default function Index() {
  return (
    <div className="bg-espresso text-canvas">
      <Nav />

      {/* HERO */}
      <section
        id="hero"
        className="relative min-h-screen pt-28 md:pt-32 px-6 md:px-12 overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 20% 0%, rgba(184,147,85,0.18), transparent 55%), radial-gradient(circle at 90% 60%, rgba(184,147,85,0.1), transparent 50%), #0F0E0D',
        }}
      >
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center py-12 md:py-16">
          <div>
            <div className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 border border-gold/40">
              <span className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse" />
              <span className="font-sans text-[10px] tracking-[3px] text-gold uppercase">
                Now Live — Series A Platform
              </span>
            </div>

            <h1
              className="font-serif font-light leading-[1.02] tracking-tight mb-8 text-canvas"
              style={{ fontSize: 'clamp(44px, 6vw, 88px)', letterSpacing: '-1.5px' }}
            >
              Every property
              <br />
              has a <em className="italic text-gold">genome.</em>
            </h1>

            <p className="font-sans text-[15px] md:text-base font-light leading-[1.85] text-canvas/70 max-w-xl mb-10">
              PropertyDNA sequences the complete genetic profile of any property — valuation, risk,
              yield trajectory, and comparative position — delivered to your inbox in under three
              minutes. Built for investors, lenders, and analysts who need the truth, not an estimate.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={() => scrollTo('form')}
                className="font-sans text-[11px] font-medium uppercase tracking-[3px] text-espresso bg-gold hover:bg-[#cfa366] transition-colors px-7 py-4"
              >
                Sequence Your First Property
              </button>
              <button
                type="button"
                onClick={() => scrollTo('platform')}
                className="font-sans text-[11px] font-medium uppercase tracking-[3px] text-canvas border border-canvas/25 hover:border-gold hover:text-gold transition-colors px-7 py-4 !bg-transparent hover:!bg-transparent flex items-center justify-center gap-2"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6,4 20,12 6,20" />
                </svg>
                Watch Demo
              </button>
            </div>

            <div className="mt-16 pt-8 border-t border-white/10">
              <div className="font-sans text-[9px] tracking-[3px] text-canvas/40 uppercase mb-5">
                Trusted by professionals at
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                {partners.map((p) => (
                  <div
                    key={p}
                    className="font-serif text-[15px] font-light text-canvas/55 italic"
                  >
                    {p}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DNA PROFILE CARD */}
          <FadeUp>
            <div
              className="relative p-8 md:p-10 border border-gold/25"
              style={{
                background:
                  'linear-gradient(145deg, rgba(34,28,22,0.92), rgba(20,17,14,0.95))',
                boxShadow: '0 40px 80px -30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(184,147,85,0.12)',
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="font-sans text-[9px] tracking-[3px] text-gold uppercase">
                  DNA Profile
                </div>
                <div className="font-sans text-[9px] tracking-[2px] text-canvas/40">
                  33.8°N · 116.5°W
                </div>
              </div>

              <div className="font-serif text-2xl md:text-3xl font-light text-canvas leading-tight mb-1">
                100 W Andreas Rd
              </div>
              <div className="text-xs text-canvas/50 tracking-wide mb-8">
                Palm Springs · CA · 92262
              </div>

              <div className="grid grid-cols-2 gap-5 mb-8">
                {[
                  ['Valuation Confidence', '94'],
                  ['Risk Index', '18'],
                  ['Yield Potential', '76'],
                  ['Market Momentum', '62'],
                ].map(([label, val]) => (
                  <div key={label} className="relative">
                    <div className="font-sans text-[9px] tracking-[2px] text-canvas/45 uppercase mb-2">
                      {label}
                    </div>
                    <div className="flex items-baseline gap-1.5 mb-2">
                      <div className="font-serif text-4xl font-light text-canvas leading-none">
                        {val}
                      </div>
                      <div className="text-[10px] text-canvas/30">/100</div>
                    </div>
                    <div className="h-[2px] w-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gold"
                        style={{ width: `${val}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-sans text-[9px] tracking-[2px] text-canvas/45 uppercase mb-1">
                      Estimated Market Value
                    </div>
                    <div className="font-serif text-3xl font-light text-gold">$995,000</div>
                  </div>
                  <div
                    className="font-sans text-[11px] tracking-[1px] font-medium px-3 py-1.5"
                    style={{ background: 'rgba(45,106,79,0.25)', color: '#6EB68B', border: '1px solid rgba(45,106,79,0.4)' }}
                  >
                    +6.3%
                  </div>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>

        {/* METRICS MARQUEE */}
        <div className="border-t border-white/10 overflow-hidden py-5 -mx-6 md:-mx-12">
          <div className="flex gap-12 whitespace-nowrap marquee">
            {[...metrics, ...metrics].map(([m], i) => (
              <div key={i} className="font-sans text-[10px] tracking-[3px] text-canvas/50 uppercase">
                {m}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INSIGHTS / STATS */}
      <section id="insights" className="bg-espresso px-6 md:px-12 py-24 md:py-32">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 md:gap-14">
            {stats.map(([num, suffix, label], i) => (
              <FadeUp key={String(label)} delay={i * 0.08}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-baseline">
                    <div
                      className="font-serif font-light text-canvas leading-none"
                      style={{ fontSize: 'clamp(48px, 5vw, 80px)', letterSpacing: '-1.5px' }}
                    >
                      {num}
                    </div>
                    <div
                      className="font-serif font-light text-gold leading-none ml-1"
                      style={{ fontSize: 'clamp(28px, 3vw, 44px)' }}
                    >
                      {suffix}
                    </div>
                  </div>
                  <div className="font-sans text-[10px] tracking-[2px] text-canvas/45 uppercase">
                    {label}
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* PLATFORM / CAPABILITY STACK */}
      <section
        id="platform"
        className="px-6 md:px-12 py-24 md:py-32"
        style={{ background: '#0A0908' }}
      >
        <div className="max-w-7xl mx-auto">
          <FadeUp>
            <div className="text-center mb-20">
              <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-5">
                Capability Stack
              </div>
              <h2
                className="font-serif font-light text-canvas leading-[1.05] mb-6"
                style={{ fontSize: 'clamp(36px, 4.5vw, 64px)', letterSpacing: '-1px' }}
              >
                Six systems.
                <br />
                <em className="italic text-gold">One genome.</em>
              </h2>
              <p className="font-sans text-[15px] font-light leading-[1.85] text-canvas/60 max-w-2xl mx-auto">
                Each module of PropertyDNA is a precision instrument. Together, they form the most
                complete picture of a property that has ever existed.
              </p>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
            {capabilities.map(([num, tag, title, desc], i) => (
              <FadeUp key={num} delay={i * 0.06}>
                <div className="relative p-10 h-full bg-[#0A0908] hover:bg-[#141210] transition-colors group">
                  <div className="flex items-baseline justify-between mb-8">
                    <div className="font-serif text-5xl font-light text-gold leading-none">{num}</div>
                    <div className="font-sans text-[9px] tracking-[2px] text-canvas/40 uppercase">
                      {tag}
                    </div>
                  </div>
                  <div className="font-serif text-2xl font-light text-canvas leading-tight mb-4 group-hover:text-gold transition-colors">
                    {title}
                  </div>
                  <div className="text-[13px] font-light leading-[1.8] text-canvas/55">
                    {desc}
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="bg-espresso px-6 md:px-12 py-24 md:py-32">
        <div className="max-w-7xl mx-auto">
          <FadeUp>
            <div className="mb-16">
              <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-5">
                Process
              </div>
              <h2
                className="font-serif font-light text-canvas leading-[1.05] max-w-3xl"
                style={{ fontSize: 'clamp(32px, 4vw, 56px)', letterSpacing: '-0.8px' }}
              >
                From address to <em className="italic text-gold">insight</em>
                <br />
                in four steps.
              </h2>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map(([num, tag, title, desc], i) => (
              <FadeUp key={num} delay={i * 0.08}>
                <div className="relative border-t border-gold/30 pt-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="font-serif text-xl font-light text-gold">{num}</div>
                    <div className="font-sans text-[9px] tracking-[2px] text-canvas/45 uppercase">
                      {tag}
                    </div>
                  </div>
                  <div className="font-serif text-xl md:text-2xl font-light text-canvas leading-tight mb-3">
                    {title}
                  </div>
                  <div className="text-[13px] font-light leading-[1.8] text-canvas/55">
                    {desc}
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT / TESTIMONIALS */}
      <section
        id="about"
        className="px-6 md:px-12 py-24 md:py-32"
        style={{ background: '#0A0908' }}
      >
        <div className="max-w-7xl mx-auto">
          <FadeUp>
            <div className="mb-16 text-center">
              <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-5">
                What Professionals Say
              </div>
              <h2
                className="font-serif font-light text-canvas leading-[1.05]"
                style={{ fontSize: 'clamp(32px, 4vw, 56px)', letterSpacing: '-0.8px' }}
              >
                Trusted by the
                <br />
                <em className="italic text-gold">sharpest minds</em> in property.
              </h2>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {testimonials.map(([quote, name, role], i) => (
              <FadeUp key={name} delay={i * 0.1}>
                <div className="relative p-10 md:p-12 h-full border border-white/10 bg-espresso/50">
                  <div className="font-serif text-5xl text-gold/40 leading-none mb-6">“</div>
                  <p className="font-serif text-xl md:text-2xl font-light text-canvas leading-[1.5] mb-10 italic">
                    {quote}
                  </p>
                  <div className="border-t border-white/10 pt-5">
                    <div className="font-serif text-lg font-light text-canvas mb-1">{name}</div>
                    <div className="font-sans text-[11px] tracking-[1px] text-canvas/45 uppercase">
                      {role}
                    </div>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="bg-espresso px-6 md:px-12 py-24 md:py-32" id="pricing">
        <div className="max-w-7xl mx-auto">
          <FadeUp>
            <div className="text-center mb-16">
              <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-5">
                Pricing
              </div>
              <h2
                className="font-serif font-light text-canvas leading-[1.05]"
                style={{ fontSize: 'clamp(32px, 4vw, 56px)', letterSpacing: '-0.8px' }}
              >
                Simple, transparent
                <br />
                <em className="italic text-gold">pricing.</em>
              </h2>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* STARTER */}
            <FadeUp>
              <div className="border border-white/10 p-10 h-full flex flex-col">
                <div className="font-sans text-[10px] tracking-[3px] text-canvas/45 uppercase mb-6">
                  Starter
                </div>
                <div className="font-serif text-3xl font-light text-canvas mb-1">Analyst</div>
                <div className="flex items-baseline mb-2">
                  <sup className="font-serif text-lg text-canvas/60 mr-1">$</sup>
                  <span className="font-serif text-6xl font-light text-canvas leading-none">0</span>
                </div>
                <div className="text-[13px] text-canvas/50 mb-8">Free forever</div>
                <ul className="flex flex-col gap-3 mb-10 text-[13px] font-light text-canvas/70 flex-1">
                  {['5 property reports per month', 'Core valuation engine', 'Basic data quality score', 'Email delivery'].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="text-gold mt-1">—</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => scrollTo('form')}
                  className="font-sans text-[10px] font-medium tracking-[3px] uppercase text-canvas border border-canvas/25 hover:border-gold hover:text-gold transition-colors px-6 py-3.5 !bg-transparent hover:!bg-transparent"
                >
                  Get Started Free
                </button>
              </div>
            </FadeUp>

            {/* PROFESSIONAL */}
            <FadeUp delay={0.08}>
              <div
                className="relative border-2 border-gold p-10 h-full flex flex-col"
                style={{ background: 'linear-gradient(160deg, rgba(184,147,85,0.08), transparent)' }}
              >
                <div
                  className="absolute -top-3 left-10 font-sans text-[9px] tracking-[3px] text-espresso bg-gold uppercase px-3 py-1.5"
                >
                  Most Popular
                </div>
                <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-6">
                  Professional
                </div>
                <div className="font-serif text-3xl font-light text-canvas mb-1">Professional</div>
                <div className="flex items-baseline mb-2">
                  <sup className="font-serif text-lg text-canvas/60 mr-1">$</sup>
                  <span className="font-serif text-6xl font-light text-canvas leading-none">149</span>
                </div>
                <div className="text-[13px] text-canvas/50 mb-8">per month, billed monthly</div>
                <ul className="flex flex-col gap-3 mb-10 text-[13px] font-light text-canvas/75 flex-1">
                  {['Unlimited property reports', 'Full genetic valuation engine', 'Risk strand analysis', 'Comparative sequencing', 'Priority email + PDF delivery', 'API access (1,000 calls/mo)'].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="text-gold mt-1">—</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => scrollTo('form')}
                  className="font-sans text-[10px] font-medium tracking-[3px] uppercase text-espresso bg-gold hover:bg-[#cfa366] transition-colors px-6 py-3.5"
                >
                  Start Free Trial
                </button>
              </div>
            </FadeUp>

            {/* ENTERPRISE */}
            <FadeUp delay={0.16}>
              <div className="border border-white/10 p-10 h-full flex flex-col">
                <div className="font-sans text-[10px] tracking-[3px] text-canvas/45 uppercase mb-6">
                  Enterprise
                </div>
                <div className="font-serif text-3xl font-light text-canvas mb-1">Institutional</div>
                <div className="flex items-baseline mb-2">
                  <sup className="font-serif text-lg text-canvas/60 mr-1">$</sup>
                  <span className="font-serif text-6xl font-light text-canvas leading-none">—</span>
                </div>
                <div className="text-[13px] text-canvas/50 mb-8">Custom pricing</div>
                <ul className="flex flex-col gap-3 mb-10 text-[13px] font-light text-canvas/70 flex-1">
                  {['Everything in Professional', 'Portfolio genome mapping', 'Temporal drift modelling', 'Dedicated data team', 'Unlimited API access', 'SLA + white-label options'].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="text-gold mt-1">—</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => scrollTo('form')}
                  className="font-sans text-[10px] font-medium tracking-[3px] uppercase text-canvas border border-canvas/25 hover:border-gold hover:text-gold transition-colors px-6 py-3.5 !bg-transparent hover:!bg-transparent"
                >
                  Talk to Sales
                </button>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section
        className="relative px-6 md:px-12 py-24 md:py-32 text-center"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(184,147,85,0.18), transparent 65%), #0A0908',
        }}
      >
        <FadeUp>
          <div className="max-w-3xl mx-auto">
            <h2
              className="font-serif font-light text-canvas leading-[1.05] mb-10"
              style={{ fontSize: 'clamp(36px, 5vw, 72px)', letterSpacing: '-1px' }}
            >
              Ready to decode your
              <br />
              <em className="italic text-gold">first property?</em>
            </h2>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                type="button"
                onClick={() => scrollTo('form')}
                className="font-sans text-[11px] font-medium uppercase tracking-[3px] text-espresso bg-gold hover:bg-[#cfa366] transition-colors px-8 py-4"
              >
                Start Free Trial
              </button>
              <button
                type="button"
                onClick={() => scrollTo('form')}
                className="font-sans text-[11px] font-medium uppercase tracking-[3px] text-canvas border border-canvas/30 hover:border-gold hover:text-gold transition-colors px-8 py-4 !bg-transparent hover:!bg-transparent"
              >
                Talk to Sales →
              </button>
            </div>
          </div>
        </FadeUp>
      </section>

      {/* FORM SECTION */}
      <section
        id="form"
        className="bg-canvas text-warmdark px-6 md:px-12 py-24 md:py-32"
      >
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-20 items-start">
          <div>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-5">
              Request Intelligence
            </div>
            <h2
              className="font-serif font-light text-warmdark leading-[1.05] mb-8"
              style={{ fontSize: 'clamp(36px, 4.5vw, 64px)', letterSpacing: '-1px' }}
            >
              Sequence any
              <br />
              <em className="italic text-gold">property.</em>
            </h2>
            <p className="font-sans text-[15px] font-light leading-[1.85] text-warmgray max-w-lg mb-12">
              Submit an address and receive a fully formatted intelligence report — property vitals,
              verified valuation, buyer and seller analysis, climate context, and a direct verdict
              on whether we'd buy it.
            </p>
            <div className="flex flex-col gap-5">
              {reportFeatures.map(([num, text]) => (
                <div key={num} className="flex items-start gap-4">
                  <div className="font-serif text-base text-gold leading-tight">{num}</div>
                  <div className="text-[14px] font-light leading-[1.8] text-warmdark/80 max-w-lg">
                    {text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-cream border border-rule p-8 md:p-12">
            <div className="mb-8">
              <div className="font-serif text-2xl font-light text-warmdark leading-tight mb-2">
                Submit a Property
              </div>
              <div className="text-[13px] text-warmgray leading-relaxed font-light">
                Free report. No account required. Delivered by email within minutes.
              </div>
            </div>
            <PropertyForm />
            <div className="mt-6 text-center text-[11px] tracking-[1px] text-warmgray/70">
              Free · No account needed · Delivered by email
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}