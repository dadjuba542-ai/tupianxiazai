import { providers } from "./providers/index.js";

export async function searchAll(keyword, { sources = [], limit = 24 } = {}) {
  const selected =
    sources.length > 0
      ? providers.filter((p) => sources.includes(p.id))
      : providers.filter((p) => !p.configured || p.configured());

  const settled = await Promise.allSettled(
    selected.map((p) => p.search(keyword, { limit }))
  );

  const items = [];
  const errors = [];
  const counts = {};

  settled.forEach((res, i) => {
    const p = selected[i];
    if (res.status === "fulfilled") {
      counts[p.id] = res.value.length;
      items.push(...res.value);
    } else {
      counts[p.id] = 0;
      errors.push({ source: p.id, message: res.reason?.message || String(res.reason) });
    }
  });

  const seen = new Set();
  const deduped = items.filter((it) => {
    if (seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });

  return { items: deduped, errors, counts };
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
        requiresKey: Boolean(p.requiresKey),
        configured,
        online,
      };
    })
  );
  return results;
}
