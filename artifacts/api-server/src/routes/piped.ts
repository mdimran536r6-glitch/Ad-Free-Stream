import { Router, type IRouter } from "express";
import { spawn } from "node:child_process";
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
    // Some upstream CDNs key on the User-Agent. Use a reasonable browser UA.
    headers["User-Agent"] =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
    const upstream = await fetch(url, { headers });
    if (!upstream.body) {
      res.status(upstream.status || 502).end();
      return;
    }
    res.status(upstream.status);
    const passthrough = ["content-length", "content-range", "accept-ranges", "last-modified", "etag"];
    for (const h of passthrough) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    // Normalize content-type so the browser plays inline instead of downloading.
    // YouTube googlevideo URLs sometimes return application/octet-stream or
    // attach Content-Disposition: attachment which forces download.
    const upstreamCt = upstream.headers.get("content-type") ?? "";
    const mimeHint = String(req.query.mime ?? "");
    let ct = mimeHint || upstreamCt;
    if (!ct || /octet-stream|application\/binary/i.test(ct)) {
      // Try to infer from URL ?mime= param (googlevideo uses this).
      const m = /[?&]mime=([^&]+)/.exec(url);
      if (m) ct = decodeURIComponent(m[1]);
    }
    if (ct) res.setHeader("Content-Type", ct);
    // Critically: never forward Content-Disposition — that triggers a download.
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    res.setHeader("Cache-Control", "public, max-age=3600");
    await pipeline(Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]), res);
  } catch (err) {
    req.log.error({ err }, "media proxy failed");
    if (!res.headersSent) res.status(502).end();
    else res.end();
  }
});

interface YtDlpFormat {
  url?: string;
  format_id?: string;
  ext?: string;
  acodec?: string;
  vcodec?: string;
  abr?: number;
  vbr?: number;
  tbr?: number;
  height?: number;
  width?: number;
  protocol?: string;
}

interface YtDlpInfo {
  id?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  uploader?: string;
  channel?: string;
  channel_id?: string;
  upload_date?: string;
  timestamp?: number;
  duration?: number;
  view_count?: number;
  like_count?: number;
  formats?: YtDlpFormat[];
  is_live?: boolean;
}

