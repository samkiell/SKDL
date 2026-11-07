/**
 * moviebox.ts — CDN URL extraction from MovieBox without downloading.
 *
 * Resolution chain (same as the Python service):
 *  1. Search(session, query, subject_type) -> SearchResultsItem[]
 *  2. Downloadable files detail (movie: se=0/ep=0, series: season/episode)
 *  3. resolve_media_file_to_be_downloaded(quality, metadata) -> MediaFileMetadata
 *  4. MediaFileMetadata.url is the CDN URL. We stop there — nothing is downloaded.
 */

import {
  bestMediaFile,
  coverUrl,
  getDownloadableFiles,
  resolveMediaFileToBeDownloaded,
  search,
  type DownloadableFilesMetadata,
  type MediaFileMetadata,
  type SearchResultsItem,
} from "../moviebox/api";
import { SubjectType } from "../moviebox/constants";
import { Session } from "../moviebox/session";
import { errMsg, sequenceRatio, splitWs } from "../util";

/** Convert quality string to moviebox-api format (e.g. '1080p' -> '1080P'). */
function normalizeQuality(quality: string): string {
  const q = quality.trim().toUpperCase();
  if (q === "BEST" || q === "WORST") return q;
  return q.replace(/P+$/, "") + "P";
}

function normTitle(text: string | null | undefined): string {
  const stripped = (text || "").replace(/\[.*?\]|\(.*?\)/g, " ");
  return stripped.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim();
}

/**
 * Pick the search result that best matches the query title.
 * Returns null when nothing is a confident match.
 */
