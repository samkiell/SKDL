/**
 * Port of moviebox_api.v1.requests.Session using fetch.
 * Workers' fetch has no cookie jar, so a minimal one is implemented here.
 */

import { appInfoUrl, DOWNLOAD_REQUEST_HEADERS, USER_INFO_ENDPOINT } from "./constants";
import { isRecord, type JsonObject } from "../util";

const REQUEST_TIMEOUT_MS = 15_000;

interface UserInfo {
  token: string;
  [key: string]: unknown;
}

// Module-level caches, shared across Session instances (like the Python globals).
let cachedUserInfo: UserInfo | null = null;
let cachedAppInfo: unknown | null = null;

export type Params = Record<string, string | number | null | undefined>;

interface RequestOptions {
  params?: Params;
  json?: unknown;
  headers?: Record<string, string>;
}

interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  hostOnly: boolean;
}

class CookieJar {
  private items: StoredCookie[] = [];

  store(url: URL, setCookies: string[]): void {
    for (const line of setCookies) {
      const parts = line.split(";").map((p) => p.trim());
      const eq = parts[0].indexOf("=");
      if (eq <= 0) continue;
      const name = parts[0].slice(0, eq);
      const value = parts[0].slice(eq + 1);
      let domain = url.hostname;
      let hostOnly = true;
      let expired = false;
      for (const attr of parts.slice(1)) {
        const [k, ...rest] = attr.split("=");
        const v = rest.join("=");
        switch (k.toLowerCase()) {
          case "domain":
            if (v) {
              domain = v.replace(/^\./, "").toLowerCase();
              hostOnly = false;
            }
            break;
          case "max-age":
            if (Number(v) <= 0) expired = true;
            break;
          case "expires": {
            const t = Date.parse(v);
            if (!Number.isNaN(t) && t <= Date.now()) expired = true;
            break;
          }
        }
      }
      this.items = this.items.filter((c) => !(c.name === name && c.domain === domain));
      if (!expired) this.items.push({ name, value, domain, hostOnly });
    }
  }

  header(url: URL): string | undefined {
    const host = url.hostname.toLowerCase();
    const matching = this.items.filter((c) =>
      c.hostOnly ? host === c.domain : host === c.domain || host.endsWith(`.${c.domain}`),
    );
    return matching.length ? matching.map((c) => `${c.name}=${c.value}`).join("; ") : undefined;
  }
}

function statusError(resp: Response, url: string): Error {
  const kind = resp.status >= 500 ? "Server error" : resp.status >= 400 ? "Client error" : "Redirect response";
  return new Error(`${kind} '${resp.status} ${resp.statusText}' for url '${url}'`);
}

/** Extracts the response `data` field (port of helpers.process_api_response). */
function processApiResponse(resp: Response, text: string): unknown {
  const expected = "application/json";
  const contentType = resp.headers.get("content-type") ?? "";
  if (contentType !== expected) {
    throw new Error(`Unexpect content type '${contentType}' encountered. Expected '${expected}' - BODY ${JSON.stringify(text)}`);
  }
  const j = JSON.parse(text) as JsonObject;
  if ((j.code ?? 1) === 0 && j.message === "ok") {
    return j.data;
  }
  throw new Error(
    `Unsuccessful response received from server -STATUS ${resp.status} - BODY: ${JSON.stringify(text)}`,
  );
}

export class Session {
  private headers: Record<string, string> = { ...DOWNLOAD_REQUEST_HEADERS };
  private jar = new CookieJar();
  userInfo: UserInfo | null = null;
  moviebox_app_info: unknown | null = null;
  private appInfoFetched = false;

  private async send(method: "GET" | "POST", url: string, opts: RequestOptions = {}): Promise<Response> {
    const u = new URL(url);
    for (const [k, v] of Object.entries(opts.params ?? {})) {
      u.searchParams.append(k, v === null || v === undefined ? "" : String(v));
    }
    const headers = new Headers({ ...this.headers, ...(opts.headers ?? {}) });
    const cookie = this.jar.header(u);
    if (cookie) headers.set("Cookie", cookie);

    let body: string | undefined;
    if (opts.json !== undefined) {
      body = JSON.stringify(opts.json);
      headers.set("Content-Type", "application/json");
    }

    const resp = await fetch(u.toString(), {
      method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    this.jar.store(u, resp.headers.getSetCookie());
    return resp;
  }

  /** raise_for_status + empty-body validation; returns body text. */
  private async validated(resp: Response, url: string): Promise<string> {
    if (!resp.ok) throw statusError(resp, url);
    const text = await resp.text();
    if (!text) throw new Error("Server returned an empty body response.");
    return text;
  }

  async getWithCookiesFromApi(url: string, params: Params = {}, headers?: Record<string, string>): Promise<unknown> {
    await this.ensureCookiesAreAssigned();
    const resp = await this.send("GET", url, { params, headers });
    const text = await this.validated(resp, url);
    return processApiResponse(resp, text);
  }

  async postToApi(url: string, json: unknown): Promise<unknown> {
    await this.ensureCookiesAreAssigned();
    const resp = await this.send("POST", url, { json });
    const text = await this.validated(resp, url);
    return processApiResponse(resp, text);
  }

  /** Makes sure the auth token / app info (and their cookies) are available. */
  async ensureCookiesAreAssigned(): Promise<void> {
    if (this.userInfo === null && cachedUserInfo !== null) {
      this.userInfo = cachedUserInfo;
      this.headers.Authorization = `Bearer ${cachedUserInfo.token}`;
    }

    if (this.moviebox_app_info === null && cachedAppInfo !== null) {
      this.moviebox_app_info = cachedAppInfo;
    }

    if (!this.appInfoFetched) {
      if (!this.userInfo) {
        try {
          await this.fetchUserInfo();
        } catch {
          // ignored, same as the Python client
        }
      }
      if (!this.moviebox_app_info) {
        try {
          await this.fetchAppInfo();
        } catch {
          // ignored
        }
      }
      this.appInfoFetched = true;
    }
  }

  private async fetchAppInfo(): Promise<unknown | null> {
    try {
      const url = appInfoUrl();
      const resp = await this.send("GET", url);
      if (!resp.ok) throw statusError(resp, url);
      const text = await resp.text();
      let info = processApiResponse(resp, text);
      if (Array.isArray(info)) info = info[0];
      this.moviebox_app_info = info;
      cachedAppInfo = info;
      return info;
    } catch {
      return null;
    }
  }

  private async fetchUserInfo(): Promise<UserInfo> {
    const resp = await this.send("POST", USER_INFO_ENDPOINT, { json: { keyword: "avatar", perPage: 0 } });
    if (!resp.ok) throw statusError(resp, USER_INFO_ENDPOINT);

    const raw = resp.headers.get("x-user");
    if (!raw) throw new Error("App-info response misses x-user key in headers");

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.token !== "string") {
      throw new Error("Invalid x-user header");
    }
    this.userInfo = parsed as UserInfo;
    cachedUserInfo = this.userInfo;
    this.headers.Authorization = `Bearer ${this.userInfo.token}`;
    return this.userInfo;
  }
}
