import { fetchText, slugTitle } from "./http.js";

const HOME = "https://coverr.co";

function extract(html, limit) {
  const out = [];
  const seen = new Set();
  const re = /cdn\.coverr\.co\/videos\/([a-z0-9-]+)\/360p\.mp4/g;
  let m;
  while ((m = re.exec(html)) && out.length < limit) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    const before = html.slice(Math.max(0, m.index - 1500), m.index);
    const alts = [...before.matchAll(/alt="([^"]*)"/g)];
    const alt = alts.length ? alts[alts.length - 1][1].trim() : "";
    out.push({
      id: `coverr:${slug}`,
      source: "coverr",
      sourceName: "Coverr",
      title: alt || slugTitle(slug),
      thumbnail: `https://cdn.coverr.co/videos/${slug}/thumbnail?width=520`,
      previewUrl: `https://cdn.coverr.co/videos/${slug}/360p.mp4`,
      videoUrl: `https://cdn.coverr.co/videos/${slug}/1080p.mp4`,
      duration: null,
      width: 1920,
      height: 1080,
      license: "Coverr Free License",
      author: "Coverr",
      pageUrl: `${HOME}/videos/${slug}`,
    });
  }
  return out;
}

export default {
  id: "coverr",
  name: "Coverr",
  homepage: HOME,
  license: "Coverr Free License",
  async health() {
    try {
      await fetchText(`${HOME}/s?q=nature`, { timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  },
  async search(keyword, { limit = 24 } = {}) {
    const tokens = String(keyword).toLowerCase().match(/[a-z0-9]{2,}/g) || [];
    if (!tokens.length) return [];
    const url = `${HOME}/s?q=${encodeURIComponent(keyword)}`;
    const html = await fetchText(url, { timeout: 25000 });
    const items = extract(html, limit * 2);
    const matched = items.filter((it) => {
      const t = it.title.toLowerCase();
      return tokens.some((tok) => t.includes(tok));
    });
    return (matched.length ? matched : []).slice(0, limit);
  },
};