function pickBest(items: SearchResultsItem[] | null | undefined, query: string): SearchResultsItem | null {
  const q = normTitle(query);
  const qTokens = new Set(splitWs(q));
  let best: SearchResultsItem | null = null;
  let bestScore = 0.0;
  for (const item of items ?? []) {
    const t = normTitle(item.title);
    if (!t) continue;
    if (t === q) return item;
    let score = sequenceRatio(q, t);
    if (qTokens.size >= 2) {
      const tTokens = new Set(splitWs(t));
      if ([...qTokens].every((tok) => tTokens.has(tok))) score = Math.max(score, 0.9);
    }
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  if (best !== null && bestScore >= 0.85) return best;
  console.info(`No confident match for '${query}' (best score ${bestScore.toFixed(2)})`);
  return null;
}

/** Friendly names of top candidates from search items. */
export function getCloseSuggestions(items: SearchResultsItem[] | null | undefined, query: string, limit = 3): string[] {
  const q = normTitle(query);
  const qTokens = new Set(splitWs(q));
  const suggestions: Array<[number, string]> = [];
  const seen = new Set<string>();
  for (const item of items ?? []) {
    const tRaw = item.title ?? "";
    const t = normTitle(tRaw);
    if (!t || seen.has(t)) continue;
    const score = sequenceRatio(q, t);
    const tTokens = splitWs(t);
    if ((qTokens.size > 0 && tTokens.some((tok) => qTokens.has(tok))) || score >= 0.4) {
      const year = item.releaseYear;
      const label = year ? `${tRaw} (${year})` : tRaw;
      suggestions.push([score, label]);
      seen.add(t);
    }
  }
  suggestions.sort((a, b) => b[0] - a[0]);
  return suggestions.slice(0, limit).map((s) => s[1]);
}

function resolveSdkMediaFile(downloadable: DownloadableFilesMetadata, quality: string): MediaFileMetadata {
  try {
    return resolveMediaFileToBeDownloaded(normalizeQuality(quality), downloadable);
  } catch {
    // Requested quality may be unavailable; fall back to best available.
    return bestMediaFile(downloadable);
  }
}

export interface MovieResult {
  cdn_url: string;
  title: string;
  year: number;
  quality: string;
  size: number;
  subject_id: string;
  imdb_id: string | null;
  poster_url: string | null;
  description: string;
}

export interface EpisodeResult {
  cdn_url: string;
  title: string;
  season: number;
  episode: number;
  quality: string;
  size: number;
  subject_id: string;
  imdb_id: string | null;
  poster_url: string | null;
  description: string;
}

/** Search for a movie and return its CDN URL + metadata without downloading. */
export async function getMovie(title: string, quality = "1080p"): Promise<MovieResult> {
  const session = new Session();

  try {
    // Step 1: Search
    const items = await search(session, title, SubjectType.MOVIES, 10);

    if (items.length === 0) {
      throw new Error(`No results found for '${title}'`);
    }

    const target = pickBest(items, title);
    if (target === null) {
      const suggestions = getCloseSuggestions(items, title);
      const suffix = suggestions.length ? ` Did you mean: ${suggestions.join(", ")}?` : "";
      throw new Error(`No results found for '${title}'.${suffix}`);
    }

    // Step 2: Resolve download metadata.
    const downloadable = await getDownloadableFiles(session, target, 0, 0);
    const mediaFile = resolveSdkMediaFile(downloadable, quality);
    const cdnUrl = String(mediaFile.url);
    const resolution = Math.trunc(mediaFile.resolution || 0);
    const size = Math.trunc(mediaFile.size || 0);

    if (!cdnUrl) {
      throw new Error("Could not resolve a playable URL for selected movie");
    }

    return {
      cdn_url: cdnUrl,
      title: target.title,
      year: target.releaseYear,
      quality: resolution > 0 ? `${resolution}p` : quality,
      size,
      subject_id: target.subjectId,
      imdb_id: null,
      poster_url: coverUrl(target),
      description: target.description,
    };
  } catch (exc) {
    console.error(`Failed to get movie '${title}': ${errMsg(exc)}`);
    throw new Error(`Could not fetch movie '${title}': ${errMsg(exc)}`);
  }
}

export interface QualityOption {
  resolution: number;
  size: number;
  label: string;
}

export async function getAvailableQualities(
  title: string,
  isSeries: boolean,
  season: number | null = null,
  episode: number | null = null,
): Promise<{ title?: string; qualities?: QualityOption[] }> {
  const session = new Session();
  try {
    // Guard: if se and ep are both 0, treat it as a movie
    const isActuallySeries = isSeries && !(season === 0 && episode === 0);

    let target: SearchResultsItem | null;
    let downloadable: DownloadableFilesMetadata;
    if (isActuallySeries) {
      const results = await search(session, title, SubjectType.TV_SERIES, 10);
      target = pickBest(results, title);
      if (target === null) return {};
      downloadable = await getDownloadableFiles(session, target, season, episode);
    } else {
      const results = await search(session, title, SubjectType.MOVIES, 10);
      target = pickBest(results, title);
      if (target === null) return {};
      downloadable = await getDownloadableFiles(session, target, 0, 0);
    }

    const qualities: QualityOption[] = [];
    for (const d of downloadable.downloads) {
      const res = Math.trunc(d.resolution || 0);
      const size = Math.trunc(d.size || 0);
      if (res > 0) qualities.push({ resolution: res, size, label: `${res}p` });
    }

    // Sort best to worst
    qualities.sort((a, b) => b.resolution - a.resolution);
    return { title: target.title, qualities };
  } catch (exc) {
    console.error(`Failed to fetch available qualities: ${errMsg(exc)}`);
    return {};
  }
}

/** Search for a TV series episode and return its CDN URL + metadata without downloading. */
export async function getEpisode(
  title: string,
  season: number,
  episode: number,
  quality = "1080p",
  target: SearchResultsItem | null = null,
  session: Session | null = null,
): Promise<EpisodeResult | MovieResult> {
  const sess = session ?? new Session();

  try {
    // Guard: if se and ep are both 0, treat it as a movie
    if (season === 0 && episode === 0) {
      return await getMovie(title, quality);
    }

    // Step 1: Search for TV series (if target not provided)
    let item = target;
    if (!item) {
      const items = await search(sess, title, SubjectType.TV_SERIES, 10);
      item = pickBest(items, title);
      if (item === null) {
        const suggestions = getCloseSuggestions(items, title);
        const suffix = suggestions.length ? ` Did you mean: ${suggestions.join(", ")}?` : "";
        throw new Error(`No series results found for '${title}'.${suffix}`);
      }
    }

    // Step 2: Resolve episode download metadata.
    const downloadable = await getDownloadableFiles(sess, item, season, episode);
    const mediaFile = resolveSdkMediaFile(downloadable, quality);
    const cdnUrl = String(mediaFile.url);
    const resolution = Math.trunc(mediaFile.resolution || 0);
    const size = Math.trunc(mediaFile.size || 0);

    if (!cdnUrl) {
      throw new Error("Could not resolve a playable URL for selected episode");
    }

    return {
      cdn_url: cdnUrl,
      title: item.title,
      season,
      episode,
      quality: resolution > 0 ? `${resolution}p` : quality,
      size,
      subject_id: item.subjectId,
      imdb_id: null,
      poster_url: coverUrl(item),
      description: item.description,
    };
  } catch (exc) {
    const err = errMsg(exc);
    if (err.toLowerCase().includes("no downloadable") && err.toLowerCase().includes("media")) {
      console.info(`Episode '${title}' S${season}E${episode} not found (expected during bulk scan)`);
    } else {
      console.error(`Failed to get episode '${title}' S${season}E${episode}: ${err}`);
    }
    throw new Error(`Could not fetch '${title}' S${season}E${episode}: ${err}`);
  }
}

/**
 * EXPERIMENTAL: Fetch all available episodes for a given season.
 * Polls episodes 1-25 concurrently. One search resolves the series target.
 */
export async function getSeasonEpisodes(title: string, season: number, quality = "1080p"): Promise<EpisodeResult[]> {
  const session = new Session();

  // One search to find the show
  const results = await search(session, title, SubjectType.TV_SERIES, 10);
  const target = pickBest(results, title);
  if (target === null) return [];

  const fetchSafe = async (epNum: number): Promise<EpisodeResult | null> => {
    try {
      return (await getEpisode(title, season, epNum, quality, target, session)) as EpisodeResult;
    } catch {
      return null;
    }
  };

  // Poll up to 25 episodes concurrently
  const resultsList = await Promise.all(Array.from({ length: 25 }, (_, i) => fetchSafe(i + 1)));

  // Filter out null and return ordered list
  return resultsList.filter((r): r is EpisodeResult => r !== null).sort((a, b) => a.episode - b.episode);
}

/** Extract English subtitles from MovieBox. */
export async function getSubtitles(
  subjectId: string,
  isSeries: boolean,
  season = 0,
  episode = 0,
): Promise<{ subtitle_url: string; file_name: string } | null> {
  const session = new Session();
  try {
    const dummy = { subjectId, detailPath: "" };
    const downloadable = isSeries
      ? await getDownloadableFiles(session, dummy, season, episode)
      : await getDownloadableFiles(session, dummy, 0, 0);

    const english = downloadable.captions.find((c) => c.lan === "en" || (c.lanName || "").toLowerCase().includes("english"));

    if (english) {
      return { subtitle_url: String(english.url), file_name: `moviebox_en_${subjectId}.srt` };
    }
  } catch (exc) {
    console.error(`Failed to extract MovieBox subtitles for ${subjectId}: ${errMsg(exc)}`);
  }
  return null;
}

export interface MediaInfo {
  title: string;
  year: number | string;
  suggestions?: string[];
  poster_url?: string | null;
  description?: string;
  genre?: string;
  subject_id?: string;
}

/** Fetch basic metadata (poster, year, genre, description) for a given title. */
export async function getMediaInfo(title: string, isSeries: boolean): Promise<MediaInfo> {
  const session = new Session();
  try {
    const subjectType = isSeries ? SubjectType.TV_SERIES : SubjectType.MOVIES;
    const results = await search(session, title, subjectType, 10);
    const target = pickBest(results, title);
    if (target === null) {
      const suggestions = getCloseSuggestions(results, title);
      return { title, year: "Unknown", suggestions };
    }
    return {
      title: target.title,
      year: target.releaseYear,
      poster_url: coverUrl(target),
      description: target.description,
      // MovieBox search items carry no `tags` attribute; the Python service always yielded "".
      genre: "",
      subject_id: target.subjectId,
    };
  } catch (exc) {
    console.error(`Failed to fetch media info for ${title}: ${errMsg(exc)}`);
    return { title, year: "Unknown" };
  }
}

