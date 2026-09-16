import { ytdlpAvailable, searchCC } from "../ytdlp.js";

const MAX_DURATION = Math.max(30, Number(process.env.YOUTUBE_MAX_DURATION) || 1800);

function pickThumb(thumbs) {
  if (!Array.isArray(thumbs) || !thumbs.length) return "";
  const sorted = [...thumbs].filter((t) => t?.url).sort((a, b) => (a.width || 0) - (b.width || 0));
  const mid = sorted.find((t) => (t.width || 0) >= 320) || sorted[sorted.length - 1];
  return mid?.url || "";
}

export default {
  id: "youtube",
  name: "YouTube CC",
  homepage: "https://www.youtube.com",
  license: "CC BY（需署名）",
  note: "仅收录 Creative Commons 授权视频，需代理",
  async health() {
    if (!ytdlpAvailable) return false;
    try {
      await searchCC("test", 1);
      return true;
    } catch {
      return false;
    }
  },
  async search(keyword, { limit = 12 } = {}) {
    const rows = await searchCC(keyword, Math.min(limit * 2, 40));
    return rows
      .filter((r) => r?.id)
      .filter((r) => !r.duration || r.duration <= MAX_DURATION)
      .slice(0, limit)
      .map((r) => ({
        id: `youtube:${r.id}`,
        source: "youtube",
        sourceName: "YouTube CC",
        title: r.title || r.id,
        thumbnail: pickThumb(r.thumbnails),
        previewUrl: null,
        videoUrl: null,
        webpageUrl: `https://www.youtube.com/watch?v=${r.id}`,
        engine: "ytdlp",
        duration: r.duration || null,
        width: null,
        height: null,
        license: "CC BY（需署名）",
        author: r.channel || r.uploader || "YouTube",
        pageUrl: `https://www.youtube.com/watch?v=${r.id}`,
        downloadable: true,
      }));
  },
};
