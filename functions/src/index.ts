import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/logger";
import type { Request, Response } from "express";
import { poiQuerySchema, photoQuerySchema, formatZodError } from "./lib/schema";
import { textSearch, placeDetails, type TextSearchPlace } from "./lib/google";
import { buildReason, mapsDirLink, photoProxyUrl } from "./lib/util";

const REGION = "us-central1" as const;
const PLACES_API_KEY = defineSecret("PLACES_API_KEY");

const allowedOrigins = new Set<string>([
  "http://localhost:5173",
  process.env.ALLOWED_ORIGIN || "",
].filter(Boolean));

function applyCors(req: Request, res: Response): boolean {
  const origin = req.headers.origin as string | undefined;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "3600");
    res.status(204).send("");
    return true;
  }
  return false;
}

// Simple per-instance token-bucket rate limiter (nice-to-have)
const RATE_LIMIT_CAPACITY = 30; // tokens
const RATE_LIMIT_REFILL_MS = 60_000; // per minute
const ipBuckets = new Map<string, { tokens: number; lastRefill: number }>();

function getClientIp(req: Request): string {
  const fwd = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return fwd || req.ip || "unknown";
}

function checkRateLimit(req: Request): boolean {
  const ip = getClientIp(req);
  const now = Date.now();
  let bucket = ipBuckets.get(ip);
  if (!bucket) {
    bucket = { tokens: RATE_LIMIT_CAPACITY, lastRefill: now };
    ipBuckets.set(ip, bucket);
  }
  // Refill
  const elapsed = now - bucket.lastRefill;
  if (elapsed > 0) {
    const refillTokens = Math.floor((elapsed / RATE_LIMIT_REFILL_MS) * RATE_LIMIT_CAPACITY);
    if (refillTokens > 0) {
      bucket.tokens = Math.min(RATE_LIMIT_CAPACITY, bucket.tokens + refillTokens);
      bucket.lastRefill = now;
    }
  }
  if (bucket.tokens <= 0) {
    return false;
  }
  bucket.tokens -= 1;
  return true;
}

export const poi = onRequest({ region: REGION, secrets: [PLACES_API_KEY] }, async (req, res) => {
  try {
    if (applyCors(req, res)) return;

    if (!checkRateLimit(req)) {
      res.status(429).json({ error: "Rate limit exceeded" });
      return;
    }

    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const parse = poiQuerySchema.safeParse(req.query);
    if (!parse.success) {
      const formatted = formatZodError(parse.error);
      res.status(400).json(formatted);
      return;
    }

    const { startLat, startLng, prompt, radius = 1200, vibe } = parse.data;
    const query = prompt && prompt.trim().length > 0 ? prompt.trim() : "cafe";

    const apiKey = PLACES_API_KEY.value();
    if (!apiKey) {
      logger.error("Missing PLACES_API_KEY secret");
      res.status(500).json({ error: "Server not configured" });
      return;
    }

    const ts = await textSearch({
      query,
      location: { lat: startLat, lng: startLng },
      radius,
      apiKey,
    });

    if (ts.status === "ZERO_RESULTS" || ts.results.length === 0) {
      res.status(404).json({ error: "No results" });
      return;
    }
    if (ts.status !== "OK" && ts.status !== "ZERO_RESULTS") {
      logger.warn("Text Search non-OK", ts);
    }

    const selected = selectBestPlace(ts.results);
    if (!selected) {
      res.status(404).json({ error: "No suitable result" });
      return;
    }

    const pd = await placeDetails({ placeId: selected.place_id, apiKey });
    if (pd.status !== "OK" || !pd.result) {
      logger.error("Place details failed", pd);
      res.status(500).json({ error: "Failed to fetch place details" });
      return;
    }

    const dest = pd.result.geometry.location;

    const photoRefs = (pd.result.photos || []).map((p) => p.photo_reference).filter(Boolean);
    let images: string[] = [];
    if (photoRefs.length >= 2) {
      images = [photoProxyUrl(photoRefs[0]), photoProxyUrl(photoRefs[1])];
    } else if (photoRefs.length === 1) {
      const url = photoProxyUrl(photoRefs[0]);
      images = [url, url];
    } else {
      images = [];
    }

    const payload = {
      title: pd.result.name,
      images,
      google_map_link: mapsDirLink(startLat, startLng, dest.lat, dest.lng),
      reason: buildReason(pd.result, vibe),
    } as const;

    res.status(200).json(payload);
  } catch (err) {
    logger.error("Unhandled error in /poi", err as Error);
    res.status(500).json({ error: "Internal server error" });
  }
});

function selectBestPlace(results: TextSearchPlace[]): TextSearchPlace | null {
  if (!results || results.length === 0) return null;

  // Prefer cafe then restaurant, high rating, has photos.
  // Simple heuristic scoring.
  const scored = results.map((r) => {
    const types = r.types || [];
    const isCafe = types.includes("cafe");
    const isRestaurant = types.includes("restaurant");
    const base = typeof r.rating === "number" ? r.rating : 0;
    const volume = Math.log(1 + (r.user_ratings_total || 0));
    const photosBonus = (r.photos && r.photos.length > 0) ? 0.1 : 0;
    const typeBonus = isCafe ? 0.3 : isRestaurant ? 0.1 : 0;
    const score = base + 0.15 * volume + typeBonus + photosBonus;
    return { r, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // First try with photos
  const withPhotos = scored.find((s) => s.r.photos && s.r.photos.length > 0);
  if (withPhotos) return withPhotos.r;

  // Fallback any
  return scored[0]?.r || null;
}

export const photo = onRequest({ region: REGION, secrets: [PLACES_API_KEY] }, async (req, res) => {
  try {
    if (applyCors(req, res)) return;

    if (!checkRateLimit(req)) {
      res.status(429).json({ error: "Rate limit exceeded" });
      return;
    }

    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const parse = photoQuerySchema.safeParse(req.query);
    if (!parse.success) {
      const formatted = formatZodError(parse.error);
      res.status(400).json(formatted);
      return;
    }

    const { ref, maxwidth = 1200 } = parse.data;
    const apiKey = PLACES_API_KEY.value();
    if (!apiKey) {
      logger.error("Missing PLACES_API_KEY secret");
      res.status(500).json({ error: "Server not configured" });
      return;
    }

    const params = new URLSearchParams({ photoreference: ref, maxwidth: String(maxwidth), key: apiKey });
    const url = `https://maps.googleapis.com/maps/api/place/photo?${params.toString()}`;

    const upstream = await fetch(url, { redirect: "follow" });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      logger.error("Photo proxy upstream error", { status: upstream.status, text });
      res.status(502).json({ error: "Failed to fetch photo" });
      return;
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).send(buffer);
  } catch (err) {
    logger.error("Unhandled error in /photo", err as Error);
    res.status(500).json({ error: "Internal server error" });
  }
});