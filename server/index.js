import "./env.js";
import express from "express";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { searchAll, healthAll } from "./aggregator.js";
import {
  addClient,
  enqueue,
  listTasks,
  pauseTask,
  resumeTask,
  deleteTasks,
  clearFinished,
  shutdown,
  publicStats,
  DOWNLOAD_DIR,
} from "./downloader.js";
import { proxyStatus } from "./proxy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/sources", async (_req, res) => {
  res.json(await healthAll());
});

app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "缺少关键词 q" });
  const sources = String(req.query.sources || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 60);

  const startedAt = Date.now();
  try {
    const { items, errors, counts, dropped, translation } = await searchAll(q, {
      sources,
      limit,
    });
    res.json({
      query: q,
      count: items.length,
      counts,
      dropped,
      translation,
      errors,
      elapsed: Date.now() - startedAt,
      items,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.get("/api/progress", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  res.write(
    `data: ${JSON.stringify({ type: "init", tasks: listTasks(), stats: publicStats() })}\n\n`
  );
  addClient(res);
});

app.get("/api/stats", (_req, res) => {
  res.json({ ...publicStats(), proxy: proxyStatus() });
});

app.post("/api/quit", (_req, res) => {
  res.json({ ok: true });
  setTimeout(shutdown, 250);
});

app.post("/api/download", (req, res) => {
  const { items, keyword } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "没有可下载的素材" });
  }
  const tasks = enqueue(items, String(keyword || "未分类").trim() || "未分类");
  res.json({ tasks });
});

app.post("/api/tasks/pause", (req, res) => {
  const task = pauseTask(String(req.body?.id || ""));
  if (!task) return res.status(404).json({ error: "任务不存在" });
  res.json({ task });
});

app.post("/api/tasks/resume", (req, res) => {
  const task = resumeTask(String(req.body?.id || ""));
  if (!task) return res.status(404).json({ error: "任务不存在" });
  res.json({ task });
});

app.post("/api/tasks/delete", (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
  res.json({ deleted: deleteTasks(ids) });
});

app.post("/api/tasks/clear-finished", (_req, res) => {
  res.json({ deleted: clearFinished() });
});

app.post("/api/reveal", (req, res) => {
  const target = req.body?.path ? path.dirname(req.body.path) : DOWNLOAD_DIR;
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  execFile(cmd, [target], () => {});
  res.json({ ok: true, target });
});

const PORT = Number(process.env.PORT) || 5178;
app.listen(PORT, () => {
  console.log(`\n  新媒体素材工作台已启动`);
  console.log(`  打开浏览器访问: http://localhost:${PORT}`);
  console.log(`  下载目录: ${DOWNLOAD_DIR}\n`);
});
