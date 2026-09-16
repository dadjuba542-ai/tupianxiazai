const state = {
  sources: [],
  active: new Set(),
  items: [],
  selected: new Set(),
  tasks: new Map(),
  taskSelected: new Set(),
  stats: null,
  dockOpen: false,
  query: "",
};

const DOMESTIC = [
  { name: "新片场", url: (q) => `https://www.xinpianchang.com/search?kw=${encodeURIComponent(q)}` },
  {
    name: "新CG儿",
    url: (q) =>
      `https://www.newcger.com/index/search/index?searchtype=titlekeyword&keyword=${encodeURIComponent(q)}`,
  },
  { name: "B站", url: (q) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(q)}` },
  { name: "抖音", url: (q) => `https://www.douyin.com/search/${encodeURIComponent(q)}` },
  { name: "33台词", url: (q) => `https://33.agilestudio.cn/search?keyword=${encodeURIComponent(q)}` },
  { name: "摄图网", site: "699pic.com" },
  { name: "包图网", site: "ibaotu.com" },
  { name: "千库网", site: "588ku.com" },
  { name: "觅知网", site: "51miz.com" },
  { name: "我图网", site: "ooopic.com" },
  { name: "汇图网", site: "huiyi8.com" },
  { name: "素材集市", site: "sucaijishi.com" },
  { name: "Pikbest", site: "pikbest.com" },
];

const MOVIE = [
  {
    name: "33搜帧",
    hint: "中文台词/画面搜电影，定位片名与时间点",
    url: (q) => `https://33.agilestudio.cn/clip-search?keyword=${encodeURIComponent(q)}`,
  },
  {
    name: "PlayPhrase",
    hint: "英文台词搜电影片段",
    url: (q) => `https://www.playphrase.me/#/search?q=${encodeURIComponent(q)}&language=en`,
  },
  {
    name: "Subzin",
    hint: "英文台词搜电影，显示时间码",
    url: (q) => `https://subzin.com/s/${encodeURIComponent(q)}`,
  },
  {
    name: "QuoDB",
    hint: "英文台词库，带时间轴",
    url: (q) => `https://www.quodb.com/search/${encodeURIComponent(q)}`,
  },
];

const el = {
  sources: document.getElementById("sources"),
  domestic: document.getElementById("domestic"),
  movie: document.getElementById("movie-search"),
  grid: document.getElementById("grid"),
  state: document.getElementById("state"),
  meta: document.getElementById("meta"),
  dock: document.getElementById("dock"),
  tasks: document.getElementById("tasks"),
  selCount: document.getElementById("sel-count"),
  form: document.getElementById("search-form"),
  q: document.getElementById("q"),
  toast: document.getElementById("toast"),
};

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.remove("show"), 2600);
}

function fmtBytes(n) {
  if (!n) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)}${u[i]}`;
}

/* ---------------- Sources ---------------- */
async function loadSources() {
  try {
    state.sources = await (await fetch("/api/sources")).json();
  } catch {
    state.sources = [];
  }
  const online = state.sources.filter((s) => s.online);
  state.active = new Set(
    (online.length ? online : state.sources.filter((s) => s.configured !== false)).map(
      (s) => s.id
    )
  );
  renderSources();
}

function renderSources() {
  el.sources.innerHTML = state.sources
    .map((s) => {
      const dotClass = s.online ? "dot on" : s.requiresKey && !s.configured ? "dot key" : "dot";
      const active = state.active.has(s.id) ? " active" : "";
      const off = !s.online ? " off" : "";
      const hint = s.online
        ? s.license
        : s.requiresKey && !s.configured
        ? "需配置 API Key"
        : s.note || "当前网络不可用";
      return `<span class="chip${active}${off}" data-id="${s.id}" title="${esc(
        hint
      )}"><i class="${dotClass}"></i><b>${esc(s.name)}</b></span>`;
    })
    .join("");
}

el.sources.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  const id = chip.dataset.id;
  state.active.has(id) ? state.active.delete(id) : state.active.add(id);
  chip.classList.toggle("active");
});

