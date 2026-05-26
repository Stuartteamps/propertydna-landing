#!/usr/bin/env node
/**
 * Generate viral-pattern carousel content for the next 14 days.
 *
 * Each entry includes:
 *  - Multi-image carousel (5-7 slides drawn from /social/photo/ pool)
 *  - Hook-driven caption (under 280 chars for the visible part)
 *  - Comment-bait CTA ("Comment DOSSIER for the file" → ManyChat trigger)
 *  - Optional DM trigger word
 *  - Hashtag block (7-10 hashtags)
 *
 * Inserts into tools/browser-agent/data/content-calendar.json
 * preserving existing past entries.
 */
const fs   = require('fs');
const path = require('path');

const CAL  = path.join(__dirname, 'browser-agent/data/content-calendar.json');
const PHOTOS_DIR = path.join(__dirname, '../app/frontend/public/social/photo');
const cal = JSON.parse(fs.readFileSync(CAL, 'utf8'));

// Photo pool — pick 5 random images per post
const photos = fs.readdirSync(PHOTOS_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
function pickPhotos(n) {
  const shuffled = [...photos].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n).map(f => `https://www.thepropertydna.com/social/photo/${f}`);
}

// Viral content patterns — hook + story + reveal + comment-bait
const POSTS = [
  {
    hook: "This $30M Palm Springs estate has a 70-year secret most agents miss.",
    body: "It's not the architect (verified Albert Frey). It's not the celebrity owner. It's the fact that the original drawings sit in the UCSB archive — and the current listing photo doesn't reference any of it.\n\nWe pulled the dossier. https://www.thepropertydna.com/dossier/513110020",
    cta: "Comment DOSSIER and we'll DM you the full provenance file.",
    triggerWord: "DOSSIER",
    hashtags: "#palmsprings #midcenturymodern #albertfrey #realestate #luxuryrealestate #palmspringsstyle #architecture #proptech",
  },
  {
    hook: "70% of \"celebrity owned\" home claims aren't documentable. We verify the other 30%.",
    body: "Frank Sinatra's Twin Palms (1148 E Alejo). Elvis's Honeymoon Hideaway (1350 Ladera Circle). Bob Hope's Lautner (2466 Southridge). Each has a deed record. Each has a magazine feature. Each has a verified provenance score.\n\nWe documented 53 of them.",
    cta: "Comment VERIFIED to get the full list.",
    triggerWord: "VERIFIED",
    hashtags: "#palmsprings #celebrityhomes #realestate #midcenturymodern #provenance #luxuryrealestate #propertyhistory",
  },
  {
    hook: "We mapped every Palm Springs home Frank Sinatra ever owned. Here are 4.",
    body: "1947–1957: Twin Palms (E. Stewart Williams, piano-shaped pool)\n1957–1995: Sinatra Compound, Rancho Mirage (JFK 1962 visit documented)\n1960s: Movie Colony rental\n1970s: Tamarisk Country Club holdings\n\nEvery owner. Every architect. Every press feature. Verified.",
    cta: "DM \"SINATRA\" and I'll send you the full provenance map.",
    triggerWord: "SINATRA",
    hashtags: "#franksinatra #palmsprings #celebrityhomes #ratpack #midcenturymodern #realestate",
  },
  {
    hook: "I tour Palm Springs homes for a living. This one shocked me.",
    body: "Albert Frey designed his own house in 1963 by literally building it around a boulder. Today, you can still see the 8-foot granite slab inside the living room.\n\nIt's the Frey House II. 686 Palisades Drive. Only ~3 owners in 60 years.",
    cta: "Comment FREY for the architect's full Palm Springs portfolio.",
    triggerWord: "FREY",
    hashtags: "#albertfrey #palmsprings #midcenturymodern #architecture #freyhouse #desertmodernism",
  },
  {
    hook: "James Bond fought a fight scene here. It's a real Palm Springs home you can see.",
    body: "The Elrod House. 2175 Southridge. Designed by John Lautner in 1968. Featured in Diamonds Are Forever (1971) — the scene with Bambi and Thumper.\n\nIt's still privately owned. Provenance verified through the Lautner Foundation archive.",
    cta: "Comment BOND for the dossier with the film clips.",
    triggerWord: "BOND",
    hashtags: "#jamesbond #johnlautner #palmsprings #elrodhouse #midcenturymodern #architecture #moviemagic",
  },
  {
    hook: "Could you live in Bob Hope's house?",
    body: "$30M+ Lautner-designed home in Indian Canyons. Hope commissioned it in 1973; rebuilt after a fire. The mushroom-shaped roof you've seen in design magazines? That's it.\n\nVerified architect. Verified celebrity owner. Verified press history.",
    cta: "Comment HOPE if you've ever toured it (or want the dossier).",
    triggerWord: "HOPE",
    hashtags: "#bobhope #johnlautner #palmsprings #mushroomhouse #midcenturymodern #realestate",
  },
  {
    hook: "Walt Disney lived in Palm Springs from 1948 to 1966. Here's where.",
    body: "Smoke Tree Ranch. A 50-home gated equestrian community founded in 1936. Disney bought in 1948, summered there for 18 years, and the deed history is publicly verifiable.\n\nThere are still ~50 homes in the ranch. Each has its own pedigree.",
    cta: "Comment SMOKE for the full neighborhood dossier.",
    triggerWord: "SMOKE",
    hashtags: "#waltdisney #palmsprings #smoketreeranch #disneyhistory #midcenturymodern #realestate",
  },
  {
    hook: "If you're looking at a Palm Springs MCM home — ask for the dossier first.",
    body: "Permit history. Architect attribution. Celebrity ownership. Period press features. National Register status.\n\nThese aren't \"nice to haves.\" They are 8–15% of the resale value.\n\nWe build them for $5M+ estates.",
    cta: "DM DOSSIER if you're listing or buying — we'll generate one free for your address.",
    triggerWord: "DOSSIER",
    hashtags: "#palmsprings #realestate #midcenturymodern #realestateagent #luxuryrealestate #proptech",
  },
  {
    hook: "Liberace lived here. The pool was shaped like a piano.",
    body: "Casa de Liberace. 501 N Belardo. Owned 1968–1987. Verified through the Liberace Foundation archive + Riverside County deeds + Palm Springs Life feature 1973.\n\nThe piano pool was filled in in the 1990s. The dossier shows you the original.",
    cta: "Comment LIBERACE for the Casa de Liberace dossier.",
    triggerWord: "LIBERACE",
    hashtags: "#liberace #palmsprings #celebrityhomes #pianopool #realestate #vintagepalmsprings",
  },
  {
    hook: "What 16,787 pedigree-classified properties told us about the Coachella Valley.",
    body: "53 verified A-tier estates (architect + celebrity).\n1,282 B-tier (top neighborhood, MCM era).\n5,161 C-tier.\n10,317 D-tier.\n\n13 named neighborhoods. 11 documented architects. Every claim cited to a primary source.",
    cta: "Comment INDEX for the full pedigree breakdown.",
    triggerWord: "INDEX",
    hashtags: "#palmsprings #realestate #midcenturymodern #realestatedata #proptech #luxuryrealestate",
  },
  {
    hook: "John Lautner designed 8 homes in Palm Springs. Originals trade once every 4.7 years.",
    body: "That's not marketing — that's the actual median trade frequency from the Lautner Foundation registry.\n\nWhen one comes on market, it doesn't sit. The Elrod House. The Hoover Residence. The Walstrom House. The Bob Hope House.",
    cta: "Comment LAUTNER for the full architect portfolio.",
    triggerWord: "LAUTNER",
    hashtags: "#johnlautner #palmsprings #midcenturymodern #architecture #lautner #desertmodernism",
  },
  {
    hook: "Want to buy a verified Albert Frey? You've got 47 options.",
    body: "Frey designed 47 documented residential commissions in Palm Springs over a 50-year career. The Tramway Gas Station. Frey House I. Frey House II. The Loewy House. The Cree House.\n\nVerified attribution = 5-12% premium at resale. Unverified = nothing.",
    cta: "Comment FREY47 for the full Frey commissions list.",
    triggerWord: "FREY47",
    hashtags: "#albertfrey #palmsprings #midcenturymodern #architecture #desertmodernism #realestate",
  },
  {
    hook: "Three things every buyer of a $5M+ Palm Springs home should ask for.",
    body: "1. Architect drawings (UCSB, UCLA, or Lautner Foundation archive copy)\n2. Permit history with dates + scope (Riverside County records)\n3. Period press features (Architectural Digest, Palm Springs Life, Look Magazine)\n\nIf the listing agent can't produce these — there's no provenance file.",
    cta: "Comment DUE if you want the buyer's due diligence checklist.",
    triggerWord: "DUE",
    hashtags: "#palmsprings #luxuryrealestate #duediligence #midcenturymodern #buyersagent #proptech",
  },
  {
    hook: "Every property has a story. Most agents never tell it.",
    body: "We pulled the deed history on a Movie Colony estate. 11 owners since 1948. Three of them were Hollywood. One of them was a U.S. Senator. The current listing photo doesn't mention any of it.\n\nThe seller is leaving money on the table because the story isn't being told.",
    cta: "Comment STORY if you own one of these homes — we'll write its dossier.",
    triggerWord: "STORY",
    hashtags: "#palmsprings #realestate #moviecolony #celebrityhomes #realestateagent #luxuryrealestate",
  },
];

