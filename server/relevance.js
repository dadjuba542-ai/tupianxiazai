const EN_STOP = new Set([
  "the", "a", "an", "of", "and", "for", "with", "in", "on", "at", "to", "by",
  "or", "is", "are", "from", "your", "you", "that", "this", "it", "as", "be",
]);

/**
 * 生成相关性打分器。
 * 中文按 2-gram 切分，英文按停用词过滤后的词元。
 * 返回 0~1 的分数，0 表示完全不沾边。
 */
export function buildMatcher(keyword) {
  const kw = String(keyword || "").trim();
  if (!kw) return () => 1;

  if (/[\u4e00-\u9fa5]/.test(kw)) {
    const grams = [];
    if (kw.length <= 2) {
      grams.push(kw);
    } else {
      for (let i = 0; i + 2 <= kw.length; i += 1) grams.push(kw.slice(i, i + 2));
    }
    const lower = kw.toLowerCase();
    return (title) => {
      const t = String(title || "").toLowerCase();
      if (!t) return 0;
      if (t.includes(lower)) return 1;
      let hit = 0;
      for (const g of grams) if (t.includes(g)) hit += 1;
      return hit / grams.length;
    };
  }

  const lower = kw.toLowerCase();
  const tokens = lower
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !EN_STOP.has(w));
  if (!tokens.length) return () => 1;

  return (title) => {
    const t = String(title || "").toLowerCase();
    if (!t) return 0;
    if (t.includes(lower)) return 1;
    let hit = 0;
    for (const tok of tokens) if (t.includes(tok)) hit += 1;
    return hit / tokens.length;
  };
}