function renderDomestic(keyword) {
  if (!keyword) {
    el.domestic.classList.add("hidden");
    return;
  }
  el.domestic.innerHTML =
    `<span class="domestic-label">国内源跳转</span>` +
    DOMESTIC.map((s) => {
      const url = s.url
        ? s.url(keyword)
        : `https://www.bing.com/search?q=${encodeURIComponent(`site:${s.site} ${keyword}`)}`;
      const via = s.site ? "（经搜索引擎直达站内结果）" : "";
      return `<a class="chip domestic-chip" href="${url}" target="_blank" rel="noopener" title="在 ${esc(
        s.name
      )} 搜索「${esc(keyword)}」${via}">${esc(s.name)}<span class="arrow">↗</span></a>`;
    }).join("");
  el.domestic.classList.remove("hidden");

  el.movie.innerHTML =
    `<span class="domestic-label">电影镜头检索<span class="tip">定位片名+时间点后自行录屏</span></span>` +
    MOVIE.map(
      (s) =>
        `<a class="chip domestic-chip movie-chip" href="${s.url(
          keyword
        )}" target="_blank" rel="noopener" title="${esc(s.hint)}">${esc(
          s.name
        )}<span class="arrow">↗</span></a>`
    ).join("");
  el.movie.classList.remove("hidden");
}

/* ---------------- Search ---------------- */
el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  doSearch();
});

async function doSearch() {
  const q = el.q.value.trim();
  if (!q) return;
  state.query = q;
  state.selected.clear();
  updateDock();
  renderDomestic(q);

  el.state.className = "state loading";
  el.state.innerHTML = `<div class="state-icon">◐</div><p>正在从多个素材站搜索「${esc(q)}」…</p>`;
  el.state.classList.remove("hidden");
  el.grid.innerHTML = "";
  el.meta.innerHTML = "";
  el.form.querySelector("button").disabled = true;

  try {
    const params = new URLSearchParams({ q, limit: "24" });
    if (state.active.size) params.set("sources", [...state.active].join(","));
    const res = await fetch(`/api/search?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "搜索失败");
    state.items = data.items || [];
    renderResults(data);
  } catch (err) {
    el.state.className = "state";
    el.state.innerHTML = `<div class="state-icon">⚠</div><p>${esc(err.message)}</p>`;
    el.state.classList.remove("hidden");
  } finally {
    el.form.querySelector("button").disabled = false;
  }
}

function renderResults(data) {
  const counts = data.counts || {};
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${esc(id)} ${n}`);
  let meta = `共 <b>${data.count}</b> 条 · ${data.elapsed}ms`;
  if (parts.length) meta += ` · ${parts.join(" / ")}`;
  if (data.errors?.length)
    meta += ` · <span class="err">${data.errors
      .map((e) => `${esc(e.source)}: ${esc(e.message)}`)
      .join("; ")}</span>`;
  el.meta.innerHTML = meta;

  if (!state.items.length) {
    el.state.className = "state";
    el.state.innerHTML = `<div class="state-icon">∅</div><p>没有找到素材，换个关键词或勾选更多素材源试试</p>`;
    el.state.classList.remove("hidden");
    return;
  }
  el.state.classList.add("hidden");

  el.grid.innerHTML = state.items
    .map((it, i) => {
      const external = it.downloadable === false || it.external === true;
      const size = it.width ? `${it.width}×${it.height}` : it.duration ? `${it.duration}s` : "";
      return `
      <article class="card${external ? " external" : ""}" data-id="${esc(
        it.id
      )}" data-external="${external ? 1 : 0}" data-url="${esc(
        it.pageUrl || ""
      )}" style="animation-delay:${Math.min(i * 22, 400)}ms">
        <div class="thumb">
          ${
            it.thumbnail
              ? `<img src="${esc(it.thumbnail)}" loading="lazy" alt="" onerror="this.style.display='none'">`
              : ""
          }
          ${
            it.previewUrl
              ? `<video muted loop playsinline preload="none" data-src="${esc(
                  it.previewUrl
                )}"></video>`
              : ""
          }
          <span class="badge">${esc(it.sourceName || it.source)}${
        external ? " · 跳转" : ""
      }</span>
          <div class="check">${external ? "↗" : "✓"}</div>
        </div>
        <div class="card-body">
          <p class="card-title" title="${esc(it.title)}">${esc(it.title)}</p>
          <div class="card-sub">
            <span class="grow">${esc(it.author || "")}</span>
            <span>${size}</span>
          </div>
          ${
            (it.extraLinks || []).length
              ? `<div class="link-row">${it.extraLinks
                  .map(
                    (l) =>
                      `<a href="${esc(l.url)}" target="_blank" rel="noopener" title="打开${esc(
                        l.label
                      )}下载原片">${esc(l.label)} ↗</a>`
                  )
                  .join("")}</div>`
              : ""
          }
        </div>
      </article>`;
    })
    .join("");
}

