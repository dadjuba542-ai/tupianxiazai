import { fetchJson } from "./http.js";

const KEY = process.env.PEXELS_API_KEY || "";

function titleFromUrl(url, id) {
  const slug = String(url || "").split("/").filter(Boolean).pop() || "";
  const cleaned = slug
    .replace(new RegExp(`-${id}$`), "")
    .replace(/-/g, " ")
    .trim();
  return cleaned
    ? cleaned.replace(/\b\w/g, (c) => c.toUpperCase())
    : `Pexels ${id}`;
}

export default {
  id: "pexels",
  name: "Pexels",
  homepage: "https://www.pexels.com/videos/",
  license: "Pexels License",
  requiresKey: true,
  note: "需免费 API Key：https://www.pexels.com/api/",
  configured() {
    return Boolean(KEY);
  },
  async health() {
    if (!KEY) return false;
    try {
      await fetchJson("https://api.pexels.com/videos/search?query=nature&per_page=1", {
        headers: { Authorization: KEY },
        timeout: 8000,
      });
      return true;
    } catch {
      return false;
    }
  },
  async search(keyword, { limit = 24 } = {}) {
    if (!KEY) return [];
    const data = await fetchJson(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(
        keyword
      )}&per_page=${limit}&orientation=all`,
      { headers: { Authorization: KEY }, timeout: 20000 }
    );
    return (data.videos || []).map((v) => {
      const files = [...(v.video_files || [])].sort(
        (a, b) => (b.width || 0) - (a.width || 0)
      );
      const best = files[0] || {};
      const preview = files.find((f) => f.quality === "sd") || best;
      return {
        id: `pexels:${v.id}`,
        source: "pexels",
        sourceName: "Pexels",
        title: titleFromUrl(v.url, v.id),
        thumbnail: v.image,
        previewUrl: preview.link,
        videoUrl: best.link,
        duration: v.duration,
        width: best.width,
        height: best.height,
        license: "Pexels License",
        author: v.user?.name || "Pexels",
        pageUrl: v.url,
      };
    });
  },
};
