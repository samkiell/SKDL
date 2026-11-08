/** Port of moviebox_api.v1.constants (only what the bot uses). */

import { getSettings } from "../config";

export const SubjectType = {
  MOVIES: 1,
  TV_SERIES: 2,
} as const;
export type SubjectTypeValue = (typeof SubjectType)[keyof typeof SubjectType];

const MIRROR_HOSTS = ["h5.aoneroom.com"];

/** Host address only (no protocol). Honors MOVIEBOX_API_HOST like the Python library. */
export function selectedHost(): string {
  return getSettings().MOVIEBOX_API_HOST || MIRROR_HOSTS[0];
}

export function hostUrl(): string {
  return `https://${selectedHost()}/`;
}

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const DOWNLOAD_REQUEST_REFERER = "https://videodownloader.site/";

/** For media and subtitle files download requests (and the default Session headers). */
export const DOWNLOAD_REQUEST_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": USER_AGENT,
  Origin: "https://videodownloader.site",
  Referer: DOWNLOAD_REQUEST_REFERER,
  "X-Client-Info": JSON.stringify({ timezone: "Africa/Nairobi" }),
};

export const DOWNLOAD_QUALITIES = ["WORST", "BEST", "360P", "480P", "720P", "1080P"];

export const USER_INFO_ENDPOINT = "https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/search-suggest";
export const SEARCH_ENDPOINT = "https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/search";

export function appInfoUrl(): string {
  return `${hostUrl()}wefeed-h5-bff/app/get-latest-app-pkgs?app_name=moviebox`;
}

/** Download endpoint host comes from MOVIEBOX_API_HOST_V2 (normalised in config). */
export function downloadUrl(): string {
  let host = getSettings().MOVIEBOX_API_HOST_V2;
  if (!host || host === "h5.aoneroom.com") host = "h5-api.aoneroom.com";
  return `https://${host}/wefeed-h5api-bff/subject/download`;
}
