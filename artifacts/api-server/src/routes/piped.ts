import { Router, type IRouter } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.private.coffee",
  "https://pipedapi.r4fo.com",
  "https://pipedapi.wireway.ch",
  "https://piapi.ggtyler.dev",
  "https://pipedapi.drgns.space",
  "https://pipedapi.tokhmi.xyz",
  "https://pipedapi.smnz.de",
  "https://pipedapi.moomoo.me",
  "https://pipedapi.us.projectsegfau.lt",
  "https://piapi.osphost.fi",
  "https://pipedapi.darkness.services",
  "https://pipedapi.phoenixthrush.com",
  "https://pipedapi.coldforge.xyz",
];

const router: IRouter = Router();

router.get("/download", async (req, res) => {
  const url = String(req.query.url ?? "");
  const filename = String(req.query.filename ?? "download");
  if (!url) {
    res.status(400).send("missing url");
    return;
  }
  try {
    const upstream = await fetch(url, {
      headers: req.headers.range ? { Range: String(req.headers.range) } : {},
    });
    if (!upstream.ok || !upstream.body) {
      res.status(upstream.status || 502).send("upstream failed");
      return;
    }
    const safeName = filename.replace(/[^\w\s.\u0980-\u09FF-]+/g, "_").slice(0, 120);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    const cl = upstream.headers.get("content-length");
    if (cl) res.setHeader("Content-Length", cl);
    res.setHeader("cache-control", "no-store");
    await pipeline(Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]), res);
  } catch (err) {
    req.log.error({ err }, "download proxy failed");
    if (!res.headersSent) res.status(502).send("download failed");
    else res.end();
  }
});

router.get("/proxy", async (req, res) => {
  const url = String(req.query.url ?? "");
  if (!url) {
    res.status(400).send("missing url");
    return;
  }
  try {
    const headers: Record<string, string> = {};
    if (req.headers.range) headers["Range"] = String(req.headers.range);
    const upstream = await fetch(url, { headers });
    if (!upstream.body) {
      res.status(upstream.status || 502).end();
      return;
    }
    res.status(upstream.status);
    const passthrough = ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"];
    for (const h of passthrough) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");
    await pipeline(Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]), res);
  } catch (err) {
    req.log.error({ err }, "media proxy failed");
    if (!res.headersSent) res.status(502).end();
    else res.end();
  }
});

const cache = new Map<string, { ts: number; text: string; ct: string }>();
const CACHE_TTL = 5 * 60 * 1000;

router.get("/piped/*splat", async (req, res) => {
  const path = req.path.replace(/^\/piped/, "");
  const query = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  const target = `${path}${query}`;

  const cached = cache.get(target);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.setHeader("content-type", cached.ct);
    res.setHeader("cache-control", "public, max-age=60");
    res.status(200).send(cached.text);
    return;
  }

  const shuffled = [...INSTANCES].sort(() => Math.random() - 0.5);

  let lastErr: unknown;
  for (const base of shuffled) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const upstream = await fetch(`${base}${target}`, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!upstream.ok) {
        lastErr = new Error(`HTTP ${upstream.status} from ${base}`);
        continue;
      }
      const ct = upstream.headers.get("content-type") ?? "";
      if (!ct.includes("json")) {
        lastErr = new Error(`non-json content-type ${ct} from ${base}`);
        continue;
      }
      const text = await upstream.text();
      if (text.includes('"error"') && text.length < 200) {
        lastErr = new Error(`error body from ${base}`);
        continue;
      }
      cache.set(target, { ts: Date.now(), text, ct });
      res.setHeader("content-type", ct);
      res.setHeader("cache-control", "public, max-age=60");
      res.status(200).send(text);
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  req.log.error({ err: lastErr, target }, "All Piped upstreams failed");
  res.status(502).json({ error: "upstream_unavailable" });
});

export default router;
