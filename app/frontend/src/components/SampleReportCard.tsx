export default function SampleReportCard() {
  return (
    <div className="relative bg-canvas border border-rule p-10 float-anim">
      <div className="absolute top-4 right-4 font-sans text-[9px] tracking-[3px] text-gold">
        SAMPLE
      </div>
      <div className="font-serif text-xl font-light text-warmdark mb-1">100 W Andreas Rd</div>
      <div className="text-xs text-warmgray tracking-wide mb-7">Palm Springs, CA 92262</div>

      <div className="flex items-center gap-4 py-5 border-t border-b border-rule mb-6">
        <div className="font-serif text-5xl font-light text-warmdark leading-none">
          88<sup className="text-lg text-warmgray">/100</sup>
        </div>
        <div className="flex flex-col gap-1.5">
          <div
            className="font-sans text-[10px] tracking-[2px] uppercase px-2.5 py-1 text-white"
            style={{ background: '#2D6A4F' }}
          >
            Rating: A
          </div>
          <div className="font-sans text-[10px] tracking-[2px] uppercase px-2.5 py-1 text-white bg-gold">
            High Confidence
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          ['Market Value', '$995,000'],
          ['Type', 'Single Family'],
          ['Beds / Baths', '3 bd / 2 ba'],
          ['Year Built', '1962'],
          ['Sq Ft', '1,850'],
          ['Would We Buy?', 'Yes'],
        ].map(([label, val]) => (
          <div key={label} className="flex flex-col gap-1">
            <div className="font-sans text-[9px] tracking-[2px] uppercase text-warmgray">
              {label}
            </div>
            <div
              className="font-serif text-base text-warmdark"
              style={label === 'Would We Buy?' ? { color: '#2D6A4F' } : undefined}
            >
              {val}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}