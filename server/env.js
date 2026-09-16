import fs from "node:fs";
import path from "node:path";

const envFile = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envFile)) {
  const text = fs.readFileSync(envFile, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
