#!/usr/bin/env node
/** 10.000 eşzamanlı genel sayfa yüklemesi. */

import { Agent, setGlobalDispatcher } from "undici";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:4173";
const users = Number(process.env.USERS || 10_000);
const timeoutMs = Number(process.env.TIMEOUT_MS || 30_000);
const connections = Number(process.env.CONNECTIONS || Math.min(users, 4_096));
const paths = (process.env.PATHS || "/,/?kategori=yemek,/restoran/ocakbasi-dukkani,/sepet,/auth").split(
  ",",
);

setGlobalDispatcher(
  new Agent({
    connections,
    pipelining: 0,
    keepAliveTimeout: 30_000,
    keepAliveMaxTimeout: 60_000,
    connect: { timeout: timeoutMs },
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
  }),
);

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

async function loadOne(path) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL(path, baseUrl), {
      signal: controller.signal,
      headers: { accept: "text/html" },
    });
    await response.arrayBuffer();
    return {
      ok: response.ok,
      status: response.status,
      ms: performance.now() - started,
      error: null,
    };
  } catch (error) {
    const code =
      error?.cause?.code ||
      error?.code ||
      (error?.name === "AbortError" ? "TIMEOUT" : error?.name || "ERROR");
    return { ok: false, status: 0, ms: performance.now() - started, error: String(code) };
  } finally {
    clearTimeout(timer);
  }
}

const jobs = Array.from({ length: users }, (_, index) => paths[index % paths.length]);
const t0 = performance.now();
const results = await Promise.all(jobs.map(loadOne));
const elapsed = performance.now() - t0;

const statuses = {};
const errors = {};
const latencies = [];
let ok = 0;
for (const row of results) {
  if (row.ok) ok += 1;
  const statusKey = String(row.status);
  statuses[statusKey] = (statuses[statusKey] || 0) + 1;
  if (row.error) errors[row.error] = (errors[row.error] || 0) + 1;
  latencies.push(row.ms);
}
latencies.sort((a, b) => a - b);

const summary = {
  baseUrl,
  users,
  paths,
  elapsedMs: Math.round(elapsed),
  success: ok,
  failed: users - ok,
  successRate: `${((ok / users) * 100).toFixed(2)}%`,
  statuses,
  errors,
  latencyMs: {
    p50: Math.round(percentile(latencies, 50)),
    p95: Math.round(percentile(latencies, 95)),
    p99: Math.round(percentile(latencies, 99)),
    max: Math.round(latencies[latencies.length - 1] || 0),
  },
};

console.log(JSON.stringify(summary, null, 2));
if (ok / users < 0.95) process.exitCode = 1;
