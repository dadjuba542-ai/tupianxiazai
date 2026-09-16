import { fetchText, mapLimit } from "./http.js";

const HOME = "https://www.newcger.com";
const REFERER = "https://www.newcger.com/";

const VIDEO_SECTIONS = new Set(["shipinsucai", "duanshipin", "aemoban"]);

const SECTION_NAME = {
  shipinsucai: "视频素材",
  duanshipin: "短视频",
  aemoban: "AE模板",
};

function parseList(html) {
  const out = [];
  const seen = new Set();
  for (const li of html.split("<li>").slice(1)) {
    const m = li.match(
      /href="https:\/\/www\.newcger\.com\/([a-z]+)\/(\d+)\.html"[^>]*title="([^"]*)"/
    );
    if (!m) continue;
    const [, section, id, title] = m;
    if (!VIDEO_SECTIONS.has(section)) continue;
    const key = `${section}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      section,
      id,
      title,
      thumbnail: li.match(/<img src="([^"]+)"/)?.[1] || "",
      mini:
        li.match(/class="fast_forward"\s*data-src="([^"]+)"/)?.[1] ||
        li.match(/data-src="([^"]+\.mp4)"/)?.[1] ||
        "",
      pageUrl: `${HOME}/${section}/${id}.html`,
    });
  }
  return out;
}

async function loadDetail(item) {
  try {
    const html = await fetchText(item.pageUrl, {
      timeout: 15000,
      headers: { referer: REFERER },
    });
    const preview = html.match(
      /https?:\/\/static\.newcger\.com\/uploads\/preview\/[^"'\s]+\.mp4/
    )?.[0];
    const pans = [
      ...new Set(
        (
          html.match(
            /https?:\/\/(?:pan\.baidu\.com|pan\.quark\.cn)[^"'\s<]*/g
          ) || []
        ).map((u) => u.replace(/[",)<]+$/, ""))
      ),
    ];
    return { preview: preview || "", pans };
  } catch {
    return { preview: "", pans: [] };
  }
}

export default {
  id: "newcger",
  name: "新CG儿",
  homepage: `${HOME}/shipinsucai/`,
  license: "免费下载（本站免费素材，原片走网盘）",
  note: "中文关键词，直链预览版 + 网盘原片",
  async health() {
    try {
      await fetchText(`${HOME}/shipinsucai/`, { timeout: 12000, headers: { referer: REFERER } });
      return true;
    } catch {
      return false;
    }
  },
  async search(keyword, { limit = 12 } = {}) {
    const url = `${HOME}/index/search/index?searchtype=titlekeyword&keyword=${encodeURIComponent(
      keyword
    )}`;
    const html = await fetchText(url, { timeout: 20000, headers: { referer: REFERER } });
    const list = parseList(html).slice(0, limit);
    if (!list.length) return [];

    const details = await mapLimit(list, 4, loadDetail);

    return list.map((item, i) => {
      const { preview, pans } = details[i] || { preview: "", pans: [] };
      const videoUrl = preview || item.mini || "";
      const extraLinks = pans.map((u) => ({
        label: /baidu/.test(u) ? "百度网盘" : "夸克网盘",
        url: u,
      }));
      return {
        id: `newcger:${item.section}:${item.id}`,
        source: "newcger",
        sourceName: `新CG儿 · ${SECTION_NAME[item.section] || item.section}`,
        title: item.title,
        thumbnail: item.thumbnail,
        previewUrl: item.mini || preview || null,
        videoUrl: videoUrl || null,
        duration: null,
        width: null,
        height: null,
        license: "新CG儿免费素材",
        author: "新CG儿",
        pageUrl: item.pageUrl,
        downloadable: Boolean(videoUrl),
        extraLinks,
      };
    });
  },
};
