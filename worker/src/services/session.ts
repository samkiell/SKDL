/**
 * Session management — per-user conversation history, pending requests and
 * the /series FSM state, keyed by Telegram user_id.
 *
 * The Python bot kept these in process memory. Worker isolates are ephemeral,
 * so the same data is persisted in Redis (with a TTL) instead.
 * Cleared after successful download or /start.
 */

import type { Intent } from "./groq";
import { getRedis } from "./supabase";
import { errMsg } from "../util";

export interface ChatMessage {
  role: string;
  content: string;
}

export interface FsmState {
  state: "waiting_for_season" | "waiting_for_episode" | null;
  data: { title?: string; season?: number };
}

export const MAX_HISTORY = 10;
const TTL_SECONDS = 24 * 3600;

const sessionKey = (uid: number) => `skdl:session:${uid}`;
const pendingKey = (uid: number) => `skdl:pending:${uid}`;
const fsmKey = (chatId: number, uid: number) => `skdl:fsm:${chatId}:${uid}`;

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await getRedis().get<string>(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (exc) {
    console.error(`Session read failed for ${key}: ${errMsg(exc)}`);
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await getRedis().set(key, JSON.stringify(value), { ex: TTL_SECONDS });
  } catch (exc) {
    console.error(`Session write failed for ${key}: ${errMsg(exc)}`);
  }
}

async function del(...keys: string[]): Promise<void> {
  try {
    await getRedis().del(...keys);
  } catch (exc) {
    console.error(`Session delete failed for ${keys.join(",")}: ${errMsg(exc)}`);
  }
}

export async function addMessage(userId: number, role: string, content: string): Promise<void> {
  const history = (await readJson<ChatMessage[]>(sessionKey(userId))) ?? [];
  history.push({ role, content });
  await writeJson(sessionKey(userId), history.length > MAX_HISTORY ? history.slice(-MAX_HISTORY) : history);
}

export async function getHistory(userId: number): Promise<ChatMessage[]> {
  return (await readJson<ChatMessage[]>(sessionKey(userId))) ?? [];
}

/** Clear session for a user (after download or /start). */
export async function clearSession(userId: number): Promise<void> {
  await del(sessionKey(userId), pendingKey(userId));
}

/** Store the parsed intent while waiting for inline quality selection. */
export async function setPendingRequest(userId: number, intent: Intent): Promise<void> {
  await writeJson(pendingKey(userId), intent);
}

export async function getPendingRequest(userId: number): Promise<Intent | null> {
  return readJson<Intent>(pendingKey(userId));
}

export async function clearPendingRequest(userId: number): Promise<void> {
  await del(pendingKey(userId));
}

// --- /series FSM (aiogram FSMContext equivalent, keyed per chat+user) ---

export async function getFsm(chatId: number, userId: number): Promise<FsmState> {
  return (await readJson<FsmState>(fsmKey(chatId, userId))) ?? { state: null, data: {} };
}

export async function setFsm(chatId: number, userId: number, fsm: FsmState): Promise<void> {
  await writeJson(fsmKey(chatId, userId), fsm);
}

export async function clearFsm(chatId: number, userId: number): Promise<void> {
  await del(fsmKey(chatId, userId));
}
