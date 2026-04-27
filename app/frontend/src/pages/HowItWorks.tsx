import { useState } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import FadeUp from '@/components/FadeUp';
import SignInModal from '@/components/SignInModal';
import { Link } from 'react-router-dom';

const steps = [
  ['01', 'INPUT', 'Submit an Address', 'Enter a single property address, upload a CSV of your portfolio, or integrate via our REST API. PropertyDNA accepts any scale of input — one unit or one thousand.'],
  ['02', 'SEQUENCE', 'Deep Data Ingestion', 'Our engine cross-references 47 live data sources and 14.3M historical property records in under 2 seconds. Land registry, planning portals, flood maps, energy ratings, census data — all spliced together into a single timeline.'],
  ['03', 'DECODE', 'Genome Generated', 'A complete property genome emerges: valuation with confidence bands, risk strand analysis, yield potential, comparative position, and trajectory modelling across 5, 10, and 25 year windows.'],
  ['04', 'DEPLOY', 'Act With Confidence', 'You receive a fully formatted intelligence report in your inbox — ready to forward to a committee, a client, or your underwriting team. Make acquisition, disposal, or lending decisions backed by the most complete property intelligence available.'],
];

export default function HowItWorks() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'signin'|'signup'|'sales'>('signin');
  return (
    <div className="bg-espresso text-canvas min-h-screen">
      <Nav
        onSignInClick={() => { setModalTab('signin'); setModalOpen(true); }}
        onRequestAccessClick={() => { setModalTab('signup'); setModalOpen(true); }}
      />
      <SignInModal isOpen={modalOpen} initialTab={modalTab} onClose={() => setModalOpen(false)} />

      <section className="pt-32 md:pt-40 px-6 md:px-12 pb-16">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-6">
              How It Works
            </div>
            <h1
              className="font-serif font-light text-canvas leading-[1.05] mb-10"
              style={{ fontSize: 'clamp(40px, 6vw, 80px)', letterSpacing: '-1.5px' }}
            >
              From address to <em className="italic text-gold">insight</em>
              <br />
              in four steps.
            </h1>
            <p className="font-sans text-[16px] font-light leading-[1.9] text-canvas/70 max-w-2xl">
              Every PropertyDNA report follows the same rigorous pipeline. No shortcuts, no
              estimates — just a sequenced, verifiable profile of the property you care about.
            </p>
          </FadeUp>
        </div>
      </section>

      <section className="px-6 md:px-12 py-16 md:py-20">
        <div className="max-w-5xl mx-auto flex flex-col gap-12 md:gap-16">
          {steps.map(([num, tag, title, desc], i) => (
            <FadeUp key={num} delay={i * 0.08}>
              <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 md:gap-16 pt-8 border-t border-white/10">
                <div className="flex md:flex-col items-baseline md:items-start gap-4 md:gap-2">
                  <div
                    className="font-serif font-light text-gold leading-none"
                    style={{ fontSize: 'clamp(48px, 5vw, 72px)' }}
                  >
                    {num}
                  </div>
                  <div className="font-sans text-[10px] tracking-[3px] text-canvas/45 uppercase">
                    {tag}
                  </div>
                </div>
                <div>
                  <div className="font-serif text-2xl md:text-3xl font-light text-canvas leading-tight mb-4">
                    {title}
                  </div>
                  <div className="text-[15px] font-light leading-[1.9] text-canvas/65 max-w-xl">
                    {desc}
                  </div>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      <section className="px-6 md:px-12 py-20 md:py-28 text-center">
        <Link
          to="/"
          className="inline-block font-sans text-[11px] font-medium uppercase tracking-[3px] text-espresso bg-gold hover:bg-[#cfa366] transition-colors px-8 py-4"
        >
          Sequence a Property
        </Link>
      </section>

      <Footer />
    </div>
  );
}