import { NextRequest } from "next/server";

/* ---------- Sanitisation helpers ---------- */

const HTML_ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "`": "&#x60;",
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`]/g, (char) => HTML_ENTITY_MAP[char] ?? char);
}

export function sanitizeText(input: unknown, max = 400): string {
  if (typeof input !== "string") {
    return "";
  }
  return escapeHtml(input.trim().slice(0, max));
}

export function sanitizeTicker(input: unknown): string {
  if (typeof input !== "string") {
    return "";
  }
  return input.trim().toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 12);
}

export function sanitizeStringArray(input: unknown, maxItems = 50, maxItemLength = 80): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.slice(0, maxItems).map((item) => sanitizeText(item, maxItemLength)).filter(Boolean);
}

/* ---------- Rate-limiting ---------- */

type RateResult = { ok: boolean; retryAfterSec?: number };

function headerIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

type RateEntry = { count: number; windowStart: number };
const HOUR_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // clean expired entries every 10 min
const memoryStore = new Map<string, RateEntry>();
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanup = now;
  memoryStore.forEach((entry, key) => {
    if (now - entry.windowStart >= HOUR_MS) {
      memoryStore.delete(key);
    }
  });
}

function memoryRateLimit(key: string, maxPerHour: number): RateResult {
  cleanupExpiredEntries();

  const now = Date.now();
  const current = memoryStore.get(key);

  if (!current || now - current.windowStart >= HOUR_MS) {
    memoryStore.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }

  if (current.count >= maxPerHour) {
    const retryAfterSec = Math.ceil((HOUR_MS - (now - current.windowStart)) / 1000);
    return { ok: false, retryAfterSec };
  }

  current.count += 1;
  return { ok: true };
}

export async function rateLimitAI(
  request: NextRequest,
  keySuffix: string,
  maxPerHour = 30,
): Promise<RateResult> {
  const ip = headerIp(request);
  const key = `${ip}:${keySuffix}`;
  return memoryRateLimit(key, maxPerHour);
}
