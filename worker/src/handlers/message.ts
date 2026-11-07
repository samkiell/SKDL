/**
 * Message handler — catches all non-command text and photos.
 * Routes through Groq AI for intent parsing, then dispatches accordingly.
 * This router MUST be registered last (catch-all).
 */

import { InputFile, type Bot, type Context } from "grammy";
import type { InlineKeyboardButton, User } from "grammy/types";

import { getSettings } from "../config";
import { parseIntent, type Intent } from "../services/groq";
import { buildUrl, generateId } from "../services/link";
import { logEvent } from "../services/logger";
import {
  getEpisode,
  getAvailableQualities,
  getMediaInfo,
  getMovie,
  getSeasonEpisodes,
  type EpisodeResult,
  type MovieResult,
} from "../services/moviebox";
import {
  addMessage,
  clearPendingRequest,
  getHistory,
  getPendingRequest,
  setPendingRequest,
} from "../services/session";
import { checkRateLimit, getRedis, saveCollection, saveMedia } from "../services/supabase";
import { chunk, errMsg, formatSize, fullName, pyInt, toInt } from "../util";
import { MD, fetchLimited, sendCdnDocument, toBase64, withTyping, type Chat } from "./common";

const HELP_TEXT = `🎬 **SKDL — Netflix and Chill with SKDL** 🍿

Just tell me what you want to watch in plain English!

**Examples:**
• "I want to watch The Dark Knight"
• "Download Stranger Things season 1 episode 3"
• "Get me Oppenheimer"

**Commands:**
/movie \`<title>\` — Direct movie download
/series \`<title>\` \`<season>\` \`<episode>\` — Direct episode download
/status — Check if bot is alive

I'll find it, generate a download link, and send it to you! 🍿`;

const MAX_POSTER_BYTES = 10 * 1024 * 1024;

/** Returns true if presented, false if skipped (no options/already chose). */
async function presentQualityOptions(chat: Chat, intent: Intent, userId: number): Promise<boolean> {
  if (intent._quality_selected) return false;

  const title = intent.title as string;
  const isSeries = intent.intent === "download_series";
  const season = intent.season;
  const episode = intent.episode;

  const data = await getAvailableQualities(title, isSeries, season, episode);
  const qualities = data.qualities ?? [];

  if (qualities.length === 0) return false;

  await setPendingRequest(userId, intent);

  const buttons: InlineKeyboardButton[] = qualities.slice(0, 5).map((q) => {
    const sizeLabel = formatSize(q.size);
    const btnText = sizeLabel ? `🎬 ${q.label} (${sizeLabel})` : `🎬 ${q.label}`;
    return { text: btnText, callback_data: `q:${q.label}` };
  });

  let displayTitle = data.title ?? title;
  if (isSeries && season != null && episode != null) {
    displayTitle += ` S${season}E${episode}`;
  }

  await chat.api.sendMessage(chat.id, `✅ Found **${displayTitle}**.\nChoose your quality 👇`, {
    reply_markup: { inline_keyboard: chunk(buttons, 1) },
    ...MD,
  });
  return true;
}

/** Appends "Did you mean" suggestions parsed from the error text, or the fallback hint. */
function appendSuggestions(msgText: string, exc: unknown, fallback: string): string {
  const text = errMsg(exc);
  if (text.includes("Did you mean:")) {
    const suggestions = text.split("Did you mean:")[1].trim().replace(/\?+$/, "");
    const opts = suggestions
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);
    if (opts.length) {
      msgText += `\n\nDid you mean:\n• ${opts.join("\n• ")}`;
    }
    return msgText;
  }
  return msgText + fallback;
}

