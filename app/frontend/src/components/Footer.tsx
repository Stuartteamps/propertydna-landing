import { Link } from 'react-router-dom';

const links = [
  { label: 'Buy',             href: '/buyer-access' },
  { label: 'Sell',            href: '/seller-valuation' },
  { label: 'Off-Market',      href: '/off-market' },
  { label: 'Property DNA',    href: '/property-dna' },
  { label: 'Open House',      href: '/open-house' },
  { label: 'Newsletter',      href: '/newsletter' },
  { label: 'Contact',         href: '/contact' },
  { label: 'Sample Report',   href: '/sample-report' },
  { label: 'How It Works',    href: '/how-it-works' },
  { label: 'About',           href: '/about' },
];

export default function Footer() {
  return (
    <footer
      className="bg-espresso px-6 md:px-12 py-12"
      style={{ borderTop: '1px solid rgba(184,147,85,0.2)' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10 mb-10">
          <div>
            <div className="font-serif text-xl font-light text-canvas mb-2">
              Property<span className="text-gold">DNA</span>
            </div>
            <div className="font-sans text-[11px] text-canvas/40 leading-relaxed max-w-xs">
              Luxury real estate intelligence for buyers, sellers, and investors in Palm Springs and the Coachella Valley.
            </div>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {links.map(({ label, href }) => (
              <Link
                key={href}
                to={href}
                className="font-sans text-[11px] tracking-[2px] uppercase text-canvas/50 hover:text-gold transition-colors"
                style={{ textDecoration: 'none' }}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-sans text-[11px] font-light text-canvas/40">
            © {new Date().getFullYear()} Stuart Team Real Estate · PropertyDNA
          </div>
          <div className="font-sans text-[11px] text-canvas/30">
            Not a licensed appraisal. For informational purposes only.
          </div>
        </div>
      </div>
    </footer>
  );
}
