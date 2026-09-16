import { fetchJson } from "./http.js";

const BASE = "https://archive.org";

export default {
  id: "internetarchive",
  name: "Internet Archive",
  homepage: "https://archive.org/details/movies",
  license: "Public Domain / CC",
  note: "公版电影/纪录片，国内网络通常需科学上网",
  async health() {
    try {
      await fetchJson(`${BASE}/advancedsearch.php?q=test&rows=1&output=json`, {
        timeout: 8000,
      });
      return true;
    } catch {
      return false;
    }
  },
  async search(keyword, { limit = 12 } = {}) {
    const q = `${keyword} AND mediatype:movies`;
    const url =
      `${BASE}/advancedsearch.php?q=${encodeURIComponent(q)}` +
      `&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=creator` +
      `&rows=${limit}&page=1&output=json`;
    const data = await fetchJson(url, { timeout: 20000 });
    const docs = data?.response?.docs || [];

    const results = await Promise.all(
      docs.map(async (doc) => {
        try {
          const meta = await fetchJson(`${BASE}/metadata/${doc.identifier}`, {
            timeout: 12000,
          });
          const files = meta?.files || [];
          const video = files
            .filter((f) => /\.(mp4|m4v|webm|ogv)$/i.test(f.name))
            .sort((a, b) => (Number(b.size) || 0) - (Number(a.size) || 0))[0];
          if (!video) return null;
          const md = meta?.metadata || {};
          return {
            id: `internetarchive:${doc.identifier}`,
            source: "internetarchive",
            sourceName: "Internet Archive",
            title: doc.title || doc.identifier,
            thumbnail: `${BASE}/services/img/${doc.identifier}`,
            previewUrl: null,
            videoUrl: `${BASE}/download/${doc.identifier}/${encodeURIComponent(video.name)}`,
            duration: null,
            width: null,
            height: null,
            license: md.licenseurl || "Public Domain",
            author: doc.creator || "Internet Archive",
            pageUrl: `${BASE}/details/${doc.identifier}`,
            year: doc.year || null,
          };
        } catch {
          return null;
        }
      })
    );
    return results.filter(Boolean);
  },
};
