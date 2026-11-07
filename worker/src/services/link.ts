/**
 * Link service — generates short IDs and builds redirect URLs.
 */

import { getSettings } from "../config";

// Simplified lowercase alphabet for case-insensitive DBs
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const ID_LENGTH = 8;

/** Generate a short, URL-safe id (nanoid-style, unbiased rejection sampling). */
export function generateId(): string {
  let id = "";
  const mask = 63; // smallest 2^n - 1 >= alphabet length - 1
  while (id.length < ID_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH * 2));
    for (const b of bytes) {
      const idx = b & mask;
      if (idx < ALPHABET.length) {
        id += ALPHABET[idx];
        if (id.length === ID_LENGTH) break;
      }
    }
  }
  return id;
}

/** Build a full redirect URL from a link ID. */
export function buildUrl(linkId: string): string {
  const base = getSettings().LINK_BASE_URL.replace(/\/+$/, "");
  return `${base}/${linkId}`;
}
