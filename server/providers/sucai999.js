import { fetchText } from "./http.js";

const HOME = "https://www.sucai999.com";

function extract(html, limit) {
  const out = [];
  const chunks = html.split('<div class="video_item">').slice(1);
  for (const chunk of chunks) {
    if (out.length >= limit) break;
    const id = chunk.match(/href="\/video\/(\d+)\.html"/)?.[1];
    if (!id) continue;
    const thumb =
      chunk.match(/class="video_preview"[^>]*src="([^"]+)"/)?.[1] ||
      chunk.match(/src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/)?.[1] ||
      "";
    const raw =
      chunk.match(/class="video_source"[^>]*data-original="([^"]+)"/)?.[1] ||
      chunk.match(/data-original="([^"]+\.mp4)"/)?.[1] ||
      "";
    const title =
      chunk.match(/class="info_title"[^>]*>([^<]+)</)?.[1]?.trim() || `菜鸟图库 ${id}`;
    if (!raw) continue;

    const videoUrl = raw.startsWith("//") ? `https:${raw}` : raw;
    out.push({
      id: `sucai999:${id}`,
      source: "sucai999",
      sourceName: "菜鸟图库",
      title,
      thumbnail: thumb,
      previewUrl: videoUrl,
      videoUrl,
      duration: null,
      width: null,
      height: null,
      license: "CC0（用户上传，原片需登录站点下载）",
      author: "菜鸟图库",
      pageUrl: `${HOME}/video/${id}.html`,
      downloadable: true,
    });
  }
  return out;
}

export default {
  id: "sucai999",
  name: "菜鸟图库",
  homepage: HOME,
  license: "CC0",
  note: "中文关键词，直链为低码率预览版",
  async health() {
    try {
      await fetchText(`${HOME}/video.html`, { timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  },
  async search(keyword, { limit = 24 } = {}) {
    const url = `${HOME}/search/video/${encodeURIComponent(keyword)}.html`;
    const html = await fetchText(url, { timeout: 20000 });
    return extract(html, limit);
  },
};
