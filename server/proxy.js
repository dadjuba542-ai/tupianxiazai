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

export function proxyStatus() {
  return {
    enabled: proxyEnabled,
    url: PROXY_URL || null,
    hosts: PROXY_HOSTS,
    error: agentError || null,
  };
}

export function dispatcherFor(url) {
  if (!agent) return undefined;
  let host = "";
  try {
    host = new URL(url).host.toLowerCase();
  } catch {
    return undefined;
  }
  if (PROXY_HOSTS.includes("*")) return agent;
  const hit = PROXY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  return hit ? agent : undefined;
}
