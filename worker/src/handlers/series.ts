/**
 * /series <title> <season> <episode> command handler — direct series episode download,
 * plus the interactive season/episode flow (aiogram FSM equivalent).
 */

import type { Bot } from "grammy";
import type { User } from "grammy/types";

import { getEpisode, type EpisodeResult, type MovieResult } from "../services/moviebox";
import { buildUrl, generateId } from "../services/link";
import { logEvent } from "../services/logger";
import { clearFsm, getFsm, setFsm } from "../services/session";
import { saveMedia } from "../services/supabase";
import { errMsg, formatSize, fullName, pyInt, splitWs } from "../util";
import { MD, sendCdnDocument, type Chat } from "./common";

const NUMBER_KEYBOARD = {
  keyboard: [
    [{ text: "1" }, { text: "2" }, { text: "3" }],
    [{ text: "4" }, { text: "5" }, { text: "6" }],
  ],
  resize_keyboard: true,
  one_time_keyboard: true,
};

/** Helper to handle the actual search and delivery logic. */
async function processSeriesDelivery(
  chat: Chat,
  user: User,
  title: string,
  season: number,
  episode: number,
): Promise<void> {
  const startTime = performance.now();
  const statusMsg = await chat.api.sendMessage(chat.id, `🔍 Searching for **${title}** S${season}E${episode}...`, {
    ...MD,
    reply_markup: { remove_keyboard: true },
  });

  try {
    const fetched = await getEpisode(title, season, episode);
    if (!("season" in fetched)) throw new Error("'season'"); // movie fallback has no season/episode
    const result: EpisodeResult = fetched as Exclude<typeof fetched, MovieResult>;

    const linkId = generateId();
    const linkUrl = buildUrl(linkId);

    await saveMedia({
      link_id: linkId,
      title: result.title,
      cdn_url: result.cdn_url,
      media_type: "series",
      quality: result.quality,
      season: result.season,
      episode: result.episode,
      requested_by: user.id,
      subject_id: result.subject_id,
      imdb_id: result.imdb_id,
      poster_url: result.poster_url,
      description: result.description,
      size: result.size,
    });

    const elapsedMs = Math.trunc(performance.now() - startTime);
    logEvent({
      user_id: user.id,
      username: user.username,
      display_name: fullName(user),
      action: "download_series",
      query: `${title} S${season}E${episode}`,
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

    // Build subtitle button
    await chat.api.editMessageText(chat.id, statusMsg.message_id, reply, {
      ...MD,
      reply_markup: {
        inline_keyboard: [[{ text: "📥 Download Subtitles", callback_data: `sb:${linkId}` }]],
      },
    });

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
      console.warn(`Direct file delivery failed: ${errMsg(e)}`);
    }
  } catch (exc) {
    console.error(`Series search failed for '${title}' S${season}E${episode}: ${errMsg(exc)}`);
    const elapsedMs = Math.trunc(performance.now() - startTime);

    const isNotFound = errMsg(exc).includes("No results found") || errMsg(exc).includes("Could not resolve");

    logEvent({
      user_id: user.id,
      username: user.username,
      display_name: fullName(user),
      action: isNotFound ? "not_found" : "error",
      query: `${title} S${season}E${episode}`,
      result_found: false,
      error_message: isNotFound ? null : errMsg(exc),
      duration_ms: elapsedMs,
    });

    await chat.api.editMessageText(
      chat.id,
      statusMsg.message_id,
      `❌ Couldn't find **${title}** S${season}E${episode}. Check the details and try again.`,
      MD,
    );
  }
}

export function register(bot: Bot): void {
  // Handle /series — starts interactive flow or processes one-shot command
  bot.command("series", async (ctx) => {
    const message = ctx.message;
    if (!message || !message.from) return;
    const user = message.from;
    const chat: Chat = { api: ctx.api, id: message.chat.id };
    const args = splitWs((message.text ?? "").trim());

    // One-shot case: /series Title 2 3
    if (args.length >= 4) {
      const episode = pyInt(args[args.length - 1]);
      const season = pyInt(args[args.length - 2]);
      if (episode !== null && season !== null) {
        const title = args.slice(1, -2).join(" ");
        await processSeriesDelivery(chat, user, title, season, episode);
        return;
      }
      // Fallback to interactive if parse fails
    }

    // Interactive flow
    const title = args.slice(1).join(" ");
    if (!title) {
      await ctx.api.sendMessage(chat.id, "🍿 Which series are we watching? (e.g. `/series Fleabag`)", MD);
      return;
    }

    await setFsm(chat.id, user.id, { state: "waiting_for_season", data: { title } });

    await ctx.api.sendMessage(chat.id, `🎬 **${title}**! Love it.\nWhich season are we aiming for? (Type a number)`, {
      reply_markup: NUMBER_KEYBOARD,
      ...MD,
    });
  });

  // FSM message handlers: SeriesStates.waiting_for_season / waiting_for_episode
  bot.on("message", async (ctx, next) => {
    const message = ctx.message;
    const user = message.from;
    if (!user) return next();
    const chat: Chat = { api: ctx.api, id: message.chat.id };
    const fsm = await getFsm(chat.id, user.id);

    if (fsm.state === "waiting_for_season") {
      // Capture season and ask for episode
      const season = pyInt(message.text);
      if (season === null) {
        await ctx.api.sendMessage(chat.id, "⚠️ Oops! Send me a number for the season.");
        return;
      }
      await setFsm(chat.id, user.id, { state: "waiting_for_episode", data: { ...fsm.data, season } });
      await ctx.api.sendMessage(chat.id, `⚡️ Nice. Season ${season} it is!\nAnd which episode are we diving into?`, {
        reply_markup: NUMBER_KEYBOARD,
      });
      return;
    }

    if (fsm.state === "waiting_for_episode") {
      // Capture episode and start delivery
      const episode = pyInt(message.text);
      if (episode === null) {
        await ctx.api.sendMessage(chat.id, "⚠️ Oops! Send me a number for the episode.");
        return;
      }
      const title = fsm.data.title as string;
      const season = fsm.data.season as number;

      await clearFsm(chat.id, user.id);
      await processSeriesDelivery(chat, user, title, season, episode);
      return;
    }

    return next();
  });
}
