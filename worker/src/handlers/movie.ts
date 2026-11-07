/**
 * /movie <title> command handler — direct movie download.
 */

import type { Bot } from "grammy";

import { getMovie } from "../services/moviebox";
import { buildUrl, generateId } from "../services/link";
import { logEvent } from "../services/logger";
import { clearSession } from "../services/session";
import { saveMedia } from "../services/supabase";
import { errMsg, formatSize, fullName, splitMax1 } from "../util";
import { MD, sendCdnDocument, type Chat } from "./common";

export function register(bot: Bot): void {
  bot.command("movie", async (ctx) => {
    // Handle /movie <title> — direct movie search and download
    const startTime = performance.now();
    const message = ctx.message;
    if (!message || !message.from) return;
    const user = message.from;
    const chat: Chat = { api: ctx.api, id: message.chat.id };

    const args = splitMax1((message.text ?? "").trim());

    if (args.length < 2 || !args[1].trim()) {
      await ctx.api.sendMessage(chat.id, "⚠️ Please provide a movie title.\nUsage: `/movie Avatar`", MD);
      return;
    }

    const title = args[1].trim();
    const statusMsg = await ctx.api.sendMessage(chat.id, `🔍 Searching for **${title}**...`, MD);

    try {
      const result = await getMovie(title);

      const linkId = generateId();
      const linkUrl = buildUrl(linkId);

      await saveMedia({
        link_id: linkId,
        title: result.title,
        cdn_url: result.cdn_url,
        media_type: "movie",
        quality: result.quality,
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
        action: "download_movie",
        query: title,
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

      await ctx.api.editMessageText(chat.id, statusMsg.message_id, reply, {
        ...MD,
        reply_markup: {
          inline_keyboard: [[{ text: "📥 Download Subtitles", callback_data: `sb:${linkId}` }]],
        },
      });

      // Attempt direct file delivery
      try {
        const fileName = `${result.title} (${result.year}) ${result.quality} - SKDL(skdlm.vercel.app).mp4`;
        await sendCdnDocument(chat, result.cdn_url, fileName, `🎬 ${result.title}`, result.size);
      } catch (e) {
        console.warn(`Direct file delivery failed for '/movie ${title}': ${errMsg(e)}`);
      }

      await clearSession(user.id);
    } catch (exc) {
      console.error(`/movie command failed for '${title}': ${errMsg(exc)}`);
      const elapsedMs = Math.trunc(performance.now() - startTime);

      const isNotFound = errMsg(exc).includes("No results found") || errMsg(exc).includes("Could not resolve");

      logEvent({
        user_id: user.id,
        username: user.username,
        display_name: fullName(user),
        action: isNotFound ? "not_found" : "error",
        query: title,
        result_found: false,
        error_message: isNotFound ? null : errMsg(exc),
        duration_ms: elapsedMs,
      });

      await ctx.api.editMessageText(
        chat.id,
        statusMsg.message_id,
        `❌ Couldn't find **${title}**. Check the spelling and try again.`,
        MD,
      );
    }
  });
}
