/**
 * Small helpers that reproduce Python semantics the original bot relied on.
 */

import type { User } from "grammy/types";

export type JsonObject = Record<string, unknown>;

export function isRecord(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Python truthiness. */
export function pyTruthy(v: unknown): boolean {
  if (v === null || v === undefined || v === false || v === 0 || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

/** `a or b or c` — first truthy operand, else the last one. */
export function pyOr<T>(...values: T[]): T {
  for (const v of values) if (pyTruthy(v)) return v;
  return values[values.length - 1];
}

/** `int(s)`; returns null when Python would raise ValueError. Throws TypeError for non-strings. */
export function pyInt(s: string | undefined | null): number | null {
  if (typeof s !== "string") {
    throw new TypeError("int() argument must be a string");
  }
  const t = s.trim();
  if (!/^[+-]?\d+$/.test(t)) return null;
  return parseInt(t, 10);
}

/** `int(value)` for loosely-typed JSON values. Throws like Python's int() would. */
export function toInt(v: unknown): number {
  const n = typeof v === "string" ? pyInt(v) : typeof v === "number" ? Math.trunc(v) : NaN;
  if (n === null || Number.isNaN(n)) throw new Error(`invalid literal for int(): ${String(v)}`);
  return n;
}

/** Python `str.split(maxsplit=1)`. */
export function splitMax1(s: string): string[] {
  const m = /^\s*(\S+)(?:\s+([\s\S]*))?$/.exec(s);
  if (!m) return [];
  return m[2] !== undefined ? [m[1], m[2]] : [m[1]];
}

/** Python `str.split()`. */
export function splitWs(s: string): string[] {
  return s.split(/\s+/).filter((p) => p.length > 0);
}

/** aiogram `User.full_name`. */
export function fullName(user: User): string {
  return user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
}

/** Python `datetime.now(timezone.utc).isoformat()` look-alike. */
export function pyIsoNow(d: Date = new Date()): string {
  return d.toISOString().replace("Z", "000+00:00");
}

export function formatSize(sizeBytes: number | null | undefined): string {
  if (!sizeBytes) return "";
  const b = Number(sizeBytes);
  if (Number.isNaN(b) || b <= 0) return "";
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(0)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${Math.trunc(b)} B`;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

// ---------------------------------------------------------------------------
// difflib.SequenceMatcher(None, a, b).ratio()
// ---------------------------------------------------------------------------

export function sequenceRatio(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la + lb === 0) return 1.0;

  const b2j = new Map<string, number[]>();
  for (let j = 0; j < lb; j++) {
    const ch = b[j];
    const arr = b2j.get(ch);
    if (arr) arr.push(j);
    else b2j.set(ch, [j]);
  }
  if (lb >= 200) {
    const ntest = Math.floor(lb / 100) + 1;
    for (const [k, v] of [...b2j]) if (v.length > ntest) b2j.delete(k);
  }

  const findLongest = (alo: number, ahi: number, blo: number, bhi: number): [number, number, number] => {
    let besti = alo;
    let bestj = blo;
    let bestsize = 0;
    let j2len = new Map<number, number>();
    for (let i = alo; i < ahi; i++) {
      const newj2len = new Map<number, number>();
      for (const j of b2j.get(a[i]) ?? []) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (j2len.get(j - 1) ?? 0) + 1;
        newj2len.set(j, k);
        if (k > bestsize) {
          besti = i - k + 1;
          bestj = j - k + 1;
          bestsize = k;
        }
      }
      j2len = newj2len;
    }
    while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) {
      besti--;
      bestj--;
      bestsize++;
    }
    while (besti + bestsize < ahi && bestj + bestsize < bhi && a[besti + bestsize] === b[bestj + bestsize]) {
      bestsize++;
    }
    return [besti, bestj, bestsize];
  };

  let matches = 0;
  const queue: Array<[number, number, number, number]> = [[0, la, 0, lb]];
  while (queue.length > 0) {
    const [alo, ahi, blo, bhi] = queue.pop()!;
    const [i, j, k] = findLongest(alo, ahi, blo, bhi);
    if (k) {
      matches += k;
      if (alo < i && blo < j) queue.push([alo, i, blo, j]);
      if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
    }
  }
  return (2.0 * matches) / (la + lb);
}

// ---------------------------------------------------------------------------
// Fire-and-forget tasks (asyncio.create_task equivalent). The Worker entry
// point awaits them before the request's waitUntil() promise settles.
// ---------------------------------------------------------------------------

const background = new Set<Promise<unknown>>();

export function trackBackground(p: Promise<unknown>): void {
  const t: Promise<unknown> = p
    .catch(() => undefined)
    .finally(() => {
      background.delete(t);
    });
  background.add(t);
}

export async function flushBackground(): Promise<void> {
  while (background.size > 0) {
    await Promise.allSettled([...background]);
  }
}
