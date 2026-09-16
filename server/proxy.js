import { ProxyAgent } from "undici";

const PROXY_URL = (process.env.PROXY_URL || "").trim();
const PROXY_HOSTS = (process.env.PROXY_HOSTS || "archive.org")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

let agent = null;
let agentError = "";
if (PROXY_URL) {
  try {
    agent = new ProxyAgent(PROXY_URL);
  } catch (err) {
    agent = null;
    agentError = err.message || String(err);
  }
}

export const proxyEnabled = Boolean(agent);
export const proxyUrl = agent ? PROXY_URL : "";

export function shouldProxy(url) {
  if (!agent) return false;
  let host = "";
  try {
    host = new URL(url).host.toLowerCase();
  } catch {
    return false;
  }
  if (PROXY_HOSTS.includes("*")) return true;
  return PROXY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

export function proxyStatus() {
  return {
    enabled: proxyEnabled,
    url: PROXY_URL || null,
    hosts: PROXY_HOSTS,
    error: agentError || null,
  };
}

export function dispatcherFor(url) {
  return shouldProxy(url) ? agent : undefined;
}
