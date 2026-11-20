#!/usr/bin/env node
/**
 * Creative Hub agent client: import a ZIP of creatives with an API token.
 * Node 18 or newer, no dependency. Guide: <your Creative Hub>/agent/README.md
 *
 *   export CREATIVE_HUB_URL=https://creatives.example.com
 *   export CREATIVE_HUB_TOKEN=chub_...          (Settings → API tokens)
 *
 *   node creative-hub-agent.mjs me
 *   node creative-hub-agent.mjs template [out.zip]
 *   node creative-hub-agent.mjs import <archive.zip> [--platform <id|name>] [--confirm] [--skip-undecided] [--approve] [--keep-archive]
 *   node creative-hub-agent.mjs status <importId> [--items problems|all|none]
 *   node creative-hub-agent.mjs confirm <importId> [--skip-undecided] [--items-file overrides.json]
 *   node creative-hub-agent.mjs approve <importId>
 *   node creative-hub-agent.mjs cancel <importId>
 *
 * Progress goes to stderr; the result is one JSON document on stdout.
 * Exit codes: 0 done, 1 error, 2 the import needs a decision (see "problems").
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, readFile, stat, writeFile } from "node:fs/promises";
import { basename } from "node:path";

const PART_CONCURRENCY = 4;
const PART_RETRIES = 4;
const URL_BATCH = 20;
const POLL_MS = 3000;
const POLL_LIMIT_MS = 6 * 3600 * 1000;

const log = (...a) => console.error("[creative-hub]", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class ApiError extends Error {
  constructor(status, body) {
    super(body?.error ?? `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

function config() {
  const url = (process.env.CREATIVE_HUB_URL ?? "").replace(/\/+$/, "");
  const token = process.env.CREATIVE_HUB_TOKEN ?? "";
  if (!url || !token) {
    throw new Error("Set CREATIVE_HUB_URL (e.g. https://creatives.example.com) and CREATIVE_HUB_TOKEN (Settings → API tokens).");
  }
  return { base: `${url}/api/agent/v1`, token };
}

/** Reads and the steps that are safe to repeat are retried after a server error; creations only after a 429. */
const SAFE_TO_REPEAT = (method, path) => method === "GET" || /\/uploads\/[^/]+\/(parts|complete)$/.test(path);

async function api(method, path, body) {
  const { base, token } = config();
  const repeatable = SAFE_TO_REPEAT(method, path);
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      if (repeatable && attempt < 3) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    if ((res.status === 429 || (repeatable && res.status >= 500)) && attempt < 3) {
      await sleep(Number(res.headers.get("retry-after") ?? 0) * 1000 || 2000 * 2 ** attempt);
      continue;
    }
    throw new ApiError(res.status, data);
  }
}

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) out._.push(a);
    else if (["--confirm", "--skip-undecided", "--approve", "--keep-archive"].includes(a)) out[a.slice(2)] = true;
    else out[a.slice(2)] = argv[++i];
  }
  return out;
}

async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function putBytes(url, bytes, contentType) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { method: "PUT", body: bytes, headers: contentType ? { "Content-Type": contentType } : {} });
      if (res.ok) return;
      if (attempt >= PART_RETRIES || (res.status < 500 && res.status !== 403 && res.status !== 429)) {
        throw new Error(`Storage refused the upload (HTTP ${res.status}).`);
      }
    } catch (err) {
      if (attempt >= PART_RETRIES) throw err;
    }
    await sleep(1000 * 2 ** attempt);
  }
}

async function uploadArchive(path, size, session) {
  if (session.mode === "SINGLE") {
    log(`uploading ${basename(path)} (${(size / 1048576).toFixed(1)} MB) in one request`);
    await putBytes(session.singleUrl, await readFile(path), session.mimeType);
    return;
  }
  const { sessionId, partSize, partCount } = session;
  log(`uploading ${basename(path)} (${(size / 1048576).toFixed(1)} MB) in ${partCount} parts of ${(partSize / 1048576).toFixed(0)} MB`);
  const file = await open(path, "r");
  let done = 0;
  try {
    for (let first = 1; first <= partCount; first += URL_BATCH) {
      const numbers = [];
      for (let n = first; n < first + URL_BATCH && n <= partCount; n++) numbers.push(n);
      const { parts } = await api("POST", `/uploads/${sessionId}/parts`, { partNumbers: numbers });
      const queue = [...parts];
      const worker = async () => {
        for (let p = queue.shift(); p; p = queue.shift()) {
          const start = (p.partNumber - 1) * partSize;
          const length = Math.min(partSize, size - start);
          const buffer = Buffer.alloc(length);
          await file.read(buffer, 0, length, start);
          try {
            await putBytes(p.url, buffer);
          } catch {
            // The presigned URL may have expired: ask for a fresh one once.
            const fresh = await api("POST", `/uploads/${sessionId}/parts`, { partNumbers: [p.partNumber] });
            await putBytes(fresh.parts[0].url, buffer);
          }
          done++;
          if (done % 10 === 0 || done === partCount) log(`  ${done}/${partCount} parts`);
        }
      };
      await Promise.all(Array.from({ length: PART_CONCURRENCY }, worker));
    }
  } finally {
    await file.close();
  }
}

