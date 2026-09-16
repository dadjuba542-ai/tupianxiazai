import { fetchText } from "./http.js";

const HOME = "https://www.xinpianchang.com";
const REFERER = "https://www.baidu.com/";

export default {
  id: "xinpianchang",
  name: "新片场",
  homepage: HOME,
  license: "版权归原作者，需跳转查看",
  note: "中文关键词，结果为跳转卡片（无直链）",
  async health() {
    try {
      const html = await fetchText(`${HOME}/search?kw=test`, {
        timeout: 12000,
        headers: { referer: REFERER },
      });
      return html.includes("__NEXT_DATA__");
    } catch {
      return false;
    }
  },
  async search(keyword, { limit = 24 } = {}) {
    const url = `${HOME}/search?kw=${encodeURIComponent(keyword)}`;
    const html = await fetchText(url, {
      timeout: 25000,
      headers: { referer: REFERER },
    });
    const raw = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
    )?.[1];
    if (!raw) return [];

    let list;
    try {
      const data = JSON.parse(raw);
      list = data?.props?.pageProps?.searchData?.list || [];
    } catch {
      return [];
    }

    return list
      .filter((it) => it && it.id && it.title)
      .slice(0, limit)
      .map((it) => {
        const cover = it.cover || "";
        return {
          id: `xinpianchang:${it.id}`,
          source: "xinpianchang",
          sourceName: "新片场",
          title: it.title,
          thumbnail: cover,
          previewUrl: null,
          videoUrl: null,
          duration: it.duration || null,
          width: null,
          height: null,
          license: "版权归原作者",
          author: it.author?.userinfo?.username || "新片场",
          pageUrl: it.web_url || `${HOME}/a${it.id}`,
          downloadable: false,
          external: true,
        };
      });
  },
};
