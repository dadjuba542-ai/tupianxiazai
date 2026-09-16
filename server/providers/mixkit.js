import { fetchText } from "./http.js";

const HOME = "https://mixkit.co/free-stock-video/";

function extract(html, limit) {
  const byId = new Map();
  const re = /assets\.mixkit\.co\/videos\/(\d+)\/\1-360\.mp4/g;
  let m;
  while ((m = re.exec(html))) {
    const id = m[1];
    const before = html.slice(Math.max(0, m.index - 1400), m.index);
    const alts = [...before.matchAll(/alt="([^"]*)"/g)];
    const alt = alts.length ? alts[alts.length - 1][1].trim() : "";
    const existing = byId.get(id);
    if (existing) {
      if (!existing.title && alt) existing.title = alt;
      continue;
    }
    byId.set(id, {
      id: `mixkit:${id}`,
      source: "mixkit",
      sourceName: "Mixkit",
      title: alt,
      thumbnail: `https://assets.mixkit.co/videos/${id}/${id}-thumb-360-0.jpg`,
      previewUrl: `https://assets.mixkit.co/videos/${id}/${id}-360.mp4`,
      videoUrl: `https://assets.mixkit.co/videos/${id}/${id}-1080.mp4`,
      duration: null,
      width: 1920,
      height: 1080,
      license: "Mixkit Free License",
      author: "Mixkit",
      pageUrl: HOME,
    });
  }
  return [...byId.values()]
    .map((v) => ({ ...v, title: v.title || `Mixkit Clip ${v.id.split(":")[1]}` }))
    .slice(0, limit);
}

export default {
  id: "mixkit",
  name: "Mixkit",
  homepage: HOME,
  license: "Mixkit Free License",
  async health() {
    try {
      await fetchText(HOME, { timeout: 8000 });
      return true;
    } catch {
      return false;
    }
  },
  async search(keyword, { limit = 24 } = {}) {
    const slug = String(keyword)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug) return [];
    const url = `${HOME}discover/${slug}/`;
    const html = await fetchText(url, { timeout: 20000 });
    return extract(html, limit);
  },
};