async function waitFor(importId, until) {
  const started = Date.now();
  let last = "";
  for (;;) {
    const view = await api("GET", `/imports/${importId}?items=none`);
    if (view.status !== last) log(`import ${importId}: ${view.status}`);
    last = view.status;
    if (until.includes(view.status)) return view;
    if (["FAILED", "CANCELLED"].includes(view.status)) return view;
    if (Date.now() - started > POLL_LIMIT_MS) throw new Error(`Still ${view.status} after ${POLL_LIMIT_MS / 3600000} h.`);
    await sleep(POLL_MS);
  }
}

async function resolvePlatform(value) {
  if (!value) return undefined;
  const me = await api("GET", "/me");
  const p = me.platforms.find((x) => x.id === value || x.name.toLowerCase() === value.toLowerCase() || x.folder === value.toLowerCase());
  if (!p) throw new Error(`Unknown platform « ${value} ». Known: ${me.platforms.map((x) => x.name).join(", ")}.`);
  return p.id;
}

async function confirm(importId, opts) {
  const items = opts["items-file"] ? JSON.parse(await readFile(opts["items-file"], "utf8")) : [];
  try {
    const res = await api("POST", `/imports/${importId}/confirm`, { skipUndecided: !!opts["skip-undecided"], items });
    log(`confirmed: ${res.included} file(s) go in${res.leftOut.length ? `, ${res.leftOut.length} left out` : ""}`);
    return res;
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) {
      const view = await api("GET", `/imports/${importId}?items=problems`);
      process.stdout.write(`${JSON.stringify({ needsDecision: true, error: err.message, undecided: err.body?.fieldErrors ?? {}, import: view }, null, 2)}\n`);
      process.exit(2);
    }
    throw err;
  }
}

async function runImport(path, opts) {
  const info = await stat(path);
  if (!info.isFile()) throw new Error(`${path} is not a file.`);
  log("computing the archive's SHA-256…");
  const sha256 = await sha256File(path);
  const applicationId = await resolvePlatform(opts.platform);
  const started = await api("POST", "/imports", {
    name: basename(path),
    size: info.size,
    lastModified: Math.floor(info.mtimeMs),
    ...(applicationId ? { applicationId } : {}),
    ...(opts["keep-archive"] ? { keepArchive: true } : {}),
  });
  const importId = started.batchId;
  log(`import ${importId} started`);
  try {
    await uploadArchive(path, info.size, started.session);
    await api("POST", `/uploads/${started.session.sessionId}/complete`, { sha256 });
  } catch (err) {
    log("upload failed, cancelling it");
    await api("DELETE", `/uploads/${started.session.sessionId}`).catch(() => undefined);
    throw err;
  }
  let view = await waitFor(importId, ["READY_FOR_REVIEW"]);
  if (view.status !== "READY_FOR_REVIEW") return { importId, ...view };
  view = await api("GET", `/imports/${importId}?items=problems`);
  log(`analysed: ${view.counts.files} file(s), ${view.counts.rejected} rejected, ${view.counts.needsDecision} need a decision`);
  if (!opts.confirm) return { importId, ...view, next: `Review it in the app, or run: confirm ${importId}` };

  await confirm(importId, opts);
  view = await waitFor(importId, ["COMPLETED"]);
  let approval = null;
  if (opts.approve && view.status === "COMPLETED") {
    approval = await api("POST", `/imports/${importId}/approve`);
    log(`approved ${approval.approved} creative(s)`);
  }
  const final = await api("GET", `/imports/${importId}?items=problems`);
  return { importId, approval, ...final };
}

async function main() {
  const opts = args(process.argv.slice(2));
  const [command, target] = opts._;
  let result;
  switch (command) {
    case "me":
      result = await api("GET", "/me");
      break;
    case "template": {
      const { base, token } = config();
      const res = await fetch(`${base}/imports/template`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
      const out = target ?? "data_creatives-template.zip";
      await writeFile(out, Buffer.from(await res.arrayBuffer()));
      result = { saved: out };
      break;
    }
    case "import":
      if (!target) throw new Error("Usage: import <archive.zip> [--platform <id|name>] [--confirm] [--skip-undecided] [--approve]");
      result = await runImport(target, opts);
      break;
    case "status":
      result = await api("GET", `/imports/${target}?items=${opts.items ?? "problems"}`);
      break;
    case "confirm":
      result = await confirm(target, opts);
      break;
    case "approve":
      result = await api("POST", `/imports/${target}/approve`);
      break;
    case "cancel":
      result = await api("POST", `/imports/${target}/cancel`);
      break;
    default:
      throw new Error("Commands: me | template [out.zip] | import <archive.zip> | status <id> | confirm <id> | approve <id> | cancel <id>");
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((err) => {
  log(`error: ${err.message}`);
  if (err instanceof ApiError && err.body?.fieldErrors) log(JSON.stringify(err.body.fieldErrors, null, 2));
  process.exit(1);
});
