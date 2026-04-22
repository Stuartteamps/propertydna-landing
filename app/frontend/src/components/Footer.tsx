const scrollTo = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export default function Footer() {
  return (
    <footer
      className="bg-espresso px-6 md:px-12 py-12 flex flex-col md:flex-row items-center justify-between gap-6"
      style={{ borderTop: '1px solid rgba(184,147,85,0.2)' }}
    >
      <div className="font-serif text-xl font-light text-canvas">
        Property<span className="text-gold">DNA</span>
      </div>
      <div className="flex flex-wrap gap-6 justify-center">
        {[
          ['Platform', 'platform'],
          ['Pricing', 'pricing'],
          ['About', 'about'],
          ['Get Report', 'form'],
        ].map(([label, id]) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollTo(id)}
            className="font-sans text-[11px] tracking-[2px] uppercase text-canvas/50 hover:text-gold transition-colors !bg-transparent"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="font-sans text-[11px] font-light text-canvas/40">
        © 2026 PropertyDNA. Not a licensed appraisal.
      </div>
    </footer>
  );
}