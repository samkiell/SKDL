/**
 * Port of the moviebox_api.v1 pieces the bot uses:
 * Search, DownloadableMovieFilesDetail / DownloadableTVSeriesFilesDetail,
 * DownloadableFilesMetadata and resolve_media_file_to_be_downloaded.
 */

import {
  DOWNLOAD_QUALITIES,
  DOWNLOAD_REQUEST_REFERER,
  SEARCH_ENDPOINT,
  USER_AGENT,
  downloadUrl,
  type SubjectTypeValue,
} from "./constants";
import type { Session } from "./session";
import { isRecord, pyTruthy, type JsonObject } from "../util";

// --- helpers (moviebox_api.v1.helpers) ---

const SERIES_NAME_WITH_SEASON_NUMBER = /^.*\sS\d+$/;
const SERIES_NAME_WITH_SEASON_NUMBER_ONE = /^.*\sS1$/;
const UNWANTED_ITEM_NAME = /(\sS\d+|\sS\d+-S\d+|-S\d+)/g;

function isValidSearchItem(name: string): boolean {
  if (SERIES_NAME_WITH_SEASON_NUMBER.test(name)) {
    return SERIES_NAME_WITH_SEASON_NUMBER_ONE.test(name);
  }
  return true;
}

function sanitizeItemName(name: string): string {
  return name.replace(UNWANTED_ITEM_NAME, "");
}

// --- models ---

export interface SearchResultsItem {
  subjectId: string;
  subjectType: number;
  title: string;
  description: string;
  /** `releaseDate.year` */
  releaseYear: number;
  cover: { url: string } | null;
  detailPath: string;
}

export interface MediaFileMetadata {
  id: string;
  url: string;
  resolution: number;
  size: number;
}

export interface CaptionFileMetadata {
  id: string;
  lan: string;
  lanName: string;
  url: string;
  size: number;
  delay: number;
}

export interface DownloadableFilesMetadata {
  downloads: MediaFileMetadata[];
  captions: CaptionFileMetadata[];
}

export const ZERO_MEDIA_FILE_MESSAGE = "There are no downloadable  mediafiles for the targeted item";

function checkDownloads(meta: DownloadableFilesMetadata): void {
  if (meta.downloads.length === 0) throw new Error(ZERO_MEDIA_FILE_MESSAGE);
}

export function bestMediaFile(meta: DownloadableFilesMetadata): MediaFileMetadata {
  checkDownloads(meta);
  let found = meta.downloads[0];
  for (const f of meta.downloads.slice(1)) if (f.resolution > found.resolution) found = f;
  return found;
}

export function worstMediaFile(meta: DownloadableFilesMetadata): MediaFileMetadata {
  checkDownloads(meta);
  let found = meta.downloads[0];
  for (const f of meta.downloads.slice(1)) if (f.resolution < found.resolution) found = f;
  return found;
}

function qualityDownloadsMap(meta: DownloadableFilesMetadata): Map<string, MediaFileMetadata> {
  const m = new Map<string, MediaFileMetadata>();
  for (const item of meta.downloads) m.set(`${item.resolution}P`, item);
  return m;
}

/** resolve_media_file_to_be_downloaded */
export function resolveMediaFileToBeDownloaded(quality: string, meta: DownloadableFilesMetadata): MediaFileMetadata {
  switch (quality) {
    case "BEST":
      return bestMediaFile(meta);
    case "WORST":
      return worstMediaFile(meta);
    default: {
      if (DOWNLOAD_QUALITIES.includes(quality)) {
        const map = qualityDownloadsMap(meta);
        const target = map.get(quality);
        if (!target) {
          throw new Error(
            `Media file for quality ${quality} does not exists. Try other qualities from ${[...map.keys()].join(", ")}`,
          );
        }
        return target;
      }
      throw new Error(`Unknown media file quality passed '${quality}'. Choose from ${DOWNLOAD_QUALITIES.join(", ")}`);
    }
  }
}