/* ---------------- Hover preview ---------------- */
el.grid.addEventListener("mouseover", (e) => {
  const card = e.target.closest(".card");
  if (!card || card.contains(e.relatedTarget)) return;
  const video = card.querySelector("video");
  if (!video) return;
  if (!video.src && video.dataset.src) {
    video.src = video.dataset.src;
    video.addEventListener("loadeddata", () => video.classList.add("playing"), { once: true });
  }
  video.play().then(() => video.classList.add("playing")).catch(() => {});
});

el.grid.addEventListener("mouseout", (e) => {
  const card = e.target.closest(".card");
  if (!card || card.contains(e.relatedTarget)) return;
  const video = card.querySelector("video");
  if (!video) return;
  video.pause();
  video.classList.remove("playing");
  try {
    video.currentTime = 0;
  } catch {}
});

/* ---------------- Selection ---------------- */
el.grid.addEventListener("click", (e) => {
  if (e.target.closest("a")) return;
  const card = e.target.closest(".card");
  if (!card) return;
  if (card.dataset.external === "1") {
    if (card.dataset.url) window.open(card.dataset.url, "_blank", "noopener");
    return;
  }
  const id = card.dataset.id;
  if (state.selected.has(id)) {
    state.selected.delete(id);
    card.classList.remove("selected");
  } else {
    state.selected.add(id);
    card.classList.add("selected");
  }
  updateDock();
});

function updateDock() {
  const n = state.selected.size;
  const m = state.tasks.size;
  el.selCount.textContent = `已选 ${n}`;
  document.getElementById("task-count").textContent = String(m);
  document.getElementById("download-btn").disabled = n === 0;
  document.getElementById("clear-btn").disabled = n === 0;
  document.getElementById("delete-selected-btn").disabled = state.taskSelected.size === 0;
  el.dock.classList.toggle("hidden", n === 0 && m === 0);
  el.dock.classList.toggle("collapsed", !state.dockOpen);
  document.getElementById("dock-toggle").setAttribute("aria-expanded", String(state.dockOpen));

  const list = [...state.tasks.values()];
  const overall = list.length
    ? Math.round(
        list.reduce((s, t) => s + (t.status === "done" ? 100 : t.progress || 0), 0) / list.length
      )
    : 0;
  document.getElementById("dock-progress").firstElementChild.style.width = `${overall}%`;

  if (state.stats?.proxy) {
    document
      .getElementById("proxy-flag")
      .classList.toggle("hidden", !state.stats.proxy.enabled);
  }

  if (state.stats) {
    const { count, limit, active: act, queued } = state.stats;
    const el2 = document.getElementById("stat-count");
    el2.textContent =
      `今日 ${count}/${limit}` + (act || queued ? ` · 并发${act}/排队${queued}` : "");
    el2.classList.toggle("warn", count / limit >= 0.8);
  }
}

document.getElementById("dock-toggle").addEventListener("click", () => {
  state.dockOpen = !state.dockOpen;
  updateDock();
});

document.getElementById("select-all-btn").addEventListener("click", () => {
  state.taskSelected = new Set(state.tasks.keys());
  renderTasks();
  updateDock();
});

document.getElementById("select-done-btn").addEventListener("click", () => {
  state.taskSelected = new Set(
    [...state.tasks.values()].filter((t) => t.status === "done").map((t) => t.id)
  );
  renderTasks();
  updateDock();
});

document.getElementById("delete-selected-btn").addEventListener("click", async () => {
  const ids = [...state.taskSelected];
  if (!ids.length) return;
  if (!confirm(`删除 ${ids.length} 个任务并移除已下载的文件？`)) return;
  await fetch("/api/tasks/delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  ids.forEach((id) => {
    state.tasks.delete(id);
    state.taskSelected.delete(id);
  });
  renderTasks();
  updateDock();
  toast(`已删除 ${ids.length} 个任务`);
});

document.getElementById("clear-finished-btn").addEventListener("click", async () => {
  const res = await fetch("/api/tasks/clear-finished", { method: "POST" });
  const data = await res.json();
  (data.deleted || []).forEach((id) => {
    state.tasks.delete(id);
    state.taskSelected.delete(id);
  });
  renderTasks();
  updateDock();
  toast(`已清除 ${(data.deleted || []).length} 个已完成任务`);
});