/** Process a download_movie intent. */
async function handleDownloadMovie(
  chat: Chat,
  intent: Intent,
  userId: number,
  startTime: number,
  user: User,
): Promise<void> {
  const title = intent.title;
  if (!title) {
    await chat.api.sendMessage(chat.id, "🤔 I couldn't figure out the movie title. Could you be more specific?");
    return;
  }

  if (await presentQualityOptions(chat, intent, userId)) return;

  const quality = intent.quality || "1080p";

  try {
    const result: MovieResult = await getMovie(title, quality);

    const linkId = generateId();
    const linkUrl = buildUrl(linkId);

    // Fetch metadata for DB consistency
    const info = await getMediaInfo(result.title, false);

    await saveMedia({
      link_id: linkId,
      title: result.title,
      cdn_url: result.cdn_url,
      media_type: "movie",
      quality: result.quality,
      requested_by: userId,
      subject_id: result.subject_id,
      poster_url: info.poster_url,
      description: info.description,
      size: result.size,
    });

    const elapsedMs = Math.trunc(performance.now() - startTime);
    logEvent({
      user_id: userId,
      username: user.username,
      display_name: fullName(user),
      action: "download_movie",
      query: intent.title,
      result_title: result.title,
      result_found: true,
      duration_ms: elapsedMs,
    });

    const sizeStr = formatSize(result.size);
    const qualityLine = sizeStr ? `${result.quality} • ${sizeStr}` : result.quality;
    const reply =
      `🎬 **${result.title} (${result.year})**\n` +
      `Quality: ${qualityLine}\n\n` +
      `📥 ${linkUrl}\n` +
      `⏳ Link expires in 6 hours`;

    await chat.api.sendMessage(chat.id, reply, MD);

    // Attempt direct file delivery
    try {
      const fileName = `${result.title} (${result.year}) ${result.quality} - SKDL(skdlm.vercel.app).mp4`;
      await sendCdnDocument(chat, result.cdn_url, fileName, `🎬 ${result.title}`, result.size);
    } catch (e) {
      console.warn(`Direct file delivery failed for '${result.title}': ${errMsg(e)}`);
    }

    await addMessage(
      userId,
      "assistant",
      `I just successfully generated a download link and sent the movie: ${result.title} (${result.year}) in ${result.quality}.`,
    );
    await clearPendingRequest(userId);
  } catch (exc) {
    console.error(`Movie download failed: ${errMsg(exc)}`);
    const elapsedMs = Math.trunc(performance.now() - startTime);

    const isNotFound = errMsg(exc).includes("No results found") || errMsg(exc).includes("Could not resolve");

    logEvent({
      user_id: userId,
      username: user.username,
      display_name: fullName(user),
      action: isNotFound ? "not_found" : "error",
      query: intent.title,
      result_found: false,
      error_message: isNotFound ? null : errMsg(exc),
      duration_ms: elapsedMs,
    });

    const msgText = appendSuggestions(
      `❌ Couldn't find **${intent.title}** in the catalog.`,
      exc,
      " Try checking the spelling or requesting another title.",
    );
    await chat.api.sendMessage(chat.id, msgText, MD);
  }
}

