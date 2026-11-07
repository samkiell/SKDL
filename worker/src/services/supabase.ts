/**
 * Redis service — media storage, collections, rate-limiting, and heartbeats.
 * Kept under supabase.ts to mirror bot/services/supabase.py (which is Redis-backed).
 * Uses the Upstash REST API because Workers cannot open raw TCP connections.
 * Values are stored as JSON strings, exactly like the Python bot.
 */

import { Redis } from "@upstash/redis/cloudflare";

import { getSettings } from "../config";
import { errMsg, pyIsoNow } from "../util";

export interface MediaRow {
  id: string;
  title: string;
  cdn_url: string;
  type: string;
  quality: string;
  season: number | null;
  episode: number | null;
  requested_by: number | null;
  requested_at: string;
  created_at: string;
  expires_at: string;
  subject_id: string | null;
  imdb_id: string | null;
  poster_url: string | null;
  description: string | null;
  size: number | null;
}

export interface CollectionRow {
  id: string;
  title: string;
  season: number;
  media_ids: string[];
  requested_by: number | null;
  expires_at: string;
}

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    const s = getSettings();
    client = new Redis({
      url: s.REDIS_REST_URL,
      token: s.REDIS_REST_TOKEN,
      // We store/read raw JSON strings like the Python bot does.
      automaticDeserialization: false,
    });
  }
  return client;
}

export interface SaveMediaArgs {
  link_id: string;
  title: string;
  cdn_url: string;
  media_type: string;
  quality?: string;
  season?: number | null;
  episode?: number | null;
  requested_by?: number | null;
  subject_id?: string | null;
  imdb_id?: string | null;
  poster_url?: string | null;
  description?: string | null;
  size?: number | null;
}

/** Store media metadata in Redis with TTL. Returns the stored row or null on failure. */
export async function saveMedia(args: SaveMediaArgs): Promise<MediaRow | null> {
  const s = getSettings();
  const nowDate = new Date();
  const now = pyIsoNow(nowDate);
  const expiresAt = new Date(nowDate.getTime() + s.CDN_TTL_HOURS * 3600 * 1000);
  const row: MediaRow = {
    id: args.link_id,
    title: args.title,
    cdn_url: args.cdn_url,
    type: args.media_type,
    quality: args.quality ?? "1080p",
    season: args.season ?? null,
    episode: args.episode ?? null,
    requested_by: args.requested_by ?? null,
    requested_at: now,
    created_at: now,
    expires_at: pyIsoNow(expiresAt),
    subject_id: args.subject_id ?? null,
    imdb_id: args.imdb_id ?? null,
    poster_url: args.poster_url ?? null,
    description: args.description ?? null,
    size: args.size ?? null,
  };

  try {
    const r = getRedis();
    const ttlSeconds = s.CDN_TTL_HOURS * 3600;
    const metaPayload = {
      id: args.link_id,
      title: args.title,
      type: args.media_type,
      season: args.season ?? null,
      episode: args.episode ?? null,
    };
    const rowJson = JSON.stringify(row);
    const p = r.pipeline();
    p.set(`media:${args.link_id}`, rowJson, { ex: ttlSeconds });
    // Long-lived metadata record (30 days) for expired link CTA resolution
    p.set(`media:meta:${args.link_id}`, JSON.stringify(metaPayload), { ex: 30 * 86400 });
    p.lpush("media:recent", rowJson);
    p.ltrim("media:recent", 0, 199);
    p.incr("stats:total_media");
    await p.exec();
    return row;
  } catch (exc) {
    console.error(`Redis save_media failed for id=${args.link_id}: ${errMsg(exc)}`);
    return null;
  }
}

export async function getMedia(linkId: string): Promise<MediaRow | null> {
  try {
    const data = await getRedis().get<string>(`media:${linkId}`);
    if (data) return JSON.parse(data) as MediaRow;
    return null;
  } catch (exc) {
    console.error(`Redis get_media failed for id=${linkId}: ${errMsg(exc)}`);
    return null;
  }
}

export async function getMediaById(linkId: string): Promise<MediaRow | null> {
  return getMedia(linkId);
}

/** Store bulk season collection in Redis with TTL. */
export async function saveCollection(args: {
  collection_id: string;
  title: string;
  season: number;
  media_ids: string[];
  requested_by?: number | null;
}): Promise<CollectionRow | null> {
  const s = getSettings();
  const expiresAt = new Date(Date.now() + s.CDN_TTL_HOURS * 3600 * 1000);
  const row: CollectionRow = {
    id: args.collection_id,
    title: args.title,
    season: args.season,
    media_ids: args.media_ids,
    requested_by: args.requested_by ?? null,
    expires_at: pyIsoNow(expiresAt),
  };
  try {
    await getRedis().set(`collection:${args.collection_id}`, JSON.stringify(row), {
      ex: s.CDN_TTL_HOURS * 3600,
    });
    return row;
  } catch (exc) {
    console.error(`Redis save_collection failed for id=${args.collection_id}: ${errMsg(exc)}`);
    return null;
  }
}

export async function getCollection(collectionId: string): Promise<CollectionRow | null> {
  try {
    const data = await getRedis().get<string>(`collection:${collectionId}`);
    if (data) return JSON.parse(data) as CollectionRow;
    return null;
  } catch (exc) {
    console.error(`Redis get_collection failed for id=${collectionId}: ${errMsg(exc)}`);
    return null;
  }
}

/**
 * Daily quota check. Atomic INCR with 24h key expiration.
 * Returns true if allowed, false if exceeded. Fails open on error.
 */
export async function checkRateLimit(userId: number, limit = 10): Promise<boolean> {
  try {
    const r = getRedis();
    const today = new Date().toISOString().slice(0, 10);
    const key = `ratelimit:${userId}:${today}`;
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, 86400);
    return count <= limit;
  } catch (exc) {
    console.error(`Redis rate limit check failed for user_id=${userId}: ${errMsg(exc)}`);
    return true;
  }
}

/** Heartbeat entry with 120s TTL for automatic offline detection. */
export async function updateBotHeartbeat(): Promise<void> {
  const now = pyIsoNow();
  try {
    const r = getRedis();
    await r.set("bot:heartbeat", now, { ex: 120 });
    await r.set("settings:bot_heartbeat", now);
  } catch (exc) {
    console.error(`Bot heartbeat update failed: ${errMsg(exc)}`);
  }
}
