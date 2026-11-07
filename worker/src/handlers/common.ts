/** Shared helpers for handlers (aiogram `message.answer(...)` equivalents etc.). */

import { InputFile, type Api } from "grammy";

import { DOWNLOAD_REQUEST_HEADERS } from "../moviebox/constants";

export interface Chat {
  api: Api;
  id: number;
}

export const MD = { parse_mode: "Markdown" } as const;

/**
 * Telegram's cloud Bot API rejects uploads above 50 MB, and a Worker only has
 * 128 MB of memory, so direct file delivery is limited to this size.
 */
export const MAX_DIRECT_UPLOAD_BYTES = 50 * 1024 * 1024;

export async function fetchLimited(
  url: string,
  headers: Record<string, string>,
  limit: number,
): Promise<Uint8Array> {
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} while downloading ${url}`);

  const declared = Number(resp.headers.get("content-length") ?? 0);
  if (declared > limit) {
    await resp.body?.cancel();
    throw new Error(`File too large (${declared} bytes > ${limit})`);
  }
  if (!resp.body) throw new Error("Empty response body");

  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error(`File too large (> ${limit} bytes)`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/**
 * Direct file delivery (URLInputFile equivalent): download the CDN file with the
 * stealth headers inside the Worker, then upload it as a document.
 * Throws when the file cannot be delivered; callers log and still keep the link.
 */
export async function sendCdnDocument(
  chat: Chat,
  cdnUrl: string,
  fileName: string,
  caption: string,
  knownSize?: number | null,
): Promise<void> {
  if (knownSize && knownSize > MAX_DIRECT_UPLOAD_BYTES) {
    throw new Error(`File too large for direct delivery from a Worker (${knownSize} bytes)`);
  }
  const bytes = await fetchLimited(cdnUrl, DOWNLOAD_REQUEST_HEADERS, MAX_DIRECT_UPLOAD_BYTES);
  await chat.api.sendDocument(chat.id, new InputFile(bytes, fileName), { caption });
}

/** aiogram ChatActionSender.typing: keeps the "typing" action alive while `fn` runs. */
export async function withTyping<T>(chat: Chat, fn: () => Promise<T>): Promise<T> {
  const send = () => chat.api.sendChatAction(chat.id, "typing").catch(() => undefined);
  await send();
  const timer = setInterval(send, 5000);
  try {
    return await fn();
  } finally {
    clearInterval(timer);
  }
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}
