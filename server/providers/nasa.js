import { fetchJson, mapLimit } from "./http.js";

const BASE = "https://images-api.nasa.gov";

export default {
  id: "nasa",
  name: "NASA",
  homepage: "https://images.nasa.gov",
  license: "NASA Public Domain",
  note: "英文关键词，太空/地球/航天影像，公版可商用",
  async health() {
    try {
      await fetchJson(`${BASE}/search?q=earth&media_type=video&page_size=1`, {
        timeout: 10000,
      });
      return true;
    } catch {
      return false;
    }
  },
  async search(keyword, { limit = 12 } = {}) {
    const data = await fetchJson(
      `${BASE}/search?q=${encodeURIComponent(
        keyword
      )}&media_type=video&page_size=${limit}`,
      { timeout: 20000 }
    );
    const raw = data?.collection?.items || [];

    const results = await mapLimit(raw, 4, async (item) => {
      const meta = item.data?.[0] || {};
      const nasaId = meta.nasa_id;
      if (!nasaId) return null;
      const asset = await fetchJson(`${BASE}/asset/${encodeURIComponent(nasaId)}`, {
        timeout: 15000,
      });
      const files = (asset?.collection?.items || []).map((f) => f.href || "");
      const pick =
        files.find((f) => /~orig\.mp4$/i.test(f)) ||
        files.find((f) => /~large\.mp4$/i.test(f)) ||
        files.find((f) => /~small\.mp4$/i.test(f)) ||
        files.find((f) => /~preview\.mp4$/i.test(f)) ||
        files.find((f) => /\.mp4$/i.test(f));
      if (!pick) return null;
      return {
        id: `nasa:${nasaId}`,
        source: "nasa",
        sourceName: "NASA",
        title: meta.title || nasaId,
        thumbnail: item.links?.[0]?.href || "",
        previewUrl: null,
        videoUrl: pick.replace(/^http:/, "https:"),
        duration: null,
        width: null,
        height: null,
        license: "NASA Public Domain",
        author: meta.center || "NASA",
        pageUrl: `https://images.nasa.gov/details-${nasaId}`,
        downloadable: true,
      };
    });

    return results.filter(Boolean);
  },
};
