import { useState } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import FadeUp from '@/components/FadeUp';
import SignInModal from '@/components/SignInModal';
import PremiumFeatureGrid from '@/components/PremiumFeatureGrid';
import { Link } from 'react-router-dom';

type ModalTab = 'signin' | 'signup' | 'sales';

const scrollTo = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const segments = [
  {
    num: '01',
    tag: 'Real Estate Agents & Teams',
    title: "Win listings with data they can't argue with.",
    desc: 'Every listing appointment is a pitch. PropertyDNA gives you an independent, data-driven valuation that positions you as the most prepared agent in the room — not an estimate pulled from Zillow.',
    useCases: [
      'Pre-listing DNA report to anchor your CMA',
      'Buyer analysis package sent within minutes of showing',
      'Neighborhood risk and demographic profile for disclosure',
      '"Would We Buy It?" verdict for investor clients',
      'Email-delivered report your client can forward to their attorney',
    ],
    quote: '"We pull a PropertyDNA report before every appointment. It sets our price from the data — not a gut feel. Our listing conversion went up meaningfully in the first quarter."',
    quoteName: 'Samantha R.', quoteRole: 'Team Lead · Keller Williams Desert Cities',
  },
  {
    num: '02',
    tag: 'Private Lenders & Underwriters',
    title: 'Underwrite with a complete risk profile in minutes.',
    desc: 'Traditional due diligence takes days and misses environmental and market signals that move default risk. PropertyDNA sequences flood zone, crime index, permit history, and comparative market position into a single defensible file.',
    useCases: [
      'Automated LTV sanity check before ordering appraisal',
      'Flood zone and FEMA category confirmation',
      'Permit history to flag unpermitted improvements',
      'Comparable market analysis across 12 dimensions',
      'Risk strand score with stated confidence level',
    ],
    quote: '"Our underwriting committee now requires a PropertyDNA report alongside the appraisal on every residential bridge loan. It catches discrepancies we were missing."',
    quoteName: 'Michael C.', quoteRole: 'Chief Credit Officer · Folio Lending Group',
  },
  {
    num: '03',
    tag: 'Investors & Fund Managers',
    title: 'Source, evaluate, and close — faster.',
    desc: 'Deal flow moves faster than analysis can keep up. PropertyDNA sequences a complete investment profile — valuation confidence, yield potential, risk index, and market momentum — in under three minutes per property.',
    useCases: [
      'Portfolio genome mapping across multiple assets',
      'Market momentum score for timing acquisitions',
      'STR yield potential and zoning flag',
      'DNA adjusted valuation for renovation upside',
      'Exportable report for LP and committee review',
    ],
    quote: '"We run PropertyDNA on every off-market deal before we engage the seller. If the numbers don\'t sequence, we don\'t make an offer. It\'s cut our wasted diligence hours in half."',
    quoteName: 'Elena V.', quoteRole: 'Director of Acquisitions · Ashbury REIT',
  },
];

const proFeatures = [
  { tag: 'Standard', title: 'Full Intelligence Report', desc: 'Property vitals, valuation, risk analysis, and a direct verdict. Delivered in under 3 minutes.', locked: false },
  { tag: 'Standard', title: 'Buyer & Seller Analysis', desc: 'AI-generated narrative grounded in verified data — not boilerplate. Defensible in front of any committee.', locked: false },
  { tag: 'Standard', title: 'Flood & Risk Profile', desc: 'FEMA flood zone, special hazard area classification, and environmental risk strand scoring.', locked: false },
  { tag: 'Pro', title: 'Comparable Trend Charts', desc: "Sales velocity and price-per-sqft trends over 6, 12, and 24 month windows across the subject's micro-market.", locked: true },
  { tag: 'Pro', title: 'Market Velocity Index', desc: 'Days on market, absorption rate, and demand intensity for the ZIP code — updated weekly from live transaction data.', locked: true },
  { tag: 'Enterprise', title: 'Portfolio Genome Mapping', desc: 'Visualise your entire portfolio as an interconnected genetic map. Spot concentration risk and hidden correlations.', locked: true },
];

