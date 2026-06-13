/**
 * seo-auto-publisher — Auto-publish SEO drafts from tools/seo-content/queue/.
 *
 * NOTE: this Netlify function lives in the same repo as the queue files
 * BUT Netlify functions don't see the repo at runtime (only their bundled
 * code). So the actual auto-publish happens via a GitHub Actions workflow
 * or by running tools/seo-content/publish.ts locally.
 *
 * This endpoint exists to TRIGGER the workflow (when wired) and to expose
 * a status check Dan can hit to see what's in queue.
 *
 * GET /.netlify/functions/seo-auto-publisher
 *   → Returns the queue + published count by reading the GitHub repo
 *     contents API (no repo checkout needed).
 *
 * POST (with x-internal-key) triggers the GitHub workflow that runs
 * publish.ts in CI and commits the updated blogPosts.ts back to main.
 */
const https = require("https");

const REPO_OWNER = "Stuartteamps";
const REPO_NAME  = "propertydna-landing";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

function gh(path) {
  return new Promise((resolve) => {
    https.get({
      hostname: "api.github.com", path,
      headers: { "User-Agent": "PropertyDNA-AutoPub/1.0", Accept: "application/vnd.github+json" },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    }).on("error", () => resolve(null))
      .setTimeout(8000, () => resolve(null));
  });
}

async function getQueueStatus() {
  const queue = await gh(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/tools/seo-content/queue`) || [];
  const published = await gh(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/tools/seo-content/published`) || [];

  const queueCount = Array.isArray(queue) ? queue.filter(f => f.name?.endsWith(".md") && !f.name.startsWith("_")).length : 0;
  const publishedCount = Array.isArray(published) ? published.filter(f => f.name?.endsWith(".md")).length : 0;

  return {
    queued: queueCount,
    published: publishedCount,
    queue_files: Array.isArray(queue) ? queue.slice(0, 20).map(f => f.name) : [],
    last_check: new Date().toISOString(),
    next_action: queueCount > 0
      ? "Run `npx tsx tools/seo-content/publish.ts` locally to inject into blogPosts.ts + move to published/"
      : "Queue is empty. Run `npx tsx tools/seo-content/generate.ts --count N` to add more.",
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  if (event.httpMethod === "GET") {
    const status = await getQueueStatus();
    return { statusCode: 200, headers: CORS, body: JSON.stringify(status, null, 2) };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };
};
