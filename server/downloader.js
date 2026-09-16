import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { dispatcherFor } from "./proxy.js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const DOWNLOAD_DIR = path.resolve(process.cwd(), "downloads");
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

export const CONFIG = {
  maxConcurrent: Math.max(1, Number(process.env.MAX_CONCURRENT) || 4),
  minInterval: Math.max(0, Number(process.env.MIN_REQUEST_INTERVAL_MS) || 500),
  dailyLimit: Math.max(1, Number(process.env.DAILY_DOWNLOAD_LIMIT) || 500),
  maxRetries: Math.max(0, Number(process.env.MAX_RETRIES) || 3),
};

const HOST_INTERVAL = {
  "static.newcger.com": 800,
  "globalimg.sucai999.com": 600,
  "videos.pexels.com": 300,
  "cdn.pixabay.com": 300,
  "images-assets.nasa.gov": 300,
  "assets.mixkit.co": 300,
  "cdn.coverr.co": 300,
  "archive.org": 800,
};

const clients = new Set();
const tasks = new Map();
const controllers = new Map();
const queue = [];
const domainLast = new Map();
const domainPenalty = new Map();
let active = 0;

/* ---------------- daily stats ---------------- */
const STATS_FILE = path.join(DOWNLOAD_DIR, ".stats.json");
const today = () => new Date().toISOString().slice(0, 10);

function loadStats() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
    if (raw.date === today()) return { date: raw.date, count: Number(raw.count) || 0 };
  } catch {}
  return { date: today(), count: 0 };
}

let stats = loadStats();

function saveStats() {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats));
  } catch {}
}

function bumpStats() {
  stats.count += 1;
  saveStats();
  broadcast({ type: "stats", stats: publicStats() });
}

export function publicStats() {
  return {
    date: stats.date,
    count: stats.count,
    limit: CONFIG.dailyLimit,
    active,
    queued: queue.length,
    maxConcurrent: CONFIG.maxConcurrent,
    minInterval: CONFIG.minInterval,
  };
}

/* ---------------- sse ---------------- */
export function addClient(res) {
  clients.add(res);
  res.on("close", () => clients.delete(res));
}

function broadcast(payload) {
  const frame = `data: ${JSON.stringify(payload)}\n\n`;
  for (const c of clients) {
    try {
      c.write(frame);
    } catch {
      clients.delete(c);
    }
  }
}

export function listTasks() {
  return [...tasks.values()].map(publicTask);
}

/* ---------------- helpers ---------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function safeName(str) {
  return (
    String(str || "untitled")
      .replace(/[\\/:*?"<>|\n\r\t]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[.\s]+$/, "")
      .slice(0, 80) || "untitled"
  );
}

function uniquePath(dir, base, ext) {
  let p = path.join(dir, `${base}${ext}`);
  let i = 1;
  while (fs.existsSync(p)) {
    p = path.join(dir, `${base} (${i})${ext}`);
    i += 1;
  }
  return p;
}

function pickExt(url) {
  try {
    const ext = path.extname(new URL(url).pathname);
    if (/^\.[a-z0-9]{2,5}$/i.test(ext)) return ext;
  } catch {}
  return ".mp4";
}

function unlink(file) {
  if (!file) return;
  try {
    fs.unlinkSync(file);
  } catch {}
}

async function throttle(rawUrl) {
  let host = "default";
  try {
    host = new URL(rawUrl).host;
  } catch {}
  const base = HOST_INTERVAL[host] ?? CONFIG.minInterval;
  const interval = Math.round(base * (domainPenalty.get(host) || 1));
  const last = domainLast.get(host) || 0;
  const wait = Math.max(0, last + interval - Date.now());
  domainLast.set(host, Date.now() + wait);
  if (wait > 0) await sleep(wait);
}

function penalize(rawUrl) {
  let host = "default";
  try {
    host = new URL(rawUrl).host;
  } catch {}
  const next = Math.min(5, (domainPenalty.get(host) || 1) * 2);
  domainPenalty.set(host, next);
}

class RetriableError extends Error {
  constructor(message) {
    super(message);
    this.retriable = true;
  }
}

/* ---------------- queue ---------------- */
function schedule() {
  while (active < CONFIG.maxConcurrent && queue.length) {
    const task = queue.shift();
    if (task.status !== "queued" || !tasks.has(task.id)) continue;
    active += 1;
    run(task).finally(() => {
      active -= 1;
      schedule();
      broadcast({ type: "stats", stats: publicStats() });
    });
  }
  broadcast({ type: "stats", stats: publicStats() });
}

function requeue(task) {
  if (!queue.includes(task)) queue.push(task);
  schedule();
}

/* ---------------- public API ---------------- */
export function enqueue(items, keyword) {
  const dir = path.join(DOWNLOAD_DIR, safeName(keyword));
  fs.mkdirSync(dir, { recursive: true });
  const created = [];

  for (const item of items) {
    if (!item?.videoUrl) continue;
    const task = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      title: item.title || "untitled",
      source: item.source || "",
      sourceName: item.sourceName || item.source || "",
      keyword,
      status: "queued",
      progress: 0,
      received: 0,
      total: 0,
      attempts: 0,
      dir,
      file: null,
      error: null,
      item,
    };
    tasks.set(task.id, task);
    created.push(publicTask(task));
    requeue(task);
  }
  return created;
}

export function pauseTask(id) {
  const task = tasks.get(id);
  if (!task) return null;
  if (task.status !== "downloading" && task.status !== "queued") return publicTask(task);
  task.status = "paused";
  controllers.get(id)?.abort();
  const i = queue.indexOf(task);
  if (i >= 0) queue.splice(i, 1);
  broadcast({ type: "update", task: publicTask(task) });
  broadcast({ type: "stats", stats: publicStats() });
  return publicTask(task);
}