document.getElementById("quit-btn").addEventListener("click", async () => {
  if (!confirm("确定退出工作台？后台服务将立即停止，进行中的下载会被中断。")) return;
  try {
    await fetch("/api/quit", { method: "POST" });
  } catch {}
  document.getElementById("bye").classList.remove("hidden");
});

async function taskAction(id, action) {
  await fetch(`/api/tasks/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

/* ---------------- Download ---------------- */
document.getElementById("download-btn").addEventListener("click", async () => {
  const items = state.items.filter((it) => state.selected.has(it.id));
  if (!items.length) return;
  try {
    const res = await fetch("/api/download", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items, keyword: state.query }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "下载失败");
    data.tasks.forEach(upsertTask);
    toast(`已加入 ${data.tasks.length} 个下载任务`);
    state.selected.clear();
    document.querySelectorAll(".card.selected").forEach((c) => c.classList.remove("selected"));
    updateDock();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("clear-btn").addEventListener("click", () => {
  state.selected.clear();
  document.querySelectorAll(".card.selected").forEach((c) => c.classList.remove("selected"));
  updateDock();
});

document.getElementById("open-btn").addEventListener("click", async () => {
  await fetch("/api/reveal", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  toast("已在文件管理器中打开下载目录");
});

/* ---------------- Tasks / SSE ---------------- */
function upsertTask(task) {
  state.tasks.set(task.id, task);
  renderTasks();
  updateDock();
}

function renderTasks() {
  const list = [...state.tasks.values()].slice(-60).reverse();
  el.tasks.innerHTML = list
    .map((t) => {
      const pct = t.status === "done" ? 100 : t.progress || 0;
      const status =
        t.status === "done"
          ? "完成"
          : t.status === "error"
          ? "失败"
          : t.status === "paused"
          ? "已暂停"
          : t.status === "queued"
          ? "排队中"
          : `${pct}%`;
      const actions =
        t.status === "done"
          ? `<button class="mini" data-act="reveal">目录</button>`
          : t.status === "paused" || t.status === "error"
          ? `<button class="mini" data-act="resume">继续</button>`
          : `<button class="mini" data-act="pause">暂停</button>`;
      const checked = state.taskSelected.has(t.id) ? " checked" : "";
      return `<div class="task ${t.status}" data-id="${esc(t.id)}">
        <input type="checkbox" class="tick" data-id="${esc(t.id)}"${checked}>
        <span class="task-name" title="${esc(t.title)}">${esc(t.title)}<small>${esc(
        t.sourceName || ""
      )}</small></span>
        <span class="bar"><i style="width:${pct}%"></i></span>
        <span class="task-status" title="${esc(t.error || "")}">${esc(status)}</span>
        <span class="task-actions">${actions}<button class="mini danger" data-act="delete">删除</button></span>
      </div>`;
    })
    .join("");
}

el.tasks.addEventListener("change", (e) => {
  const tick = e.target.closest("input.tick");
  if (!tick) return;
  const id = tick.dataset.id;
  tick.checked ? state.taskSelected.add(id) : state.taskSelected.delete(id);
  updateDock();
});

el.tasks.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest(".task")?.dataset.id;
  if (!id) return;
  const act = btn.dataset.act;

  if (act === "pause" || act === "resume") {
    await taskAction(id, act);
    return;
  }
  if (act === "delete") {
    if (!confirm("删除该任务并移除文件？")) return;
    await fetch("/api/tasks/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    state.tasks.delete(id);
    state.taskSelected.delete(id);
    renderTasks();
    updateDock();
    return;
  }
  if (act === "reveal") {
    const task = state.tasks.get(id);
    await fetch("/api/reveal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: task?.file || "" }),
    });
  }
});

function connectProgress() {
  const es = new EventSource("/api/progress");
  es.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === "init" && Array.isArray(msg.tasks)) msg.tasks.forEach(upsertTask);
      if (msg.type === "init" && msg.stats) {
        state.stats = msg.stats;
        updateDock();
      }
      if (msg.type === "stats") {
        state.stats = msg.stats;
        updateDock();
      }
      if (msg.type === "update" && msg.task) upsertTask(msg.task);
      if (msg.type === "removed" && msg.id) {
        state.tasks.delete(msg.id);
        state.taskSelected.delete(msg.id);
        renderTasks();
        updateDock();
      }
    } catch {}
  };
  es.onerror = () => {
    es.close();
    setTimeout(connectProgress, 3000);
  };
}

loadSources();
connectProgress();
