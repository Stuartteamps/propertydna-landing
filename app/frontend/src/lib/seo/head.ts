// ─────────────────────────────────────────────────────────────────────────────
// PropertyDNA — SEO head manager (SPA-safe)
//
// This is a Vite/React SPA, so there is no server-render step. Search engines
// (Googlebot renders JS) and AI crawlers read the <head> we mutate at runtime.
// `useSeo()` sets a unique title, description, canonical, OpenGraph, and Twitter
// card per route, and restores nothing on unmount — the next route's `useSeo()`
// overwrites the same managed tags. Tags we own are marked `data-managed-seo`
// so we never fight the static tags baked into index.html.
//
// Everything here degrades gracefully: missing fields are simply not written,
// and `noindex` is honored so thin / insufficient-data pages stay out of the
// index (per the "avoid duplicate thin pages" requirement).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';

export const SITE_ORIGIN = 'https://thepropertydna.com';
export const SITE_NAME = 'Property DNA';
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;

export interface SeoConfig {
  title: string;
  description: string;
  /** Absolute or path-relative canonical. Path is resolved against SITE_ORIGIN. */
  canonical?: string;
  image?: string;
  /** og:type — 'website' | 'article' | 'product' | 'place'. */
  type?: string;
  /** When true, emit robots noindex,follow — for thin / insufficient-data pages. */
  noindex?: boolean;
  /** Twitter card style. */
  twitterCard?: 'summary' | 'summary_large_image';
  /** Extra structured OG tags (e.g. article:published_time). */
  extraMeta?: { name?: string; property?: string; content: string }[];
}

function upsertMeta(key: 'name' | 'property', value: string, content: string) {
  const selector = `meta[${key}="${value}"][data-managed-seo]`;
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    // If a static tag already exists (from index.html), reuse it so we don't
    // duplicate; otherwise create a managed one.
    tag =
      document.head.querySelector<HTMLMetaElement>(`meta[${key}="${value}"]`) ??
      document.createElement('meta');
    tag.setAttribute(key, value);
    tag.setAttribute('data-managed-seo', '');
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"][data-managed-seo]`);
  if (!tag) {
    tag =
      document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`) ??
      document.createElement('link');
    tag.setAttribute('rel', rel);
    tag.setAttribute('data-managed-seo', '');
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
}

export function absoluteUrl(pathOrUrl?: string): string {
  if (!pathOrUrl) return SITE_ORIGIN;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_ORIGIN}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

/** Imperatively apply an SEO config to <head>. Safe to call outside React. */
export function applySeo(cfg: SeoConfig) {
  if (typeof document === 'undefined') return;

  document.title = cfg.title;
  upsertMeta('name', 'description', cfg.description);

  const canonical = absoluteUrl(cfg.canonical);
  upsertLink('canonical', canonical);

  upsertMeta('name', 'robots', cfg.noindex ? 'noindex,follow' : 'index,follow');

  // OpenGraph
  upsertMeta('property', 'og:site_name', SITE_NAME);
  upsertMeta('property', 'og:title', cfg.title);
  upsertMeta('property', 'og:description', cfg.description);
  upsertMeta('property', 'og:type', cfg.type ?? 'website');
  upsertMeta('property', 'og:url', canonical);
  upsertMeta('property', 'og:image', absoluteUrl(cfg.image ?? DEFAULT_OG_IMAGE));

  // Twitter / X
  upsertMeta('name', 'twitter:card', cfg.twitterCard ?? 'summary_large_image');
  upsertMeta('name', 'twitter:title', cfg.title);
  upsertMeta('name', 'twitter:description', cfg.description);
  upsertMeta('name', 'twitter:image', absoluteUrl(cfg.image ?? DEFAULT_OG_IMAGE));

  cfg.extraMeta?.forEach((m) => {
    if (m.property) upsertMeta('property', m.property, m.content);
    else if (m.name) upsertMeta('name', m.name, m.content);
  });
}

/**
 * React hook: applies the SEO config on mount and whenever it changes.
 * Pass a stable-ish config (memoize upstream if it references large objects).
 */
export function useSeo(cfg: SeoConfig | null | undefined) {
  const key = cfg
    ? JSON.stringify([cfg.title, cfg.description, cfg.canonical, cfg.image, cfg.type, cfg.noindex])
    : '';
  useEffect(() => {
    if (cfg) applySeo(cfg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