export function resumeTask(id) {
  const task = tasks.get(id);
  if (!task) return null;
  if (task.status !== "paused" && task.status !== "error") return publicTask(task);
  task.status = "queued";
  task.error = null;
  broadcast({ type: "update", task: publicTask(task) });
  requeue(task);
  return publicTask(task);
}

export function deleteTasks(ids) {
  const removed = [];
  for (const id of ids) {
    const task = tasks.get(id);
    if (!task) continue;
    const running = task.status === "downloading";
    task.status = "deleted";
    controllers.get(id)?.abort();
    tasks.delete(id);
    const i = queue.indexOf(task);
    if (i >= 0) queue.splice(i, 1);
    if (!running) unlink(task.file);
    removed.push(id);
    broadcast({ type: "removed", id });
  }
  broadcast({ type: "stats", stats: publicStats() });
  return removed;
}

export function shutdown() {
  const all = [...tasks.values()];
  for (const t of all) {
    t.status = "deleted";
    controllers.get(t.id)?.abort();
    const i = queue.indexOf(t);
    if (i >= 0) queue.splice(i, 1);
  }
  tasks.clear();
  queue.length = 0;
  setTimeout(() => {
    for (const t of all) unlink(t.file);
    process.exit(0);
  }, 400);
}

export function clearFinished() {
  return deleteTasks(
    [...tasks.values()]
      .filter((t) => t.status === "done" || t.status === "error")
      .map((t) => t.id)
  );
}

/* ---------------- worker ---------------- */
async function run(task) {
  const item = task.item;
  if (!item?.videoUrl) return;

  for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt += 1) {
    if (task.status === "deleted" || task.status === "paused") return;
    if (stats.count >= CONFIG.dailyLimit) {
      task.status = "error";
      task.error = `今日已达下载上限 ${CONFIG.dailyLimit} 个，明日自动重置`;
      broadcast({ type: "update", task: publicTask(task) });
      return;
    }

    task.attempts = attempt;
    try {
      await downloadOnce(task);
      if (task.status === "done") bumpStats();
      return;
    } catch (err) {
      if (task.status === "deleted" || task.status === "paused") return;
      const retriable = Boolean(err?.retriable);
      if (!retriable || attempt === CONFIG.maxRetries) {
        task.status = "error";
        task.error = err?.message || String(err);
        broadcast({ type: "update", task: publicTask(task) });
        return;
      }
      task.status = "queued";
      task.error = `第 ${attempt + 1} 次失败，重试中…`;
      broadcast({ type: "update", task: publicTask(task) });
      await sleep(1000 * 2 ** attempt);
    }
  }
}

async function downloadOnce(task) {
  const item = task.item;
  const ac = new AbortController();
  controllers.set(task.id, ac);
  task.status = "downloading";
  task.error = null;
  broadcast({ type: "update", task: publicTask(task) });

  try {
    const startAt = task.received > 0 && task.file ? task.received : 0;
    const headers = {
      "user-agent": UA,
      referer: item.pageUrl || new URL(item.videoUrl).origin + "/",
    };
    if (startAt > 0) headers.Range = `bytes=${startAt}-`;

    await throttle(item.videoUrl);
    let res;
    try {
      res = await fetch(item.videoUrl, {
        headers,
        redirect: "follow",
        signal: ac.signal,
        dispatcher: dispatcherFor(item.videoUrl),
      });
    } catch (err) {
      if (ac.signal.aborted) return;
      throw new RetriableError(`网络错误: ${err.message}`);
    }

    if (res.status === 429 || res.status === 403) {
      penalize(item.videoUrl);
      throw new RetriableError(`HTTP ${res.status}（已自动降速，稍后重试）`);
    }
    if (res.status >= 500) {
      throw new RetriableError(`HTTP ${res.status}`);
    }
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const partial = res.status === 206 && startAt > 0;
    const length = Number(res.headers.get("content-length") || 0);
    task.total = partial ? startAt + length : length;

    if (!task.file) {
      task.file = uniquePath(task.dir, safeName(item.title), pickExt(item.videoUrl));
    }
    if (!partial) task.received = 0;

    let received = task.received;
    let last = 0;
    const body = Readable.fromWeb(res.body);
    body.on("data", (chunk) => {
      received += chunk.length;
      task.received = received;
      task.progress = task.total
        ? Math.min(99, Math.round((received / task.total) * 100))
        : 0;
      const now = Date.now();
      if (now - last > 200) {
        last = now;
        broadcast({ type: "update", task: publicTask(task) });
      }
    });

    try {
      await pipeline(body, fs.createWriteStream(task.file, { flags: partial ? "a" : "w" }));
    } catch (err) {
      if (ac.signal.aborted) return;
      throw new Error(`写入失败: ${err.message}`);
    }

    if (ac.signal.aborted) return;
    task.status = "done";
    task.progress = 100;
    if (!task.total) task.total = received;
    broadcast({ type: "update", task: publicTask(task) });
  } catch (err) {
    if (ac.signal.aborted) return;
    throw err;
  } finally {
    controllers.delete(task.id);
    if (task.status === "deleted") unlink(task.file);
  }
}

function publicTask(t) {
  return {
    id: t.id,
    title: t.title,
    source: t.source,
    sourceName: t.sourceName,
    keyword: t.keyword,
    status: t.status,
    progress: t.progress,
    received: t.received,
    total: t.total,
    attempts: t.attempts,
    file: t.file,
    error: t.error,
  };
}