// --- search ---

function toSearchItem(raw: JsonObject): SearchResultsItem {
  const releaseMatch = /^(\d{4})-/.exec(String(raw.releaseDate ?? ""));
  const cover = isRecord(raw.cover) ? { url: String(raw.cover.url ?? "") } : null;
  return {
    subjectId: String(raw.subjectId ?? ""),
    subjectType: Number(raw.subjectType),
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    releaseYear: releaseMatch ? parseInt(releaseMatch[1], 10) : 0,
    cover,
    detailPath: String(raw.detailPath ?? ""),
  };
}

/** Search(session, query, subject_type, per_page).get_content_model().items */
export async function search(
  session: Session,
  query: string,
  subjectType: SubjectTypeValue,
  perPage = 24,
  page = 1,
): Promise<SearchResultsItem[]> {
  const contents = await session.postToApi(SEARCH_ENDPOINT, {
    keyword: query,
    page,
    perPage,
    subjectType,
  });
  if (!isRecord(contents) || !Array.isArray(contents.items)) {
    throw new Error("'items'");
  }

  const contentsItems = contents.items as unknown[];
  if (contentsItems.length === 0) {
    throw new Error("Search yielded empty results. Try a different keyword.");
  }

  const targetItems: SearchResultsItem[] = [];
  for (const item of contentsItems) {
    if (!isRecord(item)) continue;
    // Sometimes the server response includes irrelevant items
    if (item.subjectType === subjectType) {
      const itemName = String(item.title);
      if (isValidSearchItem(itemName)) {
        item.title = sanitizeItemName(itemName);
        targetItems.push(toSearchItem(item));
      }
    }
  }
  return targetItems;
}

/** `str(item.cover.url)` — raises if the item has no cover, like the Python version. */
export function coverUrl(item: SearchResultsItem): string {
  if (!item.cover) throw new Error("'NoneType' object has no attribute 'url'");
  return item.cover.url;
}

// --- downloadable files ---

export interface DownloadableItemRef {
  subjectId: string;
  detailPath?: string;
}

/** BaseDownloadableFilesDetail.get_content_model(season, episode) */
export async function getDownloadableFiles(
  session: Session,
  item: DownloadableItemRef,
  season: number | null | undefined,
  episode: number | null | undefined,
): Promise<DownloadableFilesMetadata> {
  const params: Record<string, string | number | null | undefined> = {
    subjectId: item.subjectId,
    se: season,
    ep: episode,
  };
  if (item.detailPath) params.detailPath = item.detailPath;

  const content = await session.getWithCookiesFromApi(downloadUrl(), params, {
    Referer: DOWNLOAD_REQUEST_REFERER,
    Origin: "https://videodownloader.site",
    "User-Agent": USER_AGENT,
  });

  if (!isRecord(content)) throw new Error("Unexpected download response");

  const rawDownloads = Array.isArray(content.downloads) ? content.downloads : [];
  const rawCaptions = Array.isArray(content.captions) ? content.captions : [];

  const downloads: MediaFileMetadata[] = rawDownloads
    .filter((d): d is JsonObject => isRecord(d) && pyTruthy(d.url))
    .map((d) => ({
      id: String(d.id ?? ""),
      url: String(d.url ?? ""),
      resolution: Number(d.resolution ?? 0) || 0,
      size: Number(d.size ?? 0) || 0,
    }));

  const captions: CaptionFileMetadata[] = rawCaptions
    .filter((c): c is JsonObject => isRecord(c) && pyTruthy(c.url))
    .map((c) => ({
      id: String(c.id ?? ""),
      lan: String(c.lan ?? ""),
      lanName: String(c.lanName ?? ""),
      url: String(c.url ?? ""),
      size: Number(c.size ?? 0) || 0,
      delay: Number(c.delay ?? 0) || 0,
    }));

  return { downloads, captions };
}
