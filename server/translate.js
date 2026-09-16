import { fetchJson } from "./providers/http.js";
import { lookupGlossary } from "./glossary.js";

const CACHE_TTL = 60 * 60 * 1000;
const cache = new Map();

export function hasCJK(str) {
  return /[\u4e00-\u9fa5]/.test(String(str || ""));
}

function looksEnglish(str) {
  const s = String(str || "");
  return /[a-zA-Z]{3,}/.test(s) && !hasCJK(s);
}

/**
 * 把关键词翻成英文供英文源使用。
 * 返回 { en, translated, by, failed }
 */
export async function toEnglish(keyword) {
  const kw = String(keyword || "").trim();
  if (!kw) return { en: "", translated: false, by: "none" };

  // 本来就是英文，直接用
  if (!hasCJK(kw)) return { en: kw, translated: false, by: "original" };

  // 1) 术语词典优先
  const gloss = lookupGlossary(kw);
  if (gloss) return { en: gloss, translated: true, by: "glossary" };

  // 2) 缓存
  const hit = cache.get(kw);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.result;

  // 3) MyMemory 在线翻译
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      kw
    )}&langpair=zh-CN|en`;
    const data = await fetchJson(url, { timeout: 8000, retries: 1 });
    const en = String(data?.responseData?.translatedText || "").trim();
    if (looksEnglish(en)) {
      const result = { en, translated: true, by: "mymemory" };
      cache.set(kw, { at: Date.now(), result });
      return result;
    }
  } catch {}

  // 4) 降级：翻译失败，英文源将不被查询
  const result = { en: kw, translated: false, by: "failed" };
  cache.set(kw, { at: Date.now(), result });
  return result;
}
