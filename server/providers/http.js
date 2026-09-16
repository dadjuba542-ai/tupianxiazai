import { dispatcherFor } from "../proxy.js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function once(url, timeout, headers) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        "accept-language": "en-US,en;q=0.9",
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        ...headers,
      },
      signal: ac.signal,
      redirect: "follow",
      dispatcher: dispatcherFor(url),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url, { timeout = 15000, headers = {}, retries = 2 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await once(url, timeout, headers);
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || "");
      const httpErr = /^HTTP \d+$/.test(msg);
      const transient = !httpErr && /fetch failed|abort|ECONN|ETIMEDOUT|socket|network|other side closed/i.test(msg);
      if (!transient || i === retries) throw err;
      await sleep(400 * 2 ** i);
    }
  }
  throw lastErr;
}

export async function fetchJson(url, opts = {}) {
  const txt = await fetchText(url, {
    ...opts,
    headers: { accept: "application/json", ...(opts.headers || {}) },
  });
  return JSON.parse(txt);
}

export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length).fill(null);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        out[idx] = await fn(items[idx], idx);
      } catch {
        out[idx] = null;
      }
    }
  });
  await Promise.all(workers);
  return out;
}

export function slugTitle(slug) {
  return slug
    .replace(/^coverr-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
