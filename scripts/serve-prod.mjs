#!/usr/bin/env node
/** Cloudflare çıktısını yerel HTTP olarak sunar (vite preview Nitro SSR üretmez). */

import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const publicDir = path.join(root, ".output", "public");
const serverEntry = path.join(root, ".output", "server", "index.mjs");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";

loadDotEnv(path.join(root, ".env"));

if (!existsSync(serverEntry)) {
  console.error("Önce `bun run build` çalıştırın (.output/server/index.mjs yok).");
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
};

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function safePublicFile(pathname) {
  const decoded = decodeURIComponent(pathname.split("?")[0]);
  const relative = decoded.replace(/^\/+/, "");
  if (!relative || relative.includes("\0")) return null;
  const file = path.normalize(path.join(publicDir, relative));
  const rootWithSep = publicDir.endsWith(path.sep) ? publicDir : publicDir + path.sep;
  if (file !== publicDir && !file.startsWith(rootWithSep)) return null;
  return file;
}

function contentTypeFor(file) {
  return MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
}

const ASSETS = {
  async fetch(request) {
    const url = new URL(request.url);
    const file = safePublicFile(url.pathname);
    if (!file || !existsSync(file) || !statSync(file).isFile()) {
      return new Response("Not found", { status: 404 });
    }
    const data = readFileSync(file);
    return new Response(data, {
      headers: {
        "content-type": contentTypeFor(file),
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  },
};

function toFetchHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (value == null) continue;
    const lower = key.toLowerCase();
    if (lower === "connection" || lower === "keep-alive" || lower === "transfer-encoding") continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

async function readBody(req) {
  const method = (req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const { default: nitro } = await import(pathToFileURL(serverEntry).href);

const env = new Proxy(
  { ASSETS },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === "string") return process.env[prop];
      return undefined;
    },
    has(target, prop) {
      return prop in target || (typeof prop === "string" && prop in process.env);
    },
  },
);

const ctx = {
  waitUntil(promise) {
    void Promise.resolve(promise).catch((error) => console.error(error));
  },
  passThroughOnException() {},
};

const server = createServer({ keepAlive: true, keepAliveTimeout: 30_000 }, async (req, res) => {
  try {
    const hostHeader = req.headers.host || `127.0.0.1:${port}`;
    const url = `http://${hostHeader}${req.url || "/"}`;
    const method = req.method || "GET";
    const headers = toFetchHeaders(req.headers);
    const body = await readBody(req);
    const request = new Request(url, {
      method,
      headers,
      body: body && body.length > 0 ? body : undefined,
    });
    const response = await nitro.fetch(request, env, ctx);
    const outHeaders = {};
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "transfer-encoding") return;
      const current = outHeaders[key];
      outHeaders[key] = current ? [].concat(current, value) : value;
    });
    res.writeHead(response.status, response.statusText, outHeaders);
    if (method === "HEAD") {
      res.end();
      return;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    }
    res.end("Internal Server Error");
  }
});

server.maxConnections = 20_000;
server.listen({ port, host, backlog: 8192 }, () => {
  console.log(`Production server http://${host}:${port}`);
});
