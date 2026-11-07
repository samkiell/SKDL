/**
 * /start, /status, /feedback, /privacy, and /terms command handlers.
 */

import type { Bot } from "grammy";

import { clearSession } from "../services/session";
import { MD } from "./common";

const WELCOME_MESSAGE = `🤖 **AI-POWERED CINEMATIC DISCOVERY // SKDL** 🍿

I'm your assistant for high-speed movie and series downloads. Just tell me what you want in plain English, or **drop an image** (screenshot/poster) and I'll find it for you!

**Direct Examples:**
• "I want to watch Avatar"
• "Download season 1 of Stranger Things"
• "Get me Inception in 1080p"

**Shortcuts:**
🎬 \`/movie [title]\` — Direct movie fetch
📺 \`/series [title] [season] [episode]\` — Direct episode fetch
📊 \`/status\` — Check bot health
💬 \`/feedback\` — Share your thoughts

**Legal:**
⚖️ \`/privacy\` — Privacy Policy
📜 \`/terms\` — Terms of Use

Built by **SAMKIEL**. Ready to find your next watch! 🎬`;

const STATUS_MESSAGE = `✅ **Bot Status: Online**

🤖 SKDL Bot is running and ready.
📡 All services operational.`;

const FEEDBACK_MESSAGE = `💬 **WE VALUE YOUR INPUT**

Help us improve SKDL by sharing your thoughts, bug reports, or suggestions.

🔗 Submit feedback: https://skdlm.vercel.app/feedback

Your input directly shapes the future of this bot. Thanks for being part of the journey!`;

const PRIVACY_MESSAGE = `⚖️ **PRIVACY POLICY**

Your privacy is important to us. Read our full policy here:
🔗 https://skdlm.vercel.app/privacy`;

const TERMS_MESSAGE = `📜 **TERMS OF USE**

By using SKDL, you agree to our terms. Read them here:
🔗 https://skdlm.vercel.app/terms`;

export function register(bot: Bot): void {
  bot.command("start", async (ctx) => {
    // Handle /start — welcome message + clear session
    try {
      if (ctx.from) await clearSession(ctx.from.id);
      await ctx.api.sendMessage(ctx.chat.id, WELCOME_MESSAGE, MD);
    } catch {
      await ctx.api.sendMessage(ctx.chat.id, "👋 Welcome! Send me a movie or series name to get started.");
    }
  });

  bot.command("status", async (ctx) => {
    try {
      await ctx.api.sendMessage(ctx.chat.id, STATUS_MESSAGE, MD);
    } catch {
      await ctx.api.sendMessage(ctx.chat.id, "✅ Bot is online and operational.");
    }
  });

  bot.command("feedback", async (ctx) => {
    try {
      await ctx.api.sendMessage(ctx.chat.id, FEEDBACK_MESSAGE, MD);
    } catch {
      await ctx.api.sendMessage(ctx.chat.id, "💬 Share your feedback: https://skdlm.vercel.app/feedback");
    }
  });

  bot.command("privacy", async (ctx) => {
    try {
      await ctx.api.sendMessage(ctx.chat.id, PRIVACY_MESSAGE, MD);
    } catch {
      await ctx.api.sendMessage(ctx.chat.id, "⚖️ Privacy Policy: https://skdlm.vercel.app/privacy");
    }
  });

  bot.command("terms", async (ctx) => {
    try {
      await ctx.api.sendMessage(ctx.chat.id, TERMS_MESSAGE, MD);
    } catch {
      await ctx.api.sendMessage(ctx.chat.id, "📜 Terms of Use: https://skdlm.vercel.app/terms");
    }
  });
}
