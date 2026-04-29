import { Link } from 'react-router-dom';

const SOCIAL = [
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/thepropertydna',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/thepropertydna',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
      </svg>
    ),
  },
  {
    name: 'LinkedIn',
    href: 'https://www.linkedin.com/company/thepropertydna',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
        <rect x="2" y="9" width="4" height="12"/>
        <circle cx="4" cy="4" r="2"/>
      </svg>
    ),
  },
  {
    name: 'YouTube',
    href: 'https://www.youtube.com/@thepropertydna',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
        <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
      </svg>
    ),
  },
  {
    name: 'X',
    href: 'https://x.com/thepropertydna',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
];

const links = [
  { label: 'Buy',             href: '/buyer-access' },
  { label: 'Sell',            href: '/seller-valuation' },
  { label: 'Off-Market',      href: '/off-market' },
  { label: 'Property DNA',    href: '/property-dna' },
  { label: 'Heat Maps',       href: '/market-heatmaps' },
  { label: 'Professionals',   href: '/professionals' },
  { label: 'Open House',      href: '/open-house' },
  { label: 'Newsletter',      href: '/newsletter' },
  { label: 'Contact',         href: '/contact' },
  { label: 'Sample Report',   href: '/sample-report' },
  { label: 'How It Works',    href: '/how-it-works' },
  { label: 'About',           href: '/about' },
  { label: 'Dashboard',       href: '/dashboard' },
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
        {/* Social icons */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
          {SOCIAL.map(({ name, href, icon }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={name}
              style={{
                color: 'rgba(244,240,232,0.35)',
                transition: 'color 0.2s',
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#B89355')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(244,240,232,0.35)')}
            >
              {icon}
            </a>
          ))}
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