function runYtDlp(videoId: string): Promise<YtDlpInfo> {
  return new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", [
      "-j",
      "--no-warnings",
      "--skip-download",
      "--no-call-home",
      "--socket-timeout",
      "15",
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);
    let out = "";
    let err = "";
    const timer = setTimeout(() => proc.kill("SIGKILL"), 28000);
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("error", (e) => { clearTimeout(timer); reject(e); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(err.slice(0, 300) || `yt-dlp exit ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(out));
      } catch (e) {
        reject(e);
      }
    });
  });
}

interface AudioOut { url: string; format: string; quality: string; mimeType: string; bitrate: number; codec: string }
interface VideoOut { url: string; format: string; quality: string; mimeType: string; width: number; height: number; bitrate: number; videoOnly: boolean }

function ytDlpToStreams(info: YtDlpInfo): { audioStreams: AudioOut[]; videoStreams: VideoOut[] } {
  const formats = (info.formats ?? []).filter((f) => f.url && f.protocol && /^https/.test(f.protocol));
  const audioStreams: AudioOut[] = formats
    .filter((f) => f.acodec && f.acodec !== "none" && (!f.vcodec || f.vcodec === "none"))
    .map((f) => ({
      url: f.url!,
      format: f.ext ?? "",
      quality: `${Math.round(f.abr ?? 0)}kbps`,
      mimeType: f.ext === "m4a" ? "audio/mp4" : `audio/${f.ext}`,
      bitrate: Math.round((f.abr ?? 0) * 1000),
      codec: f.acodec!,
    }));
  const videoStreams: VideoOut[] = formats
    .filter((f) => f.vcodec && f.vcodec !== "none" && f.height)
    .map((f) => ({
      url: f.url!,
      format: f.ext ?? "",
      quality: `${f.height}p`,
      mimeType: f.ext === "mp4" ? "video/mp4" : `video/${f.ext}`,
      width: f.width ?? 0,
      height: f.height ?? 0,
      bitrate: Math.round((f.tbr ?? 0) * 1000),
      videoOnly: !f.acodec || f.acodec === "none",
    }));
  return { audioStreams, videoStreams };
}

const ytCache = new Map<string, { ts: number; data: { audioStreams: AudioOut[]; videoStreams: VideoOut[]; uploadDate: string; thumbnail?: string; title?: string; uploader?: string } }>();
const YT_CACHE_TTL = 30 * 60 * 1000;

async function resolveWithYtDlp(videoId: string) {
  const cached = ytCache.get(videoId);
  if (cached && Date.now() - cached.ts < YT_CACHE_TTL) return cached.data;
  const info = await runYtDlp(videoId);
  const { audioStreams, videoStreams } = ytDlpToStreams(info);
  const ud = info.upload_date;
  const uploadDate = ud && /^\d{8}$/.test(ud) ? `${ud.slice(0, 4)}-${ud.slice(4, 6)}-${ud.slice(6, 8)}` : "";
  const data = { audioStreams, videoStreams, uploadDate, thumbnail: info.thumbnail, title: info.title, uploader: info.uploader ?? info.channel };
  ytCache.set(videoId, { ts: Date.now(), data });
  return data;
}

router.get("/streams/:id", async (req, res) => {
  const id = String(req.params.id || "");
  if (!/^[\w-]{11}$/.test(id)) {
    res.status(400).json({ error: "bad id" });
    return;
  }

  let pipedData: Record<string, unknown> | null = null;
  const shuffled = [...INSTANCES].sort(() => Math.random() - 0.5).slice(0, 6);
  for (const base of shuffled) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(`${base}/streams/${id}`, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!r.ok) continue;
      const ct = r.headers.get("content-type") ?? "";
      if (!ct.includes("json")) continue;
      pipedData = (await r.json()) as Record<string, unknown> | null;
      break;
    } catch {
      // ignore
    }
  }

  try {
    const yt = await resolveWithYtDlp(id);
    if (pipedData) {
      const audio = (pipedData.audioStreams as unknown[]) ?? [];
      const video = (pipedData.videoStreams as unknown[]) ?? [];
      if (audio.length === 0) pipedData.audioStreams = yt.audioStreams;
      if (video.length === 0) pipedData.videoStreams = yt.videoStreams;
      if (!pipedData.uploadDate || pipedData.uploadDate === "" || !String(pipedData.uploadDate).match(/\d{4}/)) {
        pipedData.uploadDate = yt.uploadDate;
      }
      res.setHeader("content-type", "application/json");
      res.setHeader("cache-control", "public, max-age=120");
      res.json(pipedData);
      return;
    }
    res.json({
      title: yt.title ?? "",
      description: "",
      uploadDate: yt.uploadDate,
      uploader: yt.uploader ?? "",
      uploaderUrl: "",
      uploaderAvatar: "",
      uploaderSubscriberCount: 0,
      thumbnailUrl: yt.thumbnail ?? "",
      duration: 0,
      views: 0,
      likes: 0,
      audioStreams: yt.audioStreams,
      videoStreams: yt.videoStreams,
      hls: undefined,
      relatedStreams: [],
    });
  } catch (err) {
    req.log.error({ err, id }, "stream resolution failed");
    if (pipedData) {
      res.setHeader("content-type", "application/json");
      res.json(pipedData);
      return;
    }
    res.status(502).json({ error: "stream_unavailable" });
  }
});

const cache = new Map<string, { ts: number; text: string; ct: string }>();
const CACHE_TTL = 60 * 1000;

router.get("/piped/*splat", async (req, res) => {
  const path = req.path.replace(/^\/piped/, "");
  const query = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  const target = `${path}${query}`;

  // No cache for trending (always fresh) and search w/o nextpage
  const noCache = path === "/trending" || path.startsWith("/search");
  const cached = noCache ? null : cache.get(target);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.setHeader("content-type", cached.ct);
    res.setHeader("cache-control", "public, max-age=30");
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
        lastErr = new Error(`non-json from ${base}`);
        continue;
      }
      const text = await upstream.text();
      if (text.includes('"error"') && text.length < 200) {
        lastErr = new Error(`error body from ${base}`);
        continue;
      }
      if (!noCache) cache.set(target, { ts: Date.now(), text, ct });
      res.setHeader("content-type", ct);
      res.setHeader("cache-control", noCache ? "no-store" : "public, max-age=30");
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
