// ─────────────────────────────────────────────────────────────────────────────
// PropertyDNA — JSON-LD injector
//
// Renders a Schema.org structured-data block into <head> as a
// <script type="application/ld+json">. AI assistants (ChatGPT, Perplexity,
// Google AI Overviews, Gemini) and classic rich-result crawlers read this to
// understand and cite the page. Each block is keyed by `id` so re-renders and
// route changes replace rather than duplicate, and it self-removes on unmount.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';

export interface JsonLdProps {
  /** Unique per-page-block id, e.g. "property", "faq", "breadcrumb". */
  id: string;
  /** A single schema object, or an array of them (rendered as @graph). */
  data: Record<string, unknown> | Record<string, unknown>[];
}

/** Strips null/undefined/'' / '—' so we never emit fabricated or empty fields. */
export function pruneSchema<T>(value: T): T {
  if (Array.isArray(value)) {
    const arr = value.map(pruneSchema).filter((v) => v != null && v !== '');
    return arr as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const pruned = pruneSchema(v);
      const empty =
        pruned == null ||
        pruned === '' ||
        pruned === '—' ||
        (Array.isArray(pruned) && pruned.length === 0) ||
        (typeof pruned === 'object' && !Array.isArray(pruned) && Object.keys(pruned).length === 0);
      if (!empty) out[k] = pruned;
    }
    return out as unknown as T;
  }
  return value;
}

export default function JsonLd({ id, data }: JsonLdProps) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const scriptId = `ld-json-${id}`;
    let el = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement('script');
      el.id = scriptId;
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    const payload = pruneSchema(data);
    el.textContent = JSON.stringify(payload);
    return () => {
      document.getElementById(scriptId)?.remove();
    };
  }, [id, JSON.stringify(data)]);

  return null;
}