/** Process a download_series intent. */
async function handleDownloadSeries(
  chat: Chat,
  intent: Intent,
  userId: number,
  startTime: number,
  user: User,
): Promise<void> {
  const title = intent.title;
  const season = intent.season;
  const episode = intent.episode;

  if (!title) {
    await chat.api.sendMessage(chat.id, "🤔 I couldn't figure out the series title. Could you be more specific?");
    return;
  }

  if (intent.bulk && season != null) {
    await handleBulkSeries(chat, intent, userId, startTime, user);
    return;
  }

  if (season == null || episode == null) {
    // Fetch show info to make it dynamic
    const info = await getMediaInfo(title, true);
    if (!info.subject_id) {
      const suggestions = info.suggestions ?? [];
      if (suggestions.length) {
        const suggText = "\n• " + suggestions.join("\n• ");
        await chat.api.sendMessage(
          chat.id,
          `😕 couldn't find **${title}** in the series catalog.\n\nDid you mean one of these?${suggText}`,
          MD,
        );
      } else {
        await chat.api.sendMessage(
          chat.id,
          `😕 couldn't find '${title}' on my end. try the exact title or another spelling.`,
        );
      }
      await clearPendingRequest(userId);
      return;
    }

    const buttons: InlineKeyboardButton[] = [];
    let perRow: number;
    let prompt: string;

    if (season != null && episode == null) {
      // Dynamic episode probing
      const episodes = await getSeasonEpisodes(title, season, "360p");
      for (const ep of episodes.slice(0, 24)) {
        buttons.push({ text: `Ep ${ep.episode}`, callback_data: `ep:${ep.episode}` });
      }

      if (episodes.length) {
        buttons.push({ text: "📂 Whole Season", callback_data: "ep:bulk" });
        prompt = `Which episode of **${info.title} Season ${season}** are we watching?`;
      } else {
        prompt = `I'm struggling to pull the list for **Season ${season}** right now. Just drop the episode number (e.g., 6) and I'm on it! 👇`;
      }
      perRow = 4;
    } else {
      // Season selection
      for (let i = 1; i < 10; i++) {
        // Most shows have < 10 seasons
        buttons.push({ text: `Season ${i}`, callback_data: `se:${i}` });
      }
      perRow = 3;
      prompt = "Which season are we aiming for?";
    }

    const caption =
      `📺 **${info.title}** (${info.year})\n` +
      `Genre: ${info.genre ?? "Unknown"}\n\n` +
      `${(info.description ?? "").slice(0, 200)}...\n\n` +
      `👇 ${prompt}`;

    await setPendingRequest(userId, intent);

    const replyMarkup = { inline_keyboard: chunk(buttons, perRow) };
    if (info.poster_url) {
      const poster = await fetchLimited(String(info.poster_url), {}, MAX_POSTER_BYTES);
      await chat.api.sendPhoto(chat.id, new InputFile(poster, "poster.jpg"), {
        caption,
        reply_markup: replyMarkup,
        ...MD,
      });
    } else {
      await chat.api.sendMessage(chat.id, caption, { reply_markup: replyMarkup, ...MD });
    }
    return;
  }

  if (await presentQualityOptions(chat, intent, userId)) return;

  const quality = intent.quality || "1080p";

  try {
    const fetched = await getEpisode(title, toInt(season), toInt(episode), quality);
    if (!("season" in fetched)) throw new Error("'season'"); // movie fallback has no season/episode
    const result = fetched as EpisodeResult;

    const linkId = generateId();
    const linkUrl = buildUrl(linkId);

    // Fetch metadata for DB consistency
    const info = await getMediaInfo(result.title, true);

    await saveMedia({
      link_id: linkId,
      title: result.title,
      cdn_url: result.cdn_url,
      media_type: "series",
      quality: result.quality,
      season: result.season,
      episode: result.episode,
      requested_by: userId,
      subject_id: result.subject_id,
      poster_url: info.poster_url,
      description: info.description,
      size: result.size,
    });

    const elapsedMs = Math.trunc(performance.now() - startTime);
    logEvent({
      user_id: userId,
      username: user.username,
      display_name: fullName(user),
      action: "download_series",
      query: `${intent.title} S${season}E${episode}`,
      result_title: result.title,
      result_found: true,
      duration_ms: elapsedMs,
    });

    const sizeStr = formatSize(result.size);
    const qualityLine = sizeStr ? `${result.quality} • ${sizeStr}` : result.quality;
    const reply =
      `📺 **${result.title} S${result.season}E${result.episode}**\n` +
      `Quality: ${qualityLine}\n\n` +
      `📥 ${linkUrl}\n` +
      `⏳ Link expires in 6 hours`;

    await chat.api.sendMessage(chat.id, reply, MD);

    // Attempt direct file delivery
    try {
      const fileName = `${result.title} S${result.season}E${result.episode} ${result.quality} - SKDL(skdlm.vercel.app).mp4`;
      await sendCdnDocument(
        chat,
        result.cdn_url,
        fileName,
        `📺 ${result.title} S${result.season}E${result.episode}`,
        result.size,
      );
    } catch (e) {
      console.warn(`Direct file delivery failed for series '${result.title}': ${errMsg(e)}`);
    }

    await addMessage(
      userId,
      "assistant",
      `I just successfully generated a download link and sent the series episode: ${result.title} Season ${result.season} Episode ${result.episode} in ${result.quality}.`,
    );
    await clearPendingRequest(userId);
  } catch (exc) {
    console.error(`Series download failed: ${errMsg(exc)}`);
    const elapsedMs = Math.trunc(performance.now() - startTime);
    const text = errMsg(exc);
    const isNotFound =
      text.includes("No series results found") || text.includes("No results found") || text.includes("Could not resolve");

    logEvent({
      user_id: userId,
      username: user.username,
      display_name: fullName(user),
      action: isNotFound ? "not_found" : "error",
      query: `${intent.title} S${season}E${episode}`,
      result_found: false,
      error_message: isNotFound ? null : text,
      duration_ms: elapsedMs,
    });

    const msgText = appendSuggestions(
      `❌ Couldn't find **${intent.title}** S${season}E${episode}.`,
      exc,
      " Check the title and episode number.",
    );
    await chat.api.sendMessage(chat.id, msgText, MD);
  }
}

