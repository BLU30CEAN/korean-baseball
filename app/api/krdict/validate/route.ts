import { NextResponse } from "next/server";
import { composeHangulWord, isHangulWord } from "@/lib/game/hangul";
import { lookupKrdictWord } from "@/lib/krdict/lookup";

type CacheEntry = {
  expiresAt: number;
  isValid: boolean;
  definition?: string;
};

const CACHE_POS_MS = 86_400_000; // 24h
const CACHE_NEG_MS = 3_600_000; // 1h
const cache = new Map<string, CacheEntry>();

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120;
const rateBuckets = new Map<string, number[]>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const prev = rateBuckets.get(ip) ?? [];
  const recent = prev.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    rateBuckets.set(ip, recent);
    return true;
  }
  recent.push(now);
  rateBuckets.set(ip, recent);

  if (rateBuckets.size > 4096) {
    for (const [key, stamps] of rateBuckets) {
      const kept = stamps.filter((t) => now - t < RATE_WINDOW_MS);
      if (kept.length === 0) {
        rateBuckets.delete(key);
      } else {
        rateBuckets.set(key, kept);
      }
    }
  }

  return false;
}

export async function POST(request: Request) {
  if (isRateLimited(getClientIp(request))) {
    return NextResponse.json(
      { isValid: false, fromCache: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ isValid: false, fromCache: false, error: "bad_json" }, { status: 400 });
  }

  const raw = typeof body === "object" && body !== null && "word" in body && typeof (body as { word: unknown }).word === "string"
    ? (body as { word: string }).word
    : "";

  const trimmed = raw.normalize("NFC").trim();
  const composed = isHangulWord(trimmed) ? trimmed : composeHangulWord(trimmed);

  if (!composed || !isHangulWord(composed)) {
    return NextResponse.json({ isValid: false, fromCache: false, error: "not_hangul" }, { status: 400 });
  }

  const key = process.env.KRDICT_KEY?.trim() ?? "";
  if (!key) {
    return NextResponse.json({
      isValid: false,
      fromCache: false,
      reason: "server_key_missing",
    });
  }

  const cacheKey = composed.normalize("NFC");
  const hit = cache.get(cacheKey);
  const now = Date.now();
  if (hit && hit.expiresAt > now) {
    return NextResponse.json({
      isValid: hit.isValid,
      definition: hit.definition,
      fromCache: true,
    });
  }

  try {
    const result = await lookupKrdictWord(cacheKey, key);
    const ttl = result.isValid ? CACHE_POS_MS : CACHE_NEG_MS;
    cache.set(cacheKey, {
      expiresAt: now + ttl,
      isValid: result.isValid,
      definition: result.definition,
    });
    return NextResponse.json({
      isValid: result.isValid,
      definition: result.definition,
      fromCache: false,
    });
  } catch {
    return NextResponse.json(
      { isValid: false, fromCache: false, error: "krdict_upstream" },
      { status: 502 },
    );
  }
}
