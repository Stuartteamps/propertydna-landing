# PropertyDNA SEO Content Engine

Long-tail content moat. Generates 1,200-1,800 word blog articles via Anthropic API, queues them for review, then publishes to `/blog`.

## Why this exists

Zillow, Redfin, and Realtor.com index millions of *listing* pages but very few "how do I check..." content pages. The long-tail queries homebuyers ask their AI assistants (or Google) are mostly un-indexed by the big real estate sites because answering them honestly conflicts with their core business.

PropertyDNA's interest is fully aligned with answering them. So we will.

100 seed queries in `seed-queries.json`, covering:
- Flood zones by city / hurricane impact
- Insurance carrier tiers by ZIP
- Permit checks by city
- Zestimate accuracy by market
- Comp analysis + cherry-picking
- Buyer protection / agent incentives
- Off-market by neighborhood
- Market shift by metro
- Pedigree (architects, AD-featured, celebrity)
- Risk overlays (wildfire, hurricane, earthquake, tornado, subsidence)
- First-time buyer / VA / FHA / investor / retiree
- Tool comparisons (vs Zillow / Redfin / Realtor / HomeSnap / HouseCanary)
- Luxury / $3M+ / $5M+ / $10M+ buyer guides
- iOS app feature pages
- Agent + enterprise tools

Each article is built to:
- Answer the question fully in the first 2 paragraphs (Google AI Overview pulls this)
- Rank for 5-50 related queries in addition to the seed query
- Include a free DNA report CTA + iOS app CTA
- Match the "save the humans" voice

Forecast: ~200-2000 monthly searches per article, compounding over 6-18 months.

## Workflow

### Generate a batch

```bash
# Anthropic key from api_keys.md memory
ANTHROPIC_API_KEY=sk-ant-... npx tsx tools/seo-content/generate.ts --count 10
```

Default `--count 10`. Each article costs ~3-5 cents at Sonnet 4.6 rates. Total cost for all 100 articles: ~$3-5.

Optional filters:
```bash
--topic flood-zone-by-city          # only flood-zone articles
--intent transactional              # only transactional intent
```

### Review the queue

Drafts land in `tools/seo-content/queue/<slug>.md` with full frontmatter + section blocks.

Read each one, check for:
- Specific numbers that should be verified (don't trust the AI on facts)
- City-specific claims that need a local check
- CTA placement reads naturally
- Title + meta description are CTR-worthy

### Publish to /blog

Copy the article into `app/frontend/src/data/blogPosts.ts` following the existing schema:

```ts
{
  slug: 'your-slug-here',
  title: '...',
  metaDescription: '...',
  date: '2026-06-11',
  readTime: 7,
  category: 'Buying',
  excerpt: '<first paragraph as 1-2 sentence preview>',
  sections: [
    { type: 'p', text: '...' },
    { type: 'h2', text: '...' },
    { type: 'ul', items: ['...', '...'] },
    { type: 'callout', text: '...' },
  ],
},
```

The blog template renders the same section types.

### Move to published/

Once an article is in blogPosts.ts and deployed, move its MD file from `queue/` to `published/` so the next generate run doesn't redraft it.

```bash
mkdir -p tools/seo-content/published
mv tools/seo-content/queue/your-slug.md tools/seo-content/published/
```

## Future enhancements

- Automate the publish step: a script that copies an approved draft into blogPosts.ts
- Add image generation per article (Stable Diffusion XL with brand-consistent prompts)
- Track ranking via Ahrefs API (premium) or free Google Search Console export
- Cluster articles into topic silos with internal linking

## Mission alignment

Every article links to:
- A free DNA report on any address
- The free iOS app
- The methodology page (citation moat)

We don't gate content. We don't run display ads. We don't sell email lists. We win by being the most honest answer in the search results — and trust compounds.
