/**
 * subtitle.ts — /sub command and callback handler for subtitle downloads.
 */

import { InputFile, type Bot } from "grammy";

import { downloadSubtitle, findBestMatch, searchSubtitles } from "../services/opensubtitles";
import { getMediaById } from "../services/supabase";
import { errMsg, splitMax1 } from "../util";
import { MD, fetchLimited, type Chat } from "./common";

const MAX_SUBTITLE_BYTES = 10 * 1024 * 1024;

/** Internal helper to search and send subs. */
async function cmdSubSearch(chat: Chat, query: string): Promise<void> {
  const status = await chat.api.sendMessage(chat.id, `🔍 Searching subtitles for **${query}**...`, MD);
  try {
    const osSubs = await searchSubtitles({ query });
    const best = findBestMatch(osSubs);
    if (best) {
      const attrs = best.attributes as { files: Array<{ file_id: number }> };
      const fileId = attrs.files[0].file_id;
      const downloadRes = await downloadSubtitle(fileId);
      if (downloadRes && downloadRes.link) {
        const fileName = `${query} - SKDL(skdlm.vercel.app).srt`;
        const bytes = await fetchLimited(String(downloadRes.link), {}, MAX_SUBTITLE_BYTES);
        await chat.api.sendDocument(chat.id, new InputFile(bytes, fileName), {
          caption: `📥 Subtitles for **${query}**`,
        });
        await chat.api.deleteMessage(chat.id, status.message_id);
        return;
      }
    }
    await chat.api.editMessageText(chat.id, status.message_id, `❌ No English subtitles found for **${query}**.`);
  } catch (e) {
    console.error(`Subtitle search failed: ${errMsg(e)}`);
    await chat.api.editMessageText(chat.id, status.message_id, "❌ Subtitle search failed.");
  }
}

export function register(bot: Bot): void {
  // Handle /sub <title> manual command
  bot.command("sub", async (ctx) => {
    const message = ctx.message;
    if (!message) return;
    const chat: Chat = { api: ctx.api, id: message.chat.id };
    const args = splitMax1(message.text ?? "");
    if (args.length < 2) {
      await ctx.api.sendMessage(chat.id, "⚠️ Usage: `/sub Avatar 2022`", MD);
      return;
    }
    await cmdSubSearch(chat, args[1]);
  });

  // Process subtitle download request via link_id
  bot.callbackQuery(/^sb:/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "🔍 Searching..." });
    try {
      const parts = ctx.callbackQuery.data.split(":");
      const targetId = parts[1]; // New format: sb:{link_id}
      const msg = ctx.callbackQuery.message;
      if (!msg) return;
      const chat: Chat = { api: ctx.api, id: msg.chat.id };

      const media = await getMediaById(targetId);
      if (!media) {
        await ctx.api.sendMessage(chat.id, "❌ This link has expired.");
        return;
      }

      await cmdSubSearch(chat, `${media.title} ${media.quality ?? ""}`);
    } catch (exc) {
      console.error(`Subtitle callback failed: ${errMsg(exc)}`);
    }
  });
}
