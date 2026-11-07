/**
 * Groq AI service — sends conversation history to Groq and returns a structured intent.
 * Calls the Groq OpenAI-compatible REST API directly with fetch.
 */

import { getSettings } from "../config";
import type { ChatMessage } from "./session";
import { errMsg, isRecord, pyOr, pyTruthy, type JsonObject } from "../util";

export type IntentKind = "download_movie" | "download_series" | "clarify" | "chat" | "help";

export interface Intent {
  intent: IntentKind;
  title: string | null;
  year: number | null;
  imdb_id?: string | null;
  season: number | null;
  episode: number | null;
  quality: string;
  clarify_message: string | null;
  chat_response: string | null;
  bulk: boolean;
  genre?: unknown;
  mood: unknown;
  source_hint: unknown;
  reference_title?: unknown;
  is_subtitle_request?: boolean;
  _quality_selected?: boolean;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are SKDL, a media-finding assistant in Telegram. You're the "homie" who always knows where to find the movie.
Talk like a real person texting: casual, sarcastic, and funny. Use lowercase, slang (bet, say no more, gotchu), and roasts.

## CRITICAL STYLE & TONE RULES
- NEVER use em dashes (—) or en dashes (–). Real people texting never use em dashes. Use standard commas, periods, or simple hyphens (-) instead.
- Sound casual and conversational. Avoid stiff, textbook, or overly formal grammar.

## YOUR CORE DIRECTIVE
- If the user is just saying "hi", "yo", "beans", or chatting casually, be a cool homie and reply naturally. Talk back!
- If the user asks for a MOVIE or SERIES, find it and return the title.
- ONLY refuse non-movie SERVICES (weather, music, math). For those, say: "bro I'm a movie fan, not a [service]. Go ask [Google/Siri] for that, I'm here for the cinema only  popcorn "

## IDENTITY
- Name: SKDL | Built by: SAMKIEL (https://samkiel.dev)
- Links: 
  - Feedback: skdlm.vercel.app/feedback
  - Privacy: skdlm.vercel.app/privacy
  - Terms: skdlm.vercel.app/terms

## CAPABILITIES
- You have VISION! You can identify movies from photos/posters. 

## ENGAGEMENT RULES
1. **FEEDBACK**: Do NOT suggest or mention the feedback link during regular movie searches or casual chat. ONLY share skdlm.vercel.app/feedback if the user explicitly asks how to give feedback, suggests an improvement, complains, or reports an issue.
2. **LEGAL**: If asked about privacy or terms, point them to skdlm.vercel.app/privacy or skdlm.vercel.app/terms.

## PERSISTENCE RULES
1. **TITLE PERSISTENCE**: If a title was mentioned before and the user says "yes", "do it", or "Season 2", keep that \`title\` in your JSON.

## RESPONSE FORMAT (JSON)
{
  "title": "canonical media title ONLY (e.g. 'Reacher', 'Beverly Hills Cop', 'Spider-Man: No Way Home' - strip actor names, 'by [actor]', download commands, etc.) | null",
  "is_series": false,
  "year": number | null,
  "imdb_id": "string | null",
  "season": number | null,
  "episode": number | null,
  "chat_response": "your personality-filled response here",
  "raw_intent": "brief summary of user intent"
}`;

const FALLBACK_INTENT: Intent = {
  intent: "chat",
  title: null,
  year: null,
  season: null,
  episode: null,
  quality: "1080p",
  clarify_message: null,
  chat_response: "yo, I didn't quite catch that. you tryna watch something specific or just vibing?",
  bulk: false,
  source_hint: null,
  mood: null,
};

interface GroqMessage {
  role: string;
  content: string | Array<Record<string, unknown>>;
}

async function createCompletion(model: string, messages: GroqMessage[]): Promise<string | null> {
  const resp = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSettings().GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 600,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Error code: ${resp.status} - ${text}`);
  }
  const data = JSON.parse(text) as { choices?: Array<{ message?: { content?: string | null } }> };
  const choice = data.choices?.[0];
  if (!choice) throw new Error("list index out of range");
  return choice.message?.content ?? null;
}

function getKey(obj: JsonObject, key: string, dflt: unknown): unknown {
  return key in obj ? obj[key] : dflt;
}

/** Send conversation history + latest user message to Groq. Returns a structured intent. */
export async function parseIntent(
  history: ChatMessage[],
  userMessage: string,
  imageBase64: string | null = null,
): Promise<Intent> {
  const messages: GroqMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  // Only include recent history (last 10 turns) to keep context manageable
  for (const msg of history.slice(-10)) {
    messages.push({ role: msg.role, content: msg.content });
  }

  let candidateModels: string[];
  if (imageBase64) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: userMessage || "What movie/show is in this image?" },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
      ],
    });
    candidateModels = ["qwen/qwen3.8-27b"];
  } else {
    messages.push({ role: "user", content: userMessage });
    candidateModels = [
      ...new Set([getSettings().GROQ_MODEL, "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]),
    ];
  }

  try {
    let raw: string | null = null;
    let got = false;
    let lastExc: unknown = null;
    for (const modelName of candidateModels) {
      try {
        raw = await createCompletion(modelName, messages);
        got = true;
        break;
      } catch (exc) {
        lastExc = exc;
        console.warn(`Groq model ${modelName} failed: ${errMsg(exc)}`);
        continue;
      }
    }

    if (!got) {
      if (lastExc) throw lastExc;
      return { ...FALLBACK_INTENT };
    }

    if (!raw) return { ...FALLBACK_INTENT };

    const parsedUnknown: unknown = JSON.parse(raw);
    if (!isRecord(parsedUnknown)) throw new TypeError("Groq response is not a JSON object");
    const parsed = parsedUnknown;

    let intentCategory: IntentKind = "chat";
    let clarifyMessage: string | null = null;

    let chatResponse: string;
    if (!pyTruthy(parsed.chat_response)) {
      chatResponse = "I'm here to help you download movies and series! Just tell me what you want to watch.";
    } else {
      if (typeof parsed.chat_response !== "string") throw new TypeError("chat_response must be a string");
      chatResponse = parsed.chat_response.replaceAll("\u2014", "-").replaceAll("\u2013", "-");
      // Only allow feedback link if user explicitly prompted for feedback, issues, or suggestions
      const userMsgLower = (userMessage || "").toLowerCase();
      if (!["feedback", "suggest", "bug", "report", "issue", "complain", "opinion"].some((k) => userMsgLower.includes(k))) {
        chatResponse = chatResponse
          .replace(/\s*(also,?\s*|yo,?\s*)?[^.!?\n]*skdlm\.vercel\.app\/feedback[^\n]*/gi, "")
          .trim();
      }
    }

    const needsClarification = getKey(parsed, "needs_clarification", false);
    const title = parsed.title ?? null;
    const isSeries = getKey(parsed, "is_series", false);

    if (pyTruthy(needsClarification) && pyTruthy(parsed.options)) {
      intentCategory = "clarify";
      const options = parsed.options as unknown[];
      const optsList: string[] = [];
      for (const opt of options) {
        if (!isRecord(opt)) throw new TypeError("option is not an object");
        const t = getKey(opt, "title", "Unknown");
        const y = getKey(opt, "year", "");
        const d = getKey(opt, "description", "");
        optsList.push(pyTruthy(y) ? `${t} (${y}) - ${d}` : `${t} - ${d}`);
      }
      const optsStr = optsList.join("\n• ");
      clarifyMessage = `Did you mean one of these?\n\n• ${optsStr}`;
    } else if (pyTruthy(title)) {
      intentCategory = pyTruthy(isSeries) ? "download_series" : "download_movie";
    }

    const rawIntent = pyOr<unknown>(parsed.raw_intent, "");
    if (!pyTruthy(title) && !pyTruthy(needsClarification) && String(rawIntent).toLowerCase().includes("help")) {
      intentCategory = "help";
    }

    return {
      intent: intentCategory,
      title: title as string | null,
      year: pyOr<unknown>(parsed.year, parsed.year_min, parsed.year_max ?? null) as number | null,
      imdb_id: (parsed.imdb_id ?? null) as string | null,
      season: (parsed.season ?? null) as number | null,
      episode: (parsed.episode ?? null) as number | null,
      quality: pyOr<unknown>(parsed.quality, "1080p") as string,
      clarify_message: clarifyMessage,
      chat_response: chatResponse,
      bulk: getKey(parsed, "bulk", false) as boolean,
      genre: parsed.genre ?? null,
      mood: parsed.mood ?? null,
      source_hint: parsed.source_hint ?? null,
      reference_title: parsed.reference_title ?? null,
      is_subtitle_request: getKey(parsed, "is_subtitle_request", false) as boolean,
    };
  } catch (exc) {
    console.error(`Groq processing failed: ${errMsg(exc)}`);
    if (errMsg(exc).includes("429") || errMsg(exc).toLowerCase().includes("rate_limit")) {
      return {
        ...FALLBACK_INTENT,
        chat_response:
          "phew, I'm a bit overwhelmed right now! my AI brain is taking a quick nap. " +
          "you can still request movies manually though! just type:\n\n" +
          "🎬 `/movie [title]`\n" +
          "📺 `/series [title] [season] [episode]`",
      };
    }
    return { ...FALLBACK_INTENT };
  }
}
