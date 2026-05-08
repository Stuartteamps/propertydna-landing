const SITE_URL = 'https://www.thepropertydna.com';

const posts = [
  {
    slug: 'what-is-propertydna',
    title: 'What Is PropertyDNA? The AI Platform Realtors Use to Win More Listings',
    excerpt: 'PropertyDNA is the AI property intelligence platform transforming how real estate professionals win listings, serve clients, and analyze markets. Here is exactly what it does and why agents are switching.',
    date: '2025-05-01',
    category: 'Platform Overview',
  },
  {
    slug: 'ai-property-reports-palm-springs-realtors',
    title: 'How Realtors in Palm Springs Are Using AI Property Reports to Win More Listings in 2025',
    excerpt: 'The Coachella Valley real estate market moves fast. Palm Springs realtors using AI-generated property reports are arriving at listing appointments more prepared than competitors — and winning more sellers as a result.',
    date: '2025-05-08',
    category: 'For Realtors',
  },
  {
    slug: 'propertydna-vs-traditional-cma',
    title: 'PropertyDNA vs Traditional CMA: Why AI Is Replacing Manual Comparables in Real Estate',
    excerpt: 'The traditional CMA has served real estate agents well for decades. But AI property reports from PropertyDNA do everything a CMA does — and ten things it cannot. Here is a direct comparison.',
    date: '2025-05-15',
    category: 'Tools & Technology',
  },
  {
    slug: 'propertydna-saves-realtors-time',
    title: '7 Ways PropertyDNA Saves Realtors 10+ Hours Every Week',
    excerpt: 'Time is the one resource every top-producing realtor runs out of first. Here are seven specific ways PropertyDNA eliminates the research bottlenecks that drain hours from your week.',
    date: '2025-05-22',
    category: 'Productivity',
  },
  {
    slug: 'win-listing-appointment-ai-property-data',
    title: 'How to Win Your Next Listing Appointment Using AI Property Data',
    excerpt: 'Listing appointments are won before the agent walks in the door. Here is the exact workflow top Coachella Valley agents use with PropertyDNA to convert more listing opportunities into signed agreements.',
    date: '2025-05-29',
    category: 'For Realtors',
  },
  {
    slug: 'what-is-a-propertydna-report-home-buyers',
    title: 'What Is a PropertyDNA Report? A Complete Guide for Home Buyers',
    excerpt: 'Before you make an offer on a home, you need more information than the MLS listing provides. A PropertyDNA report gives buyers a complete property picture — including the things sellers would rather you not know.',
    date: '2025-06-05',
    category: 'For Buyers',
  },
  {
    slug: 'real-estate-market-heat-maps-explained',
    title: 'Real Estate Market Heat Maps: How Top Agents Identify Buyer Demand Before It Moves',
    excerpt: 'Market heat maps show realtors where buyer demand is building before it shows up in listing prices. Here is how to read them and how top Coachella Valley agents use them to get ahead of the market.',
    date: '2025-06-12',
    category: 'Market Intelligence',
  },
  {
    slug: 'propertydna-lead-to-listing-conversion',
    title: 'From Cold Lead to Signed Listing: The PropertyDNA Conversion Workflow',
    excerpt: 'Winning listings is a system, not a talent. Here is the exact lead-to-listing workflow that top Coachella Valley agents use with PropertyDNA to convert more seller leads into signed agreements.',
    date: '2025-06-19',
    category: 'For Realtors',
  },
  {
    slug: 'future-of-real-estate-ai-property-analysis',
    title: 'The Future of Real Estate: How AI Is Transforming Property Analysis in 2025',
    excerpt: 'Artificial intelligence is not replacing real estate agents — it is replacing the hours of manual research that prevent great agents from doing their best work. Here is what the AI-powered real estate future looks like from inside it.',
    date: '2025-06-26',
    category: 'Industry Trends',
  },
  {
    slug: 'why-sellers-choose-propertydna-realtors',
    title: 'Why Home Sellers Choose Realtors Who Use PropertyDNA',
    excerpt: 'When a seller is choosing between two qualified agents, the one who shows up with AI-powered property intelligence wins more often than not. Here is what sellers are actually looking for — and why PropertyDNA delivers it.',
    date: '2025-07-03',
    category: 'For Sellers',
  },
];

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc822(dateStr) {
  return new Date(dateStr).toUTCString();
}

exports.handler = async () => {
  const items = posts
    .map(
      (p) => `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${SITE_URL}/blog/${p.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${p.slug}</guid>
      <description>${escapeXml(p.excerpt)}</description>
      <pubDate>${toRfc822(p.date)}</pubDate>
      <category>${escapeXml(p.category)}</category>
    </item>`
    )
    .join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>PropertyDNA Journal</title>
    <link>${SITE_URL}/blog</link>
    <description>AI property intelligence insights for real estate professionals in the Coachella Valley and beyond.</description>
    <language>en-us</language>
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${toRfc822(posts[posts.length - 1].date)}</lastBuildDate>
    <image>
      <url>${SITE_URL}/og-image.png</url>
      <title>PropertyDNA Journal</title>
      <link>${SITE_URL}/blog</link>
    </image>
${items}
  </channel>
</rss>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
    body: rss,
  };
};
