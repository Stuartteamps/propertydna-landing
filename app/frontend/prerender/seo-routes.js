// Build-time route lists for the SEO prerender (research + market pages).
// These are pure static-data routes, so we can enumerate them from the data files.
import { researchArticles } from '../src/data/researchPages.ts';
import { marketPages } from '../src/data/marketPages.ts';

export function getSeoRoutes() {
  const routes = new Set(['/research/']);
  for (const a of researchArticles) routes.add(`/research/${a.slug}/`);
  for (const m of marketPages) routes.add(`/market/${m.slug}/`);
  return Array.from(routes).sort();
}
