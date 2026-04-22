import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import FadeUp from '@/components/FadeUp';
import { Link } from 'react-router-dom';

export default function About() {
  return (
    <div className="bg-espresso text-canvas min-h-screen">
      <Nav />

      <section className="pt-32 md:pt-40 px-6 md:px-12 pb-20 md:pb-28">
        <div className="max-w-4xl mx-auto">
          <FadeUp>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-6">
              About PropertyDNA
            </div>
            <h1
              className="font-serif font-light text-canvas leading-[1.05] mb-10"
              style={{ fontSize: 'clamp(40px, 6vw, 80px)', letterSpacing: '-1.5px' }}
            >
              We believe data
              <br />
              should tell the <em className="italic text-gold">whole truth.</em>
            </h1>
            <p className="font-sans text-[16px] font-light leading-[1.9] text-canvas/70 mb-6">
              PropertyDNA was founded on a simple principle: every property carries a genetic
              fingerprint — a combination of structural, environmental, and market signals that,
              when decoded, reveals its true character and value.
            </p>
            <p className="font-sans text-[16px] font-light leading-[1.9] text-canvas/70 mb-6">
              Traditional valuation tools flatten this complexity into a single number and hope for
              the best. We don't. Our platform sequences every attribute that matters, cross-checks
              against 14.3M historical records, and returns a report that any professional can
              defend in front of a committee.
            </p>
            <p className="font-sans text-[16px] font-light leading-[1.9] text-canvas/70">
              Built for investors, lenders, and analysts who refuse to guess.
            </p>
          </FadeUp>
        </div>
      </section>

      <section className="bg-[#0A0908] px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            ['Precision', 'Every output is traceable to a verified source. No black boxes.'],
            ['Speed', 'Decisions move at market speed. Our reports arrive in minutes, not weeks.'],
            ['Honesty', 'We tell you when data is thin and when a property is a pass. No sugar coating.'],
          ].map(([title, desc], i) => (
            <FadeUp key={title} delay={i * 0.1}>
              <div>
                <div className="font-serif text-2xl font-light text-gold mb-4">{title}</div>
                <div className="text-[14px] font-light leading-[1.8] text-canvas/60">{desc}</div>
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
          Return to Home
        </Link>
      </section>

      <Footer />
    </div>
  );
}