/** Process a bulk series download (entire season). */
async function handleBulkSeries(
  chat: Chat,
  intent: Intent,
  userId: number,
  startTime: number,
  user: User,
): Promise<void> {
  const title = intent.title as string;
  const season = intent.season as number;
  const quality = intent.quality || "1080p";

  await chat.api.sendMessage(
    chat.id,
    `🌪️ Gathering all of **${title}** Season ${season} at ${quality} quality...\n` +
      `I'll have the whole pack ready for you in a few seconds. 🍿`,
    MD,
  );

  try {
    const episodes = await getSeasonEpisodes(title, season, quality);

    if (episodes.length === 0) {
      await chat.api.sendMessage(chat.id, `❌ Couldn't find any episodes for Season ${season} of **${title}**.`);
      return;
    }

    const mediaIds: string[] = [];
    for (const ep of episodes) {
      const linkId = generateId();
      await saveMedia({
        link_id: linkId,
        title: ep.title,
        cdn_url: ep.cdn_url,
        media_type: "series",
        quality: ep.quality,
        season: ep.season,
        episode: ep.episode,
        requested_by: userId,
        subject_id: ep.subject_id,
        size: ep.size,
      });
      mediaIds.push(linkId);
    }

    const collectionId = generateId();
    await saveCollection({
      collection_id: collectionId,
      title: episodes[0].title,
      season,
      media_ids: mediaIds,
      requested_by: userId,
    });

    const collectionUrl = `${getSettings().WEB_PROXY_BASE_URL}/collection/${collectionId}`;

    const reply =
      `✅ **Season Complete!**\n\n` +
      `📺 **${episodes[0].title} — Season ${season}**\n` +
      `📦 Total: ${episodes.length} episodes\n\n` +
      `📥 ${collectionUrl}\n` +
      `⏳ Link expires in 6 hours`;

    await chat.api.sendMessage(chat.id, reply, MD);
    await addMessage(
      userId,
      "assistant",
      `I just successfully generated a bulk download collection for ${episodes[0].title} Season ${season}.`,
    );

    const elapsedMs = Math.trunc(performance.now() - startTime);
    logEvent({
      user_id: userId,
      username: user.username,
      display_name: fullName(user),
      action: "download_series",
      query: `${intent.title} Season ${season} (Bulk)`,
      result_title: episodes[0].title,
      result_found: true,
      duration_ms: elapsedMs,
    });
  } catch (exc) {
    console.error(`Bulk series download failed for '${title}': ${errMsg(exc)}`);
    const elapsedMs = Math.trunc(performance.now() - startTime);

    logEvent({
      user_id: userId,
      username: user.username,
      display_name: fullName(user),
      action: "error",
      query: `${intent.title} Season ${season} (Bulk)`,
      result_found: false,
      error_message: errMsg(exc),
      duration_ms: elapsedMs,
    });

    await chat.api.sendMessage(
      chat.id,
      `❌ Something went wrong while fetching the whole season. Try requesting a single episode or check back later.`,
      MD,
    );
    await clearPendingRequest(userId);
  }
}

// Request deduplication to prevent double-processing (Telegram retries).
// Shared across isolates via Redis: SET NX with a 30 second expiry.
async function isDuplicate(msgId: string): Promise<boolean> {
  try {
    const res = await getRedis().set(`skdl:dedup:${msgId}`, "1", { nx: true, ex: 30 });
    return res === null;
  } catch {
    return false;
  }
}

