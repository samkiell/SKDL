/**
 * Configuration — all environment variables loaded in one place.
 * Same variable names as bot/config.py.
 */

export interface Env {
  TELEGRAM_BOT_TOKEN?: string;
  REDIS_URL?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  GROQ_API_KEY?: string;
  LINK_BASE_URL?: string;
  WEB_PROXY_BASE_URL?: string;
  CDN_TTL_HOURS?: string;
  MOVIEBOX_API_HOST?: string;
  MOVIEBOX_API_HOST_V2?: string;
  MOVIEBOX_DOWNLOAD_API_HOST?: string;
  OPENSUBTITLES_API_KEY?: string;
  GROQ_MODEL?: string;
}

export interface Settings {
  TELEGRAM_BOT_TOKEN: string;
  REDIS_URL: string;
  /** Upstash REST endpoint (Workers cannot open raw TCP Redis connections). */
  REDIS_REST_URL: string;
  REDIS_REST_TOKEN: string;
  GROQ_API_KEY: string;
  LINK_BASE_URL: string;
  WEB_PROXY_BASE_URL: string;
  CDN_TTL_HOURS: number;
  MOVIEBOX_API_HOST: string | undefined;
  MOVIEBOX_API_HOST_V2: string;
  MOVIEBOX_DOWNLOAD_API_HOST: string;
  OPENSUBTITLES_API_KEY: string | undefined;
  GROQ_MODEL: string;
}

let cached: Settings | null = null;

function settingsFromEnv(env: Env): Settings {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");

  let redisUrl = env.REDIS_URL;
  if (!redisUrl) {
    const upstashToken = env.UPSTASH_REDIS_REST_TOKEN;
    const upstashHost = (env.UPSTASH_REDIS_REST_URL ?? "")
      .replace("https://", "")
      .replace("http://", "");
    if (upstashToken && upstashHost) {
      redisUrl = `rediss://default:${upstashToken}@${upstashHost}:6379`;
    } else {
      throw new Error("REDIS_URL is required");
    }
  }

  let restUrl = env.UPSTASH_REDIS_REST_URL;
  let restToken = env.UPSTASH_REDIS_REST_TOKEN;
  if (!restUrl || !restToken) {
    // Derive the REST endpoint from rediss://default:<token>@<host>:6379
    const parsed = new URL(redisUrl);
    restToken = restToken || decodeURIComponent(parsed.password);
    restUrl = restUrl || `https://${parsed.hostname}`;
  }
  if (!/^https?:\/\//.test(restUrl)) restUrl = `https://${restUrl}`;

  const groqKey = env.GROQ_API_KEY;
  if (!groqKey) throw new Error("GROQ_API_KEY is required");

  let mbApiHost = env.MOVIEBOX_API_HOST_V2 ?? "h5-api.aoneroom.com";
  if (!mbApiHost || mbApiHost === "h5.aoneroom.com") {
    mbApiHost = "h5-api.aoneroom.com";
  }

  return {
    TELEGRAM_BOT_TOKEN: token,
    REDIS_URL: redisUrl,
    REDIS_REST_URL: restUrl,
    REDIS_REST_TOKEN: restToken,
    GROQ_API_KEY: groqKey,
    LINK_BASE_URL: env.LINK_BASE_URL ?? "https://movies.samkiel.dev",
    WEB_PROXY_BASE_URL: env.WEB_PROXY_BASE_URL ?? "https://skdlm.vercel.app",
    CDN_TTL_HOURS: parseInt(env.CDN_TTL_HOURS ?? "6", 10),
    MOVIEBOX_API_HOST: env.MOVIEBOX_API_HOST,
    MOVIEBOX_API_HOST_V2: mbApiHost,
    MOVIEBOX_DOWNLOAD_API_HOST: env.MOVIEBOX_DOWNLOAD_API_HOST ?? "h5.aoneroom.com",
    OPENSUBTITLES_API_KEY: env.OPENSUBTITLES_API_KEY,
    GROQ_MODEL: env.GROQ_MODEL ?? "openai/gpt-oss-120b",
  };
}

/** Load settings from the Worker env (once per isolate). */
export function initSettings(env: Env): Settings {
  if (!cached) cached = settingsFromEnv(env);
  return cached;
}

export function getSettings(): Settings {
  if (!cached) throw new Error("Settings not initialised");
  return cached;
}
