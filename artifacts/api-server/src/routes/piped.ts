import { Router, type IRouter } from "express";

const INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.private.coffee",
];

const router: IRouter = Router();

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
