import { mkdir, readFile, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const [, , command, ...args] = process.argv;
const configPath =
  process.env.RECALL_CONFIG ??
  path.join(os.homedir(), ".config", "recallq", "config.json");

function argValue(name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function hasFlag(name) {
  return args.includes(name);
}

async function loadConfig() {
  try {
    return JSON.parse(await readFile(configPath, "utf8"));
  } catch {
    return {};
  }
}

async function saveConfig(config) {
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

async function resolveAuth() {
  const config = await loadConfig();
  return {
    apiUrl: (process.env.RECALL_API_URL ?? config.apiUrl ?? "http://localhost:3008/api/v1").replace(/\/$/, ""),
    token: process.env.RECALL_TOKEN ?? config.token,
  };
}

async function request(pathname, init = {}) {
  const { apiUrl, token } = await resolveAuth();
  if (!token) throw new Error("Run `pnpm recall login ...` or set RECALL_TOKEN.");

  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${apiUrl}${pathname}`, { ...init, headers });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) throw new Error(typeof body === "string" ? body : JSON.stringify(body));
  return body;
}

function print(value) {
  if (typeof value === "string") console.log(value);
  else console.log(JSON.stringify(value, null, 2));
}

async function login() {
  const email = argValue("--email");
  const password = argValue("--password");
  const deviceName = argValue("--device-name", os.hostname());
  const apiUrl = (argValue("--api-url") ?? process.env.RECALL_API_URL ?? "http://localhost:3008/api/v1").replace(/\/$/, "");
  if (!email || !password) {
    throw new Error("Usage: pnpm recall login --email <email> --password <password> [--api-url <url>]");
  }

  const response = await fetch(`${apiUrl}/auth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, device_name: deviceName }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(body));

  await saveConfig({ apiUrl, token: body.token, tokenPrefix: body.prefix, deviceName });
  print({ saved: true, apiUrl, tokenPrefix: body.prefix, configPath });
}

async function captureFile() {
  const file = args[0];
  if (!file) throw new Error("Usage: pnpm recall capture-file <path>");
  const buffer = await readFile(file);
  const form = new FormData();
  form.append("file", new Blob([buffer]), path.basename(file));
  print(await request("/ingest/file", { method: "POST", body: form }));
}

function runAdmin() {
  const result = spawnSync(process.execPath, ["scripts/admin-jobs.mjs", ...args], {
    stdio: "inherit",
    env: process.env,
  });
  process.exitCode = result.status ?? 1;
}

async function main() {
  if (command === "login") return login();
  if (command === "whoami") return print(await request("/me"));
  if (command === "capture-url") {
    const url = args[0];
    if (!url) throw new Error("Usage: pnpm recall capture-url <url>");
    return print(await request("/ingest", {
      method: "POST",
      body: JSON.stringify({ type: "url", raw_url: url, raw_text: url, source: "api" }),
    }));
  }
  if (command === "capture-text") {
    const text = args.join(" ");
    if (!text) throw new Error("Usage: pnpm recall capture-text <text>");
    return print(await request("/ingest", {
      method: "POST",
      body: JSON.stringify({ type: "text", raw_text: text, source: "api" }),
    }));
  }
  if (command === "capture-file") return captureFile();
  if (command === "search") {
    const query = args.join(" ");
    if (!query) throw new Error("Usage: pnpm recall search <query>");
    return print(await request(`/search?q=${encodeURIComponent(query)}`));
  }
  if (command === "export-json") return print(await request("/export/json"));
  if (command === "export-bookmarks") return print(await request("/export/bookmarks"));
  if (command === "import-status") {
    const id = args[0];
    if (!id) throw new Error("Usage: pnpm recall import-status <id>");
    return print(await request(`/imports/${encodeURIComponent(id)}`));
  }
  if (command === "import-bookmarks") {
    const file = args[0];
    if (!file) throw new Error("Usage: pnpm recall import-bookmarks <bookmarks.html>");
    const html = await readFile(file, "utf8");
    return print(await request("/imports/browser-bookmarks", {
      method: "POST",
      body: JSON.stringify({ html, dryRun: hasFlag("--dry-run") }),
    }));
  }
  if (command === "admin") return runAdmin();

  console.error(`Usage:
  pnpm recall login --email <email> --password <password> [--api-url <url>]
  pnpm recall whoami
  pnpm recall capture-url <url>
  pnpm recall capture-text <text>
  pnpm recall capture-file <path>
  pnpm recall search <query>
  pnpm recall export-json | export-bookmarks
  pnpm recall import-bookmarks <bookmarks.html> [--dry-run]
  pnpm recall import-status <id>
  pnpm recall admin <queue-depth|failed|retry-failed|re-enrich-failed|backfill-hosts|operation-summary>`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
