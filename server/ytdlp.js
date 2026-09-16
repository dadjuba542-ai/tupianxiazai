import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { proxyUrl, shouldProxy } from "./proxy.js";

const HOME = os.homedir();

function firstExecutable(candidates) {
  for (const p of candidates) {
    if (!p) continue;
    try {
      fs.accessSync(p, fs.constants.X_OK);
      return p;
    } catch {}
  }
  return null;
}

export const YTDLP_BIN = firstExecutable([
  process.env.YTDLP_PATH,
  path.join(HOME, ".local/bin/yt-dlp"),
  "/opt/homebrew/bin/yt-dlp",
  "/usr/local/bin/yt-dlp",
  "/usr/bin/yt-dlp",
]);

const FFMPEG_BIN = firstExecutable([
  process.env.FFMPEG_PATH,
  path.join(HOME, ".local/bin/ffmpeg"),
  "/opt/homebrew/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
]);

export const FFMPEG_DIR = FFMPEG_BIN ? path.dirname(FFMPEG_BIN) : null;
export const ytdlpAvailable = Boolean(YTDLP_BIN);

export const TIMEOUTS = {
  search: Math.max(5000, Number(process.env.YTDLP_SEARCH_TIMEOUT_MS) || 45000),
  idle: Math.max(10000, Number(process.env.YTDLP_IDLE_TIMEOUT_MS) || 60000),
  max: Math.max(60000, Number(process.env.YTDLP_MAX_DURATION_MS) || 900000),
};

function run(args, { timeout = TIMEOUTS.search } = {}) {
  return new Promise((resolve, reject) => {
    if (!YTDLP_BIN) return reject(new Error("未找到 yt-dlp"));
    const child = spawn(YTDLP_BIN, args);
    let out = "";
    let err = "";
    let settled = false;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(arg);
    };
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {}
      finish(reject, new Error(`yt-dlp 超时（${Math.round(timeout / 1000)}秒无结果）`));
    }, timeout);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => finish(reject, e));
    child.on("close", (code) => finish(resolve, { code, out, err }));
  });
}

function proxyArgs(url) {
  return shouldProxy(url) && proxyUrl ? ["--proxy", proxyUrl] : [];
}

/* ---------- 搜索：只取 Creative Commons 授权 ---------- */
const CC_FILTER = "EgIwAQ%3D%3D";

export async function searchCC(keyword, limit = 12) {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    keyword
  )}&sp=${CC_FILTER}`;
  const { code, out, err } = await run([
    searchUrl,
    "--flat-playlist",
    "--dump-json",
    "--playlist-end",
    String(limit),
    "--no-warnings",
    ...proxyArgs("https://www.youtube.com"),
  ]);
  const rows = out
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  if (!rows.length) {
    const last = err.trim().split("\n").filter(Boolean).pop() || "";
    throw new Error(last || `yt-dlp 退出码 ${code}`);
  }
  return rows;
}

/* ---------- 下载 ---------- */
export function downloadWithYtdlp(url, outBase, { onProgress, onFile, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (!YTDLP_BIN) return reject(new Error("未找到 yt-dlp"));

    const args = [
      url,
      "-o",
      `${outBase}.%(ext)s`,
      "-f",
      "bv*[vcodec^=avc1][ext=mp4]+ba[ext=m4a]/bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
      "--merge-output-format",
      "mp4",
      "--continue",
      "--newline",
      "--no-warnings",
      "--no-playlist",
      ...(FFMPEG_DIR ? ["--ffmpeg-location", FFMPEG_DIR] : []),
      ...proxyArgs(url),
    ];

    const child = spawn(YTDLP_BIN, args);
    let err = "";
    let lastFile = "";
    let settled = false;
    let watchdog = null;
    const startedAt = Date.now();
    let lastActivity = Date.now();

    const fail = (e) => {
      if (settled) return;
      settled = true;
      if (watchdog) clearInterval(watchdog);
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(e);
    };

    const onAbort = () => {
      try {
        child.kill("SIGTERM");
      } catch {}
    };
    if (signal) {
      if (signal.aborted) return fail(new Error("已取消"));
      signal.addEventListener("abort", onAbort, { once: true });
    }

    watchdog = setInterval(() => {
      const idle = Date.now() - lastActivity;
      if (idle > TIMEOUTS.idle) {
        try {
          child.kill("SIGKILL");
        } catch {}
        fail(new Error(`yt-dlp 无响应 ${Math.round(idle / 1000)} 秒，已终止（可能被平台限流）`));
        return;
      }
      if (Date.now() - startedAt > TIMEOUTS.max) {
        try {
          child.kill("SIGKILL");
        } catch {}
        fail(new Error("yt-dlp 下载超时"));
      }
    }, 5000);

    const handleLine = (line) => {
      lastActivity = Date.now();
      const pct = line.match(/\[download\]\s+([\d.]+)%/);
      if (pct && onProgress) onProgress(Number(pct[1]));
      const dest = line.match(/\[download\] Destination: (.+)$/);
      if (dest && onFile) onFile(dest[1].trim());
      const merge = line.match(/\[Merger\] Merging formats into "(.+)"$/);
      if (merge) {
        lastFile = merge[1];
        if (onFile) onFile(lastFile);
      }
    };

    let buf = "";
    child.stdout.on("data", (d) => {
      lastActivity = Date.now();
      buf += d.toString();
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      lines.forEach(handleLine);
    });
    child.stderr.on("data", (d) => {
      lastActivity = Date.now();
      err += d;
    });

    child.on("error", fail);
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearInterval(watchdog);
      if (signal) signal.removeEventListener("abort", onAbort);
      if (code === 0) {
        if (!lastFile && onFile) {
          // 从目录里找最新产物
          try {
            const dir = path.dirname(outBase);
            const base = path.basename(outBase);
            const hit = fs
              .readdirSync(dir)
              .filter((f) => f.startsWith(base) && !f.endsWith(".part"))
              .map((f) => path.join(dir, f))
              .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
            if (hit) onFile(hit);
          } catch {}
        }
        resolve();
      } else {
        const tail = err.trim().split("\n").filter(Boolean).pop() || "";
        reject(new Error(tail || `yt-dlp 退出码 ${code}`));
      }
    });
  });
}
