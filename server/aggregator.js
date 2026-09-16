import { providers } from "./providers/index.js";
import { toEnglish, hasCJK } from "./translate.js";
import { buildMatcher } from "./relevance.js";

function selectProviders(sources) {
  const usable = providers.filter((p) => !p.configured || p.configured());
  return sources.length ? usable.filter((p) => sources.includes(p.id)) : usable;
}

/**
 * 为每个源生成查询任务：决定它该用中文还是英译关键词。
 */
function buildJobs(list, keyword, tr) {
  const jobs = [];
  const translatedOkay = tr.translated && tr.by !== "failed";
  const cjk = hasCJK(keyword);

  for (const p of list) {
    if (p.lang === "both") {
      jobs.push({ provider: p, keyword, lang: "zh" });
      if (translatedOkay) jobs.push({ provider: p, keyword: tr.en, lang: "en" });
      continue;
    }
    if (p.lang === "en") {
      // 中文查询但翻译失败 → 英文源查了也是垃圾，直接跳过
      if (cjk && !translatedOkay) continue;
      jobs.push({ provider: p, keyword: translatedOkay ? tr.en : keyword, lang: "en" });
      continue;
    }
    jobs.push({ provider: p, keyword, lang: "zh" });
  }
  return jobs;
}

export async function searchAll(keyword, { sources = [], limit = 24 } = {}) {
  const list = selectProviders(sources);
  const translation = await toEnglish(keyword);
  const jobs = buildJobs(list, keyword, translation);

  const settled = await Promise.allSettled(
    jobs.map((j) => j.provider.search(j.keyword, { limit }))
  );

  const counts = {};
  const errors = [];
  const dropped = {};
  const merged = [];

  settled.forEach((res, i) => {
    const job = jobs[i];
    const id = job.provider.id;
    if (res.status !== "fulfilled") {
      counts[id] = counts[id] || 0;
      errors.push({ source: id, message: res.reason?.message || String(res.reason) });
      return;
    }

    const matcher = buildMatcher(job.keyword);
    const kept = [];
    for (const item of res.value) {
      // matchText 允许源提供更完整的可匹配文本（如 Pixabay 的完整标签）
      const score = matcher(item.matchText || item.title);
      if (score <= 0) {
        dropped[id] = (dropped[id] || 0) + 1;
        continue;
      }
      kept.push({ ...item, relevance: score, matchedLang: job.lang });
    }
    counts[id] = (counts[id] || 0) + kept.length;
    merged.push(...kept);
  });

  const seen = new Set();
  const deduped = merged.filter((it) => {
    if (seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });

  deduped.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

  return {
    items: deduped,
    errors,
    counts,
    dropped,
    translation:
      translation.by === "glossary" || translation.by === "mymemory"
        ? { used: true, en: translation.en, by: translation.by }
        : { used: false, en: "", by: translation.by },
  };
}

export async function healthAll() {
  const results = await Promise.all(
    providers.map(async (p) => {
      const configured = p.configured ? p.configured() : true;
      let online = false;
      if (configured) {
        try {
          online = await p.health();
        } catch {
          online = false;
        }
      }
      return {
        id: p.id,
        name: p.name,
        homepage: p.homepage,
        license: p.license,
        note: p.note || "",
        lang: p.lang,
        requiresKey: Boolean(p.requiresKey),
        configured,
        online,
      };
    })
  );
  return results;
}
