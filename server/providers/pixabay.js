import { fetchJson } from "./http.js";

const KEY = process.env.PIXABAY_API_KEY || "";

export default {
  id: "pixabay",
  name: "Pixabay",
  homepage: "https://pixabay.com/videos/",
  license: "Pixabay License",
  requiresKey: true,
  note: "支持中文关键词",
  configured() {
    return Boolean(KEY);
  },
  async health() {
    if (!KEY) return false;
    try {
      await fetchJson(`https://pixabay.com/api/videos/?key=${KEY}&q=nature&per_page=3`, {
        timeout: 8000,
      });
      return true;
    } catch {
      return false;
    }
  },
  async search(keyword, { limit = 24 } = {}) {
    if (!KEY) return [];
    const hasCJK = /[\u4e00-\u9fa5]/.test(keyword);
    const lang = hasCJK ? "&lang=zh" : "";
    const data = await fetchJson(
      `https://pixabay.com/api/videos/?key=${KEY}&q=${encodeURIComponent(
        keyword
      )}${lang}&per_page=${Math.max(3, Math.min(limit, 50))}&safesearch=true`,
      { timeout: 20000 }
    );
    return (data.hits || []).map((h) => {
      const v = h.videos || {};
      const best = v.large || v.medium || v.small || v.tiny || {};
      const preview = v.tiny || v.small || best;
      return {
        id: `pixabay:${h.id}`,
        source: "pixabay",
        sourceName: "Pixabay",
        title: (h.tags || `Pixabay ${h.id}`).split(",")[0].trim(),
        thumbnail: best.thumbnail || preview.thumbnail || "",
        previewUrl: preview.url,
        videoUrl: best.url,
        duration: h.duration,
        width: best.width,
        height: best.height,
        license: "Pixabay License",
        author: h.user || "Pixabay",
        pageUrl: h.pageURL,
      };
    });
  },
};
