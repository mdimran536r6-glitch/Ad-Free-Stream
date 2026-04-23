import { Router, type IRouter } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.private.coffee",
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
    const upstream = await fetch(url);
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

router.get("/piped/*splat", async (req, res) => {
  const path = req.path.replace(/^\/piped/, "");
  const query = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  const target = `${path}${query}`;

  let lastErr: unknown;
  for (const base of INSTANCES) {
    try {
      const upstream = await fetch(`${base}${target}`, {
        headers: { Accept: "application/json" },
      });
      if (!upstream.ok) {
        lastErr = new Error(`HTTP ${upstream.status}`);
        continue;
      }
      const text = await upstream.text();
      res.setHeader("content-type", upstream.headers.get("content-type") ?? "application/json");
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
