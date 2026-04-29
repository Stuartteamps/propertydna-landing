import { useEffect, useRef, useState, ReactNode, CSSProperties } from 'react';

interface FadeUpProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

export default function FadeUp({ children, delay = 0, className = '', style }: FadeUpProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Fallback: always show after 600ms even if IntersectionObserver never fires
    const fallback = setTimeout(() => setVisible(true), 600);

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            obs.unobserve(e.target);
            clearTimeout(fallback);
          }
        });
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => { obs.disconnect(); clearTimeout(fallback); };
  }, []);

  return (
    <div
      ref={ref}
      className={`fade-up ${visible ? 'visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}s`, ...style }}
    >
      {children}
    </div>
  );
}