export default function Professionals() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>('signin');

  const openModal = (tab: ModalTab = 'signup') => {
    setModalTab(tab);
    setModalOpen(true);
  };

  return (
    <div className="bg-espresso text-canvas min-h-screen">
      <Nav
        onSignInClick={() => openModal('signin')}
        onRequestAccessClick={() => openModal('signup')}
      />
      <SignInModal isOpen={modalOpen} initialTab={modalTab} onClose={() => setModalOpen(false)} />

      {/* Hero */}
      <section
        className="pt-32 md:pt-40 px-6 md:px-12 pb-20"
        style={{ background: 'radial-gradient(circle at 70% 0%, rgba(184,147,85,0.14), transparent 55%), #0F0E0D' }}
      >
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-6">
              For Professionals
            </div>
            <h1
              className="font-serif font-light text-canvas leading-[1.04] mb-8"
              style={{ fontSize: 'clamp(40px, 6vw, 80px)', letterSpacing: '-1.5px' }}
            >
              Intelligence built for
              <br />
              <em className="italic text-gold">professionals who decide.</em>
            </h1>
            <p className="font-sans text-[16px] font-light leading-[1.9] text-canvas/65 max-w-2xl mb-10">
              PropertyDNA was engineered for the professionals who can't afford to be wrong: agents
              who need to defend a price, lenders who need to verify an LTV, and investors who need
              to sequence a deal in under an hour.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={() => openModal('signup')}
                className="font-sans text-[11px] font-medium uppercase tracking-[3px] text-espresso bg-gold hover:bg-[#cfa366] transition-colors px-7 py-4"
              >
                Request Access
              </button>
              <button
                type="button"
                onClick={() => openModal('sales')}
                className="font-sans text-[11px] font-medium uppercase tracking-[3px] text-canvas border border-canvas/25 hover:border-gold hover:text-gold transition-colors px-7 py-4 !bg-transparent hover:!bg-transparent"
              >
                Talk to Sales →
              </button>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-white/8 px-6 md:px-12 py-10" style={{ background: '#0A0908' }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            ['< 3 min', 'Report delivery'],
            ['14.3M', 'Properties indexed'],
            ['47', 'Live data sources'],
            ['97.6%', 'Valuation accuracy'],
          ].map(([num, label]) => (
            <div key={label}>
              <div className="font-serif font-light text-canvas mb-1" style={{ fontSize: 'clamp(28px,3vw,40px)', letterSpacing: '-0.5px' }}>{num}</div>
              <div className="font-sans text-[10px] tracking-[2px] text-canvas/40 uppercase">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Audience segments */}
      {segments.map((seg, idx) => (
        <section
          key={seg.num}
          className="px-6 md:px-12 py-20 md:py-28"
          style={{ background: idx % 2 === 0 ? '#0F0E0D' : '#0A0908' }}
        >
          <div className="max-w-6xl mx-auto">
            <FadeUp>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-20 items-start">
                {/* Left */}
                <div>
                  <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-4">
                    {seg.tag}
                  </div>
                  <div className="font-serif font-light text-canvas leading-[1.1] mb-6" style={{ fontSize: 'clamp(26px,3.5vw,42px)', letterSpacing: '-0.5px' }}>
                    {seg.title}
                  </div>
                  <p className="font-sans text-[14px] font-light leading-[1.85] text-canvas/65 mb-10">
                    {seg.desc}
                  </p>

                  {/* Quote */}
                  <div className="border-l-2 border-gold/40 pl-6">
                    <p className="font-serif text-[15px] font-light italic text-canvas/75 leading-[1.7] mb-4">
                      {seg.quote}
                    </p>
                    <div className="font-sans text-[11px] tracking-[1px] text-canvas/50 uppercase">
                      {seg.quoteName} — {seg.quoteRole}
                    </div>
                  </div>
                </div>

                {/* Right: use cases */}
                <div>
                  <div className="font-sans text-[9px] tracking-[3px] text-canvas/40 uppercase mb-6">
                    Common use cases
                  </div>
                  <div className="flex flex-col gap-0">
                    {seg.useCases.map((uc, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-4 py-4 border-b border-white/6"
                      >
                        <div className="font-serif text-gold text-sm leading-none mt-0.5 flex-shrink-0">{String(i + 1).padStart(2, '0')}</div>
                        <div className="font-sans text-[14px] font-light leading-[1.75] text-canvas/70">{uc}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8">
                    <button
                      type="button"
                      onClick={() => window.location.href = '/'}
                      className="font-sans text-[10px] font-medium tracking-[3px] uppercase text-canvas border border-canvas/20 hover:border-gold hover:text-gold transition-colors px-6 py-3.5 !bg-transparent hover:!bg-transparent"
                    >
                      Run a Report →
                    </button>
                  </div>
                </div>
              </div>
            </FadeUp>
          </div>
        </section>
      ))}

      {/* Feature comparison — free vs pro vs enterprise */}
      <section className="px-6 md:px-12 py-20 md:py-28" style={{ background: '#0F0E0D' }}>
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <div className="mb-14">
              <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-4">
                Capability Tiers
              </div>
              <h2
                className="font-serif font-light text-canvas leading-[1.05] max-w-2xl"
                style={{ fontSize: 'clamp(28px,3.5vw,48px)', letterSpacing: '-0.8px' }}
              >
                From standard reports to
                <br />
                <em className="italic text-gold">full portfolio intelligence.</em>
              </h2>
            </div>
          </FadeUp>
          <FadeUp delay={0.1}>
            <PremiumFeatureGrid
              features={proFeatures}
              onUpgrade={() => openModal('signup')}
            />
          </FadeUp>
        </div>
      </section>

      {/* CTA */}
      <section
        className="px-6 md:px-12 py-20 md:py-28 text-center"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(184,147,85,0.14), transparent 65%), #0A0908' }}
      >
        <FadeUp>
          <div className="max-w-2xl mx-auto">
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-5">Get Started</div>
            <h2
              className="font-serif font-light text-canvas leading-[1.05] mb-8"
              style={{ fontSize: 'clamp(28px,4vw,56px)', letterSpacing: '-0.8px' }}
            >
              Sequence your first property
              <br />
              <em className="italic text-gold">free — today.</em>
            </h2>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/"
                className="font-sans text-[11px] font-medium uppercase tracking-[3px] text-espresso bg-gold hover:bg-[#cfa366] transition-colors px-8 py-4"
                style={{ textDecoration: 'none' }}
              >
                Run Your First Report
              </Link>
              <button
                type="button"
                onClick={() => openModal('sales')}
                className="font-sans text-[11px] font-medium uppercase tracking-[3px] text-canvas border border-canvas/25 hover:border-gold hover:text-gold transition-colors px-8 py-4 !bg-transparent hover:!bg-transparent"
              >
                Discuss Enterprise →
              </button>
            </div>
          </div>
        </FadeUp>
      </section>

      <Footer />
    </div>
  );
}
