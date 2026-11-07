/**
 * opensubtitles.ts — Search and download subtitles from OpenSubtitles.com.
 */

import { getSettings } from "../config";
import { errMsg, isRecord, type JsonObject } from "../util";

export type SubtitleEntry = JsonObject;

/** Search for subtitles on OpenSubtitles.com. Returns a list of subtitle entries. */
export async function searchSubtitles(
  opts: { imdb_id?: string | null; query?: string | null; lang?: string } = {},
): Promise<SubtitleEntry[]> {
  const apiKey = getSettings().OPENSUBTITLES_API_KEY;
  if (!apiKey) {
    console.warn("OPENSUBTITLES_API_KEY not configured");
    return [];
  }

  try {
    const params = new URLSearchParams({ languages: opts.lang ?? "en" });
    if (opts.imdb_id) {
      // Strip 'tt' prefix if it exists
      params.set("imdb_id", opts.imdb_id.replaceAll("tt", ""));
    } else if (opts.query) {
      params.set("query", opts.query);
    } else {
      return [];
    }

    const response = await fetch(`https://api.opensubtitles.com/api/v1/subtitles?${params.toString()}`, {
      headers: {
        "Api-Key": apiKey,
        "User-Agent": "SKDL v1.0",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status !== 200) {
      console.error(`OpenSubtitles search failed with status ${response.status}: ${await response.text()}`);
      return [];
    }

    const data = (await response.json()) as JsonObject;
    return (data.data as SubtitleEntry[] | undefined) ?? [];
  } catch (exc) {
    console.error(`OpenSubtitles search exception: ${errMsg(exc)}`);
    return [];
  }
}

/** Get the download link for a specific subtitle file. */
export async function downloadSubtitle(fileId: number): Promise<JsonObject | null> {
  const apiKey = getSettings().OPENSUBTITLES_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.opensubtitles.com/api/v1/download", {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "User-Agent": "SKDL v1.0",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ file_id: fileId }),
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status !== 200) {
      console.error(`OpenSubtitles download failed with status ${response.status}: ${await response.text()}`);
      return null;
    }

    return (await response.json()) as JsonObject;
  } catch (exc) {
    console.error(`OpenSubtitles download exception: ${errMsg(exc)}`);
    return null;
  }
}

/** Pick the best subtitle from a list based on release name keywords. */
export function findBestMatch(subtitles: SubtitleEntry[]): SubtitleEntry | null {
  if (!subtitles || subtitles.length === 0) return null;

  const keywords = ["WEB-DL", "WEBRip", "DVDRip", "Bluray", "BRRip", "1080p", "720p"];

  for (const sub of subtitles) {
    const attrs = isRecord(sub.attributes) ? sub.attributes : {};
    const release = String(attrs.release || "").toUpperCase();
    if (keywords.some((k) => release.includes(k.toUpperCase()))) return sub;
  }

  return subtitles[0];
}