// Generate next 14 days starting from tomorrow
const start = new Date();
start.setDate(start.getDate() + 1);

const newPosts = POSTS.map((p, i) => {
  const d = new Date(start);
  d.setDate(d.getDate() + i);
  const date = d.toISOString().slice(0, 10);
  return {
    date,
    text: `${p.hook}\n\n${p.body}\n\n${p.cta}\n\n${p.hashtags}`,
    images: pickPhotos(5),  // 5-image carousel
    image: null,            // legacy single image (unused when images[] present)
    reddit: null,
    medium: null,
    triggerWord: p.triggerWord,
    pattern: 'carousel_comment_bait',
  };
});

// Preserve all past entries; replace future entries
const today = new Date().toISOString().slice(0, 10);
cal.posts = [
  ...cal.posts.filter(p => p.date <= today),
  ...newPosts,
];

fs.writeFileSync(CAL, JSON.stringify(cal, null, 2));
console.log(`✓ Generated ${newPosts.length} new carousel posts from ${newPosts[0].date} → ${newPosts[newPosts.length - 1].date}`);
console.log(`  Each post: hook + body + comment-bait CTA + ${5} image carousel + hashtag block`);
console.log(`  Trigger words: ${newPosts.map(p => p.triggerWord).join(', ')}`);