/** Catch-all message handler — routes through Groq AI for both text and images. */
async function handleMessage(ctx: Context): Promise<void> {
  const message = ctx.message;
  if (!message || !message.from) return;
  const user = message.from;
  const userId = user.id;
  const chat: Chat = { api: ctx.api, id: message.chat.id };
  const msgId = `${message.chat.id}:${message.message_id}`;

  // 1. Deduplication Check
  if (await isDuplicate(msgId)) return;

  const startTime = performance.now();
  if (!message.text && !message.photo && !message.caption) return;

  const userText = (message.text || message.caption || "What movie or series is in this image?").trim();

  let imageBase64: string | null = null;

  if (message.photo) {
    const highestResPhoto = message.photo[message.photo.length - 1];
    try {
      imageBase64 = await withTyping(chat, async () => {
        const fileInfo = await ctx.api.getFile(highestResPhoto.file_id);
        const url = `https://api.telegram.org/file/bot${getSettings().TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
        const bytes = await fetchLimited(url, {}, 20 * 1024 * 1024);
        return toBase64(bytes);
      });
    } catch (e) {
      console.error(`Failed to process image: ${errMsg(e)}`);
      await ctx.api.sendMessage(chat.id, "⚠️ I'm blanking on this image. Drop the title if you can!");
      return;
    }
  }

  await addMessage(userId, "user", message.photo ? "[Sent an Image]" : userText);

  const history = await getHistory(userId);
  const intent = await parseIntent(history, userText, imageBase64);

  if (intent.intent === "download_movie" || intent.intent === "download_series") {
    const username = (user.username || "").toLowerCase();
    if (!["samkiell", "samkiel488"].includes(username) && !(await checkRateLimit(userId))) {
      await ctx.api.sendMessage(chat.id, "⚠️ whoa there big watcher, you've hit your daily limit of 10 requests.");
      return;
    }
  }

  const chatReply = intent.chat_response;
  if (chatReply) {
    await ctx.api.sendMessage(chat.id, chatReply);
    await addMessage(userId, "assistant", chatReply);
  }

  switch (intent.intent) {
    case "download_movie":
      await handleDownloadMovie(chat, intent, userId, startTime, user);
      break;
    case "download_series":
      await handleDownloadSeries(chat, intent, userId, startTime, user);
      break;
    case "clarify": {
      const clarifyMsg = intent.clarify_message || "Could you give me more details?";
      await ctx.api.sendMessage(chat.id, `🤔 ${clarifyMsg}`);
      break;
    }
    case "help":
      await ctx.api.sendMessage(chat.id, HELP_TEXT, MD);
      break;
    case "chat":
      if (!chatReply) {
        await ctx.api.sendMessage(chat.id, "I'm here to help you watch stuff! What's on your mind?");
      }
      break;
  }
}

export function register(bot: Bot): void {
  bot.on(["message:text", "message:photo"], handleMessage);

  bot.callbackQuery(/^se:/, async (ctx) => {
    const userId = ctx.from.id;
    const val = pyInt(ctx.callbackQuery.data.split(":")[1]);
    if (val === null) throw new Error("invalid season callback");
    const intent = await getPendingRequest(userId);
    if (!intent) {
      await ctx.answerCallbackQuery({ text: "Session expired.", show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery();
    const msg = ctx.callbackQuery.message;
    if (!msg) return;
    const chat: Chat = { api: ctx.api, id: msg.chat.id };
    await ctx.api.deleteMessage(chat.id, msg.message_id);
    intent.season = val;
    await clearPendingRequest(userId);
    await handleDownloadSeries(chat, intent, userId, performance.now(), ctx.from);
  });

  bot.callbackQuery(/^q:/, async (ctx) => {
    const userId = ctx.from.id;
    const qualityLabel = ctx.callbackQuery.data.split(":").slice(1).join(":");
    const intent = await getPendingRequest(userId);
    if (!intent) {
      await ctx.answerCallbackQuery({ text: "Session expired.", show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery();
    const msg = ctx.callbackQuery.message;
    if (!msg) return;
    const chat: Chat = { api: ctx.api, id: msg.chat.id };
    await ctx.api.deleteMessage(chat.id, msg.message_id);
    intent.quality = qualityLabel;
    intent._quality_selected = true;
    await clearPendingRequest(userId);
    if (intent.intent === "download_movie") {
      await handleDownloadMovie(chat, intent, userId, performance.now(), ctx.from);
    } else {
      await handleDownloadSeries(chat, intent, userId, performance.now(), ctx.from);
    }
  });

  bot.callbackQuery(/^ep:/, async (ctx) => {
    const userId = ctx.from.id;
    const val = ctx.callbackQuery.data.split(":")[1];
    const intent = await getPendingRequest(userId);
    if (!intent) {
      await ctx.answerCallbackQuery({ text: "Session expired.", show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery();
    const msg = ctx.callbackQuery.message;
    if (!msg) return;
    const chat: Chat = { api: ctx.api, id: msg.chat.id };
    await ctx.api.deleteMessage(chat.id, msg.message_id);
    if (val === "bulk") {
      intent.bulk = true;
    } else {
      const ep = pyInt(val);
      if (ep === null) throw new Error("invalid episode callback");
      intent.episode = ep;
    }
    await clearPendingRequest(userId);
    await handleDownloadSeries(chat, intent, userId, performance.now(), ctx.from);
  });
}

